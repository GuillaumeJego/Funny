// Petit client de l'API Appwrite pour les fonctions de Funny, sans dépendance :
// pas de « npm install » au déploiement. Il utilise la clé temporaire qu'Appwrite
// donne à chaque exécution (en-tête x-appwrite-key), avec les droits déclarés
// dans scripts/appwrite/functions.mjs.

export const DB = 'funny';

/** Erreur renvoyée telle quelle au navigateur, avec un code HTTP. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const fail = (status, message) => {
  throw new HttpError(status, message);
};

// Requêtes au format attendu par Appwrite (identique au SDK officiel).
const q = (method, attribute, values) =>
  JSON.stringify({
    method,
    attribute,
    values: values === undefined ? undefined : Array.isArray(values) ? values : [values],
  });

export const Query = {
  equal: (attribute, value) => q('equal', attribute, value),
  notEqual: (attribute, value) => q('notEqual', attribute, value),
  lessThan: (attribute, value) => q('lessThan', attribute, value),
  contains: (attribute, value) => q('contains', attribute, value),
  orderAsc: (attribute) => q('orderAsc', attribute),
  orderDesc: (attribute) => q('orderDesc', attribute),
  limit: (value) => q('limit', undefined, value),
  or: (queries) =>
    q(
      'or',
      undefined,
      queries.map((x) => JSON.parse(x)),
    ),
  and: (queries) =>
    q(
      'and',
      undefined,
      queries.map((x) => JSON.parse(x)),
    ),
};

export const Permission = {
  read: (role) => `read("${role}")`,
  update: (role) => `update("${role}")`,
  delete: (role) => `delete("${role}")`,
};

export const Role = {
  users: () => 'users',
  user: (id) => `user:${id}`,
  team: (id) => `team:${id}`,
};

/** Identifiant unique, accepté par Appwrite (20 caractères hexadécimaux). */
export const uniqueId = () =>
  Date.now().toString(16).padStart(12, '0') +
  Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');

export function createApi(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const key = req.headers['x-appwrite-key'];

  async function call(method, path, { body, queries } = {}) {
    const url = new URL(endpoint + path);
    for (const query of queries ?? []) url.searchParams.append('queries[]', query);
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-appwrite-project': project,
        'x-appwrite-key': key,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message ?? `Appwrite ${response.status}`);
      error.code = response.status;
      error.type = data?.type;
      throw error;
    }
    return data;
  }

  const rowsPath = (table) => `/tablesdb/${DB}/tables/${table}/rows`;

  const api = {
    call,

    async getRow(table, id) {
      try {
        return await call('GET', `${rowsPath(table)}/${encodeURIComponent(id)}`);
      } catch (error) {
        if (error.code === 404) return null;
        throw error;
      }
    },
    async listRows(table, queries = []) {
      const data = await call('GET', rowsPath(table), { queries: [...queries] });
      return data.rows;
    },
    /** Toutes les lignes qui correspondent, page par page. */
    async listAllRows(table, queries = []) {
      const all = [];
      for (let offset = 0; ; offset += 100) {
        const page = await call('GET', rowsPath(table), {
          queries: [...queries, Query.limit(100), q('offset', undefined, offset)],
        });
        all.push(...page.rows);
        if (page.rows.length < 100) return all;
      }
    },
    async findRow(table, queries) {
      const [row] = await api.listRows(table, [...queries, Query.limit(1)]);
      return row ?? null;
    },
    async countRows(table, queries) {
      const data = await call('GET', rowsPath(table), { queries: [...queries, Query.limit(1)] });
      return data.total;
    },
    createRow(table, id, data, permissions) {
      return call('POST', rowsPath(table), { body: { rowId: id, data, permissions } });
    },
    updateRow(table, id, data, permissions) {
      const body = permissions === undefined ? { data } : { data, permissions };
      return call('PATCH', `${rowsPath(table)}/${encodeURIComponent(id)}`, { body });
    },
    async deleteRow(table, id) {
      try {
        await call('DELETE', `${rowsPath(table)}/${encodeURIComponent(id)}`);
      } catch (error) {
        if (error.code !== 404) throw error;
      }
    },

    async isTeamMember(teamId, userId) {
      const data = await call('GET', `/teams/${teamId}/memberships`, {
        queries: [Query.equal('userId', userId), Query.limit(1)],
      });
      return data.total > 0;
    },
    async addTeamMember(teamId, userId) {
      if (await api.isTeamMember(teamId, userId)) return;
      await call('POST', `/teams/${teamId}/memberships`, { body: { userId, roles: [] } });
    },
    async removeTeamMember(teamId, userId) {
      const data = await call('GET', `/teams/${teamId}/memberships`, {
        queries: [Query.equal('userId', userId)],
      });
      for (const membership of data.memberships) {
        await call('DELETE', `/teams/${teamId}/memberships/${membership.$id}`);
      }
    },
  };
  return api;
}

/** Envoie des notifications : chaque destinataire est seul à pouvoir les lire. */
export async function notify(api, notifications) {
  for (const n of notifications) {
    if (!n.user_id || n.user_id === n.actor_id) continue;
    await api.createRow('notifications', uniqueId(), n, [
      Permission.read(Role.user(n.user_id)),
      Permission.update(Role.user(n.user_id)),
      Permission.delete(Role.user(n.user_id)),
    ]);
  }
}

/**
 * Supprime un fichier du stockage. Accepte son identifiant ou l'adresse enregistrée
 * dans une ligne (…/storage/buckets/<bucket>/files/<id>/view…).
 */
export async function deleteFile(api, bucket, idOrUrl) {
  const fileId = String(idOrUrl).match(/\/files\/([^/?#]+)/)?.[1] ?? String(idOrUrl);
  if (String(idOrUrl).includes('/') && !String(idOrUrl).includes(`/buckets/${bucket}/`)) return;
  try {
    await api.call('DELETE', `/storage/buckets/${bucket}/files/${encodeURIComponent(fileId)}`);
  } catch (error) {
    if (error.code !== 404) throw error;
  }
}

export async function usernameOf(api, userId) {
  const profile = await api.getRow('profiles', userId);
  return profile?.username ?? 'Un membre';
}

export async function isAdmin(api, userId) {
  return api.isTeamMember('admins', userId);
}

/**
 * Point d'entrée commun : lit l'action demandée, vérifie que l'appel vient d'un
 * membre connecté, et transforme les erreurs en réponses JSON.
 * `onSchedule` est lancé quand Appwrite exécute la fonction selon son horaire (cron).
 */
export function handler(actions, { onSchedule } = {}) {
  return async ({ req, res, error: logError }) => {
    try {
      if (onSchedule && req.headers['x-appwrite-trigger'] === 'schedule') {
        return res.json({ ok: true, ...(await onSchedule({ api: createApi(req) })) });
      }
      const userId = req.headers['x-appwrite-user-id'];
      if (!userId) fail(401, 'Connexion requise.');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const action = actions[body.action];
      if (!action) fail(400, `Action inconnue : ${body.action}`);
      const api = createApi(req);
      const result = await action({ api, userId, input: body, log: logError });
      return res.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof HttpError) return res.json({ ok: false, error: err.message }, err.status);
      logError(err.stack ?? String(err));
      return res.json({ ok: false, error: 'Erreur du serveur.' }, 500);
    }
  };
}
