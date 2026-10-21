// Crée dans le projet Appwrite de Funny tout ce que décrit schema.mjs : base, tables, colonnes,
// index, espaces de stockage et équipes. Peut être relancé sans risque : il ne crée que ce
// qui manque, remet les droits des tables et du stockage comme dans schema.mjs, et ne
// supprime jamais rien.
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:setup
//   Remove-Item Env:APPWRITE_API_KEY

import { Client, Storage, TablesDB, Teams } from 'node-appwrite';
import { BUCKETS, DATABASE_ID, DATABASE_NAME, TABLES, TEAMS } from './schema.mjs';

const endpoint = process.env.APPWRITE_ENDPOINT ?? 'https://appwrite.metanafr.fr/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId || !apiKey) {
  console.error('Il manque APPWRITE_PROJECT_ID ou APPWRITE_API_KEY (voir le haut de ce fichier).');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new TablesDB(client);
const storage = new Storage(client);
const teams = new Teams(client);

const TEXT_SIZE = 10000; // colonnes « text » : chaîne longue, compatible avec toutes les versions

const log = (symbol, message) => console.log(`${symbol} ${message}`);

async function exists(fetch) {
  try {
    await fetch();
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

async function ensureDatabase() {
  if (await exists(() => db.get({ databaseId: DATABASE_ID }))) {
    log('·', `base « ${DATABASE_ID} » déjà là`);
    return;
  }
  await db.create({ databaseId: DATABASE_ID, name: DATABASE_NAME });
  log('+', `base « ${DATABASE_ID} » créée`);
}

function createColumn(tableId, column) {
  const base = { databaseId: DATABASE_ID, tableId, key: column.key, required: !!column.required };
  const xdefault = column.required ? undefined : column.default;
  switch (column.type) {
    case 'string':
      return db.createStringColumn({ ...base, size: column.size, xdefault });
    case 'text':
      return db.createStringColumn({ ...base, size: TEXT_SIZE, xdefault });
    case 'stringArray':
      return db.createStringColumn({ ...base, size: column.size, array: true });
    case 'enum':
      return db.createEnumColumn({ ...base, elements: column.elements, xdefault });
    case 'datetime':
      return db.createDatetimeColumn({ ...base, xdefault });
    case 'integer':
      return db.createIntegerColumn({ ...base, xdefault });
    case 'float':
      return db.createFloatColumn({ ...base, xdefault });
    case 'boolean':
      return db.createBooleanColumn({ ...base, xdefault });
    default:
      throw new Error(`Type de colonne inconnu : ${column.type}`);
  }
}

// Appwrite crée les colonnes en arrière-plan : on attend qu'elles soient prêtes avant les index.
async function waitUntilAvailable(list, label) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const items = await list();
    const failed = items.filter((item) => item.status === 'failed');
    if (failed.length) {
      throw new Error(`${label} en échec : ${failed.map((i) => i.key).join(', ')}`);
    }
    if (items.every((item) => item.status === 'available')) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} : toujours en cours de création après 60 secondes`);
}

async function ensureTable(table) {
  const params = {
    databaseId: DATABASE_ID,
    tableId: table.id,
    name: table.name,
    permissions: table.permissions,
    rowSecurity: table.rowSecurity,
  };
  if (await exists(() => db.getTable({ databaseId: DATABASE_ID, tableId: table.id }))) {
    await db.updateTable(params);
    log('·', `table « ${table.id} » déjà là (droits remis à jour)`);
  } else {
    await db.createTable(params);
    log('+', `table « ${table.id} » créée`);
  }

  const listColumns = async () =>
    (await db.listColumns({ databaseId: DATABASE_ID, tableId: table.id })).columns;
  const existingColumns = new Set((await listColumns()).map((c) => c.key));
  for (const column of table.columns) {
    if (existingColumns.has(column.key)) continue;
    await createColumn(table.id, column);
    log('+', `  colonne ${table.id}.${column.key}`);
  }
  await waitUntilAvailable(listColumns, `colonnes de « ${table.id} »`);

  const listIndexes = async () =>
    (await db.listIndexes({ databaseId: DATABASE_ID, tableId: table.id })).indexes;
  const existingIndexes = new Set((await listIndexes()).map((i) => i.key));
  for (const index of table.indexes) {
    if (existingIndexes.has(index.key)) continue;
    await db.createIndex({
      databaseId: DATABASE_ID,
      tableId: table.id,
      key: index.key,
      type: index.type,
      columns: index.columns,
    });
    log('+', `  index ${table.id}.${index.key}`);
  }
  await waitUntilAvailable(listIndexes, `index de « ${table.id} »`);
}

async function ensureBucket(bucket) {
  const params = {
    bucketId: bucket.id,
    name: bucket.name,
    permissions: bucket.permissions,
    fileSecurity: bucket.fileSecurity,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: bucket.allowedFileExtensions,
  };
  if (await exists(() => storage.getBucket({ bucketId: bucket.id }))) {
    await storage.updateBucket(params);
    log('·', `stockage « ${bucket.id} » déjà là (réglages remis à jour)`);
  } else {
    await storage.createBucket(params);
    log('+', `stockage « ${bucket.id} » créé`);
  }
}

async function ensureTeam(team) {
  if (await exists(() => teams.get({ teamId: team.id }))) {
    log('·', `équipe « ${team.id} » déjà là`);
    return;
  }
  await teams.create({ teamId: team.id, name: team.name });
  log('+', `équipe « ${team.id} » créée`);
}

try {
  console.log(`Projet ${projectId} sur ${endpoint}\n`);
  for (const team of TEAMS) await ensureTeam(team);
  await ensureDatabase();
  for (const table of TABLES) await ensureTable(table);
  for (const bucket of BUCKETS) await ensureBucket(bucket);
  console.log('\nTerminé. Pense à supprimer la clé API dans la console Appwrite.');
} catch (error) {
  console.error(`\nArrêt : ${error.message}`);
  process.exit(1);
}
