export interface Profile {
  id: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  birthdate?: string;
  gender?: string;
  city?: string;
  smoking?: string;
  vaping?: string;
  alcohol?: string;
  children?: string;
  relationship?: string;
  role?: string;
  is_banned?: boolean;
  banned_until?: string;
  ban_reason?: string;
  ban_count?: number;
  total_ban_days?: number;
  view_mode?: 'grid' | 'list';
  subscription_end_date?: string;
  can_view_profiles?: boolean | null;
}

/**
 * Choix de « Situation » (colonne relationship). La valeur est enregistrée telle quelle ;
 * « secret » s'affiche « Ne se prononce pas ». Les anciennes réponses restent valables.
 */
export const RELATIONSHIP_OPTIONS = [
  { value: 'Célibataire', label: 'Célibataire' },
  { value: 'Célibataire en recherche', label: 'Célibataire en recherche' },
  { value: 'En couple', label: 'En couple' },
  { value: 'secret', label: 'Ne se prononce pas' },
] as const;

/** Libellé à afficher pour une valeur de « Situation ». */
export function relationshipLabel(value?: string | null): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '';
}
