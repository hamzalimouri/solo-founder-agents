import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

function initDb() {
  const dir = dirname(config.databasePath);
  try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }

  const sqlite = new Database(config.databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  createTables(sqlite);
  return db;
}

function createTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      telegram_id     INTEGER UNIQUE NOT NULL,
      username        TEXT,
      first_name      TEXT,
      business_name   TEXT,
      business_desc   TEXT,
      target_audience TEXT,
      product_url     TEXT,
      daily_budget    REAL DEFAULT 5.00,
      onboarding_step INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id    TEXT NOT NULL REFERENCES users(id),
      agent_key  TEXT NOT NULL,
      messages   TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, agent_key)
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id        TEXT NOT NULL REFERENCES users(id),
      agent_key      TEXT NOT NULL,
      user_message   TEXT NOT NULL,
      agent_response TEXT,
      model          TEXT NOT NULL,
      input_tokens   INTEGER,
      output_tokens  INTEGER,
      cost_usd       REAL,
      duration_ms    INTEGER,
      tool_calls     TEXT,
      status         TEXT DEFAULT 'success',
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id      TEXT NOT NULL REFERENCES users(id),
      agent_key    TEXT NOT NULL,
      title        TEXT NOT NULL,
      content      TEXT NOT NULL,
      content_type TEXT NOT NULL,
      status       TEXT DEFAULT 'draft',
      tags         TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pending_tasks (
      id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id          TEXT NOT NULL REFERENCES users(id),
      telegram_chat_id INTEGER NOT NULL,
      agent_key        TEXT NOT NULL,
      message          TEXT NOT NULL,
      status           TEXT DEFAULT 'pending',
      result           TEXT,
      retries          INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_spend (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id       TEXT NOT NULL REFERENCES users(id),
      date          TEXT NOT NULL,
      total_cost    REAL DEFAULT 0,
      total_tokens  INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      UNIQUE(user_id, date)
    );
  `);
}

export const db = initDb();
