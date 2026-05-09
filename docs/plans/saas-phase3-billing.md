# Stripe Billing and Subscriptions

## What & Why
To monetise the product, organisations need to subscribe to a paid plan. This phase integrates Stripe to handle plan selection, payment collection, subscription lifecycle (upgrades, downgrades, renewals, cancellations), and failed payment recovery.

## Done looks like
- A Billing page in Settings shows the current plan, next renewal date, and a button to upgrade or manage the subscription
- Clicking Upgrade opens a plan selection screen (e.g. Starter / Pro / Enterprise) with pricing displayed
- Payment is handled via Stripe Checkout — no card data touches the app server
- After a successful payment the organisation's plan field updates immediately and the UI reflects the new tier
- Stripe webhooks keep the subscription status in sync (renewals, failed payments, cancellations)
- When a subscription lapses, the org is downgraded gracefully to the trial/free tier
- Admins receive an email when a payment fails and when a subscription is cancelled

## Out of scope
- Per-seat pricing (flat per-org pricing only for now)
- Invoicing and receipt generation beyond what Stripe provides natively
- Multiple payment methods per org

## Steps
1. **Stripe setup** — Install the Stripe SDK, store the Stripe secret key and webhook signing secret as environment secrets, and create a Stripe configuration module.
2. **Subscription schema** — Add `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `planStatus` (active / trialing / past_due / cancelled), and `currentPeriodEnd` to the `organisations` table. Run a migration.
3. **Checkout endpoint** — Create POST /api/billing/checkout that creates a Stripe Checkout Session for the selected plan and returns the checkout URL.
4. **Webhook handler** — Create POST /api/billing/webhook (unauthenticated, signature-verified) that handles `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, and `customer.subscription.deleted` events, updating the org record accordingly.
5. **Billing portal endpoint** — Create POST /api/billing/portal that creates a Stripe Customer Portal session so admins can update payment methods, download invoices, or cancel.
6. **Billing UI** — Add a Billing tab to Settings showing plan name, status, renewal date, and buttons for Upgrade and Manage Billing (links to Stripe portal). Show a "Trial" banner in the app header when on the trial plan.
7. **Plan selection screen** — Build a plan comparison page listing the tiers with features and pricing. Selecting a plan triggers the checkout flow.
8. **Email notifications** — Send an internal email (via the existing email module) on payment failure and on cancellation, prompting the admin to update billing details.

## Relevant files
- `server/routes.ts`
- `server/storage.ts`
- `server/email.ts`
- `shared/schema.ts`
- `client/src/App.tsx`
