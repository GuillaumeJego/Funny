import { Models } from 'appwrite';

/** Ligne Appwrite convertie au format des modèles : `id`, `created_at`, sans champs `$`. */
export function fromRow<T>(row: Models.Row): T {
  const result: Record<string, unknown> = { id: row.$id, created_at: row.$createdAt };
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('$')) result[key] = value;
  }
  return result as T;
}
