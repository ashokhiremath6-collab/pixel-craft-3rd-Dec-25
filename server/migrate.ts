import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

/**
 * Bootstrap DDL: ensure the billing columns on `organisations` exist.
 * Uses IF NOT EXISTS so it is safe to run on every startup and is a no-op
 * once the columns are present.  This runs even when the /migrations folder
 * is absent so that existing deployments get the schema without requiring a
 * full migration setup.
 */
async function ensureBillingColumns(pool: Pool): Promise<void> {
  const statements = [
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial'`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing'`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Log but don't throw — a column-already-exists error would only appear
      // on pre-IF-NOT-EXISTS Postgres versions (< 9.6), which are not in use.
      console.warn("[migrate] billing column check:", (err as Error).message);
    }
  }
  console.log("✅ Organisation billing columns verified");
}

export async function runMigrations() {
  // Skip migrations if DATABASE_URL is not configured (e.g., local dev without DB)
  if (!process.env.DATABASE_URL) {
    console.log("ℹ️  DATABASE_URL not set - skipping migrations");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Always ensure billing columns exist, regardless of migrations folder.
    await ensureBillingColumns(pool);

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
