import { PremiumPlan, Subscription } from '../models/subscription.model';
import { RepositoryResult } from './repository.types';

/** Paiement du Premium : le serveur parle à Stripe, le navigateur ne reçoit que des adresses. */
export abstract class BillingRepository {
  /**
   * Adresse de la page de paiement Stripe. `waiver` : le membre demande l'accès immédiat
   * et renonce à son droit de rétractation. `origin` : adresse de Funny où revenir ensuite.
   */
  abstract checkout(
    plan: PremiumPlan,
    waiver: boolean,
    origin: string,
  ): Promise<RepositoryResult<string>>;
  /** Adresse de l'espace client Stripe (factures, carte, résiliation). */
  abstract portal(origin: string): Promise<RepositoryResult<string>>;
  abstract getSubscription(userId: string): Promise<RepositoryResult<Subscription | null>>;
}
