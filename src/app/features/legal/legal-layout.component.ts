import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LEGAL } from './legal-info';

/** Mise en page commune des pages légales et de l'aide. */
@Component({
  selector: 'app-legal-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="legal-page">
      <button type="button" class="btn-back" (click)="back()">← Retour</button>
      <article class="legal-card">
        <h1>{{ title }}</h1>
        <p class="updated">Mise à jour : {{ legal.miseAJour }}</p>
        <ng-content />
      </article>
      <nav class="legal-nav" aria-label="Informations">
        <a routerLink="/mentions-legales" routerLinkActive="active">Mentions légales</a>
        <a routerLink="/confidentialite" routerLinkActive="active">Confidentialité</a>
        <a routerLink="/conditions" routerLinkActive="active">Conditions d'utilisation</a>
        <a routerLink="/aide" routerLinkActive="active">Aide</a>
      </nav>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './legal.scss',
})
export class LegalLayoutComponent {
  @Input({ required: true }) title!: string;
  legal = LEGAL;

  back() {
    // Ouverte dans un nouvel onglet depuis l'inscription : pas d'historique, on va à l'accueil.
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  }
}
