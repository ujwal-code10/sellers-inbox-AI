import pkg from "pg";
const { Pool } = pkg;

const isProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("FATAL: DATABASE_URL is not set in production environment.");
}

if (!isProduction) {
  console.log(
    "DB connection mode:",
    process.env.DATABASE_URL ? "DATABASE_URL (remote)" : "localhost (local dev)"
  );
}

const connectionString = process.env.DATABASE_URL;

function shouldUseSsl(connString?: string): boolean {
  if (!connString) return false;

  try {
    const url = new URL(connString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    const host = url.hostname.toLowerCase();
    const isLocalHost = host === "localhost" || host === "127.0.0.1";

    if (sslMode === "disable" || isLocalHost) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

const pool = connectionString
  ? new Pool({
      connectionString,
      ...(shouldUseSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
      max: 5,
    })
  : new Pool({
      user: "postgres",
      host: "localhost",
      database: "seller_inbox",
      password: "postgres",
      port: 5432,
    });

export default pool;
