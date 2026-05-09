# Migrate to Custom Email/Password Authentication

## What & Why

Replace the current Replit OIDC authentication with a standard email + password
login system, including forgot-password email flow. All existing user data
(vendors, projects, renders, floor plans, working drawings, etc.) must stay
completely intact — existing Replit users simply use "Forgot Password" on first
login to set a new password, since their email is already in the database.

## Done looks like

- A proper login page with email + password fields and a "Forgot password?" link
- Forgot password flow: enter email → receive a reset link by email → click link → set new password
- Email verification for newly registered accounts
- Existing user ashokhiremath6@gmail.com (and any others) can log in with their email — all their old data (projects, renders, moodboards, floor plans, etc.) appears exactly as before
- No Replit login redirect — the app stays fully self-contained
- Admin can still invite new users and assign roles from the Settings page
- Role-based access (admin / designer / project_manager / client) works exactly as before

## Out of scope

- Social/OAuth login (Google, GitHub, etc.)
- Multi-factor authentication
- Changing any existing data or user IDs — all foreign keys stay as-is

## Tasks

1. **Extend users schema** — Add `passwordHash`, `emailVerifiedAt`, `emailVerificationToken`, `passwordResetToken`, `passwordResetTokenExpiry` columns to the `users` table in `shared/schema.ts`. Keep the `id` column as-is (varchar — Replit numeric IDs stay untouched). Push the schema change with `npm run db:push`.

2. **Install email package** — Install `nodemailer` and `@types/nodemailer`. Add env var stubs for `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

3. **Create email service** (`server/email.ts`) — nodemailer-based helper that sends password reset and email verification emails. Reads SMTP credentials from env vars. Gracefully logs a warning if SMTP is not configured (so the app doesn't crash in dev).

4. **Create local auth module** (`server/localAuth.ts`) — Replaces `server/replitAuth.ts`. Sets up `passport-local` strategy: looks up user by email, verifies bcrypt password hash. Keeps the same PostgreSQL session store (`getSession()`). Exposes `setupAuth(app)`, `isAuthenticated` middleware, `requireAuth`, `requireAdmin`, `requireAdminOnly`, `requireProjectManagerOrAdmin` middleware helpers — all using `(req.user as any).id` instead of `(req.user as any).claims.sub`. New API endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/verify-email/:token`. Keep `GET /api/auth/user` working.

5. **Update server/index.ts and server/routes.ts** — Switch import from `replitAuth` to `localAuth`. Do a global find/replace of `(req.user as any).claims.sub` → `(req.user as any).id` across the ~80 occurrences in `routes.ts`. Remove Replit-only endpoints (`/api/login`, `/api/callback`, `/api/logout` redirect to Replit).

6. **Add storage methods for the new auth columns** — Add `getUserByEmail`, `setPasswordHash`, `setEmailVerificationToken`, `verifyEmail`, `setPasswordResetToken`, `resetPassword` methods to `IStorage` and `DBStorage` in `server/storage.ts`.

7. **Build auth frontend pages** — Create `client/src/pages/LoginPage.tsx` (email + password form, forgot password link), `client/src/pages/ForgotPasswordPage.tsx` (email input, "send reset link" button), `client/src/pages/ResetPasswordPage.tsx` (new password + confirm, reads token from URL query). Register routes in `client/src/App.tsx`. Update `client/src/hooks/useAuth.ts` so `login()` navigates to `/login` instead of `/api/login`.

8. **Data migration note for existing users** — No SQL migration needed. Existing Replit users (whose email is already in the DB) simply use Forgot Password on first login to set their password. New registrations go through the email verification flow. The admin account (ashokhiremath6@gmail.com) should be documented to use Forgot Password first.

## Relevant files

- `shared/schema.ts:797-806` — users table definition
- `server/replitAuth.ts` — current auth (to be replaced)
- `server/routes.ts` — 80 occurrences of `claims.sub` to update
- `server/storage.ts:1242-1270` — DBStorage user methods
- `client/src/hooks/useAuth.ts` — frontend auth hook
- `client/src/App.tsx` — router, needs new auth routes
- `server/index.ts` — entry point, imports replitAuth
