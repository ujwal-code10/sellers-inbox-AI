/**
 * Database Initialization System
 *
 * Main orchestrator for database setup:
 * 1. Validates environment variables
 * 2. Tests database connection
 * 3. Runs migrations
 * 4. Seeds default data
 *
 * This runs automatically on server start.
 */

import pool from "./db.js";
import { runMigrations, getMigrationStatus } from "./migrate.js";
import { runSeeds, getAdminCount, getSystemSettings } from "./seed.js";

// ANSI color codes for logging
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log(`\n${colors.bold}${colors.blue}${"=".repeat(50)}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}  ${message}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}${"=".repeat(50)}${colors.reset}\n`);
}

/**
 * Validate required environment variables for admin system
 */
function validateAdminEnv(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // ADMIN_JWT_SECRET is required for admin auth
  if (!process.env.ADMIN_JWT_SECRET) {
    warnings.push("ADMIN_JWT_SECRET not set - admin auth will fail");
  } else if (process.env.ADMIN_JWT_SECRET.length < 32) {
    warnings.push("ADMIN_JWT_SECRET should be at least 32 characters for security");
  }

  // ADMIN_EMAIL and ADMIN_PASSWORD are optional but recommended
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    warnings.push("ADMIN_EMAIL/ADMIN_PASSWORD not set - no default admin will be created");
  }

  return {
    valid: true, // These are warnings, not fatal errors
    warnings,
  };
}

/**
 * Test database connection
 */
async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query("SELECT NOW() as time, current_database() as db");
    log(`Connected to database: ${result.rows[0].db}`, "green");
    return true;
  } catch (err: any) {
    log(`Database connection failed: ${err.message}`, "red");
    return false;
  }
}

/**
 * Initialize the database (migrations + seeding)
 * This is the main entry point called from server.ts
 *
 * @param options - Configuration options
 * @returns true if initialization succeeded, false if failed
 */
export async function initializeDatabase(options: {
  exitOnFailure?: boolean;
} = {}): Promise<boolean> {
  const { exitOnFailure = true } = options;

  logHeader("Database Initialization");

  // Step 1: Validate environment
  log("Validating environment...", "cyan");
  const envCheck = validateAdminEnv();
  for (const warning of envCheck.warnings) {
    log(`WARNING: ${warning}`, "yellow");
  }

  // Step 2: Test database connection
  log("Testing database connection...", "cyan");
  const connected = await testConnection();
  if (!connected) {
    log("FATAL: Cannot connect to database", "red");
    if (exitOnFailure) {
      process.exit(1);
    }
    return false;
  }

  // Step 3: Run migrations
  log("Running database migrations...", "cyan");
  const migrationsSuccess = await runMigrations();
  if (!migrationsSuccess) {
    log("FATAL: Migration failed - stopping server", "red");
    if (exitOnFailure) {
      process.exit(1);
    }
    return false;
  }

  // Step 4: Run seeds
  log("Running database seeds...", "cyan");
  const seedsSuccess = await runSeeds();
  if (!seedsSuccess) {
    // Seeds are not fatal - log warning but continue
    log("WARNING: Some seeds failed - check logs above", "yellow");
  }

  // Step 5: Log status summary
  await logStatus();

  logHeader("Initialization Complete");

  return true;
}

/**
 * Log current database status
 */
async function logStatus(): Promise<void> {
  try {
    // Migration status
    const { executed, pending } = await getMigrationStatus();
    log(`Migrations: ${executed.length} executed, ${pending.length} pending`, "cyan");

    // Admin count
    const adminCount = await getAdminCount();
    if (adminCount === 0) {
      log("Admin users: 0 (set ADMIN_EMAIL/ADMIN_PASSWORD to create one)", "yellow");
    } else {
      log(`Admin users: ${adminCount}`, "green");
    }

    // System settings
    const settings = await getSystemSettings();
    log(`System settings: ${settings.length} configured`, "green");
  } catch (err: any) {
    log(`Could not get status: ${err.message}`, "yellow");
  }
}

/**
 * Get initialization status (for API endpoint)
 */
export async function getInitStatus(): Promise<{
  database: boolean;
  migrations: { executed: number; pending: number };
  admins: number;
  settings: number;
}> {
  let database = false;
  let migrations = { executed: 0, pending: 0 };
  let admins = 0;
  let settings = 0;

  try {
    await pool.query("SELECT 1");
    database = true;
  } catch {
    database = false;
  }

  try {
    const status = await getMigrationStatus();
    migrations = {
      executed: status.executed.length,
      pending: status.pending.length,
    };
  } catch {
    // Ignore
  }

  try {
    admins = await getAdminCount();
  } catch {
    // Ignore
  }

  try {
    const settingsList = await getSystemSettings();
    settings = settingsList.length;
  } catch {
    // Ignore
  }

  return { database, migrations, admins, settings };
}
