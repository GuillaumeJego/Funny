// Donne le rôle admin à un membre déjà inscrit sur Funny (à faire une fois, pour ton compte).
//
// Utilisation (PowerShell), avec une clé API à durée courte collée dans le terminal
// (droits : users.read, rows.read, rows.write, teams.read, teams.write) :
//   $env:APPWRITE_PROJECT_ID = "id-du-projet-funny"
//   $env:APPWRITE_API_KEY = Read-Host "Colle la clé API Appwrite"
//   npm run appwrite:admin -- ton.email@exemple.fr
//   Remove-Item Env:APPWRITE_API_KEY

import { Client, Query, TablesDB, Teams, Users } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? 'https://appwrite.metanafr.fr/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const email = process.argv[2];

if (!projectId || !apiKey || !email) {
  console.error(
    'Il manque APPWRITE_PROJECT_ID, APPWRITE_API_KEY ou l’email (voir le haut de ce fichier).',
  );
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const users = new Users(client);
const db = new TablesDB(client);
const teams = new Teams(client);

try {
  const { users: found } = await users.list({ queries: [Query.equal('email', email)] });
  if (found.length === 0)
    throw new Error(`aucun membre avec l'email ${email}. Inscris-toi d'abord sur Funny.`);
  const userId = found[0].$id;
  await db.upsertRow({
    databaseId: 'funny',
    tableId: 'member_status',
    rowId: userId,
    data: { role: 'admin' },
  });
  for (const teamId of ['admins', 'abonnes']) {
    const { memberships } = await teams.listMemberships({
      teamId,
      queries: [Query.equal('userId', userId)],
    });
    if (memberships.length === 0) await teams.createMembership({ teamId, roles: [], userId });
  }
  console.log(`${email} est maintenant admin de Funny.`);
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
}
