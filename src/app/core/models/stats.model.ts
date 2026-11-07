/** Filtres de la page Statistiques : période (jours inclus, AAAA-MM-JJ) et population. */
export interface StatsQuery {
  from: string;
  to: string;
  /** 'Homme', 'Femme' ou 'secret' (ne se prononce pas ou non renseigné). */
  gender?: string;
  /** Valeur de « Situation » ; 'secret' : ne se prononce pas ou non renseigné. */
  relationship?: string;
}

export interface ConnexionStats {
  /** Par jour : connexions et membres différents. */
  days: { day: string; total: number; unique: number }[];
  /** Connexions par heure de la journée (0 à 23, heure de Paris). */
  hours: number[];
  total: number;
  unique: number;
}
