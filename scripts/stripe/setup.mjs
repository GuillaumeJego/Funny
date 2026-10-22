// Prépare les abonnements Premium dans Stripe et relie Stripe au projet Appwrite.
// Peut être relancé sans risque : il ne crée que ce qui manque.
//
//  1. Stripe : le produit « Funny Premium » et ses deux prix (9,99 €/mois, 79,99 €/an),
//     les réglages de l'espace client (factures, carte, résiliation) et le webhook.
//  2. Appwrite : l'adresse de la fonction stripe-webhook (domaine) et les variables
//     STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET et STRIPE_PORTAL_CONFIG, enregistrées
//     comme secrètes : elles ne s'affichent nulle part, ni dans la console ni ici.
//
// Utilisation (PowerShell), après « npm run appwrite:functions », avec deux clés collées
// dans le terminal (jamais dans le chat) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   $env:STRIPE_SECRET_KEY = Read-Host "Colle la clé secrète Stripe de TEST"
//   npm run stripe:setup
//   Remove-Item Env:APPWRITE_API_KEY, Env:STRIPE_SECRET_KEY
//
// Clé Appwrite : droits project.read, project.write, rules.read, rules.write.
// Facultatif : $env:STRIPE_WEBHOOK_DOMAIN (par défaut paiement.metanafr.fr),
// $env:STRIPE_PRODUCT_NAME (par défaut « Funny Premium »).

const endpoint = process.env.APPWRITE_ENDPOINT ?? 'https://appwrite.metanafr.fr/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const appwriteKey = process.env.APPWRITE_API_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeBase = process.env.STRIPE_API_BASE || 'https://api.stripe.com';
const domain = process.env.STRIPE_WEBHOOK_DOMAIN ?? 'paiement.metanafr.fr';
const webhookUrl = process.env.STRIPE_WEBHOOK_URL ?? `https://${domain}/`;
const productName = process.env.STRIPE_PRODUCT_NAME ?? 'Funny Premium';

if (!projectId || !appwriteKey || !stripeKey) {
  console.error(
    'Il manque APPWRITE_PROJECT_ID, APPWRITE_API_KEY ou STRIPE_SECRET_KEY (voir le haut de ce fichier).',
  );
  process.exit(1);
}
// Lot 10 : mode test seulement. Le passage aux vrais paiements se fera au lot 12.
if (/^(sk|rk)_live_/.test(stripeKey) && process.env.STRIPE_LIVE !== 'oui') {
  console.error('Cette clé Stripe est une clé RÉELLE. Utilise la clé de TEST (sk_test_…).');
  process.exit(1);
}

const PLANS = [
  { lookupKey: 'funny_premium_mensuel', amount: 999, interval: 'month', label: 'Mensuel' },
  { lookupKey: 'funny_premium_annuel', amount: 7999, interval: 'year', label: 'Annuel' },
];

const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
];

function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') encode(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function stripe(method, path, params) {
  const query = method === 'GET' && params ? `?${encode(params)}` : '';
  const response = await fetch(`${stripeBase}/v1${path}${query}`, {
    method,
    headers: {
      authorization: `Bearer ${stripeKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : encode(params).toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Stripe : ${data?.error?.message ?? response.status}`);
  return data;
}

async function appwrite(method, path, body) {
  const response = await fetch(endpoint + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-appwrite-project': projectId,
      'x-appwrite-key': appwriteKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Appwrite : ${data?.message ?? response.status}`);
  return data;
}

const log = (sign, text) => console.log(`${sign} ${text}`);

async function ensurePrices() {
  const existing = await stripe('GET', '/prices', {
    lookup_keys: PLANS.map((plan) => plan.lookupKey),
    active: true,
  });
  const found = new Set(existing.data.map((price) => price.lookup_key));
  const missing = PLANS.filter((plan) => !found.has(plan.lookupKey));
  if (!missing.length) return log('·', 'prix Premium déjà présents');
  const product =
    existing.data[0]?.product ?? (await stripe('POST', '/products', { name: productName })).id;
  for (const plan of missing) {
    await stripe('POST', '/prices', {
      product: typeof product === 'string' ? product : product.id,
      currency: 'eur',
      unit_amount: plan.amount,
      recurring: { interval: plan.interval },
      lookup_key: plan.lookupKey,
      nickname: plan.label,
    });
    log('+', `prix ${plan.label} (${(plan.amount / 100).toFixed(2).replace('.', ',')} €)`);
  }
}

/** Espace client : factures, changement de carte et résiliation à la fin de la période. */
async function ensurePortal() {
  const list = await stripe('GET', '/billing_portal/configurations', { limit: 100 });
  const mine = list.data.find((config) => config.metadata?.funny === 'premium' && config.active);
  if (mine) {
    log('·', 'espace client Stripe déjà réglé');
    return mine.id;
  }
  const config = await stripe('POST', '/billing_portal/configurations', {
    business_profile: { headline: productName },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
    },
    metadata: { funny: 'premium' },
  });
  log('+', 'espace client Stripe réglé');
  return config.id;
}

/** Le secret d'un webhook ne se lit qu'à sa création : un webhook existant est recréé. */
async function createWebhook() {
  const list = await stripe('GET', '/webhook_endpoints', { limit: 100 });
  for (const old of list.data.filter((hook) => hook.url === webhookUrl)) {
    await stripe('DELETE', `/webhook_endpoints/${old.id}`);
  }
  const hook = await stripe('POST', '/webhook_endpoints', {
    url: webhookUrl,
    enabled_events: EVENTS,
    description: 'Funny : Premium',
  });
  log('+', `webhook Stripe vers ${webhookUrl}`);
  return hook.secret;
}

async function ensureDomain() {
  const rules = await appwrite('GET', '/proxy/rules');
  if (rules.rules.some((rule) => rule.domain === domain)) {
    return log('·', `adresse ${domain} déjà reliée à la fonction stripe-webhook`);
  }
  await appwrite('POST', '/proxy/rules/function', { domain, functionId: 'stripe-webhook' });
  log('+', `adresse ${domain} reliée à la fonction stripe-webhook`);
}

async function setVariable(key, value) {
  const list = await appwrite('GET', '/project/variables');
  const existing = list.variables.find((variable) => variable.key === key);
  if (existing) {
    await appwrite('PUT', `/project/variables/${existing.$id}`, { key, value, secret: true });
  } else {
    await appwrite('POST', '/project/variables', {
      variableId: 'unique()',
      key,
      value,
      secret: true,
    });
  }
  log('+', `variable secrète ${key}`);
}

try {
  await ensurePrices();
  const portalConfig = await ensurePortal();
  await ensureDomain();
  const webhookSecret = await createWebhook();
  await setVariable('STRIPE_SECRET_KEY', stripeKey);
  await setVariable('STRIPE_WEBHOOK_SECRET', webhookSecret);
  await setVariable('STRIPE_PORTAL_CONFIG', portalConfig);
  console.log('Terminé.');
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
}
