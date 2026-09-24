// Kills a process in the middle of a write transaction on the app database (like the OS killing
// the app, or the battery dying) and checks what survives: the file is intact, committed
// transactions are all there, the open one left nothing behind, and the sync outbox (filled by
// triggers in the same transaction) matches the rows exactly — no change that would never reach
// the cloud.   npm run test:crash
//
// Uses the app's real migrations on a real SQLite file (node:sqlite), in both journal modes.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const BATCH = 500; // rows per transaction, like an import or a restore
const COMMITTED = 3; // transactions that finish before the kill
const HABIT_ID = 'habit-1';
const NOW = '2026-09-23T12:00:00.000Z';
const migrationsDir = new URL('../src/db/migrations/', import.meta.url);

function open(file, mode) {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = ${mode}; PRAGMA foreign_keys = ON;`);
  return db;
}

function migrate(db) {
  for (const name of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(new URL(name, migrationsDir), 'utf8');
    db.exec('BEGIN');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) db.exec(statement);
    }
    db.exec('COMMIT');
  }
}

/**
 * Child: commits COMMITTED transactions of BATCH rows, then stops halfway through the next one
 * (rows written, no COMMIT yet) and waits to be killed.
 */
function writeUntilKilled(file, mode) {
  const db = open(file, mode);
  const insert = db.prepare(
    `INSERT INTO habit_entries (id, habit_id, date, status, value, note, created_at, updated_at)
     VALUES (?, ?, ?, 'done', 1, ?, ?, ?)`,
  );
  const day = new Date(Date.UTC(1900, 0, 1));
  for (let batch = 0; ; batch += 1) {
    db.exec('BEGIN');
    for (let i = 0; i < BATCH; i += 1) {
      if (batch === COMMITTED && i === BATCH / 2) {
        process.stdout.write('mid-transaction\n');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30_000); // killed here
        process.exit(1);
      }
      day.setUTCDate(day.getUTCDate() + 1);
      const date = day.toISOString().slice(0, 10);
      insert.run(`e${batch * BATCH + i}`, HABIT_ID, date, 'x'.repeat(200), NOW, NOW);
    }
    db.exec('COMMIT');
  }
}

async function scenario(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'habits-crash-'));
  const file = join(dir, 'habits.db');
  try {
    const setup = open(file, mode);
    migrate(setup);
    setup
      .prepare(
        `INSERT INTO habits (id, name, icon, color, start_date, created_at, updated_at)
         VALUES (?, 'Beber água', 'cup-water', 'blue', '1900-01-01', ?, ?)`,
      )
      .run(HABIT_ID, NOW, NOW);
    setup.close();

    const script = fileURLToPath(import.meta.url);
    const child = spawn(process.execPath, ['--no-warnings', script, '--child', file, mode], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve, reject) => {
      child.on('exit', (code) => reject(new Error(`writer exited before the kill (${code})`)));
      child.stdout.once('data', () => {
        child.removeAllListeners('exit');
        child.on('exit', resolve);
        child.kill('SIGKILL'); // no cleanup, no rollback
      });
    });

    const db = open(file, mode);
    const count = (sql) => db.prepare(sql).get().n;
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    const habits = count('SELECT count(*) AS n FROM habits');
    const entries = count('SELECT count(*) AS n FROM habit_entries');
    const queued = count(`SELECT count(*) AS n FROM sync_outbox WHERE table_name = 'habitEntries'`);
    const unqueued = count(
      `SELECT count(*) AS n FROM habit_entries e WHERE NOT EXISTS (SELECT 1 FROM sync_outbox o
         WHERE o.table_name = 'habitEntries' AND o.row_key = e.id)`,
    );
    db.close();

    const expected = COMMITTED * BATCH;
    const problems = [];
    if (integrity !== 'ok') problems.push(`integrity_check: ${integrity}`);
    if (habits !== 1) problems.push(`habits: ${habits} (a committed row is gone)`);
    if (entries !== expected) {
      problems.push(`entries: ${entries}, expected ${expected} (lost commits or a half-write)`);
    }
    if (queued !== entries || unqueued !== 0) {
      problems.push(`outbox: ${queued} queued for ${entries} entries (${unqueued} never synced)`);
    }
    if (problems.length > 0) throw new Error(`${mode}: ${problems.join('; ')}`);
    console.log(
      `ok   ${mode.padEnd(6)} killed mid-transaction: ${COMMITTED} commits kept, ` +
        `the open one left nothing, outbox = rows`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[2] === '--child') {
  writeUntilKilled(process.argv[3], process.argv[4]);
} else {
  for (const mode of ['DELETE', 'WAL']) await scenario(mode);
}
