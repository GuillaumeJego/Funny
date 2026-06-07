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
}

export interface SortieWithRelations extends Sortie {
  themes: { name: string; icon: string } | null;
  profiles: { username: string; avatar_url?: string } | null;
  resolvedImageUrl?: string;
  inscriptionsCount?: number;
}

export interface Inscription {
  id: string;
  sortie_id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at?: string;
}