import { Injectable } from '@angular/core';
import {
  Account,
  AppwriteException,
  Client,
  Functions,
  Models,
  Query,
  Storage,
  TablesDB,
} from 'appwrite';
import {
  MiniProfile,
  RepositoryError,
  RepositoryResult,
} from '../../repositories/repository.types';

/** Adresse et projet Appwrite, écrits dans public/runtime-config.js au moment du build. */
interface RuntimeConfig {
  appwriteEndpoint: string;
  appwriteProjectId: string;
}

declare global {
  interface Window {
    __FUNNY_CONFIG__?: RuntimeConfig;
  }
}

export const DB = 'funny';

/** Client Appwrite partagé par les repositories de ce dossier, et seulement par eux. */
@Injectable({ providedIn: 'root' })
export class AppwriteClientService {
  readonly config: RuntimeConfig = window.__FUNNY_CONFIG__ ?? {
    appwriteEndpoint: '',
    appwriteProjectId: '',
  };
  readonly client = new Client()
    .setEndpoint(this.config.appwriteEndpoint)
    .setProject(this.config.appwriteProjectId)
    // Les e-mails envoyés par Appwrite (confirmation, mot de passe oublié) sont en français.
    .setLocale('fr');
  readonly account = new Account(this.client);
  readonly tables = new TablesDB(this.client);
  readonly storage = new Storage(this.client);
  readonly functions = new Functions(this.client);

  /** Toutes les lignes d'une table qui correspondent aux requêtes, page par page. */
  async listAll<T extends Models.Row>(tableId: string, queries: string[] = []): Promise<T[]> {
    const rows: T[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.tables.listRows<T>({
        databaseId: DB,
        tableId,
        queries: [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
      });
      rows.push(...page.rows);
      if (page.rows.length < 100) return rows;
      cursor = page.rows[page.rows.length - 1].$id;
    }
  }

  /** Lignes dont la colonne vaut l'une des valeurs (découpé en paquets de 100). */
  async listIn<T extends Models.Row>(
    tableId: string,
    column: string,
    values: string[],
    queries: string[] = [],
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let i = 0; i < values.length; i += 100) {
      rows.push(
        ...(await this.listAll<T>(tableId, [
          Query.equal(column, values.slice(i, i + 100)),
          ...queries,
        ])),
      );
    }
    return rows;
  }

  /**
   * Une ligne, ou null si elle n'existe pas ou n'est pas lisible.
   * Passe par une recherche plutôt que par getRow, qui répondrait par une erreur 404.
   */
  async getRowOrNull<T extends Models.Row>(tableId: string, rowId: string): Promise<T | null> {
    const page = await this.tables.listRows<T>({
      databaseId: DB,
      tableId,
      queries: [Query.equal('$id', rowId), Query.limit(1)],
    });
    return page.rows[0] ?? null;
  }

  /** Profils réduits (pseudo, photo) des membres demandés, indexés par identifiant. */
  async miniProfiles(userIds: string[]): Promise<Map<string, MiniProfile>> {
    const ids = [...new Set(userIds)].filter(Boolean);
    const rows = ids.length
      ? await this.listIn<Models.Row & { username: string; avatar_url: string | null }>(
          'profiles',
          '$id',
          ids,
          [Query.select(['$id', 'username', 'avatar_url'])],
        )
      : [];
    return new Map(
      rows.map((p) => [
        p.$id,
        { id: p.$id, username: p.username, avatar_url: p.avatar_url ?? null },
      ]),
    );
  }

  async count(tableId: string, queries: string[]): Promise<number> {
    const page = await this.tables.listRows({
      databaseId: DB,
      tableId,
      queries: [...queries, Query.limit(1)],
    });
    return page.total;
  }

  /**
   * Lance une action d'une Appwrite Function (dossier functions/ du dépôt).
   * Toute écriture sensible passe par là : le serveur vérifie les droits.
   */
  async run<T = Record<string, unknown>>(
    functionId: string,
    action: string,
    input: Record<string, unknown> = {},
  ): Promise<RepositoryResult<T>> {
    try {
      const execution = await this.functions.createExecution({
        functionId,
        body: JSON.stringify({ action, ...input }),
      });
      const response = JSON.parse(execution.responseBody || '{}');
      if (!response.ok) {
        return { data: null, error: { message: response.error ?? 'Erreur du serveur.' } };
      }
      return { data: response as T, error: null };
    } catch (error) {
      return { data: null, error: toError(error) };
    }
  }

  /** Adresse d'affichage d'un fichier lisible sans connexion (photos de profil, sorties). */
  fileUrl(bucketId: string, fileId: string): string {
    return this.storage.getFileView({ bucketId, fileId });
  }

  /** Contenu d'un fichier privé, chargé avec la session du membre. */
  async privateFileUrl(bucketId: string, fileId: string): Promise<string | null> {
    try {
      const data = (await this.client.call(
        'get',
        new URL(this.fileUrl(bucketId, fileId)),
        {},
        {},
        'arrayBuffer',
      )) as ArrayBuffer;
      return URL.createObjectURL(new Blob([data]));
    } catch {
      return null;
    }
  }
}

export function toError(error: unknown): RepositoryError {
  if (error instanceof AppwriteException) return { message: error.message };
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

/** Exécute une opération et la convertit en résultat neutre { data, error }. */
export async function attempt<T>(operation: () => Promise<T>): Promise<RepositoryResult<T>> {
  try {
    return { data: await operation(), error: null };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}
