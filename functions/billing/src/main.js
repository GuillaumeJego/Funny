// Fonction « billing » : ouvre la page de paiement Stripe et l'espace client Stripe.
// Elle n'active jamais le Premium elle-même : seul le webhook (fonction « stripe-webhook »)
// le fait, après la confirmation du paiement par Stripe.
import { Query, fail, handler } from './shared/appwrite.js';
import { PRICES, stripe } from './shared/stripe.js';

/** Adresses où Stripe peut renvoyer le membre après le paiement. */
const ORIGINS = (
  process.env.FUNNY_ORIGINS ??
  'https://funny.metanafr.fr,https://funny-rosy.vercel.app,http://localhost:4200'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function originOf(input) {
  const origin = String(input.origin ?? '');
  if (!ORIGINS.includes(origin)) fail(400, 'Adresse de retour non autorisée.');
  return origin;
}

const subscriptionOf = (api, userId) =>
  api.findRow('subscriptions', [Query.equal('user_id', userId)]);

/** Le client Stripe du membre : créé au premier paiement, puis réutilisé. */
async function customerOf(api, userId, row) {
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const user = await api.call('GET', `/users/${userId}`);
  const customer = await stripe('POST', '/customers', {
    email: user.email,
    name: user.name || undefined,
    metadata: { appwrite_user_id: userId },
  });
  const data = { user_id: userId, stripe_customer_id: customer.id, status: 'incomplete' };
  if (row) await api.updateRow('subscriptions', row.$id, data);
  else await api.createRow('subscriptions', userId, data, [`read("user:${userId}")`]);
  return customer.id;
}

async function checkout({ api, userId, input }) {
  const lookupKey = PRICES[input.plan];
  if (!lookupKey) fail(400, 'Formule inconnue.');
  // Le service démarre tout de suite : la loi demande que le membre renonce expressément
  // à son droit de rétractation de 14 jours. La case est obligatoire, et sa date est gardée.
  if (input.waiver !== true) fail(400, 'Cochez la case sur le droit de rétractation.');
  const origin = originOf(input);

  const row = await subscriptionOf(api, userId);
  if (row && ['active', 'past_due'].includes(row.status)) {
    fail(409, 'Vous êtes déjà abonné. Gérez votre abonnement depuis votre profil.');
  }
  const prices = await stripe('GET', '/prices', { lookup_keys: [lookupKey], active: true });
  const price = prices.data?.[0];
  if (!price) fail(503, 'Cette formule n’est pas encore disponible.');

  const customer = await customerOf(api, userId, row);
  const waiverAt = new Date().toISOString();
  await api.updateRow('subscriptions', (await subscriptionOf(api, userId)).$id, {
    withdrawal_waiver_at: waiverAt,
  });
  const session = await stripe('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: userId,
    line_items: [{ price: price.id, quantity: 1 }],
    locale: 'fr',
    success_url: `${origin}/premium?paiement=ok`,
    cancel_url: `${origin}/premium?paiement=annule`,
    subscription_data: { metadata: { appwrite_user_id: userId, withdrawal_waiver_at: waiverAt } },
  });
  return { url: session.url };
}

async function portal({ api, userId, input }) {
  const origin = originOf(input);
  const row = await subscriptionOf(api, userId);
  if (!row?.stripe_customer_id) fail(404, 'Aucun abonnement à gérer.');
  const session = await stripe('POST', '/billing_portal/sessions', {
    customer: row.stripe_customer_id,
    return_url: `${origin}/profile/edit`,
    configuration: process.env.STRIPE_PORTAL_CONFIG || undefined,
    locale: 'fr',
  });
  return { url: session.url };
}

export default handler({ checkout, portal });
