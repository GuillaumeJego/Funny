// Crée une cinquantaine de sorties fictives (Saint-Malo, Dinard, Cancale, Dinan…) organisées
// par le compte « developer », pour tester l'appli avec du contenu. Relançable sans risque :
// une sortie de démo déjà là n'est pas recréée. Avec --supprimer, retire toutes les sorties
// de démo (et leurs inscriptions, likes et aperçus).
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal
// (droits : rows.read et rows.write) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:demo                 (créer)
//   npm run appwrite:demo -- --supprimer  (tout retirer)
//   Remove-Item Env:APPWRITE_API_KEY
//
// Plusieurs comptes « developer » ? Choisir l'organisateur avec
//   $env:DEMO_ORGANIZER_ID = "identifiant-du-membre"

import { Client, Permission, Query, Role, TablesDB } from 'node-appwrite';
import { DEMO_SORTIES } from './demo-sorties-data.mjs';
import { IMAGES_PER_THEME, themeImagePath } from './themes-data.mjs';

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
const remove = process.argv.includes('--supprimer');

/** Identifiants fixes : « demo-sortie-01 »… pour ne rien créer deux fois et tout retrouver. */
const sortieId = (i) => `demo-sortie-${String(i + 1).padStart(2, '0')}`;
const inscriptionId = (i) => `demo-insc-${String(i + 1).padStart(2, '0')}`;

async function exists(tableId, rowId) {
  try {
    await db.getRow({ databaseId, tableId, rowId });
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

async function deleteIfExists(tableId, rowId) {
  if (await exists(tableId, rowId)) await db.deleteRow({ databaseId, tableId, rowId });
}

async function listAll(tableId, queries) {
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const { rows } = await db.listRows({
      databaseId,
      tableId,
      queries: [...queries, Query.limit(100), Query.offset(offset)],
    });
    all.push(...rows);
    if (rows.length < 100) return all;
  }
}

async function findOrganizer() {
  if (process.env.DEMO_ORGANIZER_ID) return process.env.DEMO_ORGANIZER_ID;
  // Le rôle est dans « member_status » (une ligne par membre, même identifiant que son profil).
  const statuses = await listAll('member_status', [Query.equal('role', 'developer')]);
  const developers = await Promise.all(
    statuses.map(async (s) => {
      try {
        const profile = await db.getRow({ databaseId, tableId: 'profiles', rowId: s.$id });
        return { id: s.$id, name: profile.username };
      } catch {
        return { id: s.$id, name: '(sans profil)' };
      }
    }),
  );
  if (developers.length === 0) {
    throw new Error('Aucun compte « developer » trouvé. Indique-le avec DEMO_ORGANIZER_ID.');
  }
  if (developers.length > 1) {
    const names = developers.map((d) => `${d.name} (${d.id})`).join(', ');
    throw new Error(`Plusieurs comptes « developer » : ${names}. Choisis avec DEMO_ORGANIZER_ID.`);
  }
  console.log(`Organisateur : ${developers[0].name}`);
  return developers[0].id;
}

/** Date à « jour » jours d'aujourd'hui, à « heure » heure de Paris (12.5 = 12 h 30). */
function dateFor(jour, heure) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + jour));
  // Heure de Paris : UTC+1 en hiver, UTC+2 en été.
  // (Les deux textes sont relus dans le même fuseau : leur écart est celui de Paris.)
  const read = (timeZone) => new Date(date.toLocaleString('en-US', { timeZone })).getTime();
  const offsetHours = Math.round((read('Europe/Paris') - read('UTC')) / 3600000);
  date.setUTCHours(Math.floor(heure) - offsetHours, Math.round((heure % 1) * 60));
  return date.toISOString();
}

/** Mêmes droits que la fonction « sorties » : tous les membres, ou abonnés si Premium. */
function permissions(premium, organizerId) {
  const readers = premium
    ? [Role.team('abonnes'), Role.team('admins'), Role.user(organizerId)]
    : [Role.users('verified')];
  return readers.map((role) => Permission.read(role));
}

async function create() {
  const organizerId = await findOrganizer();
  let created = 0;
  for (const [i, s] of DEMO_SORTIES.entries()) {
    const rowId = sortieId(i);
    if (await exists('sorties', rowId)) continue;
    const data = {
      title: s.title,
      description: s.description,
      theme_id: s.theme,
      created_by: organizerId,
      date: dateFor(s.jour, s.heure),
      location: s.location,
      price: s.prix,
      max_participants: s.places,
      is_premium: !!s.premium,
      image_url: themeImagePath(s.theme, (i % IMAGES_PER_THEME) + 1),
      image_source: 'default',
      status: 'published',
    };
    await db.createRow({
      databaseId,
      tableId: 'sorties',
      rowId,
      data,
      permissions: permissions(data.is_premium, organizerId),
    });
    // L'organisateur est inscrit d'office, comme pour une vraie sortie.
    await db.createRow({
      databaseId,
      tableId: 'inscriptions',
      rowId: inscriptionId(i),
      data: { sortie_id: rowId, user_id: organizerId, status: 'confirmed' },
    });
    // Sortie Premium : aperçu flouté pour les non-abonnés.
    if (data.is_premium) {
      await db.createRow({
        databaseId,
        tableId: 'sorties_apercus',
        rowId,
        data: {
          title: data.title,
          theme_id: data.theme_id,
          date: data.date,
          image_url: data.image_url,
        },
      });
    }
    created++;
    console.log(`+ ${data.title}`);
  }
  console.log(`✅ ${created} sortie(s) de démo créée(s) (${DEMO_SORTIES.length} au total).`);
}

async function removeAll() {
  let removed = 0;
  for (let i = 0; i < DEMO_SORTIES.length; i++) {
    const rowId = sortieId(i);
    if (!(await exists('sorties', rowId))) continue;
    for (const table of ['inscriptions', 'favoris']) {
      for (const row of await listAll(table, [Query.equal('sortie_id', rowId)])) {
        await db.deleteRow({ databaseId, tableId: table, rowId: row.$id });
      }
    }
    await deleteIfExists('sorties_apercus', rowId);
    await db.deleteRow({ databaseId, tableId: 'sorties', rowId });
    removed++;
  }
  console.log(`🗑️  ${removed} sortie(s) de démo supprimée(s).`);
}

try {
  await (remove ? removeAll() : create());
} catch (error) {
  console.error('❌', error.message);
  process.exit(1);
}
