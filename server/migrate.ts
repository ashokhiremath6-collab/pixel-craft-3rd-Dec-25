import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

// Deprecated: bootstrap DDL (ensureBillingColumns) removed 2026-05-09.
// All schema changes are now managed exclusively by Drizzle migrations
// in /migrations. See docs/migrations.md for the workflow.

export async function runMigrations() {
  // Skip migrations if DATABASE_URL is not configured (e.g., local dev without DB)
  if (!process.env.DATABASE_URL) {
    console.log("ℹ️  DATABASE_URL not set - skipping migrations");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const migrationsFolder = "./migrations";

    // Check if migrations folder exists
    if (!fs.existsSync(migrationsFolder)) {
      console.log("ℹ️  No migrations folder found - skipping drizzle migrations");
      return;
    }

    // Check if migrations folder has any content (drizzle-kit generates directories)
    const migrationDirs = fs.readdirSync(migrationsFolder);
    if (migrationDirs.length === 0) {
      console.log("ℹ️  No migration files found - skipping drizzle migrations");
      return;
    }

    console.log("Running database migrations...");

    const db = drizzle(pool);

    try {
      // Drizzle migrator automatically handles the directory structure
      await migrate(db, { migrationsFolder });
      console.log("✅ Migrations completed successfully");
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  } finally {
    await pool.end();
  }
}
