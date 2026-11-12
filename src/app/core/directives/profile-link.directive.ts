import { Directive, HostListener, inject, input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Rend une photo de profil (ou un bloc photo + pseudo) cliquable : un clic ouvre la fiche du
 * membre. Le clic ne remonte pas à la carte autour (qui, elle, ouvre une sortie, une
 * conversation…). Sans identifiant de membre, l'élément reste un simple affichage.
 */
@Directive({
  selector: '[appProfileLink]',
  standalone: true,
  host: {
    '[attr.role]': 'userId() ? "link" : null',
    '[attr.tabindex]': 'userId() ? 0 : null',
    '[attr.aria-label]': 'userId() ? "Voir le profil" : null',
    '[class.profile-link]': '!!userId()',
  },
})
export class ProfileLinkDirective {
  readonly userId = input<string | null | undefined>(undefined, { alias: 'appProfileLink' });

  private router = inject(Router);

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    const id = this.userId();
    if (!id) return;
    event.stopPropagation();
    event.preventDefault();
    this.router.navigate(['/membres', id]);
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.userId()) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    this.onClick(event);
  }
}
