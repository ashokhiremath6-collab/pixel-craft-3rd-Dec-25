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

  // One-time backfill: assign any remaining null-org vendors to Supriya Vora Designs.
  // Previous migration attempts (0043-0053) missed these rows in production. This runs
  // outside the migration runner so it's not affected by the journal timestamp ordering
  // issue that causes migrations 0039+ to be skipped silently in production.
  // Idempotent: after first run, no rows have org_id = NULL so subsequent runs are no-ops.
  try {
    await db.execute(sql`
      UPDATE vendors
      SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
      WHERE org_id IS NULL
        AND EXISTS (
          SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
        )
    `);
  } catch (err) {
    console.warn("Vendor org backfill skipped:", err);
  }

  // Backfill null-org activity_log entries in production.
  // Pass 1: derive org from project (most activity has a projectId).
  // Pass 2: for vendor activities without a project, derive from vendors.org_id.
  // Pass 3: any remaining nulls get Vora Designs (everything pre-Coonoor was theirs).
  try {
    await db.execute(sql`
      UPDATE activity_log al
      SET org_id = p.org_id
      FROM projects p
      WHERE al.project_id = p.id
        AND al.org_id IS NULL
        AND p.org_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE activity_log al
      SET org_id = v.org_id
      FROM vendors v
      WHERE al.org_id IS NULL
        AND al.activity_type IN ('vendor_create','vendor_update','vendor_delete')
        AND (al.metadata->>'vendorId') = v.id
        AND v.org_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE activity_log
      SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
      WHERE org_id IS NULL
        AND EXISTS (
          SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
        )
    `);
  } catch (err) {
    console.warn("Activity log org backfill skipped:", err);
  }

  // Remove cross-org project_vendor links (vendor.orgId != project.orgId, both non-null).
  // These are data entry errors from before org isolation was enforced.
  try {
    await db.execute(sql`
      DELETE FROM project_vendors pv
      USING vendors v, projects p
      WHERE pv.vendor_id = v.id
        AND pv.project_id = p.id
        AND v.org_id IS NOT NULL
        AND p.org_id IS NOT NULL
        AND v.org_id != p.org_id
    `);
  } catch (err) {
    console.warn("Cross-org project_vendor cleanup skipped:", err);
  }

  // Backfill null-org vendor_invoices rows (set from project's org, then vendor's org as fallback).
  try {
    await db.execute(sql`
      UPDATE vendor_invoices vi
      SET org_id = p.org_id
      FROM projects p
      WHERE vi.project_id = p.id
        AND vi.org_id IS NULL
        AND p.org_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE vendor_invoices vi
      SET org_id = v.org_id
      FROM vendors v
      WHERE vi.vendor_id = v.id
        AND vi.org_id IS NULL
        AND v.org_id IS NOT NULL
    `);
    // Fix any invoice_create activity_log entries whose org_id doesn't match
    // the invoice's actual org (derived from vendor) — corrects pre-fix mismatch.
    await db.execute(sql`
      UPDATE activity_log al
      SET org_id = v.org_id
      FROM vendor_invoices vi
      JOIN vendors v ON vi.vendor_id = v.id
      WHERE (al.metadata->>'invoiceId') = vi.id
        AND al.activity_type = 'invoice_create'
        AND al.org_id != v.org_id
        AND v.org_id IS NOT NULL
    `);
  } catch (err) {
    console.warn("Vendor invoices org backfill skipped:", err);
  }

  // Backfill null-org works_orders and meeting_minutes rows.
  try {
    await db.execute(sql`
      UPDATE works_orders wo
      SET org_id = p.org_id
      FROM project_vendors pv
      JOIN projects p ON pv.project_id = p.id
      WHERE wo.project_vendor_id = pv.id
        AND wo.org_id IS NULL
        AND p.org_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE works_orders
      SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
      WHERE org_id IS NULL
        AND EXISTS (SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07')
    `);
    await db.execute(sql`
      UPDATE meeting_minutes mm
      SET org_id = p.org_id
      FROM projects p
      WHERE mm.project_id = p.id
        AND mm.org_id IS NULL
        AND p.org_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE meeting_minutes
      SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
      WHERE org_id IS NULL
        AND EXISTS (SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07')
    `);
  } catch (err) {
    console.warn("Works order / meeting minutes org backfill skipped:", err);
  }

  // Seed any missing vendor categories (safe: skips names that already exist)
  try {
    await db.execute(sql`
      INSERT INTO vendor_categories (id, name, parent_id, is_active)
      SELECT gen_random_uuid(), v.name, NULL, true
      FROM (VALUES
        ('Special Hardware')
      ) AS v(name)
      WHERE NOT EXISTS (
        SELECT 1 FROM vendor_categories vc WHERE vc.name = v.name
      )
    `);
  } catch (err) {
    console.error("Failed to seed vendor categories:", err);
  }

  // Backfill project_vendors that have a NULL or mismatched org_id — always inherit from their project
  try {
    await db.execute(sql`
      UPDATE project_vendors pv
      SET org_id = p.org_id
      FROM projects p
      WHERE pv.project_id = p.id
        AND p.org_id IS NOT NULL
        AND (pv.org_id IS NULL OR pv.org_id != p.org_id)
    `);
  } catch (err) {
    console.error("Failed to backfill project_vendor org_id:", err);
  }

  // Backfill moodboards.org_id from their project's org_id (rows created before multi-tenant)
  try {
    await db.execute(sql`
      UPDATE moodboards mb
      SET org_id = p.org_id
      FROM projects p
      WHERE mb.project_id = p.id
        AND p.org_id IS NOT NULL
        AND mb.org_id IS NULL
    `);
  } catch (err) {
    console.error("Failed to backfill moodboard org_id:", err);
  }

  // Backfill works_orders.org_id via project_vendor → project chain
  try {
    await db.execute(sql`
      UPDATE works_orders wo
      SET org_id = p.org_id
      FROM project_vendors pv
      JOIN projects p ON pv.project_id = p.id
      WHERE wo.project_vendor_id = pv.id
        AND p.org_id IS NOT NULL
        AND wo.org_id IS NULL
    `);
  } catch (err) {
    console.error("Failed to backfill works_order org_id:", err);
  }

  // Backfill meeting_minutes.org_id from their project's org_id (rows created before multi-tenant)
  try {
    await db.execute(sql`
      UPDATE meeting_minutes mm
      SET org_id = p.org_id
      FROM projects p
      WHERE mm.project_id = p.id
        AND p.org_id IS NOT NULL
        AND mm.org_id IS NULL
    `);
  } catch (err) {
    console.error("Failed to backfill meeting minutes org_id:", err);
  }

  // Patch existing works_order activity rows that are missing vendorName/categoryName in metadata.
  // Idempotent: only updates rows where vendorName is absent.
  try {
    await db.execute(sql`
      UPDATE activity_log al
      SET metadata = al.metadata || jsonb_build_object(
        'vendorName',   v.name,
        'categoryName', pv.category
      )
      FROM works_orders wo
      LEFT JOIN project_vendors pv ON pv.id = wo.project_vendor_id
      LEFT JOIN vendors v ON v.id = pv.vendor_id
      WHERE al.activity_type IN ('works_order_create', 'works_order_uploaded')
        AND (al.metadata->>'worksOrderId') = wo.id::text
        AND (al.metadata->>'vendorName') IS NULL
    `);
  } catch (err) {
    console.error("Failed to patch works order activity metadata:", err);
  }

  // Backfill works_order_create activity entries for any works orders
  // that were uploaded before activity logging was wired up.
  // Uses WHERE NOT EXISTS so it is fully idempotent on every restart.
  try {
    await db.execute(sql`
      INSERT INTO activity_log (
        id, user_id, user_name, user_email, project_id, activity_type,
        file_name, file_path, description, metadata, created_at, org_id
      )
      SELECT
        gen_random_uuid(),
        wo.created_by,
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
          u.email
        ),
        COALESCE(u.email, ''),
        p.id,
        'works_order_create',
        wo.order_number || '.pdf',
        '',
        'uploaded works order ' || wo.order_number,
        jsonb_build_object(
          'worksOrderId',    wo.id,
          'orderNumber',     wo.order_number,
          'projectVendorId', wo.project_vendor_id,
          'projectName',     p.project_name,
          'vendorName',      v.name,
          'categoryName',    pv.category,
          'backfilled',      true
        ),
        wo.created_at,
        u.org_id
      FROM works_orders wo
      JOIN users u ON u.id = wo.created_by
      LEFT JOIN project_vendors pv ON pv.id = wo.project_vendor_id
      LEFT JOIN vendors v ON v.id = pv.vendor_id
      LEFT JOIN projects p ON p.id = pv.project_id
      WHERE NOT EXISTS (
        SELECT 1 FROM activity_log al
        WHERE al.activity_type = 'works_order_create'
          AND (al.metadata->>'worksOrderId') = wo.id
      )
    `);
  } catch (err) {
    console.error("Failed to backfill works order activity logs:", err);
  }

  // Ensure Ashok (ashokhiremath6@gmail.com) is linked to Coonoor Projects as admin
  // so the org switcher appears for him. Fully idempotent.
  try {
    await db.execute(sql`
      INSERT INTO user_roles (id, user_id, role, org_id, is_active, assigned_by, created_at)
      SELECT gen_random_uuid(), '46833846', 'admin', '76fe8e5d-a3f2-4832-b75d-db876476e72f', true, '46833846', NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = '46833846' AND org_id = '76fe8e5d-a3f2-4832-b75d-db876476e72f'
      )
    `);
  } catch (err) {
    console.error("Failed to ensure Ashok Coonoor Projects membership:", err);
  }

  // Ensure Sapna (sapna@starc.in) is linked to Coonoor Projects as designer
  // so the org switcher appears for her. Fully idempotent.
  try {
    await db.execute(sql`
      INSERT INTO user_roles (id, user_id, role, org_id, is_active, assigned_by, created_at)
      SELECT gen_random_uuid(), '48688631', 'designer', '76fe8e5d-a3f2-4832-b75d-db876476e72f', true, '46833846', NOW()
      WHERE EXISTS (SELECT 1 FROM users WHERE id = '48688631')
        AND NOT EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = '48688631' AND org_id = '76fe8e5d-a3f2-4832-b75d-db876476e72f'
        )
    `);
  } catch (err) {
    console.error("Failed to ensure Sapna Coonoor Projects membership:", err);
  }

  // Add project_id column to vendor_payments if it doesn't exist (production DDL gap)
  try {
    await db.execute(sql`
      ALTER TABLE vendor_payments
      ADD COLUMN IF NOT EXISTS project_id VARCHAR REFERENCES projects(id)
    `);
  } catch (err) {
    console.error("Failed to add project_id column to vendor_payments:", err);
  }

  // Backfill vendor_payments for confirmed payment requests that never got a payment entry.
  // Matches by payment_reference (UTR or PR-{id}) to avoid duplicates.
  try {
    await db.execute(sql`
      INSERT INTO vendor_payments (
        id, vendor_id, payment_date, payment_reference, amount,
        payment_method, notes, created_by, org_id, created_at
      )
      SELECT
        gen_random_uuid(),
        pr.vendor_id,
        COALESCE(pr.client_paid_at::date, pr.confirmed_at::date, CURRENT_DATE),
        COALESCE(pr.client_utr, 'PR-' || UPPER(SUBSTRING(pr.id::text, 1, 8))),
        pr.amount::numeric,
        'bank_transfer',
        'Payment received from client. UTR: ' || COALESCE(pr.client_utr, 'N/A') || '. ' || pr.description,
        COALESCE(pr.confirmed_by, pr.requested_by),
        pr.org_id,
        COALESCE(pr.confirmed_at, NOW())
      FROM payment_requests pr
      WHERE pr.status = 'confirmed'
        AND COALESCE(pr.confirmed_by, pr.requested_by) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM vendor_payments vp
          WHERE vp.payment_reference = COALESCE(pr.client_utr, 'PR-' || UPPER(SUBSTRING(pr.id::text, 1, 8)))
        )
    `);
  } catch (err) {
    console.error("Failed to backfill vendor_payments for confirmed payment requests:", err);
  }

  // Create project_messages table if it doesn't exist yet.
  // Migration 0055 is skipped in production due to the journal timestamp ordering
  // issue that affects migrations 0039+. This is the established workaround.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        org_id VARCHAR,
        author_id VARCHAR NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_messages_project_idx ON project_messages (project_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS project_messages_org_idx ON project_messages (org_id)
    `);
  } catch (err) {
    console.error("Failed to create project_messages table:", err);
  }

  // Add attachment columns to project_messages (production DDL gap for migration 0056)
  try {
    await db.execute(sql`ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS attachment_path TEXT`);
    await db.execute(sql`ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT`);
  } catch (err) {
    console.error("Failed to add attachment columns to project_messages:", err);
  }

  // Create project_chat_reads table — tracks who has opened Chat for each project.
  // Used to enforce "badge clears only after 2+ others have read" rule.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_chat_reads (
        project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id    VARCHAR NOT NULL REFERENCES users(id),
        org_id     VARCHAR,
        last_read_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, user_id)
      )
    `);
  } catch (err) {
    console.error("Failed to create project_chat_reads table:", err);
  }

  // Backfill activity_log entries for existing working/concept drawings that were
  // uploaded before the upload-batch endpoint started logging activities.
  try {
    await db.execute(sql`
      INSERT INTO activity_log (id, user_id, user_name, user_email, activity_type, file_name, description, metadata, created_at, org_id)
      SELECT
        gen_random_uuid(),
        COALESCE(dr.uploaded_by, d.created_by),
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
          u.email,
          'Unknown'
        ),
        COALESCE(u.email, ''),
        'working_drawing_upload',
        dr.file_name,
        'uploaded ' || CASE WHEN d.drawing_type = 'concept' THEN 'concept drawing' ELSE 'working drawing' END || ': ' || d.title,
        jsonb_build_object(
          'drawingId', d.id,
          'projectId', d.project_id,
          'projectName', p.project_name,
          'drawingType', d.drawing_type,
          'backfilled', true
        ),
        dr.uploaded_at,
        d.org_id
      FROM drawings d
      JOIN drawing_revisions dr ON dr.drawing_id = d.id AND dr.revision_letter = 'A'
      JOIN users u ON u.id = COALESCE(dr.uploaded_by, d.created_by)
      JOIN projects p ON p.id = d.project_id
      WHERE d.is_template_placeholder = false
        AND COALESCE(dr.uploaded_by, d.created_by) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM activity_log al
          WHERE al.activity_type = 'working_drawing_upload'
            AND (al.metadata->>'drawingId') = d.id
        )
    `);
  } catch (err) {
    console.error("Failed to backfill working drawing activity logs:", err);
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
