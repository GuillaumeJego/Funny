// Thèmes de départ de Funny, avec leurs images par défaut (dossier public/images/themes/).
// Lu par themes.mjs, qui les ajoute dans Appwrite. Les admins peuvent ensuite en ajouter,
// en renommer ou en retirer depuis l'espace admin, sans toucher à ce fichier.
//
// L'identifiant de chaque thème sert aussi de nom de fichier pour ses images :
// /images/themes/<id>-1.svg, <id>-2.svg, <id>-3.svg.

export const IMAGES_PER_THEME = 3;

export const DEFAULT_THEMES = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', colors: ['#ff8a5c', '#d9480f'] },
  { id: 'bar', name: 'Bar et apéro', icon: '🍻', colors: ['#fcc419', '#e67700'] },
  { id: 'cafe', name: 'Café et brunch', icon: '☕', colors: ['#c08457', '#7c4a24'] },
  { id: 'cinema', name: 'Cinéma', icon: '🎬', colors: ['#5c7cfa', '#364fc7'] },
  { id: 'concert', name: 'Concert', icon: '🎵', colors: ['#cc5de8', '#862e9c'] },
  { id: 'soiree', name: 'Soirée', icon: '🎉', colors: ['#f06595', '#a61e4d'] },
  { id: 'musee', name: 'Musée et expo', icon: '🖼️', colors: ['#868e96', '#343a40'] },
  { id: 'jeux', name: 'Jeux de société', icon: '🎲', colors: ['#20c997', '#087f5b'] },
  { id: 'sport', name: 'Sport', icon: '⚽', colors: ['#51cf66', '#2b8a3e'] },
  { id: 'randonnee', name: 'Randonnée', icon: '🥾', colors: ['#94d82d', '#5c940d'] },
  { id: 'plage', name: 'Plage', icon: '🏖️', colors: ['#3bc9db', '#0b7285'] },
  { id: 'voyage', name: 'Voyage et week-end', icon: '✈️', colors: ['#4dabf7', '#1864ab'] },
  { id: 'atelier', name: 'Atelier créatif', icon: '🎨', colors: ['#ff922b', '#c2255c'] },
];

export const themeImagePath = (themeId, n) => `/images/themes/${themeId}-${n}.svg`;
