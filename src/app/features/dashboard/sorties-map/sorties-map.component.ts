import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { SortieWithRelations } from '../../../core/models/sortie.model';

/** L'icône vient de la base : on l'insère comme du texte, jamais comme du code. */
function escapeHtml(text: string): string {
  const span = document.createElement('span');
  span.textContent = text;
  return span.innerHTML;
}

/** Sans sortie ni position : la carte s'ouvre sur la côte d'Émeraude. */
const DEFAULT_CENTER: [number, number] = [48.6, -2.0];

/**
 * Carte des sorties (OpenStreetMap, avec Leaflet chargé seulement à l'ouverture de la carte).
 * Un repère par sortie qui a une position ; un clic ouvre sa fiche.
 */
@Component({
  selector: 'app-sorties-map',
  standalone: true,
  template: `<div #map class="map" role="region" aria-label="Carte des sorties"></div>`,
  styleUrl: './sorties-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortiesMapComponent implements OnDestroy {
  readonly sorties = input<SortieWithRelations[]>([]);
  /** Position du membre (filtre « autour de moi »), affichée en bleu. */
  readonly position = input<{ lat: number; lng: number } | null>(null);
  readonly sortieClicked = output<SortieWithRelations>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;

  constructor() {
    effect(() => {
      const sorties = this.sorties();
      const position = this.position();
      this.draw(sorties, position);
    });
  }

  private async draw(
    sorties: SortieWithRelations[],
    position: { lat: number; lng: number } | null,
  ) {
    if (!this.L) {
      // Leaflet est un module CommonJS : selon l'outil, il arrive sous « default » ou non.
      const mod = await import('leaflet');
      this.L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
    }
    const L = this.L;
    if (!this.map) {
      this.map = L.map(this.container().nativeElement, { zoomControl: true }).setView(
        DEFAULT_CENTER,
        10,
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
    }
    this.layer!.clearLayers();

    const points: Leaflet.LatLngExpression[] = [];
    for (const sortie of sorties) {
      if (sortie.lat == null || sortie.lng == null) continue;
      const icon = L.divIcon({
        className: 'sortie-pin',
        html: `<span class="pin"><span class="pin-icon">${escapeHtml(sortie.themes?.icon ?? '📍')}</span></span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });
      const marker = L.marker([sortie.lat, sortie.lng], { icon, title: sortie.title });
      marker.bindTooltip(sortie.title, { direction: 'top', offset: [0, -34] });
      marker.on('click', () => this.sortieClicked.emit(sortie));
      marker.addTo(this.layer!);
      points.push([sortie.lat, sortie.lng]);
    }
    if (position) {
      L.circleMarker([position.lat, position.lng], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      })
        .bindTooltip('Vous êtes ici')
        .addTo(this.layer!);
      points.push([position.lat, position.lng]);
    }
    if (points.length) {
      this.map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    }
    // La carte vient d'apparaître : Leaflet doit relire sa taille.
    setTimeout(() => this.map?.invalidateSize());
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}
