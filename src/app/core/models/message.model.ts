/** Texte, photo, vidéo ou message vocal. */
export type MessageType = 'text' | 'image' | 'video' | 'audio';

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

/** Vue d'un message éphémère par un destinataire. */
export interface EphemeralView {
  user_id: string;
  username?: string;
  /** Vues utilisées / vues autorisées (1, puis +1 à chaque « revoir » accepté). */
  seen: number;
  allowed: number;
  /** Demande pour revoir : en attente, ou refusée par l'expéditeur. */
  request: 'pending' | 'refused' | null;
}

/** Contenu d'un message éphémère, le temps de l'afficher une fois. */
export interface EphemeralContent {
  type: 'text' | 'image' | 'video' | 'audio';
  content?: string;
  /** Adresse locale de la photo ou de la vidéo (à libérer après affichage). */
  url?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: MessageType;
  media_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  sender?: { username: string; avatar_url: string | null };
  reply_to?: {
    id: string;
    content: string | null;
    type: string;
    sender?: { username: string };
  } | null;
  reactions?: MessageReaction[];
  /** Message éphémère (« voir une fois ») : son contenu n'est jamais dans le message. */
  ephemeral?: boolean;
  /** Message éphémère : qui l'a ouvert, et les demandes pour le revoir. */
  views?: EphemeralView[];
  /** Date de la dernière modification du texte (affiche « modifié »). */
  edited_at?: string | null;
  /** Supprimé par son auteur : plus de contenu, « Message supprimé » à sa place. */
  deleted?: boolean;
}

/** Date de lecture de la conversation par un participant. */
export interface ReadState {
  user_id: string;
  last_read_at: string;
}

export interface ConversationParticipant {
  user_id: string;
  user?: { id: string; username: string; avatar_url: string | null };
}

export interface Conversation {
  id: string;
  created_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message | null;
  /** Discussion de groupe d'une sortie : son identifiant et son titre. */
  sortie_id?: string | null;
  sortie_title?: string | null;
  /** Image de la sortie (ou de son thème), affichée comme photo de la discussion. */
  sortie_image?: string | null;
}
