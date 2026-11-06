# Funny

Application de sorties entre membres : on crée une sortie, on la rejoint (avec liste d'attente
quand elle est complète), on discute entre amis et on peut s'abonner à Funny Premium.

- Site : Angular 22 (`src/`), hébergé sur Vercel.
- Données, comptes et fichiers : Appwrite, sur `https://appwrite.metanafr.fr`.
- Règles côté serveur : Appwrite Functions (`functions/`). Tout ce qui a de la valeur (inscriptions,
  amis, rôles, paiements) passe par elles ; le navigateur ne fait que lire.
- Paiements : Stripe (fonctions `billing` et `stripe-webhook`).

## Lancer le site sur son PC

```powershell
npm ci
# .env.local (jamais commité) : APPWRITE_ENDPOINT et APPWRITE_PROJECT_ID
npm start          # http://localhost:4200
```

## Vérifier avant d'envoyer

```powershell
npm run format     # mise en forme (Prettier)
npm run build      # construction du site
npm run test:ci    # tests du site
npm run test:functions   # tests des règles des fonctions serveur
```

GitHub refait ces vérifications à chaque demande de fusion (`.github/workflows/ci.yml`).

## Installer ou mettre à jour Appwrite

Chaque script se lance avec une clé API à durée courte, collée dans le terminal puis supprimée
(voir le haut de chaque fichier pour les droits nécessaires) :

| Commande                          | Rôle                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run appwrite:setup`          | Tables, colonnes, droits, stockage et équipes (`scripts/appwrite/schema.mjs`) |
| `npm run appwrite:themes`         | Thèmes de départ et leurs images par défaut                                   |
| `npm run appwrite:functions`      | Envoie le code des fonctions serveur                                          |
| `npm run appwrite:admin -- email` | Donne le rôle admin à un membre                                               |
| `npm run stripe:setup`            | Produit et prix Stripe                                                        |

Les images par défaut des thèmes sont dans `public/images/themes/` (`<thème>-1.webp` à `-3.webp`,
1600 × 900). Pour un nouveau thème de départ : l'ajouter dans `scripts/appwrite/themes-data.mjs`
avec ses 3 images, puis relancer `npm run appwrite:themes`. Les admins peuvent aussi gérer les
thèmes et leurs images depuis l'espace admin.

## Sauvegardes

Voir `docs/sauvegardes.md`.
