
import Database from 'better-sqlite3';
import { sql } from "drizzle-orm";
import { invoices, invoiceLineItems } from "../shared/invoice-schema-sqlite";

async function initDb() {
    console.log("🛠️ Initializing Test Database...");
    const db = new Database('./data/invoices.db');

    // enable foreign keys
    db.pragma('foreign_keys = ON');

    console.log("Creating tables...");

    db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      invoicer_wallet_address TEXT NOT NULL,
      invoicee_wallet_address TEXT NOT NULL,
      invoice_date INTEGER NOT NULL DEFAULT (unixepoch()),
      due_date INTEGER NOT NULL,
      description TEXT,
      notes TEXT,
      currency TEXT NOT NULL DEFAULT 'USDC',
      token_mint TEXT,
      token_decimals INTEGER NOT NULL DEFAULT 6,
      subtotal TEXT NOT NULL,
      tax_amount TEXT NOT NULL DEFAULT '0',
      discount_amount TEXT NOT NULL DEFAULT '0',
      total_amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      paid_amount TEXT NOT NULL DEFAULT '0',
      remaining_amount TEXT NOT NULL,
      payment_terms TEXT,
      payment_instructions TEXT,
      is_private INTEGER NOT NULL DEFAULT 1,
      privacy_salt TEXT,
      hide_amounts INTEGER NOT NULL DEFAULT 1,
      hide_parties INTEGER NOT NULL DEFAULT 1,
      is_arcium_encrypted INTEGER NOT NULL DEFAULT 0,
      arcium_encrypted_data TEXT,
      arcium_encryption_key TEXT,
      arcium_computation_id TEXT,
      arcium_allowed_parties TEXT,
      x402_service_fee_usd TEXT NOT NULL DEFAULT '0.01',
      x402_fee_paid INTEGER NOT NULL DEFAULT 0,
      x402_payment_signature TEXT,
      nft_mint TEXT,
      nft_merkle_tree TEXT,
      nft_leaf_index INTEGER,
      nft_metadata_uri TEXT,
      nft_minted_at INTEGER,
      nft_transferred_to TEXT,
      nft_burned_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      sent_at INTEGER,
      viewed_at INTEGER,
      paid_at INTEGER,
      cancelled_at INTEGER,
      arcium_invoice_pda TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      line_number INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '1',
      unit_price TEXT NOT NULL,
      line_total TEXT NOT NULL,
      tax_rate TEXT,
      discount_rate TEXT,
      sku TEXT,
      category TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

    console.log("✅ Tables created.");
}

initDb();
