// Envoie les Appwrite Functions de Funny (dossier functions/) dans le projet Appwrite :
// crée ou met à jour chaque fonction, puis publie son code et attend qu'il soit prêt.
// Peut être relancé à chaque changement du code des fonctions.
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal
// (droits : functions.read et functions.write) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:functions
//   Remove-Item Env:APPWRITE_API_KEY
//
// Le code n'a aucune dépendance : pas de « npm install » ni de build sur le serveur.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Client, Functions } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const endpoint = process.env.APPWRITE_ENDPOINT ?? 'https://appwrite.metanafr.fr/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const runtime = process.env.APPWRITE_FUNCTIONS_RUNTIME ?? 'node-22';

if (!projectId || !apiKey) {
  console.error('Il manque APPWRITE_PROJECT_ID ou APPWRITE_API_KEY (voir le haut de ce fichier).');
  process.exit(1);
}

// Droits de la clé temporaire que chaque fonction reçoit à l'exécution : le strict nécessaire.
const FUNCTIONS = [
  {
    id: 'sorties',
    name: 'Sorties',
    timeout: 30,
    scopes: ['rows.read', 'rows.write', 'teams.read', 'files.write'],
  },
  {
    id: 'social',
    name: 'Amis et conversations',
    timeout: 30,
    scopes: ['rows.read', 'rows.write', 'teams.read', 'teams.write'],
  },
  {
    id: 'admin',
    name: 'Administration',
    timeout: 30,
    scopes: ['rows.read', 'rows.write', 'teams.read', 'teams.write', 'users.write'],
  },
  {
    id: 'account',
    name: 'Compte',
    timeout: 300,
    scopes: ['rows.read', 'rows.write', 'teams.read', 'teams.write', 'users.write', 'files.write'],
  },
];

const root = fileURLToPath(new URL('../../functions/', import.meta.url));

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const functions = new Functions(client);

// Archive .tar.gz minimale (format ustar) : évite toute dépendance et marche aussi sous Windows.
function tarGz(files) {
  const blocks = [];
  for (const { name, content } of files) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(content.length.toString(8).padStart(11, '0') + '\0', 124);
    header.write('00000000000\0', 136);
    header.write('        ', 148);
    header.write('0', 156);
    header.write('ustar\0' + '00', 257);
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, content, Buffer.alloc((512 - (content.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

function filesIn(dir, prefix) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesIn(path, `${prefix}${entry}/`);
    return [{ name: prefix + entry, content: readFileSync(path) }];
  });
}

/** Le code d'une fonction : son dossier src/ et le dossier shared/ commun, copié dans src/shared/. */
function packageOf(id) {
  return tarGz([
    {
      name: 'package.json',
      content: Buffer.from(JSON.stringify({ name: `funny-${id}`, type: 'module', private: true })),
    },
    ...filesIn(join(root, id, 'src'), 'src/'),
    ...filesIn(join(root, 'shared'), 'src/shared/'),
  ]);
}

async function ensureFunction(fn) {
  const settings = {
    functionId: fn.id,
    name: fn.name,
    runtime,
    execute: ['users'],
    timeout: fn.timeout,
    entrypoint: 'src/main.js',
    commands: '',
    scopes: fn.scopes,
    logging: true,
  };
  try {
    await functions.get({ functionId: fn.id });
    await functions.update(settings);
    console.log(`· fonction « ${fn.id} » mise à jour`);
  } catch (error) {
    if (error.code !== 404) throw error;
    await functions.create(settings);
    console.log(`+ fonction « ${fn.id} » créée`);
  }
}

async function deploy(fn) {
  const code = InputFile.fromBuffer(packageOf(fn.id), `${fn.id}.tar.gz`);
  const deployment = await functions.createDeployment({ functionId: fn.id, code, activate: true });
  for (let i = 0; i < 150; i++) {
    const current = await functions.getDeployment({
      functionId: fn.id,
      deploymentId: deployment.$id,
    });
    if (current.status === 'ready') {
      console.log(`+ code de « ${fn.id} » publié`);
      return;
    }
    if (current.status === 'failed') {
      throw new Error(`Échec de la publication de « ${fn.id} » :\n${current.buildLogs}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`La publication de « ${fn.id} » prend trop de temps.`);
}

try {
  for (const fn of FUNCTIONS) {
    await ensureFunction(fn);
    await deploy(fn);
  }
  console.log('Terminé.');
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
}
