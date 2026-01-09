#!/usr/bin/env tsx
/**
 * Database Migration Runner
 * 
 * Runs all SQL migrations in order
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
    console.log('🚀 Starting database migrations...\n');

    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Run in order

    let successCount = 0;
    let skipCount = 0;

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(filePath, 'utf-8');

        try {
            console.log(`📄 Running: ${file}`);

            // Split on semicolons and filter out empty statements
            const statements = migrationSql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
                if (statement.includes('IF NOT EXISTS') || statement.includes('IF EXISTS')) {
                    // Safe to re-run
                    await db.execute(sql.raw(statement));
                } else {
                    // Check if already applied
                    try {
                        await db.execute(sql.raw(statement));
                    } catch (err: any) {
                        if (err.message.includes('already exists') || err.message.includes('does not exist')) {
                            // Skip - already applied
                            skipCount++;
                            continue;
                        }
                        throw err;
                    }
                }
            }

            console.log(`  ✅ Success\n`);
            successCount++;
        } catch (err: any) {
            console.error(`  ❌ Failed: ${err.message}\n`);
        }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Total: ${files.length}`);

    process.exit(0);
}

runMigrations().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
