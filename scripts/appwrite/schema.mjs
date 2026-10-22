// Description de la base Appwrite de Funny : tables, colonnes, index, droits, stockage et équipes.
// Ce fichier ne contient aucun secret. Il est lu par setup.mjs, qui crée ce qui manque.
//
// Droits (format Appwrite) :
//   read("any")           tout le monde (seulement pour les images publiques)
//   read("users/verified") tout membre connecté dont l'adresse e-mail est confirmée
//   read("team:admins")   l'équipe admins
//   aucun droit "create"  seul le serveur (clé API ou Appwrite Function) peut créer
// Avec rowSecurity: true, chaque ligne reçoit en plus ses propres droits
// (par exemple : seul son auteur peut la modifier). Ces droits par ligne seront posés
// par l'application et par les Appwrite Functions (lots 5 et 6).

export const DATABASE_ID = 'funny';
export const DATABASE_NAME = 'Funny';

const MEMBRES = 'read("users/verified")';
const MEMBRES_CREENT = 'create("users/verified")';
const PUBLIC = 'read("any")';
const ADMINS_ECRIVENT = ['create("team:admins")', 'update("team:admins")', 'delete("team:admins")'];

// Types de colonnes : string (taille max), text, enum, datetime, integer, float, boolean, stringArray.
const str = (key, size, opts = {}) => ({ type: 'string', key, size, ...opts });
const text = (key, opts = {}) => ({ type: 'text', key, ...opts });
const enumeration = (key, elements, opts = {}) => ({ type: 'enum', key, elements, ...opts });
const datetime = (key, opts = {}) => ({ type: 'datetime', key, ...opts });
const integer = (key, opts = {}) => ({ type: 'integer', key, ...opts });
const float = (key, opts = {}) => ({ type: 'float', key, ...opts });
const bool = (key, opts = {}) => ({ type: 'boolean', key, ...opts });
const stringArray = (key, size, opts = {}) => ({ type: 'stringArray', key, size, ...opts });

const ID = 36; // identifiant Appwrite (utilisateur, ligne, fichier)
const CHOIX = 40; // réponses courtes du profil (tabac, alcool…)

