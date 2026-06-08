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
}