// Petit client de l'API Stripe pour les fonctions de Funny, sans dépendance.
// Les clés viennent des variables du projet Appwrite (posées par scripts/stripe/setup.mjs) :
//   STRIPE_SECRET_KEY      clé secrète Stripe (mode test tant que le lot 12 n'est pas fait)
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (whsec_…)
//   STRIPE_PORTAL_CONFIG   réglages de l'espace client Stripe (bpc_…), facultatif
// STRIPE_API_BASE ne sert qu'aux essais, avec un faux Stripe.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Query, fail } from './appwrite.js';
import { syncPremium } from './premium.js';

/** Identifiants des deux prix Premium, posés par scripts/stripe/setup.mjs. */
export const PRICES = { mensuel: 'funny_premium_mensuel', annuel: 'funny_premium_annuel' };

/** Transforme { a: { b: 1 }, c: [x] } en a[b]=1&c[0]=x, le format attendu par Stripe. */
function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') encode(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) fail(503, 'Le paiement n’est pas encore configuré.');
  const base = process.env.STRIPE_API_BASE || 'https://api.stripe.com';
  const query = method === 'GET' && params ? `?${encode(params)}` : '';
  const response = await fetch(`${base}/v1${path}${query}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : encode(params).toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Stripe ${response.status} : ${data?.error?.message ?? 'erreur'}`);
    error.code = response.status;
    throw error;
  }
  return data;
}

/**
 * Vérifie l'en-tête Stripe-Signature (t=…,v1=…) : HMAC SHA-256 de « t.corps » avec le secret
 * du webhook. Refuse aussi un message trop ancien (rejeu).
 */
export function verifySignature(payload, header, secret, toleranceSeconds = 300) {
  if (!secret || !header) return false;
  const parts = Object.groupBy(
    String(header)
      .split(',')
      .map((part) => part.split('=')),
    ([name]) => name,
  );
  const timestamp = Number(parts.t?.[0]?.[1]);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest();
  return (parts.v1 ?? []).some(([, signature]) => {
    const given = Buffer.from(signature ?? '', 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** États Stripe ramenés aux quatre états de la table « subscriptions ». */
const STATUS = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  canceled: 'canceled',
  paused: 'canceled',
};

/** Fin de la période payée (selon la version de l'API, elle est sur l'abonnement ou sur sa ligne). */
function periodEnd(subscription) {
  const seconds =
    subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Met à jour la ligne, ou la crée. Si un autre message Stripe l'a créée entre-temps, la met à jour. */
async function upsert(api, table, id, data, permissions) {
  if (await api.getRow(table, id)) return api.updateRow(table, id, data);
  try {
    return await api.createRow(table, id, data, permissions);
  } catch (error) {
    if (error.code !== 409) throw error;
    return api.updateRow(table, id, data);
  }
}

/**
 * Recopie un abonnement Stripe dans Funny : table « subscriptions », date de fin du Premium
 * (member_status) et équipe « abonnes ». Relit toujours l'abonnement chez Stripe, pour ne pas
 * dépendre de l'ordre d'arrivée des messages.
 */
export async function syncSubscription(api, subscriptionId) {
  const subscription = await stripe('GET', `/subscriptions/${subscriptionId}`);
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const row = await api.findRow('subscriptions', [Query.equal('stripe_customer_id', customerId)]);
  const userId = subscription.metadata?.appwrite_user_id || row?.user_id;
  if (!userId || !(await api.getRow('profiles', userId))) return { ignored: 'membre inconnu' };

  const status = STATUS[subscription.status] ?? 'incomplete';
  const end = periodEnd(subscription);
  const data = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status,
    current_period_end: end,
    // Les versions récentes de Stripe notent une résiliation en fin de période dans
    // « cancel_at » (une date) et laissent « cancel_at_period_end » à false.
    cancel_at_period_end: !!(subscription.cancel_at_period_end || subscription.cancel_at),
  };
  await upsert(api, 'subscriptions', row?.$id ?? userId, data, [`read("user:${userId}")`]);

  // Premium payé jusqu'à la fin de la période. Un paiement en retard garde le Premium
  // pendant que Stripe réessaie ; un abonnement terminé le retire tout de suite.
  const paid = status === 'active' || status === 'past_due';
  const until = paid ? end : new Date().toISOString();
  const memberStatus = await upsert(api, 'member_status', userId, { subscription_end_date: until });
  await syncPremium(api, userId, memberStatus);
  return { userId, status };
}
