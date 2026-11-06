import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PremiumPlan, Subscription } from '../../core/models/subscription.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { ClickableDirective } from '../../core/directives/clickable.directive';
import { LEGAL } from '../legal/legal-info';

@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [ClickableDirective, DatePipe, FormsModule],
  templateUrl: './premium.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './premium.component.scss',
})
export class PremiumComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private billing = inject(BillingService);

  avantages = [
    { icon: '🎟️', label: 'Accès aux sorties exclusives Premium' },
    { icon: '🔍', label: 'Voir les profils complets des participants' },
    { icon: '💬', label: 'Messagerie privée illimitée' },
    { icon: '⭐', label: 'Badge Premium visible sur votre profil' },
    { icon: '🔔', label: 'Alertes prioritaires pour les nouvelles sorties' },
    { icon: '🎯', label: 'Recommandations personnalisées' },
  ];

  plans: {
    id: PremiumPlan;
    label: string;
    price: string;
    period: string;
    note?: string;
    highlight: boolean;
  }[] = [
    { id: 'mensuel', label: 'Mensuel', price: '9,99', period: 'mois', highlight: false },
    {
      id: 'annuel',
      label: 'Annuel',
      price: '79,99',
      period: 'an',
      note: '2 mois offerts',
      highlight: true,
    },
  ];

  readonly selectedPlan = signal(1);
  /** Le membre demande l'accès immédiat et renonce à son droit de rétractation. */
  readonly waiver = signal(false);
  readonly subscription = signal<Subscription | null>(null);
  readonly loading = signal(true);
  readonly redirecting = signal(false);
  /** Retour de Stripe : « ok » (payé) ou « annule ». */
  readonly paiement = signal<string | null>(null);
  readonly activating = signal(false);
  readonly errorMessage = signal('');
  private userId = '';

  readonly isSubscribed = computed(() => {
    return this.subscription()?.status === 'active' || this.subscription()?.status === 'past_due';
  });

  async ngOnInit() {
    this.paiement.set(this.route.snapshot.queryParamMap.get('paiement'));
    const {
      data: { user },
    } = await this.authService.getUser();
    this.userId = user?.id ?? '';
    await this.loadSubscription();
    // Après le paiement, Stripe prévient le serveur en quelques secondes : on attend sa confirmation.
    if (this.paiement() === 'ok' && !this.isSubscribed()) {
      this.activating.set(true);
      for (let i = 0; i < 15 && !this.isSubscribed(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.loadSubscription();
      }
      this.activating.set(false);
    }
    this.loading.set(false);
  }

  private async loadSubscription() {
    if (!this.userId) return;
    const { data } = await this.billing.getSubscription(this.userId);
    this.subscription.set(data);
  }

  selectPlan(index: number) {
    this.selectedPlan.set(index);
  }

  async onSubscribe() {
    if (!this.waiver() || this.redirecting()) return;
    this.errorMessage.set('');
    this.redirecting.set(true);
    const error = await this.billing.subscribe(this.plans[this.selectedPlan()].id, this.waiver());
    if (error) {
      this.errorMessage.set(error);
      this.redirecting.set(false);
    }
  }

  async onManage() {
    this.errorMessage.set('');
    this.redirecting.set(true);
    const error = await this.billing.manage();
    if (error) {
      this.errorMessage.set(error);
      this.redirecting.set(false);
    }
  }

  /** Adresse de contact des pages légales : une question avant de s'abonner. */
  readonly contactEmail = LEGAL.contact;

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
