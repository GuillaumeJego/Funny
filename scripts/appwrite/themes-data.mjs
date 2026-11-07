// Thèmes de départ de Funny, avec leurs images par défaut (dossier public/images/themes/).
// Lu par themes.mjs, qui les ajoute dans Appwrite. Les admins peuvent ensuite en ajouter,
// en renommer ou en retirer depuis l'espace admin, sans toucher à ce fichier.
//
// L'identifiant de chaque thème sert aussi de nom de fichier pour ses images :
// /images/themes/<id>-1.webp, <id>-2.webp, <id>-3.webp (photos 1600 × 900).

export const IMAGES_PER_THEME = 8;

export const DEFAULT_THEMES = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
  { id: 'bar', name: 'Bar et apéro', icon: '🍻' },
  { id: 'cafe', name: 'Café et brunch', icon: '☕' },
  { id: 'cinema', name: 'Cinéma', icon: '🎬' },
  { id: 'concert', name: 'Concert', icon: '🎵' },
  { id: 'soiree', name: 'Soirée', icon: '🎉' },
  { id: 'musee', name: 'Musée et expo', icon: '🖼️' },
  { id: 'jeux', name: 'Jeux de société', icon: '🎲' },
  { id: 'sport', name: 'Sport', icon: '⚽' },
  { id: 'randonnee', name: 'Randonnée', icon: '🥾' },
  { id: 'plage', name: 'Plage', icon: '🏖️' },
  { id: 'voyage', name: 'Voyage et week-end', icon: '✈️' },
  { id: 'atelier', name: 'Atelier créatif', icon: '🎨' },
];

export const themeImagePath = (themeId, n) => `/images/themes/${themeId}-${n}.webp`;
