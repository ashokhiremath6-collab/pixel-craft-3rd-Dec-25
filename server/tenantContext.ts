// server/tenantContext.ts
// Per-request transaction + AsyncLocalStorage context for tenant isolation.
//
// What this does:
//   For authenticated requests with a known orgId, opens a Drizzle
//   transaction, sets app.current_org_id as a transaction-local Postgres
//   setting (via set_config(..., true)), and stores the transaction
//   client in txStorage so storage methods that call requestDb() see
//   the transaction-scoped client instead of the module-level db.
//
// For unauthenticated requests (or requests where req.user has no
// orgId), this middleware is a no-op: it calls next() without opening
// any transaction. That keeps login, signup, public-token endpoints,
// health checks, etc. behaving exactly as before.
//
// This middleware is NOT yet wired into any production route — it is
// being smoke-tested end-to-end first.

import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db, txStorage } from "./db";

export function withRequestOrg(req: Request, res: Response, next: NextFunction): void {
  const orgId = req.user?.orgId;

  // No org context: pass through with no transaction.
  if (!orgId) {
    return next();
  }

  // We open a transaction, set the session variable, then run next()
  // inside the AsyncLocalStorage scope. The transaction commits when
  // the response finishes successfully; it rolls back on error or if
  // the connection closes before response completion.
  let settled = false;

  db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);

    await new Promise<void>((resolve, reject) => {
      const finalize = (errored: boolean) => {
        if (settled) return;
        settled = true;
        if (errored) reject(new Error("Request errored — rolling back transaction"));
        else resolve();
      };

      // res 'finish' fires after the response is fully sent.
      // res 'close' fires if the underlying connection closes early.
      res.on("finish", () => finalize(res.statusCode >= 500));
      res.on("close", () => {
        if (!settled) finalize(true);
      });

      txStorage.run(tx, () => {
        try {
          next();
        } catch (err) {
          finalize(true);
        }
      });
    });
  }).catch((err) => {
    if (!res.headersSent) {
      next(err);
    } else {
      console.error("Request transaction rolled back after response sent:", err);
    }
  });
}
