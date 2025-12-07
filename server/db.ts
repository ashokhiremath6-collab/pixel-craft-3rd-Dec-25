import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Reduce pipelining to avoid connection issues during long operations
neonConfig.pipelineConnect = false;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with connection management to handle long-running operations
// that may cause idle connections to be terminated by Neon
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Don't keep connections open too long - get a fresh one each time
  max: 10,
  // Close idle connections quickly to avoid stale connection issues
  idleTimeoutMillis: 10000,
  // Time to wait for connection before error
  connectionTimeoutMillis: 30000,
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
  // Don't crash the process - the pool will create a new connection
});

export const db = drizzle({ client: pool, schema });
