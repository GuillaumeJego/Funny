import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthRepository } from '../../repositories/auth.repository';
import { ConversationRepository } from '../../repositories/conversation.repository';
import { FavoriRepository } from '../../repositories/favori.repository';
import { FriendshipRepository } from '../../repositories/friendship.repository';
import { InscriptionRepository } from '../../repositories/inscription.repository';
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
  getFirstThemeImage: async () => null,
  create: async () => ok,
  delete: async () => ok,
};

const fakeInscriptions: InscriptionRepository = {
  getStatus: async () => 'none',
  countPending: async () => 0,
  getSortieIds: async () => [],
  getParticipants: async () => [],
  getWaitingUserIds: async () => [],
  inscrireOrganisateur: async () => {},
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
  getConversationIds: async () => [],
  findShared: async () => [],
  create: async () => 'conversation-test',
  getWithLastMessage: async () => [],
  getMessages: async () => [],
  sendMessage: async () => null,
  setReaction: async () => {},
  removeReaction: async () => {},
  onNewMessage: () => () => {},
};

const fakeNotifications: NotificationRepository = {
  getForUser: async () => empty,
  countUnread: async () => 0,
  markAllRead: async () => ok,
  createMany: async () => ok,
};

const fakeSettings: SettingsRepository = {
  get: async () => undefined,
  set: async () => ({ error: null }),
};

const fakeThemes: ThemeRepository = {
  getAll: async () => empty,
  getImages: async () => empty,
};

const fakeStorage: StorageRepository = {
  uploadAvatar: async () => ok,
  uploadSortieImage: async () => ok,
  uploadChatMedia: async () => ok,
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
  ]);
}
