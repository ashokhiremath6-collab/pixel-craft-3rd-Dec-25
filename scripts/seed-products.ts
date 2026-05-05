/**
 * Seed Stripe products for Olympik Design subscription plans.
 * Run with: npx tsx scripts/seed-products.ts
 *
 * This script is idempotent — safe to run multiple times.
 */

// Load stripeClient from the server directory
import('../server/stripeClient').then(async ({ getUncachableStripeClient }) => {
  const stripe = await getUncachableStripeClient();
  console.log('Connected to Stripe.');

  const plans = [
    {
      name: 'Starter',
      description: 'For small studios — 3 users, 5 active projects, AI renders included.',
      metadata: { tier: 'starter', maxUsers: '3', maxProjects: '5' },
      monthlyAmount: 4900,  // $49/mo
      yearlyAmount: 47000,  // $470/yr (≈20% off)
    },
    {
      name: 'Pro',
      description: 'For growing firms — unlimited users, unlimited projects, priority support.',
      metadata: { tier: 'pro', maxUsers: 'unlimited', maxProjects: 'unlimited' },
      monthlyAmount: 9900,  // $99/mo
      yearlyAmount: 95000,  // $950/yr (≈20% off)
    },
  ];

  for (const plan of plans) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`${plan.name} product already exists (${existing.data[0].id}). Skipping.`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyAmount,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { interval: 'monthly', tier: plan.metadata.tier },
    });
    console.log(`  Monthly price: $${plan.monthlyAmount / 100}/mo (${monthly.id})`);

    const yearly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.yearlyAmount,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { interval: 'yearly', tier: plan.metadata.tier },
    });
    console.log(`  Yearly price:  $${plan.yearlyAmount / 100}/yr (${yearly.id})`);
  }

  console.log('\nDone. Webhooks will sync these to the local database automatically.');
  process.exit(0);
}).catch(err => {
  console.error('Error seeding products:', err.message);
  process.exit(1);
});
