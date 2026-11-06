// Dessine les images par défaut des thèmes (public/images/themes/*.svg) à partir de themes-data.mjs.
// Des illustrations simples et légères, sans droits d'auteur. À relancer après avoir ajouté
// un thème dans themes-data.mjs :
//   node scripts/appwrite/theme-images.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEMES, IMAGES_PER_THEME } from './themes-data.mjs';

const dir = fileURLToPath(new URL('../../public/images/themes/', import.meta.url));
mkdirSync(dir, { recursive: true });

const W = 800;
const H = 450;

// Trois motifs de fond, un par image du thème.
const patterns = [
  // Bulles
  () =>
    [
      [90, 80, 70],
      [700, 380, 110],
      [640, 70, 45],
      [150, 390, 55],
      [420, 420, 30],
    ]
      .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="0.14"/>`)
      .join(''),
  // Vagues
  () =>
    [300, 350, 400]
      .map(
        (y, i) =>
          `<path d="M0 ${y} C 200 ${y - 60}, 400 ${y + 60}, 800 ${y - 20} L800 450 L0 450 Z" fill="#fff" opacity="${0.1 + i * 0.04}"/>`,
      )
      .join(''),
  // Rayures
  () =>
    Array.from(
      { length: 9 },
      (_, i) =>
        `<rect x="${i * 120 - 200}" y="-100" width="40" height="700" fill="#fff" opacity="0.08" transform="rotate(25 400 225)"/>`,
    ).join(''),
];

let count = 0;
for (const theme of DEFAULT_THEMES) {
  const [light, dark] = theme.colors;
  for (let n = 1; n <= IMAGES_PER_THEME; n++) {
    const [from, to] = n === 2 ? [dark, light] : [light, dark];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${theme.name}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
${patterns[(n - 1) % patterns.length]()}
<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="190" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${theme.icon}</text>
</svg>
`;
    writeFileSync(`${dir}${theme.id}-${n}.svg`, svg);
    count++;
  }
}
console.log(`${count} images écrites dans public/images/themes/.`);
