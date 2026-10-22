// Fonction « stripe-webhook » : reçoit les messages de Stripe (paiement réussi, renouvellement,
// résiliation, paiement refusé) et met le Premium à jour. Elle est appelée par Stripe à
// l'adresse de son domaine, sans session : chaque message est refusé si sa signature,
// calculée avec le secret STRIPE_WEBHOOK_SECRET, n'est pas valable.
import { createApi } from './shared/appwrite.js';
import { syncSubscription, verifySignature } from './shared/stripe.js';

/** Où trouver l'abonnement concerné dans chaque type de message. */
const SUBSCRIPTION_OF = {
  'checkout.session.completed': (object) => object.subscription,
  'customer.subscription.created': (object) => object.id,
  'customer.subscription.updated': (object) => object.id,
  'customer.subscription.deleted': (object) => object.id,
  'invoice.paid': (object) =>
    object.subscription ?? object.parent?.subscription_details?.subscription,
  'invoice.payment_failed': (object) =>
    object.subscription ?? object.parent?.subscription_details?.subscription,
};

export default async ({ req, res, log, error: logError }) => {
  if (req.method !== 'POST') return res.text('Funny : webhook Stripe.', 200);
  const payload = req.bodyText ?? '';
  if (
    !verifySignature(payload, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
  ) {
    return res.json({ ok: false, error: 'Signature invalide.' }, 400);
  }
  try {
    const event = JSON.parse(payload);
    const subscriptionOf = SUBSCRIPTION_OF[event.type];
    const subscriptionId = subscriptionOf?.(event.data?.object ?? {});
    if (!subscriptionId) return res.json({ ok: true, ignored: event.type });
    const result = await syncSubscription(createApi(req), String(subscriptionId));
    log(`${event.type} → ${JSON.stringify(result)}`);
    return res.json({ ok: true, ...result });
  } catch (err) {
    // Une erreur 500 fait réessayer Stripe plus tard : rien n'est perdu.
    logError(err.stack ?? String(err));
    return res.json({ ok: false, error: 'Erreur du serveur.' }, 500);
  }
};
