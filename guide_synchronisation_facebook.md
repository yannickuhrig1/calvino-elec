# Guide de Synchronisation Facebook Graph API ⚡

Ce guide explique comment obtenir et configurer un **jeton d'accès permanent** (Page Access Token) pour synchroniser automatiquement les réalisations de votre page Facebook avec le site Calvino Elec.

---

## Étape 1 : Créer un compte Meta Developer et une Application

1. Connectez-vous sur [Meta for Developers](https://developers.facebook.com/) avec vos identifiants Facebook.
2. Cliquez sur **Mes applications** en haut à droite, puis sur **Créer une application**.
3. Choisissez le type d'application : Sélectionnez **Autre**, puis cliquez sur **Suivant**.
4. Sélectionnez le type d'application **Entreprise** (Business) ou **Consommateur** (Consumer) et complétez les informations (Nom de l'application, adresse e-mail de contact).
5. Cliquez sur **Créer une application**.

---

## Étape 2 : Ajouter le produit "Facebook Login" (Connexion Facebook)

1. Dans le tableau de bord de votre application nouvellement créée, recherchez **Connexion Facebook** dans la liste des produits et cliquez sur **Configurer**.
2. Sélectionnez **Web** et renseignez l'URL de votre site (vous pourrez la modifier plus tard, vous pouvez mettre `http://localhost` pour le développement).

---

## Étape 3 : Obtenir un jeton d'accès Page longue durée (60 jours)

Pour cela, nous allons utiliser l'outil d'exploration de l'API Graph (Graph API Explorer) de Meta.

1. Rendez-vous sur l'outil [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Dans le menu de droite, dans **Application Meta**, sélectionnez l'application que vous venez de créer.
3. Dans **Jeton d'accès**, sélectionnez **Jeton d'accès utilisateur** (User Access Token).
4. Dans **Autorisations** (Permissions), ajoutez les permissions suivantes :
   * `pages_read_user_content` (indispensable pour lire le fil d'actualité)
   * `pages_show_list`
   * `pages_manage_posts` (optionnel)
5. Cliquez sur **Generate Access Token** (Générer un jeton d'accès). Une fenêtre d'autorisation Facebook s'ouvre, validez-la en sélectionnant la page **Calvino Elec**.
6. Copiez ce jeton d'accès utilisateur temporaire (il expire dans 1 ou 2 heures).

---

## Étape 4 : Convertir le jeton utilisateur en jeton permanent pour la Page

Nous allons maintenant transformer ce jeton temporaire en un jeton d'accès de page permanent (qui n'expire jamais).

1. Ouvrez l'outil [Access Token Tool (Outil de jetons d'accès)](https://developers.facebook.com/tools/accesstoken/).
2. Recherchez le jeton que vous venez de générer et cliquez sur **Détails / Déboguer** (Debug).
3. Cliquez sur **Extend Access Token** (Prolonger le jeton d'accès) en bas de page. Cela génère un jeton utilisateur longue durée (valable 60 jours).
4. Pour obtenir le jeton de page permanent (qui n'expire jamais) :
   Retournez sur le [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
   * Dans le champ **Jeton d'accès**, collez le jeton utilisateur longue durée (60 jours).
   * Dans le champ de requête API (la barre d'adresse centrale), remplacez le texte par : `/me/accounts`
   * Cliquez sur **Soumettre** (Submit).
5. La réponse JSON affiche la liste de vos pages Facebook.
6. Repérez la page **Calvino Elec** et copiez la valeur du champ `access_token` associé à cette page. **Ce jeton est permanent et n'expirera jamais.**

---

## Étape 5 : Configurer la variable d'environnement sur votre hébergeur

Une fois votre jeton d'accès permanent récupéré, vous devez le renseigner sur votre plateforme d'hébergement (Vercel, Netlify, etc.) :

### Sur Vercel :
1. Allez dans le tableau de bord de votre projet Vercel.
2. Allez dans **Settings** (Paramètres) > **Environment Variables** (Variables d'environnement).
3. Ajoutez une nouvelle variable :
   * **Key (Clé)** : `FACEBOOK_PAGE_TOKEN`
   * **Value (Valeur)** : *(Collez votre jeton permanent)*
4. Cliquez sur **Save** et redéployez le site.

### Sur Netlify :
1. Allez dans le tableau de bord de votre site Netlify.
2. Allez dans **Site configuration** > **Environment variables**.
3. Cliquez sur **Add a variable** > **Add single variable** :
   * **Key (Clé)** : `FACEBOOK_PAGE_TOKEN`
   * **Value (Valeur)** : *(Collez votre jeton permanent)*
4. Cliquez sur **Create variable** et déclenchez un nouveau déploiement.

---

## 🔍 Comment fonctionne la synchronisation sur le site ?

* **Mode Local (`file://`)** : Lorsque vous ouvrez les fichiers HTML localement sur votre ordinateur, le site détecte le protocole local et utilise automatiquement les réalisations statiques par défaut (afin de ne pas afficher une page vide ou casser le design).
* **Mode Production** : Une fois déployé, le site interroge automatiquement la fonction serverless (`/api/facebook-photos` ou `/.netlify/functions/facebook-photos`). La fonction récupère les 12 dernières photos de la page Facebook, les met en cache pendant 1 heure pour optimiser le temps de chargement, et les affiche sous forme de grille interactive. Chaque photo renvoie directement vers la publication Facebook d'origine si l'utilisateur clique dessus.
