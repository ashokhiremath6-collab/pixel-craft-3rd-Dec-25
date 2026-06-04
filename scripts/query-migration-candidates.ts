import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Summary of distinct asset_type / folder values
    const assetTypes = await client.query(
      `SELECT asset_type, folder, COUNT(*)::int n FROM moodboards GROUP BY asset_type, folder ORDER BY asset_type, folder`
    );
    console.log("DISTINCT asset_type / folder combos:");
    for (const r of assetTypes.rows) {
      console.log(`  asset_type=${JSON.stringify(r.asset_type)}  folder=${JSON.stringify(r.folder)}  n=${r.n}`);
    }

    // Full row dump (all 25)
    const all = await client.query(
      `SELECT id, project_id, org_id, name, description, file_name, file_type, file_size,
              tags, asset_type, room_type, folder, uploaded_at, is_latest_version
       FROM moodboards ORDER BY uploaded_at`
    );
    console.log(`\nFULL DUMP (${all.rows.length} rows):`);
    for (const r of all.rows) {
      console.log(JSON.stringify(r));
    }
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
