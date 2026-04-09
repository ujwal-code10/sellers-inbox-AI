/**
 * Server Entry Point
 *
 * This file bootstraps the entire application:
 * 1. Initializes the database (migrations + seeding)
 * 2. Starts the Express server
 *
 * All database setup is automatic - no manual SQL required.
 */

import "dotenv/config";
import { initializeDatabase } from "./utils/init.js";
import app from "./app.js";

const PORT = parseInt(process.env.PORT || "4000", 10);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

async function startServer() {
  console.log("\n🚀 Starting Seller Inbox AI Server...\n");

  // Initialize database (migrations + seeding)
  // This will exit the process if critical initialization fails
  const initialized = await initializeDatabase({
    exitOnFailure: true,
  });

  if (!initialized) {
    console.error("Failed to initialize database. Exiting.");
    process.exit(1);
  }

  // Start the HTTP server
  app.listen(PORT, () => {
    if (IS_PRODUCTION) {
      console.log(`\nServer running on port ${PORT}\n`);
      return;
    }

    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`   Admin panel: http://localhost:5173/admin/login (dev)`);
    console.log(`   API endpoint: http://localhost:${PORT}/api/admin\n`);
  });
}

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

// Start the server
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
