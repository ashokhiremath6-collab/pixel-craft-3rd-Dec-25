import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

/**
 * Bootstrap DDL: ensure billing and plan-limit columns exist.
 * Uses IF NOT EXISTS — safe to run on every startup.
 */
async function ensureBillingColumns(pool: Pool): Promise<void> {
  const statements = [
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial'`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing'`,
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organisations(id)`,
    `ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organisations(id)`,
    `CREATE INDEX IF NOT EXISTS projects_org_id_idx ON projects(org_id)`,
    `CREATE INDEX IF NOT EXISTS catalogue_items_org_id_idx ON catalogue_items(org_id)`,
    // Backfill legacy rows (org_id IS NULL) when there is exactly one organisation.
    `UPDATE projects SET org_id = (SELECT id FROM organisations LIMIT 1) WHERE org_id IS NULL AND (SELECT COUNT(*) FROM organisations) = 1`,
    `UPDATE catalogue_items SET org_id = (SELECT id FROM organisations LIMIT 1) WHERE org_id IS NULL AND (SELECT COUNT(*) FROM organisations) = 1`,
    // Super-admin flag on users
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false`,
    // Super-admin audit log table
    `CREATE TABLE IF NOT EXISTS superadmin_audit_log (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      super_admin_id VARCHAR NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_org_id VARCHAR REFERENCES organisations(id),
      target_user_id VARCHAR REFERENCES users(id),
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS superadmin_audit_super_admin_idx ON superadmin_audit_log(super_admin_id)`,
    `CREATE INDEX IF NOT EXISTS superadmin_audit_created_at_idx ON superadmin_audit_log(created_at)`,
    // Allow system/webhook events to have a null actor (previously NOT NULL)
    `ALTER TABLE superadmin_audit_log ALTER COLUMN super_admin_id DROP NOT NULL`,
    // Trial-expiry notification tracking
    `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trial_expiry_notified_at TIMESTAMP`,
  ];

  // Elevate any emails listed in SUPER_ADMIN_EMAILS env var.
  // Format: comma-separated list e.g. "alice@example.com,bob@example.com"
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.warn("[migrate] schema check:", (err as Error).message);
    }
  }

  if (superAdminEmails.length > 0) {
    try {
      await pool.query(
        `UPDATE users SET is_super_admin = true WHERE LOWER(email) = ANY($1)`,
        [superAdminEmails]
      );
      console.log(`✅ Super-admin emails elevated: ${superAdminEmails.join(", ")}`);
    } catch (err) {
      console.warn("[migrate] super-admin elevation:", (err as Error).message);
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
