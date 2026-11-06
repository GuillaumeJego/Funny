// Ajoute dans Appwrite les thèmes de départ et leurs images par défaut (themes-data.mjs).
// Peut être relancé sans risque : il ne crée que ce qui manque, et ne touche jamais
// à un thème qu’un admin a modifié ou ajouté depuis l’espace admin (un thème de départ
// supprimé dans l’espace admin revient seulement si on relance ce script).
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal
// (droits : rows.read et rows.write) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:themes
//   Remove-Item Env:APPWRITE_API_KEY

import { Client, TablesDB } from 'node-appwrite';
import { DEFAULT_THEMES, IMAGES_PER_THEME, themeImagePath } from './themes-data.mjs';

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

async function createIfMissing(tableId, rowId, data) {
  try {
    await db.getRow({ databaseId, tableId, rowId });
    return false;
  } catch (error) {
    if (error.code !== 404) throw error;
  }
  await db.createRow({ databaseId, tableId, rowId, data });
  return true;
}

try {
  let themes = 0;
  let images = 0;
  for (const theme of DEFAULT_THEMES) {
    if (await createIfMissing('themes', theme.id, { name: theme.name, icon: theme.icon })) {
      themes++;
      console.log(`+ thème « ${theme.name} »`);
    }
    for (let n = 1; n <= IMAGES_PER_THEME; n++) {
      const added = await createIfMissing('theme_images', `${theme.id}-${n}`, {
        theme_id: theme.id,
        image_url: themeImagePath(theme.id, n),
        position: n,
      });
      if (added) images++;
    }
  }
  console.log(`Terminé : ${themes} thème(s) et ${images} image(s) ajoutés.`);
  console.log('Pense à supprimer la clé API dans la console Appwrite.');
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
}