export const TABLES = [
  {
    // Partie publique du profil. L'identifiant de la ligne est celui du membre.
    id: 'profiles',
    name: 'Profils',
    permissions: [MEMBRES],
    rowSecurity: true, // chaque ligne : update("user:<id>") pour son propriétaire
    columns: [
      str('username', 40, { required: true }),
      text('bio'),
      str('avatar_url', 500),
      str('gender', CHOIX),
      str('city', 100),
      str('smoking', CHOIX),
      str('vaping', CHOIX),
      str('alcohol', CHOIX),
      str('children', CHOIX),
      str('relationship', CHOIX),
      enumeration('view_mode', ['grid', 'list'], { default: 'grid' }),
    ],
    indexes: [{ key: 'username_unique', type: 'unique', columns: ['username'] }],
  },
  {
    // Informations que seul le membre voit (date de naissance, acceptation des conditions).
    id: 'profiles_private',
    name: 'Profils (privé)',
    permissions: [],
    rowSecurity: true, // read/update("user:<id>")
    // terms_accepted_at : date d'acceptation des conditions (et de l'âge minimum) à l'inscription.
    columns: [datetime('birthdate'), datetime('terms_accepted_at')],
    indexes: [],
  },
  {
    // Rôle et abonnement : visibles par les membres, modifiables seulement par le serveur.
    id: 'member_status',
    name: 'Statut des membres',
    permissions: [MEMBRES],
    rowSecurity: false,
    columns: [
      enumeration('role', ['user', 'user_premium', 'developer', 'admin'], { default: 'user' }),
      datetime('subscription_end_date'),
      bool('can_view_profiles'),
    ],
    indexes: [],
  },
  {
    // Bannissements : le membre concerné et les admins seulement, écrit par le serveur.
    id: 'moderation',
    name: 'Modération',
    permissions: ['read("team:admins")'],
    rowSecurity: true, // read("user:<id>")
    columns: [
      bool('is_banned', { default: false }),
      datetime('banned_until'),
      text('ban_reason'),
      integer('ban_count', { default: 0 }),
      integer('total_ban_days', { default: 0 }),
    ],
    indexes: [],
  },
  {
    // Sorties : créées par le serveur (Function « sorties »).
    // Ligne normale : read("users/verified"). Ligne Premium : read("team:abonnes") et l'organisateur.
    id: 'sorties',
    name: 'Sorties',
    permissions: [],
    rowSecurity: true,
    columns: [
      str('title', 120, { required: true }),
      text('description'),
      str('theme_id', ID, { required: true }),
      str('created_by', ID, { required: true }),
      datetime('date', { required: true }),
      str('location', 300, { required: true }),
      float('price', { default: 0 }),
      integer('max_participants'),
      bool('is_premium', { default: false }),
      str('image_url', 500),
      enumeration('image_source', ['default', 'custom'], { default: 'default' }),
      enumeration('status', ['draft', 'published', 'cancelled'], { default: 'published' }),
    ],
    indexes: [
      { key: 'status_date', type: 'key', columns: ['status', 'date'] },
      { key: 'created_by', type: 'key', columns: ['created_by'] },
    ],
  },
  {
    // Inscriptions : visibles par les membres (liste des inscrits), écrites par le serveur.
    id: 'inscriptions',
    name: 'Inscriptions',
    permissions: [MEMBRES],
    rowSecurity: false,
    columns: [
      str('sortie_id', ID, { required: true }),
      str('user_id', ID, { required: true }),
      enumeration('status', ['pending', 'waiting', 'confirmed', 'cancelled'], { required: true }),
    ],
    indexes: [
      { key: 'sortie_user_unique', type: 'unique', columns: ['sortie_id', 'user_id'] },
      { key: 'user_status', type: 'key', columns: ['user_id', 'status'] },
    ],
  },
  {
    // Favoris (likes) : visibles par les membres, chacun crée et supprime les siens.
    id: 'favoris',
    name: 'Favoris',
    permissions: [MEMBRES, MEMBRES_CREENT],
    rowSecurity: true, // delete("user:<id>")
    columns: [str('user_id', ID, { required: true }), str('sortie_id', ID, { required: true })],
    indexes: [
      { key: 'user_sortie_unique', type: 'unique', columns: ['user_id', 'sortie_id'] },
      { key: 'sortie', type: 'key', columns: ['sortie_id'] },
    ],
  },
  {
    // Amitiés : créées par le serveur (Function « social »), visibles par les deux membres.
    id: 'friendships',
    name: 'Amitiés',
    permissions: [],
    rowSecurity: true,
    columns: [
      str('requester_id', ID, { required: true }),
      str('receiver_id', ID, { required: true }),
      enumeration('status', ['pending', 'accepted', 'declined'], { default: 'pending' }),
    ],
    indexes: [
      { key: 'pair_unique', type: 'unique', columns: ['requester_id', 'receiver_id'] },
      { key: 'receiver_status', type: 'key', columns: ['receiver_id', 'status'] },
    ],
  },
  {
    // Conversations : une équipe Appwrite par conversation (identifiant = celui de la conversation),
    // créée par le serveur. Ligne : read("team:<id conversation>").
    id: 'conversations',
    name: 'Conversations',
    permissions: [],
    rowSecurity: true,
    columns: [stringArray('participant_ids', ID, { required: true }), datetime('last_message_at')],
    indexes: [], // Appwrite n'indexe pas les colonnes « liste »
  },
  {
    // Messages : chaque participant écrit les siens avec read("team:<conversation>").
    id: 'messages',
    name: 'Messages',
    permissions: [MEMBRES_CREENT],
    rowSecurity: true,
    columns: [
      str('conversation_id', ID, { required: true }),
      str('sender_id', ID, { required: true }),
      text('content'),
      enumeration('type', ['text', 'image', 'video'], { default: 'text' }),
      str('media_file_id', ID),
      str('reply_to_id', ID),
    ],
    indexes: [{ key: 'conversation', type: 'key', columns: ['conversation_id'] }],
  },
  {
    id: 'message_reactions',
    name: 'Réactions',
    permissions: [MEMBRES_CREENT],
    rowSecurity: true,
    columns: [
      str('message_id', ID, { required: true }),
      str('conversation_id', ID, { required: true }),
      str('user_id', ID, { required: true }),
      str('emoji', 16, { required: true }),
    ],
    indexes: [{ key: 'message_user_unique', type: 'unique', columns: ['message_id', 'user_id'] }],
  },
  {
    // Notifications : écrites par le serveur, lues et marquées « lues » par leur destinataire.
    id: 'notifications',
    name: 'Notifications',
    permissions: [],
    rowSecurity: true, // read/update("user:<id>")
    columns: [
      str('user_id', ID, { required: true }),
      str('title', 120, { required: true }),
      text('message', { required: true }),
      bool('read', { default: false }),
      str('actor_id', ID),
    ],
    indexes: [{ key: 'user_read', type: 'key', columns: ['user_id', 'read'] }],
  },
  {
    // Réglages : l'identifiant de la ligne est la clé (ex. sortie_creation_access).
    id: 'app_settings',
    name: 'Réglages',
    permissions: [MEMBRES, ...ADMINS_ECRIVENT],
    rowSecurity: false,
    columns: [text('value')], // valeur JSON
    indexes: [],
  },
  {
    id: 'themes',
    name: 'Thèmes',
    permissions: [MEMBRES, ...ADMINS_ECRIVENT],
    rowSecurity: false,
    columns: [str('name', 60, { required: true }), str('icon', 16)],
    indexes: [],
  },
  {
    id: 'theme_images',
    name: 'Images des thèmes',
    permissions: [MEMBRES, ...ADMINS_ECRIVENT],
    rowSecurity: false,
    columns: [
      str('theme_id', ID, { required: true }),
      str('image_url', 500, { required: true }),
      integer('position', { default: 0 }),
    ],
    indexes: [{ key: 'theme_position', type: 'key', columns: ['theme_id', 'position'] }],
  },
  {
    // Signalements : créés par le serveur (Function « social »), lus et traités par les admins.
    id: 'reports',
    name: 'Signalements',
    permissions: ['read("team:admins")', 'update("team:admins")'],
    rowSecurity: false,
    columns: [
      str('reporter_id', ID, { required: true }),
      str('target_user_id', ID, { required: true }),
      str('reason', 60, { required: true }),
      text('details'),
      enumeration('status', ['open', 'handled'], { default: 'open' }),
    ],
    indexes: [{ key: 'status', type: 'key', columns: ['status'] }],
  },
  {
    // Blocages : créés et supprimés par le serveur (Function « social »).
    id: 'blocks',
    name: 'Blocages',
    permissions: [],
    rowSecurity: true, // read("user:<celui qui bloque>")
    columns: [str('blocker_id', ID, { required: true }), str('blocked_id', ID, { required: true })],
    indexes: [{ key: 'pair_unique', type: 'unique', columns: ['blocker_id', 'blocked_id'] }],
  },
  {
    // Abonnements payants : lus par leur propriétaire, écrits par le serveur (fonctions billing
    // et stripe-webhook).
    id: 'subscriptions',
    name: 'Abonnements',
    permissions: [],
    rowSecurity: true, // read("user:<id>")
    columns: [
      str('user_id', ID, { required: true }),
      str('stripe_customer_id', 100),
      str('stripe_subscription_id', 100),
      enumeration('status', ['active', 'past_due', 'canceled', 'incomplete'], { required: true }),
      datetime('current_period_end'),
      bool('cancel_at_period_end', { default: false }),
      // Date à laquelle le membre a demandé l'accès immédiat et renoncé à sa rétractation.
      datetime('withdrawal_waiver_at'),
    ],
    indexes: [
      { key: 'user_unique', type: 'unique', columns: ['user_id'] },
      { key: 'customer', type: 'key', columns: ['stripe_customer_id'] },
    ],
  },
];

