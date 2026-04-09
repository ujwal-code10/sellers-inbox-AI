/**
 * Database Migration System
 *
 * Automatically runs SQL migrations from src/migrations/ directory.
 * Tracks executed migrations to prevent duplicate execution.
 * Safe to run multiple times (idempotent).
 */

import pool from "./db.js";
import fs from "fs";
import path from "path";

// Get migrations directory - works in both development and production
// In development: process.cwd() is backend/
// In production (built): migrations are copied to dist/migrations/
function getMigrationsDir(): string {
  // Try src/migrations first (development)
  const devDir = path.join(process.cwd(), "src", "migrations");
  if (fs.existsSync(devDir)) {
    return devDir;
  }

  // Try dist/migrations (production)
  const prodDir = path.join(process.cwd(), "dist", "migrations");
  if (fs.existsSync(prodDir)) {
    return prodDir;
  }

  // Fallback to src/migrations
  return devDir;
}

// ANSI color codes for logging
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

const VERBOSE_STARTUP_LOGS =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_STARTUP_VERBOSE_LOGS === "true";

function log(message: string, color: keyof typeof colors = "reset") {
  if (!VERBOSE_STARTUP_LOGS && color !== "yellow" && color !== "red") {
    return;
  }

  if (!VERBOSE_STARTUP_LOGS) {
    console.log(message);
    return;
  }

  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * Get list of already executed migrations
 */
async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query(
    `SELECT name FROM _migrations ORDER BY executed_at`
  );
  return result.rows.map((row) => row.name);
}

/**
 * Record a migration as executed
 */
async function recordMigration(name: string): Promise<void> {
  await pool.query(
    `INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [name]
  );
}

/**
 * Get all migration files from the migrations directory
 */
function getMigrationFiles(): string[] {
  const migrationsDir = getMigrationsDir();

  if (!fs.existsSync(migrationsDir)) {
    log(`Migrations directory not found: ${migrationsDir}`, "yellow");
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort(); // Sort alphabetically for consistent order

  return files;
}

/**
 * Execute a single migration file
 */
async function executeMigration(fileName: string): Promise<void> {
  const migrationsDir = getMigrationsDir();
  const filePath = path.join(migrationsDir, fileName);

  const sql = fs.readFileSync(filePath, "utf-8");

  // Execute the migration in a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 * Returns true if all migrations succeeded, false otherwise
 */
export async function runMigrations(): Promise<boolean> {
  log("Starting database migrations...", "cyan");

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();

    // Get executed and pending migrations
    const executedMigrations = await getExecutedMigrations();
    const allMigrations = getMigrationFiles();
    const pendingMigrations = allMigrations.filter(
      (name) => !executedMigrations.includes(name)
    );

    if (pendingMigrations.length === 0) {
      log("No pending migrations", "green");
      return true;
    }

    log(`Found ${pendingMigrations.length} pending migration(s)`, "cyan");

    // Execute each pending migration
    for (const migration of pendingMigrations) {
      try {
        log(`Running migration: ${migration}`, "yellow");
        await executeMigration(migration);
        await recordMigration(migration);
        log(`Completed: ${migration}`, "green");
      } catch (err: any) {
        log(`FAILED: ${migration} - ${err.message}`, "red");
        throw err; // Re-throw to stop migration process
      }
    }

    log(`All ${pendingMigrations.length} migration(s) completed successfully`, "green");
    return true;
  } catch (err: any) {
    log(`Migration failed: ${err.message}`, "red");
    return false;
  }
}

/**
 * Check if a specific table exists in the database
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

/**
 * Get migration status for debugging
 */
export async function getMigrationStatus(): Promise<{
  executed: string[];
  pending: string[];
}> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const all = getMigrationFiles();
  const pending = all.filter((name) => !executed.includes(name));
  return { executed, pending };
}
