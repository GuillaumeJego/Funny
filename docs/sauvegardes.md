# Sauvegardes du serveur Appwrite

Chaque nuit, le serveur fait une sauvegarde chiffrée de tout Appwrite (Funny, Math-Aventure et
tout autre projet du serveur). Le PC de l'éditeur vient la chercher chaque jour.

| Où                                 | Quoi                           | Combien de temps |
| ---------------------------------- | ------------------------------ | ---------------- |
| Serveur, `/var/backups/appwrite/`  | une archive par nuit, à 3 h 30 | 7 jours          |
| PC, `Documents\Sauvegardes-Funny\` | copie des archives du serveur  | 30 jours         |

Chaque archive `appwrite-AAAA-MM-JJ-HHMM.tar.gpg` contient la base PostgreSQL, les fichiers
stockés (photos, médias, code des fonctions, certificats), le `.env` et le `docker-compose.yml`.
Elle est chiffrée (AES-256) avec la phrase secrète `/root/.sauvegarde-phrase`. **Sans cette
phrase, les sauvegardes sont illisibles** : en garder une copie hors du serveur (gestionnaire
de mots de passe ou papier), jamais dans le dépôt ni dans un chat.

## Scripts

- `scripts/serveur/sauvegarde.sh` : fait la sauvegarde (root, cron).
- `scripts/serveur/restauration.sh verifier <archive>` : déchiffre et contrôle une archive sans rien modifier.
- `scripts/serveur/restauration.sh restaurer <archive>` : remplace la base et les fichiers d'Appwrite par ceux de l'archive (demande de taper `RESTAURER`).
- `scripts/serveur/recuperer-sauvegardes.ps1` : sur le PC Windows, télécharge les archives manquantes par SSH et garde les 30 plus récentes.

## Installation sur le serveur

Depuis le PC, dans le dossier Funny :

```powershell
scp scripts/serveur/sauvegarde.sh scripts/serveur/restauration.sh ubuntu@vps-0bf5eb6e.vps.ovh.net:~/
ssh ubuntu@vps-0bf5eb6e.vps.ovh.net
```

Puis sur le serveur :

```bash
sudo install -m 700 ~/sauvegarde.sh ~/restauration.sh /usr/local/sbin/
sudo sh -c 'umask 077; openssl rand -base64 32 > /root/.sauvegarde-phrase'
sudo cat /root/.sauvegarde-phrase      # à recopier en lieu sûr
sudo /usr/local/sbin/sauvegarde.sh     # premier essai
echo '30 3 * * * root /usr/local/sbin/sauvegarde.sh >> /var/log/sauvegarde-appwrite.log 2>&1' | sudo tee /etc/cron.d/sauvegarde-appwrite
```

Le dossier d'Appwrite est supposé être `/home/ubuntu/appwrite` ; sinon, ajouter
`APPWRITE_DIR=/chemin` devant la commande dans le cron.

## Récupération automatique sur le PC

1. Connexion SSH sans mot de passe (une seule fois) :
   ```powershell
   ssh-keygen -t ed25519
   type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@vps-0bf5eb6e.vps.ovh.net "cat >> ~/.ssh/authorized_keys"
   ssh -o BatchMode=yes ubuntu@vps-0bf5eb6e.vps.ovh.net echo ok
   ```
2. Tâche planifiée chaque jour à 9 h (ou dès que le PC s'allume si 9 h est passé) :
   ```powershell
   $script = (Resolve-Path scripts\serveur\recuperer-sauvegardes.ps1).Path
   $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
   $trigger = New-ScheduledTaskTrigger -Daily -At 9am
   $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
   Register-ScheduledTask -TaskName 'Sauvegardes Funny' -Action $action -Trigger $trigger -Settings $settings
   ```
   Le résultat de chaque passage est écrit dans `Documents\Sauvegardes-Funny\journal.txt`.

## Restaurer

- **Contrôle mensuel** : `sudo /usr/local/sbin/restauration.sh verifier /var/backups/appwrite/<archive>`.
- **Après une erreur** (données supprimées par erreur) : `sudo /usr/local/sbin/restauration.sh restaurer <archive>`.
  Appwrite est arrêté pendant l'opération ; tout ce qui a changé depuis la sauvegarde est perdu.
- **Serveur perdu** : sur un nouveau serveur, installer Docker et Appwrite de la même version
  avec le `.env` et le `docker-compose.yml` de l'archive (même `_APP_OPENSSL_KEY_V1`, sinon les
  données chiffrées sont illisibles), recréer `/root/.sauvegarde-phrase`, copier l'archive depuis
  le PC avec `scp`, puis lancer `restaurer`.
