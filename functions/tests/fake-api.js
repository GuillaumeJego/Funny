// Faux serveur Appwrite en mémoire pour tester les règles des fonctions sans réseau.
// Il comprend les requêtes écrites par shared/appwrite.js (Query.equal, orderAsc…).

let clock = 0;
const tick = () => new Date(Date.UTC(2026, 0, 1, 0, 0, 0, ++clock)).toISOString();

function matches(row, query) {
  const { method, attribute, values } = query;
  const value = row[attribute];
  switch (method) {
    case 'equal':
      return values.includes(value);
    case 'notEqual':
      return !values.includes(value);
    case 'lessThan':
      return value != null && value < values[0];
    case 'greaterThan':
      return value != null && value > values[0];
    case 'isNull':
      return value == null;
    case 'contains':
      return Array.isArray(value) && values.some((v) => value.includes(v));
    case 'or':
      return values.some((q) => matches(row, q));
    case 'and':
      return values.every((q) => matches(row, q));
    default:
      return true;
  }
}

export function createFakeApi(initial = {}, teams = {}) {
  const tables = new Map(
    Object.entries(initial).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))]),
  );
  const rowsOf = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  let nextId = 0;

  function list(table, queries = []) {
    const parsed = queries.map((q) => JSON.parse(q));
    let rows = rowsOf(table).filter((row) =>
      parsed.every(
        (q) =>
          ![
            'equal',
            'notEqual',
            'lessThan',
            'greaterThan',
            'isNull',
            'contains',
            'or',
            'and',
          ].includes(q.method) || matches(row, q),
      ),
    );
    const orders = parsed.filter((q) => q.method === 'orderAsc' || q.method === 'orderDesc');
    rows = [...rows].sort((a, b) => {
      for (const o of orders) {
        const x = a[o.attribute];
        const y = b[o.attribute];
        if (x === y) continue;
        return (x < y ? -1 : 1) * (o.method === 'orderAsc' ? 1 : -1);
      }
      return 0;
    });
    const total = rows.length;
    const offset = parsed.find((q) => q.method === 'offset')?.values[0] ?? 0;
    const limit = parsed.find((q) => q.method === 'limit')?.values[0] ?? 25;
    return { total, rows: rows.slice(offset, offset + limit) };
  }

  const api = {
    tables,
    teams,
    async getRow(table, id) {
      return rowsOf(table).find((r) => r.$id === id) ?? null;
    },
    async listRows(table, queries) {
      return list(table, queries).rows;
    },
    async listAllRows(table, queries = []) {
      return list(table, [...queries, JSON.stringify({ method: 'limit', values: [100000] })]).rows;
    },
    async findRow(table, queries) {
      return (
        list(table, [...queries, JSON.stringify({ method: 'limit', values: [1] })]).rows[0] ?? null
      );
    },
    async countRows(table, queries) {
      return list(table, queries).total;
    },
    async createRow(table, id, data) {
      const now = tick();
      const row = { $id: id ?? `row${++nextId}`, $createdAt: now, $updatedAt: now, ...data };
      rowsOf(table).push(row);
      return row;
    },
    async updateRow(table, id, data) {
      const row = rowsOf(table).find((r) => r.$id === id);
      Object.assign(row, data, { $updatedAt: tick() });
      return row;
    },
    async deleteRow(table, id) {
      tables.set(
        table,
        rowsOf(table).filter((r) => r.$id !== id),
      );
    },
    async isTeamMember(teamId, userId) {
      return (teams[teamId] ?? []).includes(userId);
    },
    async addTeamMember(teamId, userId) {
      teams[teamId] = [...new Set([...(teams[teamId] ?? []), userId])];
    },
    async removeTeamMember(teamId, userId) {
      teams[teamId] = (teams[teamId] ?? []).filter((id) => id !== userId);
    },
    async call() {
      return null;
    },
  };
  return api;
}
