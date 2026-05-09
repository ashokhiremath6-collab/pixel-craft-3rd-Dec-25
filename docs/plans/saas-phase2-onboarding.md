# Self-Service Sign-Up and Onboarding

## What & Why
Right now the only way to get an account is for an existing admin to create one manually. For a public SaaS product, anyone must be able to sign up, automatically get their own isolated organisation, and start using the app without any manual intervention. This phase builds the full self-service onboarding flow.

## Done looks like
- A public sign-up page lets anyone register with name, email, company name, and password
- On registration, a new organisation is created automatically and the registering user becomes its Admin
- A verification email is sent; the user must confirm their email before accessing the app
- After email confirmation, the user lands on a brief onboarding wizard (company name confirmation, invite first team member — skippable)
- An Admin can invite team members via email; invitees receive a link that creates their account inside the same organisation (no new org created)
- The invitation link is time-limited (48 hours) and single-use
- Admins can manage pending invitations (resend or revoke) from the Settings page
- The designer_allowlist system is retired in favour of the invite flow

## Out of scope
- SSO / OAuth login (future)
- Plan selection at sign-up (Phase 3 handles billing; sign-up creates a "trial" org)
- Bulk user import

## Steps
1. **Registration endpoint** — Create POST /api/auth/register-org that accepts name, email, company name, and password; creates the organisation and the admin user atomically; sends a verification email.
2. **Sign-up page** — Build a public registration page with fields for name, email, company name, and password. Redirect to a "check your email" screen after submission.
3. **Onboarding wizard** — After first login post-verification, show a 2-step wizard: confirm company details, optionally invite a team member. Wizard is shown once and then dismissed permanently.
4. **Invitation system (backend)** — Add an `invitations` table (orgId, email, role, token, expiresAt, acceptedAt). Create POST /api/invitations to issue invites and GET /api/invitations/accept/:token to redeem them.
5. **Invitation UI** — Add an Invite Team Members section to Settings where admins can enter an email and role, see pending invitations, and resend or revoke them.
6. **Invite acceptance flow** — When an invitee clicks the link, show a page to set their name and password, then create their account inside the inviting organisation.
7. **Retire designer_allowlist** — Remove the allowlist auto-provisioning logic from the auth flow; existing allowlist entries can be migrated to invitations or ignored.

## Relevant files
- `server/localAuth.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/email.ts`
- `shared/schema.ts`
- `client/src/App.tsx`
- `client/src/pages/AuthPage.tsx`
