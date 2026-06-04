// Verification script using the same neon-serverless pool the app uses.
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const dbRow = await client.query("SELECT current_database(), current_user, version()");
    console.log("Connected to:", dbRow.rows[0]);

    const TABLES = ['rooms','drawings','drawing_revisions','drawing_approvals','revision_events','drawing_comments'];

    for (const tbl of TABLES) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`TABLE: ${tbl}`);
      console.log('═'.repeat(60));

      const cols = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tbl]
      );
      console.log(`COLUMNS (${cols.rows.length}):`);
      for (const r of cols.rows) {
        const def = r.column_default ? ` default=${r.column_default}` : '';
        console.log(`  ${r.column_name.padEnd(24)} ${r.data_type.padEnd(18)} nullable=${r.is_nullable}${def}`);
      }

      const idx = await client.query(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = $1 ORDER BY indexname`,
        [tbl]
      );
      console.log(`INDEXES (${idx.rows.length}):`);
      for (const r of idx.rows) {
        console.log(`  ${r.indexname}`);
        console.log(`    ${r.indexdef}`);
      }

      const fks = await client.query(
        `SELECT kcu.column_name, ccu.table_name AS foreign_table,
                ccu.column_name AS foreign_column, rc.delete_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         JOIN information_schema.referential_constraints rc
           ON tc.constraint_name = rc.constraint_name
         JOIN information_schema.constraint_column_usage ccu
           ON rc.unique_constraint_name = ccu.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public' AND tc.table_name = $1
         ORDER BY kcu.column_name`,
        [tbl]
      );
      console.log(`FOREIGN KEYS (${fks.rows.length}):`);
      for (const r of fks.rows) {
        console.log(`  ${r.column_name} -> ${r.foreign_table}(${r.foreign_column}) ON DELETE ${r.delete_rule}`);
      }
    }

    // Row counts
    console.log(`\n${'═'.repeat(60)}`);
    console.log('ROW COUNTS:');
    for (const tbl of TABLES) {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${tbl}"`);
      console.log(`  ${tbl.padEnd(24)} ${r.rows[0].n} rows`);
    }

    console.log('\nVerification complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