const IMAGES = ['jpg', 'jpeg', 'png', 'webp'];
const MO = 1024 * 1024;

export const BUCKETS = [
  {
    // Lecture publique : les images s'affichent dans des balises <img>, qui n'envoient pas
    // la session Appwrite. Il faut connaître l'identifiant du fichier pour les voir.
    id: 'avatars',
    name: 'Photos de profil',
    permissions: [PUBLIC, MEMBRES_CREENT],
    fileSecurity: true, // update/delete("user:<id>")
    maximumFileSize: 2 * MO,
    allowedFileExtensions: IMAGES,
  },
  {
    id: 'sorties-images',
    name: 'Images des sorties',
    permissions: [PUBLIC, MEMBRES_CREENT],
    fileSecurity: true,
    maximumFileSize: 5 * MO,
    allowedFileExtensions: IMAGES,
  },
  {
    // Fichiers privés : chaque fichier reçoit read("team:<conversation>").
    id: 'chat-media',
    name: 'Médias des conversations',
    permissions: [MEMBRES_CREENT],
    fileSecurity: true,
    maximumFileSize: 20 * MO,
    allowedFileExtensions: [...IMAGES, 'gif', 'mp4', 'webm', 'mov'],
  },
];

export const TEAMS = [
  { id: 'admins', name: 'Admins' },
  { id: 'abonnes', name: 'Abonnés' },
];
