/**
 * Database Backup Script
 * 
 * Automated daily backup of PostgreSQL database with S3/R2 upload.
 * Run via cron or GitHub Actions.
 * 
 * Usage:
 *   npm run backup
 *   tsx scripts/backup-database.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const S3_BUCKET = process.env.BACKUP_S3_BUCKET; // Optional: for off-site storage
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
    execAsync(`mkdir -p ${BACKUP_DIR}`);
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename(): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `backup-${timestamp}.sql`;
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(): Promise<string> {
    if (!DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable not set');
    }

    const filename = getBackupFilename();
    const filepath = join(BACKUP_DIR, filename);

    console.log(`📦 Creating backup: ${filename}`);
    console.log(`📍 Location: ${filepath}`);

    try {
        // Use pg_dump to create backup
        const { stdout, stderr } = await execAsync(
            `pg_dump "${DATABASE_URL}" --no-owner --no-acl --clean --if-exists > "${filepath}"`
        );

        if (stderr && !stderr.includes('NOTICE')) {
            console.warn('⚠️  Backup warnings:', stderr);
        }

        // Verify backup file exists and has content
        if (!existsSync(filepath)) {
            throw new Error('Backup file was not created');
        }

        const stats = await execAsync(`wc -l "${filepath}"`);
        const lineCount = parseInt(stats.stdout.split(' ')[0], 10);

        if (lineCount < 10) {
            throw new Error(`Backup file is too small (${lineCount} lines)`);
        }

        console.log(`✅ Backup created successfully (${lineCount} lines)`);
        return filepath;

    } catch (error: any) {
        console.error('❌ Backup failed:', error.message);
        throw error;
    }
}

/**
 * Calculate MD5 checksum for integrity verification
 */
async function calculateChecksum(filepath: string): Promise<string> {
    const fileBuffer = readFileSync(filepath);
    const hash = crypto.createHash('md5');
    hash.update(fileBuffer);
    return hash.digest('hex');
}

/**
 * Upload backup to S3/R2 (optional)
 */
async function uploadToS3(filepath: string): Promise<void> {
    if (!S3_BUCKET) {
        console.log('ℹ️  S3_BUCKET not configured, skipping off-site backup');
        return;
    }

    console.log(`☁️  Uploading to S3: ${S3_BUCKET}`);

    try {
        // Use AWS CLI or S3 SDK
        const filename = filepath.split('/').pop();
        await execAsync(
            `aws s3 cp "${filepath}" "s3://${S3_BUCKET}/${filename}" --storage-class STANDARD_IA`
        );

        // Also upload as "latest" for easy recovery
        await execAsync(
            `aws s3 cp "${filepath}" "s3://${S3_BUCKET}/backup-latest.sql" --storage-class STANDARD_IA`
        );

        console.log('✅ Uploaded to S3 successfully');
    } catch (error: any) {
        console.error('❌ S3 upload failed:', error.message);
        // Don't throw - local backup is still valid
    }
}

/**
 * Clean up old backups beyond retention period
 */
async function cleanupOldBackups(): Promise<void> {
    console.log(`🧹 Cleaning up backups older than ${RETENTION_DAYS} days`);

    try {
        // Find and delete old backups
        const { stdout } = await execAsync(
            `find "${BACKUP_DIR}" -name "backup-*.sql" -type f -mtime +${RETENTION_DAYS}`
        );

        const oldBackups = stdout.trim().split('\n').filter(Boolean);

        if (oldBackups.length === 0) {
            console.log('ℹ️  No old backups to clean up');
            return;
        }

        for (const backup of oldBackups) {
            unlinkSync(backup);
            console.log(`🗑️  Deleted: ${backup}`);
        }

        console.log(`✅ Cleaned up ${oldBackups.length} old backup(s)`);
    } catch (error: any) {
        console.error('⚠️  Cleanup failed:', error.message);
        // Don't throw - this is not critical
    }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(filepath: string): Promise<boolean> {
    console.log('🔍 Verifying backup integrity...');

    try {
        // Check if backup can be parsed
        const { stdout } = await execAsync(
            `head -n 100 "${filepath}" | grep -c "CREATE TABLE"`
        );

        const tableCount = parseInt(stdout.trim(), 10);

        if (tableCount < 5) {
            console.error('❌ Backup verification failed: Too few tables');
            return false;
        }

        // Calculate and save checksum
        const checksum = await calculateChecksum(filepath);
        const checksumFile = `${filepath}.md5`;
        writeFileSync(checksumFile, checksum);

        console.log(`✅ Backup verified (MD5: ${checksum})`);
        return true;

    } catch (error: any) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

/**
 * Send notification (optional)
 */
async function sendNotification(success: boolean, filepath: string): Promise<void> {
    const WEBHOOK_URL = process.env.BACKUP_NOTIFICATION_WEBHOOK;

    if (!WEBHOOK_URL) {
        return;
    }

    try {
        const message = success
            ? `✅ Database backup completed successfully: ${filepath}`
            : `❌ Database backup failed: ${filepath}`;

        await execAsync(
            `curl -X POST "${WEBHOOK_URL}" -H "Content-Type: application/json" -d '{"text":"${message}"}'`
        );
    } catch (error) {
        // Ignore notification errors
    }
}

/**
 * Main backup function
 */
async function main() {
    console.log('🚀 Starting database backup...');
    console.log(`📅 Date: ${new Date().toISOString()}`);

    let filepath: string | null = null;
    let success = false;

    try {
        // Step 1: Create backup
        filepath = await createBackup();

        // Step 2: Verify backup
        const isValid = await verifyBackup(filepath);
        if (!isValid) {
            throw new Error('Backup verification failed');
        }

        // Step 3: Upload to S3 (optional)
        await uploadToS3(filepath);

        // Step 4: Clean up old backups
        await cleanupOldBackups();

        success = true;
        console.log('✅ Backup process completed successfully');

    } catch (error: any) {
        console.error('❌ Backup process failed:', error.message);
        console.error(error.stack);
        success = false;
    } finally {
        // Send notification
        if (filepath) {
            await sendNotification(success, filepath);
        }

        // Exit with appropriate code
        process.exit(success ? 0 : 1);
    }
}

// Run backup
main();
