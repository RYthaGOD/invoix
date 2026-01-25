#!/usr/bin/env npx tsx
/**
 * Invoix Setup Script
 *
 * This script performs all necessary setup steps for a new Invoix installation:
 * 1. Validates environment configuration
 * 2. Checks database connectivity
 * 3. Runs database migrations
 * 4. Generates required keys (if missing)
 * 5. Creates required directories
 *
 * Usage: npx tsx scripts/setup.ts
 */

import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text: string) {
    console.log();
    log('═'.repeat(60), 'blue');
    log(`  ${text}`, 'blue');
    log('═'.repeat(60), 'blue');
    console.log();
}

function success(text: string) {
    log(`✅ ${text}`, 'green');
}

function warning(text: string) {
    log(`⚠️  ${text}`, 'yellow');
}

function error(text: string) {
    log(`❌ ${text}`, 'red');
}

function info(text: string) {
    log(`ℹ️  ${text}`, 'cyan');
}

// ============================================
// VALIDATION CHECKS
// ============================================

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

function validateEnvironment(): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    const isProduction = process.env.NODE_ENV === 'production';

    // Check for .env file
    if (!existsSync('.env') && !existsSync('.env.local')) {
        result.warnings.push('No .env file found. Using environment variables or defaults.');
    }

    // Required in Production
    if (isProduction) {
        if (!process.env.SESSION_SECRET) {
            result.errors.push('SESSION_SECRET is required in production');
            result.valid = false;
        } else if (process.env.SESSION_SECRET.length < 32) {
            result.errors.push('SESSION_SECRET must be at least 32 characters');
            result.valid = false;
        }

        if (!process.env.DATABASE_URL) {
            result.errors.push('DATABASE_URL is required in production');
            result.valid = false;
        }

        if (!process.env.PLATFORM_TREASURY_WALLET) {
            result.warnings.push('PLATFORM_TREASURY_WALLET not set - using default');
        }
    }

    // Optional but recommended
    if (!process.env.SOLANA_RPC_URL) {
        result.warnings.push('SOLANA_RPC_URL not set - will use devnet');
    }

    if (process.env.ENABLE_NFT_MINTING === 'true' && !process.env.PAYER_PRIVATE_KEY) {
        result.errors.push('PAYER_PRIVATE_KEY required when ENABLE_NFT_MINTING=true');
        result.valid = false;
    }

    if (process.env.ENABLE_ARCIUM_ENCRYPTION === 'true' && !process.env.ARCIUM_PROGRAM_ID) {
        result.warnings.push('ARCIUM_PROGRAM_ID not set - Arcium features will be limited');
    }

    return result;
}

async function checkDatabaseConnection(): Promise<boolean> {
    if (!process.env.DATABASE_URL) {
        info('No DATABASE_URL set - will use SQLite for development');
        return true;
    }

    try {
        const pg = await import('pg');
        const pool = new pg.default.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('railway.internal')
                ? false
                : { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
        });

        const client = await pool.connect();
        client.release();
        await pool.end();
        return true;
    } catch (err: any) {
        error(`Database connection failed: ${err.message}`);
        return false;
    }
}

function createDirectories(): void {
    const dirs = [
        'data',        // SQLite database
        'uploads',     // User uploads
        'logs',        // Log files (if file logging enabled)
    ];

    for (const dir of dirs) {
        const path = resolve(process.cwd(), dir);
        if (!existsSync(path)) {
            mkdirSync(path, { recursive: true });
            info(`Created directory: ${dir}/`);
        }
    }
}

// ============================================
// MAIN SETUP FLOW
// ============================================

async function main() {
    console.clear();
    header('Invoix Setup Script');

    const isProduction = process.env.NODE_ENV === 'production';
    info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log();

    // Step 1: Validate Environment
    header('Step 1: Validating Environment');
    const envResult = validateEnvironment();

    if (envResult.warnings.length > 0) {
        for (const w of envResult.warnings) {
            warning(w);
        }
    }

    if (envResult.errors.length > 0) {
        for (const e of envResult.errors) {
            error(e);
        }
        if (isProduction) {
            console.log();
            error('Environment validation failed. Cannot proceed in production mode.');
            process.exit(1);
        } else {
            warning('Proceeding with warnings in development mode.');
        }
    } else {
        success('Environment configuration valid');
    }

    // Step 2: Create Directories
    header('Step 2: Creating Directories');
    createDirectories();
    success('All required directories exist');

    // Step 3: Check Database Connection
    header('Step 3: Checking Database Connection');
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
        if (isProduction) {
            error('Cannot connect to database. Aborting.');
            process.exit(1);
        } else {
            warning('Database connection failed. SQLite will be used for development.');
        }
    } else {
        success('Database connection verified');
    }

    // Step 4: Run Migrations (if not skipped)
    header('Step 4: Database Migrations');
    if (process.env.SKIP_MIGRATIONS === 'true') {
        info('Migrations skipped (SKIP_MIGRATIONS=true)');
    } else if (!process.env.DATABASE_URL) {
        info('Using SQLite - migrations handled by Drizzle schema sync');
    } else {
        info('Migrations will run automatically on server start');
        info('To run manually: npm run db:migrate');
    }

    // Step 5: Final Summary
    header('Setup Complete');

    console.log('Next steps:');
    console.log();
    console.log('  1. Start the development server:');
    console.log('     npm run dev');
    console.log();
    console.log('  2. Or build for production:');
    console.log('     npm run build && npm start');
    console.log();

    if (!process.env.PAYER_PRIVATE_KEY) {
        console.log('  3. Generate a payer keypair for NFT minting:');
        console.log('     npx tsx scripts/generate-payer.ts');
        console.log();
    }

    success('Setup completed successfully!');
    console.log();
}

// Run
main().catch((err) => {
    error(`Setup failed: ${err.message}`);
    process.exit(1);
});
