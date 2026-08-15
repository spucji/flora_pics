import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle, type AsyncBatchRemoteCallback, type RemoteCallback } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const databasePath = resolve(process.env.DATABASE_PATH || "data/flora.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new DatabaseSync(databasePath);
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA busy_timeout = 5000");

function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      reference TEXT NOT NULL,
      bouquet_id TEXT NOT NULL,
      bouquet_name TEXT NOT NULL,
      size TEXT NOT NULL,
      material_plan TEXT NOT NULL,
      price_range TEXT NOT NULL,
      scene TEXT DEFAULT '' NOT NULL,
      delivery_date TEXT DEFAULT '' NOT NULL,
      budget TEXT DEFAULT '' NOT NULL,
      customer_name TEXT DEFAULT '' NOT NULL,
      contact TEXT DEFAULT '' NOT NULL,
      note TEXT DEFAULT '' NOT NULL,
      referral_code TEXT DEFAULT '' NOT NULL,
      referrer_member_id INTEGER,
      purchase_amount INTEGER DEFAULT 0 NOT NULL,
      reward_granted INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      contact TEXT DEFAULT '' NOT NULL,
      note TEXT DEFAULT '' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS member_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      member_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      consultation_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    );
    CREATE TABLE IF NOT EXISTS catalog_state (
      id INTEGER PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  const columns = sqlite.prepare("PRAGMA table_info(consultations)").all() as Array<{ name: string }>;
  const names = new Set(columns.map(column => column.name));
  if (!names.has("referral_code")) sqlite.exec("ALTER TABLE consultations ADD COLUMN referral_code TEXT DEFAULT '' NOT NULL");
  if (!names.has("purchase_amount")) sqlite.exec("ALTER TABLE consultations ADD COLUMN purchase_amount INTEGER DEFAULT 0 NOT NULL");
  if (!names.has("reward_granted")) sqlite.exec("ALTER TABLE consultations ADD COLUMN reward_granted INTEGER DEFAULT 0 NOT NULL");
  if (!names.has("referrer_member_id")) sqlite.exec("ALTER TABLE consultations ADD COLUMN referrer_member_id INTEGER");
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_reference ON consultations(reference);
    CREATE INDEX IF NOT EXISTS idx_consultations_status_created ON consultations(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_consultations_referrer_member ON consultations(referrer_member_id);
    DROP INDEX IF EXISTS idx_members_code;
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
    CREATE INDEX IF NOT EXISTS idx_member_ledger_member_created ON member_ledger(member_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_member_ledger_consultation ON member_ledger(consultation_id);
    PRAGMA optimize;
  `);
}

initializeDatabase();

function execute(sql: string, params: unknown[], method: "run" | "all" | "values" | "get") {
  const statement = sqlite.prepare(sql);
  const values = params as SQLInputValue[];
  if (method === "run") {
    const result = statement.run(...values);
    return { rows: [{ changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) }] };
  }
  if (method === "all" || method === "values" || method === "get") statement.setReturnArrays(true);
  if (method === "get") {
    const row = statement.get(...values);
    return { rows: row || undefined };
  }
  return { rows: statement.all(...values) };
}

const remote: RemoteCallback = async (sql, params, method) => execute(sql, params, method);
const batch: AsyncBatchRemoteCallback = async queries => {
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const results = queries.map(query => execute(query.sql, query.params, query.method));
    sqlite.exec("COMMIT");
    return results;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
};
const database = drizzle(remote, batch, { schema });

export async function getDb() {
  return database;
}
