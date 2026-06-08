import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

export interface GeoPlace {
  displayName: string;  // Label affiché dans la liste
  city: string;         // Ville extraite
  country: string;
}

export interface GeoFullPlace {
  displayName: string;  // Nom complet du lieu (restaurant, adresse…)
  shortName: string;    // Nom court (1ère partie)
  address: string;      // Adresse complète
  city: string;
  country: string;
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly API = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  /** Recherche de villes uniquement (pour le filtre "Où ?") */
  searchCities(query: string): Observable<GeoPlace[]> {
    if (!query || query.length < 2) return of([]);

    return this.http.get<any[]>(this.API, {
      params: { q: query, format: 'json', addressdetails: '1', limit: '8', 'accept-language': 'fr' },
      headers: { 'User-Agent': 'FunnyApp/1.0' }
    }).pipe(
      map(results => {
        const seen = new Set<string>();
        const places: GeoPlace[] = [];
        for (const r of results) {
          const addr = r.address ?? {};
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || r.display_name.split(',')[0];
          const country = addr.country ?? '';
          const key = city.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            places.push({ displayName: city + (country ? `, ${country}` : ''), city, country });
          }
        }
        return places;
      }),
      catchError(() => of([]))
    );
  }

  /** Recherche de lieux précis : restaurants, adresses, villes… (pour créer une sortie) */
  searchPlaces(query: string): Observable<GeoFullPlace[]> {
    if (!query || query.length < 2) return of([]);

    return this.http.get<any[]>(this.API, {
      params: { q: query, format: 'json', addressdetails: '1', limit: '8', 'accept-language': 'fr' },
      headers: { 'User-Agent': 'FunnyApp/1.0' }
    }).pipe(
      map(results => results.map(r => {
        const addr = r.address ?? {};
        const parts = r.display_name.split(',');
        const shortName = parts[0].trim();
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const postcode = addr.postcode ?? '';
        const road = addr.road ?? '';
        const houseNumber = addr.house_number ?? '';
        const addressLine = [
          houseNumber ? `${houseNumber} ${road}` : road,
          postcode, city
        ].filter(Boolean).join(', ');

        return {
          displayName: r.display_name,
          shortName,
          address: addressLine || r.display_name,
          city,
          country: addr.country ?? ''
        };
      })),
      catchError(() => of([]))
    );
  }
}
