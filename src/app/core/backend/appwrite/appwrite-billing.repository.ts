import { Injectable } from '@angular/core';
import { Models } from 'appwrite';
import { PremiumPlan, Subscription } from '../../models/subscription.model';
import { BillingRepository } from '../../repositories/billing.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService, attempt } from './appwrite-client';

type SubscriptionRow = Models.Row & Subscription;

@Injectable()
export class AppwriteBillingRepository extends BillingRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  checkout(plan: PremiumPlan, waiver: boolean, origin: string): Promise<RepositoryResult<string>> {
    return this.url('checkout', { plan, waiver, origin });
  }

  portal(origin: string): Promise<RepositoryResult<string>> {
    return this.url('portal', { origin });
  }

  getSubscription(userId: string): Promise<RepositoryResult<Subscription | null>> {
    return attempt(async () => {
      const row = await this.appwrite.getRowOrNull<SubscriptionRow>('subscriptions', userId);
      if (!row) return null;
      return {
        status: row.status,
        current_period_end: row.current_period_end ?? null,
        cancel_at_period_end: !!row.cancel_at_period_end,
      };
    });
  }

  private async url(action: string, input: Record<string, unknown>) {
    const { data, error } = await this.appwrite.run<{ url: string }>('billing', action, input);
    return { data: data?.url ?? null, error };
  }
}
