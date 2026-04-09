/**
 * Database Seeding System
 *
 * Automatically seeds required data:
 * - Default admin user (from ENV)
 * - System settings
 *
 * Safe to run multiple times (idempotent).
 */

import pool from "./db.js";
import bcrypt from "bcryptjs";

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
 * Default system settings
 * These are stored in the database, not .env
 */
const DEFAULT_SETTINGS = [
  {
    key: "free_tier_limits",
    value: { daily_replies: 20, max_products: 5, enforce: false, mode: "trust" },
    description: "Free tier usage limits and enforcement mode",
  },
  {
    key: "pro_pricing",
    value: { monthly: 299, yearly: 2499 },
    description: "Pro plan pricing in NPR",
  },
  {
    key: "ai_config",
    value: { model: "llama-3.3-70b-versatile", temperature: 0.3 },
    description: "AI model configuration",
  },
  {
    key: "maintenance_mode",
    value: { enabled: false, message: "" },
    description: "Maintenance mode settings",
  },
  {
    key: "rate_limits",
    value: { login_attempts: 5, window_minutes: 15 },
    description: "Rate limiting configuration",
  },
];

/**
 * Check if any admin user exists in the database
 */
async function adminExists(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM admin_users LIMIT 1)`
    );
    return result.rows[0].exists;
  } catch {
    // Table might not exist yet
    return false;
  }
}

/**
 * Create the default admin user from environment variables
 */
async function createDefaultAdmin(): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  // Skip if env vars not set
  if (!email || !password) {
    log("ADMIN_EMAIL and ADMIN_PASSWORD not set - skipping admin creation", "yellow");
    log("Set these env vars to auto-create admin user on startup", "dim" as any);
    return false;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    log(`Invalid ADMIN_EMAIL format: ${email}`, "red");
    return false;
  }

  // Validate password length
  if (password.length < 8) {
    log("ADMIN_PASSWORD must be at least 8 characters", "red");
    return false;
  }

  try {
    // Check if this specific admin already exists
    const existing = await pool.query(
      `SELECT id FROM admin_users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      log(`Admin user already exists: ${email}`, "yellow");
      return true;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    await pool.query(
      `INSERT INTO admin_users (email, password, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        email.toLowerCase().trim(),
        hashedPassword,
        "Administrator",
        "super_admin",
        true,
      ]
    );

    log(`Created admin user: ${email} (super_admin)`, "green");
    return true;
  } catch (err: any) {
    log(`Failed to create admin user: ${err.message}`, "red");
    return false;
  }
}

/**
 * Initialize system settings in the database
 */
async function initializeSystemSettings(): Promise<boolean> {
  try {
    let inserted = 0;
    let skipped = 0;

    for (const setting of DEFAULT_SETTINGS) {
      // Check if setting exists
      const existing = await pool.query(
        `SELECT id FROM system_settings WHERE key = $1`,
        [setting.key]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert new setting
      await pool.query(
        `INSERT INTO system_settings (key, value, description)
         VALUES ($1, $2, $3)`,
        [setting.key, JSON.stringify(setting.value), setting.description]
      );
      inserted++;
    }

    if (inserted > 0) {
      log(`Initialized ${inserted} system setting(s)`, "green");
    }
    if (skipped > 0) {
      log(`${skipped} system setting(s) already exist`, "dim" as any);
    }

    return true;
  } catch (err: any) {
    log(`Failed to initialize system settings: ${err.message}`, "red");
    return false;
  }
}

/**
 * Run all seeding operations
 * Returns true if all critical seeds succeeded
 */
export async function runSeeds(): Promise<boolean> {
  log("Starting database seeding...", "cyan");

  let success = true;

  // Check if admin table exists before trying to seed
  try {
    await pool.query(`SELECT 1 FROM admin_users LIMIT 0`);
  } catch {
    log("Admin tables not yet created - skipping seeding", "yellow");
    return true; // Not a failure, just not ready yet
  }

  // Create default admin if none exists
  const hasAdmin = await adminExists();
  if (!hasAdmin) {
    log("No admin users found - creating default admin", "cyan");
    const adminCreated = await createDefaultAdmin();
    if (!adminCreated && process.env.ADMIN_EMAIL) {
      // Only fail if env vars were set but creation failed
      success = false;
    }
  } else {
    log("Admin user(s) already exist", "green");
  }

  // Initialize system settings
  const settingsSuccess = await initializeSystemSettings();
  if (!settingsSuccess) {
    // Log but don't fail - settings can be added manually
    log("System settings initialization had issues", "yellow");
  }

  if (success) {
    log("Database seeding completed", "green");
  }

  return success;
}

/**
 * Get current admin count (for debugging)
 */
export async function getAdminCount(): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) FROM admin_users`);
    return parseInt(result.rows[0].count, 10);
  } catch {
    return 0;
  }
}

/**
 * Get all system settings (for debugging)
 */
export async function getSystemSettings(): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT key, value, description, updated_at FROM system_settings ORDER BY key`
    );
    return result.rows;
  } catch {
    return [];
  }
}
