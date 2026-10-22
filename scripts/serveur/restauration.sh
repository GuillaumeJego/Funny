#!/usr/bin/env bash
# Vérifie ou restaure une sauvegarde faite par sauvegarde.sh. À lancer en root sur le serveur.
#
#   sudo ./restauration.sh verifier  /chemin/appwrite-AAAA-MM-JJ-HHMM.tar.gpg
#       Déchiffre l'archive et contrôle qu'elle est complète et lisible. Ne touche à rien.
#
#   sudo ./restauration.sh restaurer /chemin/appwrite-AAAA-MM-JJ-HHMM.tar.gpg
#       Remplace la base et les fichiers d'Appwrite par ceux de la sauvegarde.
#       Tout ce qui a changé depuis est perdu. Appwrite est arrêté pendant l'opération.
#
# Sur un serveur neuf : installer Appwrite avec le .env de la sauvegarde (même clé
# _APP_OPENSSL_KEY_V1), puis lancer « restaurer ». Voir docs/sauvegardes.md.

set -euo pipefail

MODE="${1:-}"
ARCHIVE="${2:-}"
APPWRITE_DIR="${APPWRITE_DIR:-/home/ubuntu/appwrite}"
PHRASE="${PHRASE:-/root/.sauvegarde-phrase}"

journal() { echo "$(date '+%F %T') $*"; }

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root (sudo)."; exit 1; }
case "$MODE" in verifier | restaurer) ;; *) sed -n '2,13p' "$0"; exit 1 ;; esac
[ -f "$ARCHIVE" ] || { echo "Archive introuvable : $ARCHIVE"; exit 1; }
[ -s "$PHRASE" ] || { echo "Phrase secrète absente : $PHRASE"; exit 1; }

env_val() { grep -E "^$1=" "$APPWRITE_DIR/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB_USER="$(env_val _APP_DB_USER)"
DB_NAME="$(env_val _APP_DB_SCHEMA)"

TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

journal "Déchiffrement…"
gpg --batch --quiet --passphrase-file "$PHRASE" -d "$ARCHIVE" | tar -C "$TRAVAIL" -xf -
DOSSIER="$(find "$TRAVAIL" -mindepth 1 -maxdepth 1 -type d | head -1)"

for f in base.dump .env docker-compose.yml; do
  [ -s "$DOSSIER/$f" ] || { echo "❌ $f manque dans l'archive"; exit 1; }
done
TABLES="$(docker exec -i appwrite-postgresql pg_restore --list <"$DOSSIER/base.dump" | grep -c 'TABLE DATA' || true)"
journal "✅ base lisible : $TABLES tables"
for t in "$DOSSIER"/fichiers/*.tar.gz; do
  n="$(tar -tzf "$t" | grep -vc '/$' || true)"
  journal "✅ $(basename "$t" .tar.gz) lisible : $n fichier(s)"
done
if ! cmp -s <(env_val _APP_OPENSSL_KEY_V1) <(grep -E '^_APP_OPENSSL_KEY_V1=' "$DOSSIER/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'); then
  journal "⚠️  la clé _APP_OPENSSL_KEY_V1 de la sauvegarde diffère de celle du serveur : restaurer d'abord son .env"
fi
[ "$MODE" = verifier ] && { journal "Vérification terminée, rien n'a été modifié."; exit 0; }

read -r -p "Remplacer TOUTES les données actuelles d'Appwrite par cette sauvegarde ? Tape RESTAURER : " ok
[ "$ok" = RESTAURER ] || { echo "Annulé."; exit 1; }

cd "$APPWRITE_DIR"
journal "Arrêt d'Appwrite (sauf la base)…"
SERVICES="$(docker compose config --services | grep -vx postgresql)"
# shellcheck disable=SC2086
docker compose stop $SERVICES

journal "Restauration de la base…"
docker exec -i appwrite-postgresql pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner <"$DOSSIER/base.dump"

for t in "$DOSSIER"/fichiers/*.tar.gz; do
  nom="$(basename "$t" .tar.gz)"
  source="$(docker inspect appwrite --format "{{range .Mounts}}{{if eq .Destination \"/storage/$nom\"}}{{.Source}}{{end}}{{end}}")"
  [ -n "$source" ] || { journal "  (pas de volume pour /storage/$nom, ignoré)"; continue; }
  journal "Restauration des fichiers $nom…"
  find "$source" -mindepth 1 -delete
  tar -C "$source" -xzf "$t"
done

journal "Redémarrage d'Appwrite…"
docker compose up -d
journal "Restauration terminée."
