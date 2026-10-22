import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AdminRepository } from '../repositories/admin.repository';
import { AuthRepository } from '../repositories/auth.repository';
import { BillingRepository } from '../repositories/billing.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { FavoriRepository } from '../repositories/favori.repository';
import { FriendshipRepository } from '../repositories/friendship.repository';
import { InscriptionRepository } from '../repositories/inscription.repository';
import { ModerationRepository } from '../repositories/moderation.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { ProfileRepository } from '../repositories/profile.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { SortieRepository } from '../repositories/sortie.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { ThemeRepository } from '../repositories/theme.repository';
import { AppwriteAdminRepository } from './appwrite/appwrite-admin.repository';
import { AppwriteAuthRepository } from './appwrite/appwrite-auth.repository';
import { AppwriteBillingRepository } from './appwrite/appwrite-billing.repository';
import { AppwriteConversationRepository } from './appwrite/appwrite-conversation.repository';
import { AppwriteFavoriRepository } from './appwrite/appwrite-favori.repository';
import { AppwriteFriendshipRepository } from './appwrite/appwrite-friendship.repository';
import { AppwriteInscriptionRepository } from './appwrite/appwrite-inscription.repository';
import { AppwriteModerationRepository } from './appwrite/appwrite-moderation.repository';
import { AppwriteNotificationRepository } from './appwrite/appwrite-notification.repository';
import { AppwriteProfileRepository } from './appwrite/appwrite-profile.repository';
import { AppwriteSettingsRepository } from './appwrite/appwrite-settings.repository';
import { AppwriteSortieRepository } from './appwrite/appwrite-sortie.repository';
import { AppwriteStorageRepository } from './appwrite/appwrite-storage.repository';
import { AppwriteThemeRepository } from './appwrite/appwrite-theme.repository';

/** Seul endroit qui choisit le fournisseur de données : Appwrite (`backend/appwrite/`). */
export function provideBackend(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AuthRepository, useClass: AppwriteAuthRepository },
    { provide: ProfileRepository, useClass: AppwriteProfileRepository },
    { provide: SortieRepository, useClass: AppwriteSortieRepository },
    { provide: InscriptionRepository, useClass: AppwriteInscriptionRepository },
    { provide: FavoriRepository, useClass: AppwriteFavoriRepository },
    { provide: FriendshipRepository, useClass: AppwriteFriendshipRepository },
    { provide: ConversationRepository, useClass: AppwriteConversationRepository },
    { provide: NotificationRepository, useClass: AppwriteNotificationRepository },
    { provide: SettingsRepository, useClass: AppwriteSettingsRepository },
    { provide: ThemeRepository, useClass: AppwriteThemeRepository },
    { provide: StorageRepository, useClass: AppwriteStorageRepository },
    { provide: AdminRepository, useClass: AppwriteAdminRepository },
    { provide: ModerationRepository, useClass: AppwriteModerationRepository },
    { provide: BillingRepository, useClass: AppwriteBillingRepository },
  ]);
}
