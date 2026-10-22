import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PremiumPlan, Subscription } from '../../core/models/subscription.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';

@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './premium.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './premium.component.scss',
})
export class PremiumComponent implements OnInit {
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

  selectedPlan = 1;
  /** Le membre demande l'accès immédiat et renonce à son droit de rétractation. */
  waiver = false;
  subscription: Subscription | null = null;
  loading = true;
  redirecting = false;
  /** Retour de Stripe : « ok » (payé) ou « annule ». */
  paiement: string | null = null;
  activating = false;
  errorMessage = '';
  private userId = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private billing: BillingService,
    private cdr: ChangeDetectorRef,
  ) {}

  get isSubscribed() {
    return this.subscription?.status === 'active' || this.subscription?.status === 'past_due';
  }

  async ngOnInit() {
    this.paiement = this.route.snapshot.queryParamMap.get('paiement');
    const {
      data: { user },
    } = await this.authService.getUser();
    this.userId = user?.id ?? '';
    await this.loadSubscription();
    // Après le paiement, Stripe prévient le serveur en quelques secondes : on attend sa confirmation.
    if (this.paiement === 'ok' && !this.isSubscribed) {
      this.activating = true;
      for (let i = 0; i < 15 && !this.isSubscribed; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.loadSubscription();
      }
      this.activating = false;
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  private async loadSubscription() {
    if (!this.userId) return;
    const { data } = await this.billing.getSubscription(this.userId);
    this.subscription = data;
  }

  selectPlan(index: number) {
    this.selectedPlan = index;
  }

  async onSubscribe() {
    if (!this.waiver || this.redirecting) return;
    this.errorMessage = '';
    this.redirecting = true;
    const error = await this.billing.subscribe(this.plans[this.selectedPlan].id, this.waiver);
    if (error) {
      this.errorMessage = error;
      this.redirecting = false;
    }
  }

  async onManage() {
    this.errorMessage = '';
    this.redirecting = true;
    const error = await this.billing.manage();
    if (error) {
      this.errorMessage = error;
      this.redirecting = false;
    }
  }

  contactAdmin() {
    // À relier à la messagerie admin
    alert('Message envoyé aux administrateurs — fonctionnalité à configurer');
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
