/** Filtres de la page Statistiques : période (jours inclus, AAAA-MM-JJ) et population. */
export interface StatsQuery {
  from: string;
  to: string;
  /** 'Homme', 'Femme' ou 'secret' (ne se prononce pas ou non renseigné). */
  gender?: string;
  /** Valeur de « Situation » ; 'secret' : ne se prononce pas ou non renseigné. */
  relationship?: string;
}

export interface StatsDay {
  day: string;
  /** Connexions et membres différents. */
  total: number;
  unique: number;
  /** Pages vues, messages envoyés, sorties créées, inscriptions à une sortie. */
  pages: number;
  messages: number;
  sorties: number;
  joins: number;
  /** Nouveaux membres inscrits ce jour-là. */
  members: number;
}

export interface ConnexionStats {
  days: StatsDay[];
  /** Connexions par heure de la journée (0 à 23, heure de Paris). */
  hours: number[];
  /** Pages les plus vues (chemins sans identifiant, ex. « /membres/:id »). */
  pages: { page: string; count: number }[];
  total: number;
  unique: number;
  pageViews: number;
  messages: number;
  sorties: number;
  /** Inscriptions à une sortie (hors organisateur). */
  joins: number;
  /** Nouveaux membres inscrits sur Funny pendant la période. */
  newMembers: number;
}
