// Crée l'aperçu (titre, thème, date, image) des sorties Premium qui n'en ont pas encore.
// Les nouvelles sorties Premium reçoivent leur aperçu toutes seules ; ce script sert une
// fois, pour les sorties Premium créées avant l'arrivée des aperçus. Il peut être relancé
// sans risque : il ne crée que ce qui manque.
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal
// (droits : rows.read et rows.write) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:apercus
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

// Mêmes champs que premiumPreview() dans functions/shared/sorties.js.
const premiumPreview = (sortie) => ({
  title: sortie.title,
  theme_id: sortie.theme_id,
  date: sortie.date,
  image_url: sortie.image_url || null,
});

try {
  let created = 0;
  for (let offset = 0; ; offset += 100) {
    const { rows } = await db.listRows({
      databaseId,
      tableId: 'sorties',
      queries: [Query.equal('is_premium', true), Query.limit(100), Query.offset(offset)],
    });
    for (const sortie of rows) {
      try {
        await db.getRow({ databaseId, tableId: 'sorties_apercus', rowId: sortie.$id });
      } catch (error) {
        if (error.code !== 404) throw error;
        await db.createRow({
          databaseId,
          tableId: 'sorties_apercus',
          rowId: sortie.$id,
          data: premiumPreview(sortie),
        });
        created++;
      }
    }
    if (rows.length < 100) break;
  }
  console.log(`✅ ${created} aperçu(s) de sortie Premium créé(s).`);
} catch (error) {
  console.error('❌', error.message);
  process.exit(1);
}
