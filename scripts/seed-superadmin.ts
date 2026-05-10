// seed-superadmin.ts
// Replacement for the deleted ensureBillingColumns startup logic.
// Promotes one or more users to is_super_admin = true in the database.
// Safe to re-run at any time (idempotent).
// To add new super-admins: append their email to SUPER_ADMIN_EMAILS and re-run.

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const SUPER_ADMIN_EMAILS = [
  "ashokhiremath6@gmail.com",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const email of SUPER_ADMIN_EMAILS) {
      const { rows } = await pool.query(
        "SELECT id, email, is_super_admin FROM users WHERE email = $1",
        [email]
      );

      if (rows.length === 0) {
        console.warn(`  [WARN]  ${email} — user not found, must sign up first`);
        continue;
      }

      const user = rows[0];

      if (user.is_super_admin === true) {
        console.log(`  [SKIP]  ${email} — already super-admin`);
        continue;
      }

      await pool.query(
        "UPDATE users SET is_super_admin = true, updated_at = NOW() WHERE id = $1",
        [user.id]
      );

      console.log(`  [OK]    ${email} — promoted to super-admin`);
    }
  } finally {
    await pool.end();
  }
}

main();
