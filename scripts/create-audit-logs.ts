import Database from 'better-sqlite3';

async function createAuditLogsTable() {
    try {
        const sqlite = new Database('./data/invoices.db');

        console.log("Creating audit_logs table...");

        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        action TEXT NOT NULL,
        user_id TEXT,
        resource_id TEXT,
        access_granted INTEGER NOT NULL,
        ip_address TEXT,
        details TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

        console.log("Creating indexes...");

        sqlite.exec(`CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_logs(action)`);
        sqlite.exec(`CREATE INDEX IF NOT EXISTS audit_user_id_idx ON audit_logs(user_id)`);
        sqlite.exec(`CREATE INDEX IF NOT EXISTS audit_timestamp_idx ON audit_logs(timestamp)`);

        sqlite.close();

        console.log("✅ audit_logs table created successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating table:", error);
        process.exit(1);
    }
}

createAuditLogsTable();
