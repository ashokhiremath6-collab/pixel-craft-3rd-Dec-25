import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("Deleting OLIE LIGHTS dummy entries from production...");

  const pr = await db.execute(sql`
    DELETE FROM payment_requests
    WHERE id IN (
      '09fa789d-3699-46b9-9aa2-aa5d081ce03d',
      '17d0300a-6015-4a3c-a646-939e8d30e1fc'
    )
    RETURNING id
  `);
  console.log(`Deleted ${pr.rows.length} payment_request(s):`, pr.rows.map((r: any) => r.id));

  const vp = await db.execute(sql`
    DELETE FROM vendor_payments
    WHERE id = 'd52bf79d-39b0-445c-8b30-66d4ea5dd813'
    RETURNING id
  `);
  console.log(`Deleted ${vp.rows.length} vendor_payment(s):`, vp.rows.map((r: any) => r.id));

  const pv = await db.execute(sql`
    DELETE FROM project_vendors
    WHERE id = '387f7454-7e7c-4ffa-9e9b-909efbdb121a'
    RETURNING id
  `);
  console.log(`Deleted ${pv.rows.length} project_vendor(s):`, pv.rows.map((r: any) => r.id));

  const v = await db.execute(sql`
    DELETE FROM vendors
    WHERE id = 'e7d4e1f0-26ed-4d86-b7b8-ec122e602528'
    RETURNING id, name
  `);
  console.log(`Deleted ${v.rows.length} vendor(s):`, v.rows.map((r: any) => r.name));

  console.log("Done.");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
