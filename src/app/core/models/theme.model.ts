/** Thème « Autre » : pas dans la liste des thèmes, l'organisateur écrit son nom (et met sa photo). */
export const OTHER_THEME_ID = 'autre';

export interface Theme {
  id: string;
  name: string;
  icon: string;
  created_by?: string;
  created_at?: string;
}

export interface ThemeImage {
  id: string;
  theme_id: string;
  image_url: string;
  position: number;
}
