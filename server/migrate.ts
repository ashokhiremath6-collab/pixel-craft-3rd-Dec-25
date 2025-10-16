import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";
import path from "path";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const migrationsFolder = "./migrations";
  
  // Check if migrations folder exists and has SQL files
  if (!fs.existsSync(migrationsFolder)) {
    console.log("ℹ️  No migrations folder found - skipping migrations");
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsFolder).filter(f => f.endsWith('.sql'));
  if (migrationFiles.length === 0) {
    console.log("ℹ️  No migration files found - skipping migrations");
    return;
  }

  console.log("Running database migrations...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}
