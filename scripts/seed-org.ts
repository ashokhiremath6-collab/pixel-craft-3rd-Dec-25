// seed-org.ts
// One-time script: creates the default organisation and backfills all existing
// data rows with its org_id.
//
// Safe to re-run: exits cleanly if any organisation already exists.
//
// NOTE: plan_status is set to 'trialing' (not 'active') to match the schema
// default for a trial-plan organisation. Change to 'active' here if you want
// the seed org to bypass trial restrictions.

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// The 29 tables that received org_id columns in migration 0004
const TABLES_TO_BACKFILL = [
  "vendor_categories",
  "vendors",
  "vendor_contacts",
  "specifications",
  "sops",
  "designer_allowlist",
  "user_roles",
  "user_project_assignments",
  "project_clients",
  "quote_templates",
  "works_order_templates",
  "vendor_invoices",
  "vendor_payments",
  "project_vendors",
  "quote_files",
  "boq",
  "object_assets",
  "saved_assets",
  "floor_plans",
  "moodboards",
  "project_schedules",
  "activity_log",
  "meeting_minutes",
  "tasks",
  "task_dependencies",
  "task_alerts",
  "approvals",
  "works_orders",
  "works_order_items",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ── Step 1: Check if any organisation already exists ──────────────────────
    console.log("Checking for existing organisations...");
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM organisations;"
    );
    const existingCount = countRows[0].count;

    if (existingCount > 0) {
      console.log(
        `Organisations already exist (${existingCount} found). Exiting.`
      );
      return;
    }

    // ── Step 2: Create default organisation ───────────────────────────────────
    console.log("No organisations found. Creating default organisation...");

    const { rows: insertRows } = await pool.query(`
      INSERT INTO organisations (name, slug, plan, plan_status)
      VALUES ('Default', 'default', 'trial', 'trialing')
      RETURNING id, name, slug, plan, plan_status, created_at;
    `);

    const org = insertRows[0];
    const orgId: string = org.id;

    console.log(`  [OK]  Organisation created:`);
    console.log(`          id         : ${org.id}`);
    console.log(`          name       : ${org.name}`);
    console.log(`          slug       : ${org.slug}`);
    console.log(`          plan       : ${org.plan}`);
    console.log(`          plan_status: ${org.plan_status}`);
    console.log(`          created_at : ${org.created_at}`);

    // ── Step 3: Backfill all 29 tables ────────────────────────────────────────
    console.log(`\nBackfilling ${TABLES_TO_BACKFILL.length} tables with org_id = '${orgId}'...`);

    for (const table of TABLES_TO_BACKFILL) {
      const { rowCount } = await pool.query(
        `UPDATE ${table} SET org_id = $1 WHERE org_id IS NULL;`,
        [orgId]
      );
      console.log(`  [OK]  ${table.padEnd(30)} — ${rowCount} row(s) updated`);
    }

    // ── Step 4: Confirm — no remaining NULL org_id rows ───────────────────────
    console.log("\nConfirming backfill — checking for remaining NULL org_id rows...");

    let allClean = true;
    for (const table of TABLES_TO_BACKFILL) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ${table} WHERE org_id IS NULL;`
      );
      const nullCount = rows[0].count;
      if (nullCount > 0) {
        console.warn(`  [WARN]  ${table.padEnd(30)} — ${nullCount} row(s) still have NULL org_id`);
        allClean = false;
      } else {
        console.log(`  [OK]    ${table.padEnd(30)} — 0 NULL rows`);
      }
    }

    if (!allClean) {
      console.warn("\n[WARN] Some rows still have NULL org_id. Review warnings above.");
    }

    console.log("\nSeed organisation created and backfill complete.");
  } catch (err) {
    console.error("ERROR during seed-org:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
