import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AdminRepository } from '../../repositories/admin.repository';
import { AuthRepository } from '../../repositories/auth.repository';
import { BillingRepository } from '../../repositories/billing.repository';
import { AffiniteRepository } from '../../repositories/affinite.repository';
import { ConversationRepository } from '../../repositories/conversation.repository';
import { FavoriRepository } from '../../repositories/favori.repository';
import { FriendshipRepository } from '../../repositories/friendship.repository';
import { InscriptionRepository } from '../../repositories/inscription.repository';
import { ModerationRepository } from '../../repositories/moderation.repository';
import { NotificationRepository } from '../../repositories/notification.repository';
import { ProfileRepository } from '../../repositories/profile.repository';
import { SettingsRepository } from '../../repositories/settings.repository';
import { SortieRepository } from '../../repositories/sortie.repository';
import { StorageRepository } from '../../repositories/storage.repository';
import { ThemeRepository } from '../../repositories/theme.repository';

// Faux repositories pour les tests : aucun appel réseau, aucune donnée, aucun membre connecté.

const ok = { data: null, error: null };
const empty = { data: [], error: null };

const fakeAuth: AuthRepository = {
  register: async () => ({ error: null }),
  login: async () => ({ error: null }),
  logout: async () => ({ error: null }),
  getUser: async () => ({ data: { user: null } }),
  hasSession: async () => false,
  recordVisit: async () => false,
  recordPages: async () => false,
  deleteAccount: async () => ({ error: null }),
  sendVerification: async () => ({ error: null }),
  confirmVerification: async () => ({ error: null }),
  sendPasswordRecovery: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
};

const fakeProfiles: ProfileRepository = {
  getById: async () => ok,
  getAll: async () => empty,
  getMiniProfiles: async () => [],
  update: async () => ok,
};

const fakeSorties: SortieRepository = {
  getPublished: async () => empty,
  getPublishedCreatedBy: async () => empty,
  getPublishedByIds: async () => [],
  create: async () => ok,
  update: async () => ok,
  delete: async () => ok,
};

const fakeInscriptions: InscriptionRepository = {
  getStatus: async () => 'none',
  countPending: async () => 0,
  getSortieIds: async () => [],
  getParticipants: async () => [],
  getWaitingUserIds: async () => [],
  rejoindre: async () => ({ error: null, status: 'pending' }),
  quitter: async () => ({ error: null }),
};

const fakeFavoris: FavoriRepository = {
  getSortieIds: async () => [],
  getUserIds: async () => [],
  add: async () => ok,
  remove: async () => ok,
};

const fakeFriendships: FriendshipRepository = {
  countPendingReceived: async () => 0,
  getBetween: async () => null,
  getAccepted: async () => [],
  getPendingSent: async () => [],
  getPendingReceived: async () => [],
  create: async () => ok,
  setStatus: async () => ok,
  delete: async () => ok,
};

const fakeConversations: ConversationRepository = {
  open: async () => 'conversation-test',
  getForUser: async () => [],
  getOtherParticipant: async () => null,
  openSortieChat: async () => 'conversation-test',
  getConversation: async () => null,
  getMessages: async () => [],
  sendMessage: async () => null,
  setReaction: async () => {},
  removeReaction: async () => {},
  onNewMessage: () => () => {},
  getReactions: async () => [],
  onAnyNewMessage: () => () => {},
  getUnreadCounts: async () => new Map(),
  markRead: async () => {},
  onReactionChange: () => () => {},
};

const fakeNotifications: NotificationRepository = {
  getForUser: async () => empty,
  countUnread: async () => 0,
  markAllRead: async () => ok,
  onNew: () => () => {},
};

const fakeSettings: SettingsRepository = {
  get: async () => undefined,
  set: async () => ({ error: null }),
};

const fakeThemes: ThemeRepository = {
  getAll: async () => empty,
  getImages: async () => empty,
  create: async () => ok,
  update: async () => ok,
  delete: async () => ok,
  addImage: async () => ok,
  removeImage: async () => ok,
};

const fakeStorage: StorageRepository = {
  uploadAvatar: async () => ok,
  uploadSortieImage: async () => ok,
  uploadChatMedia: async () => ok,
};

const fakeAdmin: AdminRepository = {
  setRole: async () => ok,
  setPremium: async () => ok,
  setCanViewProfiles: async () => ok,
  ban: async () => ok,
  unban: async () => ok,
  getOpenReports: async () => empty,
  markReportHandled: async () => ok,
  deleteReportedMessage: async () => ok,
  getStats: async () => ({
    data: {
      days: [],
      hours: Array(24).fill(0),
      pages: [],
      total: 0,
      unique: 0,
      pageViews: 0,
      messages: 0,
      sorties: 0,
      joins: 0,
      newMembers: 0,
    },
    error: null,
  }),
};

const fakeModeration: ModerationRepository = {
  report: async () => ok,
  block: async () => ok,
  unblock: async () => ok,
  getBlockedIds: async () => [],
};

const fakeAffinites: AffiniteRepository = {
  getMine: async () => [],
  getHeartDatesSince: async () => [],
  answer: async () => ({ data: null, error: null }),
};

const fakeBilling: BillingRepository = {
  checkout: async () => ok,
  portal: async () => ok,
  getSubscription: async () => ok,
};

export function provideBackendTesting(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AuthRepository, useValue: fakeAuth },
    { provide: ProfileRepository, useValue: fakeProfiles },
    { provide: SortieRepository, useValue: fakeSorties },
    { provide: InscriptionRepository, useValue: fakeInscriptions },
    { provide: FavoriRepository, useValue: fakeFavoris },
    { provide: FriendshipRepository, useValue: fakeFriendships },
    { provide: ConversationRepository, useValue: fakeConversations },
    { provide: NotificationRepository, useValue: fakeNotifications },
    { provide: SettingsRepository, useValue: fakeSettings },
    { provide: ThemeRepository, useValue: fakeThemes },
    { provide: StorageRepository, useValue: fakeStorage },
    { provide: AdminRepository, useValue: fakeAdmin },
    { provide: ModerationRepository, useValue: fakeModeration },
    { provide: BillingRepository, useValue: fakeBilling },
    { provide: AffiniteRepository, useValue: fakeAffinites },
  ]);
}
