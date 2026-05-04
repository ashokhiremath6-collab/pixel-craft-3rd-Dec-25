import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from './email';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // 1. stripe-replit-sync handles event verification + DB sync to stripe schema
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // 2. Parse the event to update our organisations table
    try {
      const stripe = await getUncachableStripeClient();
      const event = stripe.webhooks.constructEventAsync
        ? await (stripe.webhooks as any).constructEventAsync(payload, signature, '')
        : null;

      // Fallback: parse payload directly (sync already verified signature)
      const body = JSON.parse(payload.toString());
      await WebhookHandlers.handleStripeEvent(body);
    } catch (err) {
      // Non-fatal: stripe schema is already updated by sync; org table update is best-effort
      console.error('[webhook] Post-sync org update error:', err instanceof Error ? err.message : err);
    }
  }

  static async handleStripeEvent(event: any): Promise<void> {
    const type = event?.type;
    const data = event?.data?.object;

    if (!type || !data) return;

    switch (type) {
      case 'checkout.session.completed': {
        // Payment succeeded — link org to Stripe customer + subscription
        if (data.mode !== 'subscription') break;
        const orgId = data.metadata?.orgId;
        if (!orgId) break;
        await storage.updateOrganisation(orgId, {
          stripeCustomerId: data.customer,
          stripeSubscriptionId: data.subscription,
          plan: data.metadata?.plan || 'starter',
          planStatus: 'active',
        });
        break;
      }

      case 'customer.subscription.updated': {
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        const plan = data.metadata?.plan || deriveplan(data);
        await storage.updateOrganisation(org.id, {
          stripeSubscriptionId: data.id,
          plan,
          planStatus: mapStatus(data.status),
          currentPeriodEnd: data.current_period_end
            ? new Date(data.current_period_end * 1000)
            : undefined,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        await storage.updateOrganisation(org.id, {
          plan: 'trial',
          planStatus: 'cancelled',
          stripeSubscriptionId: null as any,
          currentPeriodEnd: null as any,
        });
        // Notify admin by email
        try {
          const adminUsers = await storage.getUsersByOrg(org.id);
          const admin = adminUsers.find(u => (u as any).role === 'admin') || adminUsers[0];
          if (admin?.email) {
            await sendSubscriptionCancelledEmail(admin.email, org.name);
          }
        } catch { /* best-effort */ }
        break;
      }

      case 'invoice.payment_failed': {
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        await storage.updateOrganisation(org.id, { planStatus: 'past_due' });
        // Notify admin by email
        try {
          const adminUsers = await storage.getUsersByOrg(org.id);
          const admin = adminUsers.find(u => (u as any).role === 'admin') || adminUsers[0];
          if (admin?.email) {
            await sendPaymentFailedEmail(admin.email, org.name);
          }
        } catch { /* best-effort */ }
        break;
      }

      case 'invoice.payment_succeeded': {
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        await storage.updateOrganisation(org.id, { planStatus: 'active' });
        break;
      }

      default:
        break;
    }
  }
}

function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'cancelled': return 'cancelled';
    default: return 'active';
  }
}

function deriveplan(subscription: any): string {
  // Try to derive from metadata on items
  const item = subscription.items?.data?.[0];
  if (item?.price?.metadata?.tier) return item.price.metadata.tier;
  if (item?.plan?.metadata?.tier) return item.plan.metadata.tier;
  return 'starter';
}
