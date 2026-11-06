import { Directive, ElementRef, HostListener } from '@angular/core';

/**
 * Rend utilisable au clavier un élément cliquable qui n'est pas un vrai bouton
 * (une carte, une ligne de liste…) : il reçoit le focus avec Tab, il est annoncé comme
 * bouton par les lecteurs d'écran, et Entrée ou Espace font comme un clic.
 */
@Directive({
  selector: '[appClickable]',
  standalone: true,
  host: { role: 'button', tabindex: '0', class: 'clickable' },
})
export class ClickableDirective {
  constructor(private element: ElementRef<HTMLElement>) {}

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.target !== this.element.nativeElement) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.element.nativeElement.click();
  }
}
