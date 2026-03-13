import pkg from "pg";
const { Pool } = pkg;

const isProduction = process.env.VERCEL || process.env.NODE_ENV === "production";

if (isProduction && !process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set in production environment!");
}

console.log("DB connection mode:", process.env.DATABASE_URL ? "DATABASE_URL (remote)" : "localhost (local dev)");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: "postgres",
      host: "localhost",
      database: "seller_inbox",
      password: "postgres",
      port: 5432,
    });

export default pool;
