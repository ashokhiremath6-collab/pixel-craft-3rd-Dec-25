import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { sendPaymentFailedEmail, sendSubscriptionCancelledEmail, sendTrialExpiryEmail } from './email';
import type { User } from '../shared/schema';


/**
 * Find the admin user for a given organisation.
 * Looks up each org member's role via user_roles and returns the first
 * user whose role is 'admin'. Falls back to the first org member if none
 * have the admin role (so at minimum someone gets notified).
 */
async function findOrgAdmin(orgId: string): Promise<User | undefined> {
  const orgUsers: User[] = await storage.getUsersByOrg(orgId);
  for (const user of orgUsers) {
    const roleRow = await storage.getUserRole(user.id);
    if (roleRow?.role === 'admin') return user;
  }
  // Fallback: notify the first member so billing alerts are never silently dropped
  return orgUsers[0];
}

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
      // Fallback: parse payload directly (sync already verified the signature above)
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
          stripeSubscriptionId: undefined,
          currentPeriodEnd: undefined,
        });
        {
          const adminUser = await findOrgAdmin(org.id).catch(() => undefined);
          const notifiedEmail = adminUser?.email ?? null;
          let emailSent = false;
          if (notifiedEmail && adminUser) {
            try {
              const prefs = await storage.getNotificationPreferences(adminUser.id);
              if (prefs.planChanges) {
                const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(adminUser.id).catch(() => undefined);
                await sendSubscriptionCancelledEmail(notifiedEmail, org.name, { unsubscribeToken });
                emailSent = true;
              } else {
                console.info(`[webhook] subscription_cancelled email suppressed for ${notifiedEmail} (planChanges opted out)`);
              }
            } catch (err) {
              console.error('[webhook] subscription_cancelled email error:', err instanceof Error ? err.message : err);
            }
          }
          try {
            await storage.writeSuperAdminAuditLog({
              superAdminId: null,
              action: 'subscription_cancelled_email_sent',
              targetOrgId: org.id,
              targetUserId: adminUser?.id ?? null,
              metadata: { notifiedEmail, emailSent, stripeEventId: event?.id ?? null },
            });
          } catch (err) {
            console.error('[webhook] subscription_cancelled audit error:', err instanceof Error ? err.message : err);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        await storage.updateOrganisation(org.id, { planStatus: 'past_due' });
        {
          const adminUser = await findOrgAdmin(org.id).catch(() => undefined);
          const notifiedEmail = adminUser?.email ?? null;
          let emailSent = false;
          if (notifiedEmail && adminUser) {
            try {
              const prefs = await storage.getNotificationPreferences(adminUser.id);
              if (prefs.paymentFailures) {
                const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(adminUser.id).catch(() => undefined);
                await sendPaymentFailedEmail(notifiedEmail, org.name, { unsubscribeToken });
                emailSent = true;
              } else {
                console.info(`[webhook] payment_failed email suppressed for ${notifiedEmail} (paymentFailures opted out)`);
              }
            } catch (err) {
              console.error('[webhook] payment_failed email error:', err instanceof Error ? err.message : err);
            }
          }
          try {
            await storage.writeSuperAdminAuditLog({
              superAdminId: null,
              action: 'payment_failed_email_sent',
              targetOrgId: org.id,
              targetUserId: adminUser?.id ?? null,
              metadata: { notifiedEmail, emailSent, stripeEventId: event?.id ?? null },
            });
          } catch (err) {
            console.error('[webhook] payment_failed audit error:', err instanceof Error ? err.message : err);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        await storage.updateOrganisation(org.id, { planStatus: 'active' });
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe fires this 3 days before the trial ends
        const org = await storage.getOrganisationByStripeCustomerId(data.customer);
        if (!org) break;
        const trialEnd: number | null = data.trial_end ?? null;
        const daysRemaining = trialEnd
          ? Math.max(0, Math.ceil((trialEnd * 1000 - Date.now()) / 86_400_000))
          : 3;
        {
          const adminUser = await findOrgAdmin(org.id).catch(() => undefined);
          const notifiedEmail = adminUser?.email ?? null;
          let emailSent = false;
          if (notifiedEmail && adminUser) {
            try {
              const prefs = await storage.getNotificationPreferences(adminUser.id);
              if (prefs.trialExpiry) {
                const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(adminUser.id).catch(() => undefined);
                await sendTrialExpiryEmail(notifiedEmail, org.name, daysRemaining, { unsubscribeToken });
                emailSent = true;
              } else {
                console.info(`[webhook] trial_will_end email suppressed for ${notifiedEmail} (trialExpiry opted out)`);
              }
            } catch (err) {
              console.error('[webhook] trial_will_end email error:', err instanceof Error ? err.message : err);
            }
          }
          try {
            await storage.writeSuperAdminAuditLog({
              superAdminId: null,
              action: 'trial_expiry_email_sent',
              targetOrgId: org.id,
              targetUserId: adminUser?.id ?? null,
              metadata: { notifiedEmail, emailSent, daysRemaining, stripeEventId: event?.id ?? null },
            });
          } catch (err) {
            console.error('[webhook] trial_will_end audit error:', err instanceof Error ? err.message : err);
          }
        }
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
  const item = subscription.items?.data?.[0];
  if (item?.price?.metadata?.tier) return item.price.metadata.tier;
  if (item?.plan?.metadata?.tier) return item.plan.metadata.tier;
  return 'starter';
}
