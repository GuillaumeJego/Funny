// Écrit public/runtime-config.js avec l'adresse Appwrite et l'identifiant du projet Funny.
// Ces deux valeurs ne sont pas secrètes : le navigateur en a besoin pour joindre Appwrite.
// Aucune clé API ni aucun secret ne doit jamais être ajouté ici.
//
// Les valeurs viennent des variables d'environnement (Vercel) ou du fichier .env.local
// (sur ton PC, jamais envoyé sur GitHub) :
//   APPWRITE_ENDPOINT=https://appwrite.metanafr.fr/v1
//   APPWRITE_PROJECT_ID=id-du-projet-funny

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const local = existsSync('.env.local')
  ? Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, '')]),
    )
  : {};

const read = (key) => process.env[key] || local[key] || '';
const config = {
  appwriteEndpoint: read('APPWRITE_ENDPOINT'),
  appwriteProjectId: read('APPWRITE_PROJECT_ID'),
};

if (!config.appwriteEndpoint || !config.appwriteProjectId) {
  console.error(
    'Il manque APPWRITE_ENDPOINT ou APPWRITE_PROJECT_ID (dans .env.local ou dans les variables de Vercel).',
  );
  process.exit(1);
}

writeFileSync(
  'public/runtime-config.js',
  `window.__FUNNY_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
);
console.log(`runtime-config.js écrit pour ${config.appwriteEndpoint}`);
