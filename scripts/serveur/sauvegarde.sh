#!/usr/bin/env bash
# Sauvegarde nocturne du serveur Appwrite (Funny, Math-Aventure et tout projet du même serveur).
# À lancer en root sur le VPS, par cron : voir docs/sauvegardes.md.
#
# Ce que contient chaque sauvegarde (une seule archive chiffrée) :
#   - la base PostgreSQL d'Appwrite (comptes, profils, sorties, messages…) ;
#   - les fichiers stockés : photos, médias des conversations, code des fonctions, certificats ;
#   - le fichier .env et docker-compose.yml, indispensables pour relire les données.
# L'archive est chiffrée avec la phrase secrète de /root/.sauvegarde-phrase : sans elle,
# personne ne peut la lire, pas même toi. Garde une copie de cette phrase hors du serveur.

set -euo pipefail

APPWRITE_DIR="${APPWRITE_DIR:-/home/ubuntu/appwrite}"   # dossier qui contient .env et docker-compose.yml
DEST="${DEST:-/var/backups/appwrite}"                   # où le PC vient chercher les sauvegardes
PHRASE="${PHRASE:-/root/.sauvegarde-phrase}"
GARDER="${GARDER:-7}"                                   # nombre de sauvegardes gardées sur le serveur
LECTEUR="${LECTEUR:-ubuntu}"                            # utilisateur SSH autorisé à les télécharger

# Volumes Appwrite à sauvegarder, désignés par leur emplacement dans le conteneur « appwrite »
# (le nom réel du volume change selon l'installation). Le cache et les imports se recréent seuls.
DOSSIERS=(/storage/uploads /storage/functions /storage/builds /storage/sites /storage/certificates /storage/config)

journal() { echo "$(date '+%F %T') $*"; }

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root (sudo)."; exit 1; }
[ -s "$PHRASE" ] || { echo "Phrase secrète absente : $PHRASE (voir docs/sauvegardes.md.."; exit 1; }
[ -f "$APPWRITE_DIR/.env" ] || { echo "Pas de .env dans $APPWRITE_DIR (variable APPWRITE_DIR)."; exit 1; }

# Valeur d'une variable du .env, sans guillemets.
env_val() { grep -E "^$1=" "$APPWRITE_DIR/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB_USER="$(env_val _APP_DB_USER)"
DB_NAME="$(env_val _APP_DB_SCHEMA)"

NOM="appwrite-$(date '+%Y-%m-%d-%H%M')"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT
mkdir -p "$TRAVAIL/$NOM/fichiers" "$DEST"

journal "Base de données ($DB_NAME)…"
docker exec appwrite-postgresql pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom >"$TRAVAIL/$NOM/base.dump"

for dossier in "${DOSSIERS[@]}"; do
  source="$(docker inspect appwrite --format "{{range .Mounts}}{{if eq .Destination \"$dossier\"}}{{.Source}}{{end}}{{end}}")"
  if [ -z "$source" ] || [ ! -d "$source" ]; then
    journal "  (pas de volume pour $dossier, ignoré)"
    continue
  fi
  journal "Fichiers $dossier…"
  tar -C "$source" -czf "$TRAVAIL/$NOM/fichiers/$(basename "$dossier").tar.gz" .
done

cp "$APPWRITE_DIR/.env" "$APPWRITE_DIR/docker-compose.yml" "$TRAVAIL/$NOM/"

journal "Chiffrement…"
tar -C "$TRAVAIL" -cf - "$NOM" |
  gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$PHRASE" -o "$DEST/$NOM.tar.gpg.part"
mv "$DEST/$NOM.tar.gpg.part" "$DEST/$NOM.tar.gpg"

# Lisible par l'utilisateur SSH (le contenu reste chiffré), puis on ne garde que les plus récentes.
chown "root:$LECTEUR" "$DEST" "$DEST/$NOM.tar.gpg"
chmod 750 "$DEST"
chmod 640 "$DEST/$NOM.tar.gpg"
ls -1t "$DEST"/appwrite-*.tar.gpg | tail -n +"$((GARDER + 1))" | xargs -r rm -f

journal "Terminé : $DEST/$NOM.tar.gpg ($(du -h "$DEST/$NOM.tar.gpg" | cut -f1))"
