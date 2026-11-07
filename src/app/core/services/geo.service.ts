import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { Observable, of, timer } from 'rxjs';

export interface GeoPlace {
  displayName: string; // Label affiché dans la liste
  city: string; // Ville extraite
  country: string;
}

export interface GeoTown {
  name: string;
  /** Code postal et département, pour distinguer deux villes du même nom. */
  context: string;
  lat: number;
  lng: number;
}

export interface GeoFullPlace {
  displayName: string; // Nom complet du lieu (restaurant, adresse…)
  shortName: string; // Nom court (1ère partie)
  address: string; // Adresse complète
  city: string;
  country: string;
  lat: number;
  lng: number;
}

/**
 * Recherche d'adresses avec Nominatim (OpenStreetMap). Ses règles d'usage demandent au plus
 * une requête par seconde et la mention « © OpenStreetMap » près des résultats :
 * les requêtes sont donc espacées d'une seconde, et les réponses gardées en mémoire.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  private http = inject(HttpClient);

  private readonly API = 'https://nominatim.openstreetmap.org/search';
  private readonly MIN_INTERVAL_MS = 1000;
  private nextSlot = 0;
  private cache = new Map<string, any[]>();

  private search(query: string): Observable<any[]> {
    const key = query.trim().toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return of(cached);
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = now + wait + this.MIN_INTERVAL_MS;
    return timer(wait).pipe(
      switchMap(() =>
        this.http.get<any[]>(this.API, {
          params: {
            q: query,
            format: 'json',
            addressdetails: '1',
            limit: '8',
            'accept-language': 'fr',
          },
        }),
      ),
      tap((results) => this.cache.set(key, results)),
    );
  }

  /** Recherche de villes uniquement (pour le filtre "Où ?") */
  searchCities(query: string): Observable<GeoPlace[]> {
    if (!query || query.length < 2) return of([]);

    return this.search(query).pipe(
      map((results) => {
        const seen = new Set<string>();
        const places: GeoPlace[] = [];
        for (const r of results) {
          const addr = r.address ?? {};
          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            r.display_name.split(',')[0];
          const country = addr.country ?? '';
          const key = city.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            places.push({ displayName: city + (country ? `, ${country}` : ''), city, country });
          }
        }
        return places;
      }),
      catchError(() => of([])),
    );
  }

  /** Recherche de lieux précis : restaurants, adresses, villes… (pour créer une sortie) */
  searchPlaces(query: string): Observable<GeoFullPlace[]> {
    if (!query || query.length < 2) return of([]);

    return this.search(query).pipe(
      map((results) =>
        results.map((r) => {
          const addr = r.address ?? {};
          const parts = r.display_name.split(',');
          const shortName = parts[0].trim();
          const city = addr.city || addr.town || addr.village || addr.municipality || '';
          const postcode = addr.postcode ?? '';
          const road = addr.road ?? '';
          const houseNumber = addr.house_number ?? '';
          const addressLine = [houseNumber ? `${houseNumber} ${road}` : road, postcode, city]
            .filter(Boolean)
            .join(', ');

          return {
            displayName: r.display_name,
            shortName,
            address: addressLine || r.display_name,
            city,
            country: addr.country ?? '',
            lat: Number(r.lat),
            lng: Number(r.lon),
          };
        }),
      ),
      catchError(() => of([])),
    );
  }

  /** Villes, avec leur position (filtre « Où ? » : une ville et un rayon). */
  searchTowns(query: string): Observable<GeoTown[]> {
    if (!query || query.trim().length < 2) return of([]);
    return this.search(query).pipe(
      map((results) => {
        const seen = new Set<string>();
        const towns: GeoTown[] = [];
        for (const r of results) {
          const addr = r.address ?? {};
          const name = addr.city || addr.town || addr.village || addr.municipality || r.name || '';
          if (!name) continue;
          const context = [addr.postcode, addr.county || addr.state].filter(Boolean).join(', ');
          const key = `${name}|${context}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          towns.push({ name, context, lat: Number(r.lat), lng: Number(r.lon) });
        }
        return towns.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng));
      }),
      catchError(() => of([])),
    );
  }
}
