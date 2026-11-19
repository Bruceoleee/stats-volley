# Stats volley — mise en ligne

L'app est gratuite et en ligne. Elle s'ouvre avec un simple lien, sans compte Claude, et les données sont partagées entre tous les appareils de l'équipe.
Compte environ 30 minutes, une seule fois.

## 1. La base de données (Supabase, gratuit)

1. Crée un compte sur https://supabase.com, puis **New project**. Choisis un nom (ex. `stats-volley`), un mot de passe de base de données (garde-le, il ne sert qu'à toi) et la région **Canada (Central)**.
2. Dans le menu de gauche : **SQL Editor** → **New query**. Colle tout le contenu de `supabase.sql`, puis **Run**. Le message attendu est « Success ».
3. **Authentication** → **Users** → **Add user** → **Create new user** :
   - courriel : n'importe lequel, par exemple `equipe@statsvolley.app` (il n'a pas besoin d'exister) ;
   - mot de passe : le **mot de passe d'équipe** que tu donneras aux entraîneurs ;
   - coche **Auto Confirm User**.
4. **Bloque les inscriptions** pour que personne d'autre ne puisse créer un compte : **Authentication** → **Sign In / Providers** (ou **Settings**) → désactive **Allow new users to sign up** → **Save**.
5. **Project Settings** → **API** (ou **Data API**). Copie le **Project URL** et la clé **anon public**.

## 2. Remplir `config.js`

Ouvre `config.js` dans un éditeur de texte et remplace :

- `supabaseUrl` → le Project URL ;
- `supabaseAnonKey` → la clé anon public ;
- `teamEmail` → le courriel choisi à l'étape 1.3 ;
- `teamName` → le nom de ton équipe (affiché sur l'accueil et les rapports).

La clé anon peut être publique : sans le mot de passe d'équipe, la base refuse toute lecture et toute écriture.

## 3. Mettre l'app en ligne (GitHub Pages, gratuit)

1. Sur https://github.com : **New repository**. Nom : `stats-volley`, visibilité **Public** (GitHub Pages gratuit l'exige ; seuls les fichiers de l'app sont visibles, jamais les stats).
2. Dans le dépôt vide : **uploading an existing file**. Glisse **tout le contenu** du dossier (`index.html`, `app.js`, … et le dossier `icons`), puis **Commit changes**.
3. **Settings** → **Pages** → Source : **Deploy from a branch**, branche **main**, dossier **/ (root)** → **Save**.
4. Après une ou deux minutes, l'adresse apparaît en haut de la page : `https://TON-NOM.github.io/stats-volley/`.

## 4. Installer sur iPhone et iPad

1. Ouvre l'adresse dans **Safari**.
2. Touche **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvre l'app depuis l'icône et entre le mot de passe d'équipe. Ça se fait une seule fois par appareil.

## Bon à savoir

- **Synchro** : chaque touche est envoyée en ligne. La pastille en haut indique « ✓ Enregistré ». Sans réseau au gymnase, elle indique « Hors ligne » et tout part dès que le réseau revient. Ne ferme pas l'app avant de revoir « ✓ Enregistré ».
- **Un appareil par feuille** pendant le match : deux appareils qui modifient la même feuille en même temps s'écrasent.
- **Supabase gratuit** met le projet en pause après environ une semaine sans aucune utilisation (l'intersaison, par exemple). Pour le réveiller, connecte-toi sur supabase.com et clique **Restore project**. Les données sont conservées.
- **Changer le mot de passe d'équipe** : Supabase → Authentication → Users → ton utilisateur → **Reset password** / modifier.
- **Mettre à jour l'app** : remplace les fichiers dans le dépôt GitHub (même méthode qu'à l'étape 3.2).
- **Mode démo** : tant que `config.js` n'est pas rempli, l'app fonctionne mais garde tout sur l'appareil. C'est pratique pour l'essayer avant la mise en ligne.
