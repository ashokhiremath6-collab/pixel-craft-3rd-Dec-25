import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrate";
import { WebhookHandlers } from "./webhookHandlers";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

// Stripe webhook disabled until billing is configured. See docs/migrations.md for re-enabling.
/*
// Stripe webhook MUST receive the raw body before express.json() parses it.
// This route is intentionally placed before the global json middleware.
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      console.error('[webhook] Error:', message);
      res.status(400).json({ error: message });
    }
  }
);
*/

app.use(express.json({ limit: '100mb' })); // Increased to 100MB to support large file uploads
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path.startsWith("/objects")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run database migrations before starting the server
  try {
    await runMigrations();
  } catch (error) {
    console.error("Failed to run migrations. Exiting...");
    process.exit(1);
  }

  // Seed any missing vendor categories (safe: skips names that already exist)
  try {
    await db.execute(sql`
      INSERT INTO vendor_categories (id, name, parent_id, is_active)
      SELECT gen_random_uuid(), v.name, NULL, true
      FROM (VALUES
        ('Architectural Lighting'),
        ('Decorative Lighting'),
        ('Finishes (Veneer and Laminates)'),
        ('Special Hardware')
      ) AS v(name)
      WHERE NOT EXISTS (
        SELECT 1 FROM vendor_categories vc WHERE vc.name = v.name
      )
    `);
  } catch (err) {
    console.error("Failed to seed vendor categories:", err);
  }

  const server = await registerRoutes(app);

  // Keep the Neon serverless database connection warm to avoid cold-start delays.
  // Neon goes to sleep after ~5 minutes of inactivity; this ping every 4 minutes
  // prevents that, cutting first-query latency from ~1000ms to <50ms.
  setInterval(async () => {
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      // Silent — a failed ping just means the next real query will be slightly slower
    }
  }, 4 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err.limitExceeded) {
      return res.status(403).json({ error: err.message, limitExceeded: true, current: err.current, limit: err.limit, resource: err.resource });
    }
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
