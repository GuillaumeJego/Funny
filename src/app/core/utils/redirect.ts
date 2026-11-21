/**
 * Page de Funny où revenir après la connexion (ex. « /dashboard?sortie=… » d'un lien partagé).
 * Seulement un chemin de l'appli : jamais un autre site (« //pirate.com », « https://… »).
 */
export function safeRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  if (value === '/' || value.startsWith('/login')) return null;
  return value;
}
