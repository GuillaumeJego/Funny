import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './premium.component.html',
  styleUrl: './premium.component.scss'
})
export class PremiumComponent {
  avantages = [
    { icon: '🎟️', label: 'Accès aux sorties exclusives Premium' },
    { icon: '🔍', label: 'Voir les profils complets des participants' },
    { icon: '💬', label: 'Messagerie privée illimitée' },
    { icon: '⭐', label: 'Badge Premium visible sur votre profil' },
    { icon: '🔔', label: 'Alertes prioritaires pour les nouvelles sorties' },
    { icon: '🎯', label: 'Recommandations personnalisées' },
  ];

  plans = [
    {
      label: 'Mensuel',
      price: '9,99',
      period: 'mois',
      highlight: false,
    },
    {
      label: 'Annuel',
      price: '79,99',
      period: 'an',
      note: '2 mois offerts',
      highlight: true,
    },
  ];

  selectedPlan = 1;

  constructor(private router: Router) {}

  selectPlan(index: number) {
    this.selectedPlan = index;
  }

  onSubscribe() {
    // Intégration Stripe à configurer
    alert('Paiement à configurer (Stripe)');
  }

  contactAdmin() {
    // À relier à la messagerie admin
    alert('Message envoyé aux administrateurs — fonctionnalité à configurer');
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
