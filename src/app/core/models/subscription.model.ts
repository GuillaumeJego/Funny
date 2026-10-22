/** Abonnement Premium payé du membre connecté, tel que Stripe l'a confirmé au serveur. */
export interface Subscription {
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  /** Fin de la période payée. */
  current_period_end: string | null;
  /** Le membre a résilié : l'abonnement s'arrête à `current_period_end`. */
  cancel_at_period_end: boolean;
}

export type PremiumPlan = 'mensuel' | 'annuel';
