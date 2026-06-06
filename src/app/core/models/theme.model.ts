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