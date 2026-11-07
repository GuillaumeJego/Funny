export interface Sortie {
  id: string;
  title: string;
  description?: string;
  theme_id: string;
  created_by?: string;
  date: string;
  location: string;
  price: number;
  max_participants?: number;
  is_premium: boolean;
  image_url?: string;
  image_source: 'default' | 'custom';
  status: 'draft' | 'published' | 'cancelled';
  created_at?: string;
  /** Fin du délai pour répondre à la question des affinités (posée après la sortie). */
  affinites_jusqua?: string | null;
  /** Position du lieu (carte, distance) ; absente si l'adresse n'a pas été trouvée. */
  lat?: number | null;
  lng?: number | null;
}

export interface SortieWithRelations extends Sortie {
  themes: { name: string; icon: string } | null;
  profiles: { username: string; avatar_url?: string } | null;
  resolvedImageUrl?: string;
  inscriptionsCount?: number;
  /**
   * Sortie Premium vue par un non-abonné : on n'en connaît que l'aperçu (titre, thème, date,
   * image). Elle s'affiche floutée, avec une invitation à s'abonner.
   */
  locked?: boolean;
}

export interface Favori {
  id: string;
  user_id: string;
  sortie_id: string;
  created_at?: string;
}

export interface Inscription {
  id: string;
  sortie_id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at?: string;
}
