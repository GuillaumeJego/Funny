import { Injectable } from '@angular/core';
import { PremiumPlan } from '../models/subscription.model';
import { BillingRepository } from '../repositories/billing.repository';

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private billing: BillingRepository) {}

  /** Ouvre la page de paiement Stripe. Renvoie un message d'erreur si elle n'a pas pu s'ouvrir. */
  async subscribe(plan: PremiumPlan, waiver: boolean): Promise<string | null> {
    return this.open(await this.billing.checkout(plan, waiver, window.location.origin));
  }

  /** Ouvre l'espace client Stripe (factures, carte bancaire, résiliation). */
  async manage(): Promise<string | null> {
    return this.open(await this.billing.portal(window.location.origin));
  }

  getSubscription(userId: string) {
    return this.billing.getSubscription(userId);
  }

  private open({ data, error }: { data: string | null; error: { message: string } | null }) {
    if (error || !data) return error?.message ?? 'Le paiement est indisponible pour le moment.';
    window.location.assign(data);
    return null;
  }
}
