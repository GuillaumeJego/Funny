// Types neutres partagés par tous les repositories : aucun type du fournisseur (Supabase, Appwrite) ici.

export interface RepositoryError {
  message: string;
}

export interface RepositoryResult<T> {
  data: T | null;
  error: RepositoryError | null;
}

export interface AuthUser {
  id: string;
  email?: string;
  /** L'adresse e-mail a été confirmée en cliquant sur le lien reçu. */
  emailVerified?: boolean;
}

/** Fonction à appeler pour arrêter une écoute en temps réel. */
export type Unsubscribe = () => void;

/** Profil réduit affiché dans les listes (inscrits, likes, attente). */
export interface MiniProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}
