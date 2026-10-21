// Fonction « admin » : rôles, Premium manuel, accès aux profils et bannissements.
// Seuls les membres de l'équipe « admins » peuvent l'utiliser.
import { Permission, Role, fail, handler, isAdmin } from './shared/appwrite.js';

const ROLES = ['user', 'user_premium', 'developer', 'admin'];

async function requireMember(api, userId) {
  const id = String(userId ?? '');
  if (!id || !(await api.getRow('profiles', id))) fail(404, 'Membre introuvable.');
  return id;
}

async function upsert(api, table, id, data, permissions) {
  if (await api.getRow(table, id)) return api.updateRow(table, id, data);
  return api.createRow(table, id, data, permissions);
}

/** Met l'équipe « abonnes » en accord avec le rôle et la date d'abonnement. */
async function syncPremium(api, memberId, status) {
  const active =
    status.role === 'user_premium' ||
    status.role === 'admin' ||
    status.role === 'developer' ||
    (status.subscription_end_date && new Date(status.subscription_end_date) > new Date());
  if (active) await api.addTeamMember('abonnes', memberId);
  else await api.removeTeamMember('abonnes', memberId);
}

async function setRole({ api, input }) {
  const memberId = await requireMember(api, input.userId);
  if (!ROLES.includes(input.role)) fail(400, 'Rôle invalide.');
  const status = await upsert(api, 'member_status', memberId, { role: input.role });
  if (input.role === 'admin') await api.addTeamMember('admins', memberId);
  else await api.removeTeamMember('admins', memberId);
  await syncPremium(api, memberId, status);
  return { status };
}

async function setPremium({ api, input }) {
  const memberId = await requireMember(api, input.userId);
  const until = input.until ? new Date(input.until) : null;
  if (until && Number.isNaN(until.getTime())) fail(400, 'Date invalide.');
  const status = await upsert(api, 'member_status', memberId, {
    subscription_end_date: until ? until.toISOString() : null,
  });
  await syncPremium(api, memberId, status);
  return { status };
}

async function setCanViewProfiles({ api, input }) {
  const memberId = await requireMember(api, input.userId);
  const value = input.value === null ? null : !!input.value;
  const status = await upsert(api, 'member_status', memberId, { can_view_profiles: value });
  return { status };
}

async function ban({ api, input }) {
  const memberId = await requireMember(api, input.userId);
  const days = Number(input.days);
  if (!Number.isInteger(days) || days < 1 || days > 3650) fail(400, 'Durée invalide.');
  const previous = await api.getRow('moderation', memberId);
  const data = {
    is_banned: true,
    banned_until: new Date(Date.now() + days * 86400000).toISOString(),
    ban_reason: String(input.reason ?? '').slice(0, 1000),
    ban_count: (previous?.ban_count ?? 0) + 1,
    total_ban_days: (previous?.total_ban_days ?? 0) + days,
  };
  const moderation = await upsert(api, 'moderation', memberId, data, [
    Permission.read(Role.user(memberId)),
  ]);
  // Bloque aussi la connexion : le compte est désactivé jusqu'au débannissement.
  await api.call('PATCH', `/users/${memberId}/status`, { body: { status: false } });
  return { moderation };
}

async function unban({ api, input }) {
  const memberId = await requireMember(api, input.userId);
  const moderation = await upsert(
    api,
    'moderation',
    memberId,
    { is_banned: false, banned_until: null },
    [Permission.read(Role.user(memberId))],
  );
  await api.call('PATCH', `/users/${memberId}/status`, { body: { status: true } });
  return { moderation };
}

const actions = { setRole, setPremium, setCanViewProfiles, ban, unban };

export default handler(
  Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [
      name,
      async (ctx) => {
        if (!(await isAdmin(ctx.api, ctx.userId))) fail(403, 'Réservé aux administrateurs.');
        return action(ctx);
      },
    ]),
  ),
);
