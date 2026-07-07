import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'feedback.sqlite');
let SQL;

export async function applyFeedbackHistory(rows, { scanMode = 'full' } = {}) {
  const db = await openDatabase();
  const now = new Date().toISOString();
  const mode = scanMode === 'incremental' ? 'incremental' : 'full';
  const outputRows = [];
  let newRows = 0;
  let skippedRows = 0;

  try {
    for (const row of rows.map(withStarRating)) {
      const feedbackKey = feedbackKeyFor(row);
      const exists = hasFeedback(db, feedbackKey);

      if (exists && mode === 'incremental') {
        skippedRows += 1;
        touchFeedback(db, feedbackKey, now);
        continue;
      }

      upsertFeedback(db, feedbackKey, row, now);
      if (!exists) newRows += 1;
      outputRows.push(row);
    }

    await saveDatabase(db);
  } finally {
    db.close();
  }

  return {
    rows: outputRows,
    stats: {
      scan_mode: mode,
      rows_seen: rows.length,
      rows_exported: outputRows.length,
      new_rows: newRows,
      skipped_existing_rows: skippedRows,
      database_path: dbPath
    }
  };
}

export async function resetFeedbackHistory() {
  const db = await openDatabase();

  try {
    const deletedRows = rowCount(db);
    db.run('DELETE FROM scanned_feedback');
    await saveDatabase(db);

    return {
      deleted_rows: deletedRows,
      database_path: dbPath
    };
  } finally {
    db.close();
  }
}

export function withStarRating(row) {
  return {
    ...row,
    star_rating: starRatingFor(row.rating)
  };
}

export function starRatingFor(rating = '') {
  const normalized = String(rating).toLowerCase();
  if (normalized === 'positive') return 5;
  if (normalized === 'neutral') return 2;
  if (normalized === 'negative') return 1;
  return '';
}

export function feedbackKeyFor(row) {
  const stableParts = [
    row.feedback_id,
    row.seller_username,
    row.source_item_id,
    row.matched_item_id,
    row.buyer_username,
    row.feedback_date,
    row.feedback_text
  ].filter(Boolean);

  const rawKey = stableParts.length ? stableParts.join('|') : JSON.stringify(row);
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function openDatabase() {
  SQL ??= await initSqlJs({
    locateFile: (file) => path.join(rootDir, 'node_modules', 'sql.js', 'dist', file)
  });

  await fs.mkdir(dataDir, { recursive: true });

  let db;
  try {
    const buffer = await fs.readFile(dbPath);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  createSchema(db);
  return db;
}

function createSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS scanned_feedback (
      feedback_key TEXT PRIMARY KEY,
      feedback_id TEXT,
      seller_username TEXT,
      source_item_id TEXT,
      source_item_title TEXT,
      source_item_image_url TEXT,
      matched_item_id TEXT,
      matched_item_title TEXT,
      matched_item_image_url TEXT,
      rating TEXT,
      star_rating REAL,
      buyer_username TEXT,
      feedback_date TEXT,
      feedback_text TEXT,
      source_listing_url TEXT,
      matched_item_url TEXT,
      feedback_profile_url TEXT,
      match_type TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scanned_feedback_seller
      ON scanned_feedback (seller_username);

    CREATE INDEX IF NOT EXISTS idx_scanned_feedback_item
      ON scanned_feedback (source_item_id, matched_item_id);
  `);

  ensureColumn(db, 'source_item_image_url', 'TEXT');
  ensureColumn(db, 'matched_item_image_url', 'TEXT');
}

function rowCount(db) {
  const result = db.exec('SELECT COUNT(*) FROM scanned_feedback');
  return result[0]?.values?.[0]?.[0] ?? 0;
}

function ensureColumn(db, columnName, definition) {
  const columns = db.exec('PRAGMA table_info(scanned_feedback)')[0]?.values ?? [];
  const hasColumn = columns.some((column) => column[1] === columnName);
  if (!hasColumn) db.run(`ALTER TABLE scanned_feedback ADD COLUMN ${columnName} ${definition}`);
}

function hasFeedback(db, feedbackKey) {
  const statement = db.prepare('SELECT 1 FROM scanned_feedback WHERE feedback_key = ? LIMIT 1');
  try {
    statement.bind([feedbackKey]);
    return statement.step();
  } finally {
    statement.free();
  }
}

function touchFeedback(db, feedbackKey, now) {
  db.run('UPDATE scanned_feedback SET last_seen_at = ? WHERE feedback_key = ?', [now, feedbackKey]);
}

function upsertFeedback(db, feedbackKey, row, now) {
  db.run(
    `
      INSERT INTO scanned_feedback (
        feedback_key,
        feedback_id,
        seller_username,
        source_item_id,
        source_item_title,
        source_item_image_url,
        matched_item_id,
        matched_item_title,
        matched_item_image_url,
        rating,
        star_rating,
        buyer_username,
        feedback_date,
        feedback_text,
        source_listing_url,
        matched_item_url,
        feedback_profile_url,
        match_type,
        first_seen_at,
        last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(feedback_key) DO UPDATE SET
        rating = excluded.rating,
        star_rating = excluded.star_rating,
        buyer_username = excluded.buyer_username,
        feedback_date = excluded.feedback_date,
        feedback_text = excluded.feedback_text,
        source_item_image_url = excluded.source_item_image_url,
        matched_item_title = excluded.matched_item_title,
        matched_item_url = excluded.matched_item_url,
        matched_item_image_url = excluded.matched_item_image_url,
        match_type = excluded.match_type,
        last_seen_at = excluded.last_seen_at
    `,
    [
      feedbackKey,
      row.feedback_id || '',
      row.seller_username || '',
      row.source_item_id || '',
      row.source_item_title || '',
      row.source_item_image_url || '',
      row.matched_item_id || '',
      row.matched_item_title || '',
      row.matched_item_image_url || '',
      row.rating || '',
      row.star_rating === '' ? null : row.star_rating,
      row.buyer_username || '',
      row.feedback_date || '',
      row.feedback_text || '',
      row.source_listing_url || '',
      row.matched_item_url || '',
      row.feedback_profile_url || '',
      row.match_type || '',
      now,
      now
    ]
  );
}

async function saveDatabase(db) {
  const data = db.export();
  await fs.writeFile(dbPath, Buffer.from(data));
}
