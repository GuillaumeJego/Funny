# Copie sur ce PC les sauvegardes du serveur qui n'y sont pas encore, puis ne garde
# que les 30 plus récentes. Les fichiers restent chiffrés : il faut la phrase secrète
# pour les lire. Voir docs/sauvegardes.md pour le lancer chaque jour automatiquement.
#
#   powershell -ExecutionPolicy Bypass -File scripts\serveur\recuperer-sauvegardes.ps1

param(
  [string]$Serveur = 'ubuntu@vps-0bf5eb6e.vps.ovh.net',
  [string]$DossierServeur = '/var/backups/appwrite',
  [string]$DossierPC = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sauvegardes-Funny'),
  [int]$Garder = 30
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $DossierPC | Out-Null
$journal = Join-Path $DossierPC 'journal.txt'
function Journal($texte) {
  $ligne = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $texte"
  Write-Host $ligne
  Add-Content -Path $journal -Value $ligne
}

# BatchMode : échoue au lieu de demander un mot de passe (la tâche planifiée n'a personne à qui demander).
$distants = ssh -o BatchMode=yes $Serveur "ls -1 $DossierServeur/appwrite-*.tar.gpg 2>/dev/null || true"
if ($LASTEXITCODE -ne 0) {
  Journal "❌ Connexion au serveur impossible (clé SSH ? serveur éteint ?)"
  exit 1
}

$nouveaux = 0
foreach ($distant in $distants) {
  $nom = Split-Path $distant -Leaf
  $local = Join-Path $DossierPC $nom
  if (Test-Path $local) { continue }
  scp -q -o BatchMode=yes "${Serveur}:$distant" "$local.part"
  if ($LASTEXITCODE -ne 0) { Journal "❌ Échec du téléchargement de $nom"; exit 1 }
  Move-Item "$local.part" $local
  Journal "✅ $nom ($([math]::Round((Get-Item $local).Length / 1MB, 1)) Mo)"
  $nouveaux++
}
if ($nouveaux -eq 0) { Journal "Rien de nouveau sur le serveur." }

Get-ChildItem $DossierPC -Filter 'appwrite-*.tar.gpg' |
  Sort-Object Name -Descending |
  Select-Object -Skip $Garder |
  ForEach-Object { Remove-Item $_.FullName; Journal "Supprimé (trop ancien) : $($_.Name)" }
