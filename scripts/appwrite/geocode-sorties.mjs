// Ajoute la position (latitude, longitude) des sorties qui n'en ont pas encore, pour la
// carte des sorties et le filtre « à moins de X km ». Les nouvelles sorties reçoivent leur
// position à la création ; ce script sert pour les sorties plus anciennes. Relançable.
//
// Il interroge Nominatim (OpenStreetMap) au rythme d'une adresse par seconde, comme le
// demandent ses règles d'usage : compte environ une minute pour 60 sorties.
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal
// (droits : rows.read et rows.write) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:positions
//   Remove-Item Env:APPWRITE_API_KEY

import { Client, Query, TablesDB } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? 'https://appwrite.metanafr.fr/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId || !apiKey) {
  console.error('Il manque APPWRITE_PROJECT_ID ou APPWRITE_API_KEY (voir le haut de ce fichier).');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new TablesDB(client);
const databaseId = 'funny';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Première position trouvée par Nominatim pour cette adresse, ou null. */
async function geocode(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: address, format: 'json', limit: '1', countrycodes: 'fr' });
  const response = await fetch(url, { headers: { 'User-Agent': 'Funny (positions des sorties)' } });
  if (!response.ok) throw new Error(`Nominatim a répondu ${response.status}`);
  const [place] = await response.json();
  return place ? { lat: Number(place.lat), lng: Number(place.lon) } : null;
}

try {
  const missing = [];
  for (let offset = 0; ; offset += 100) {
    const { rows } = await db.listRows({
      databaseId,
      tableId: 'sorties',
      queries: [Query.isNull('lat'), Query.limit(100), Query.offset(offset)],
    });
    missing.push(...rows);
    if (rows.length < 100) break;
  }
  console.log(`${missing.length} sortie(s) sans position.`);
  let found = 0;
  for (const sortie of missing) {
    let position = await geocode(sortie.location);
    // Adresse trop précise ou mal écrite : on se rabat sur la ville (après la dernière virgule).
    const town = sortie.location?.split(',').pop()?.trim();
    if (!position && town && town !== sortie.location?.trim()) {
      await sleep(1100);
      position = await geocode(town);
    }
    if (position) {
      await db.updateRow({ databaseId, tableId: 'sorties', rowId: sortie.$id, data: position });
      found++;
      console.log(`📍 ${sortie.title} — ${sortie.location}`);
    } else {
      console.log(`❔ introuvable : ${sortie.title} — ${sortie.location}`);
    }
    await sleep(1100);
  }
  console.log(`✅ ${found} sortie(s) placée(s) sur la carte.`);
} catch (error) {
  console.error('❌', error.message);
  process.exit(1);
}
