import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthRepository } from '../repositories/auth.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { FavoriRepository } from '../repositories/favori.repository';
import { FriendshipRepository } from '../repositories/friendship.repository';
import { InscriptionRepository } from '../repositories/inscription.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { ProfileRepository } from '../repositories/profile.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { SortieRepository } from '../repositories/sortie.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { ThemeRepository } from '../repositories/theme.repository';
import { SupabaseAuthRepository } from './supabase/supabase-auth.repository';
import { SupabaseConversationRepository } from './supabase/supabase-conversation.repository';
import { SupabaseFavoriRepository } from './supabase/supabase-favori.repository';
import { SupabaseFriendshipRepository } from './supabase/supabase-friendship.repository';
import { SupabaseInscriptionRepository } from './supabase/supabase-inscription.repository';
import { SupabaseNotificationRepository } from './supabase/supabase-notification.repository';
import { SupabaseProfileRepository } from './supabase/supabase-profile.repository';
import { SupabaseSettingsRepository } from './supabase/supabase-settings.repository';
import { SupabaseSortieRepository } from './supabase/supabase-sortie.repository';
import { SupabaseStorageRepository } from './supabase/supabase-storage.repository';
import { SupabaseThemeRepository } from './supabase/supabase-theme.repository';

/**
 * Seul endroit qui choisit le fournisseur de données.
 * Pour passer à Appwrite, on remplacera ces implémentations par celles de `backend/appwrite/`.
 */
export function provideBackend(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AuthRepository, useClass: SupabaseAuthRepository },
    { provide: ProfileRepository, useClass: SupabaseProfileRepository },
    { provide: SortieRepository, useClass: SupabaseSortieRepository },
    { provide: InscriptionRepository, useClass: SupabaseInscriptionRepository },
    { provide: FavoriRepository, useClass: SupabaseFavoriRepository },
    { provide: FriendshipRepository, useClass: SupabaseFriendshipRepository },
    { provide: ConversationRepository, useClass: SupabaseConversationRepository },
    { provide: NotificationRepository, useClass: SupabaseNotificationRepository },
    { provide: SettingsRepository, useClass: SupabaseSettingsRepository },
    { provide: ThemeRepository, useClass: SupabaseThemeRepository },
    { provide: StorageRepository, useClass: SupabaseStorageRepository },
  ]);
}
