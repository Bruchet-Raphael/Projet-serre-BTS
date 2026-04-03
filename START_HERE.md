# ⚡ START HERE - Étapes Rapides pour Corriger le Système de Tokens

## 🎯 Objectif
Corriger le problème: **"Le token admin n'a pas accès aux pages qu'il devrait avoir"**

**Statut**: ✅ **CORRIGÉ** - Tous les changements sont faits

---

## 🚀 À Faire Maintenant (4 Étapes)

### Étape 1: 🗄️ Nettoyer la Base de Données (5 min)

**Où**: MySQL/PhpMyAdmin de votre serveur

**Action**: Copier-coller le contenu de `back/migration_roles.sql` et exécuter

```sql
-- Voir le fichier complet: back/migration_roles.sql
SELECT COUNT(*) FROM Utilisateur;  -- Voir combien d'utilisateurs
UPDATE Utilisateur SET role = LOWER(TRIM(COALESCE(role, 'user')));
UPDATE Utilisateur SET role = 'user' WHERE role IS NULL OR role = '';
SELECT DISTINCT role FROM Utilisateur;  -- Vérifier
```

⚠️ **Important**: Faire une sauvegarde avant!
```bash
mysqldump -u user -p dbname > backup.sql
```

---

### Étape 2: 🔄 Redémarrer le Serveur Backend (2 min)

**Où**: Terminal, dossier `back/`

```bash
cd back
npm restart
# ou
npm stop
npm start
```

✅ Attendre le message `Connecté à la base de données MySQL`

---

### Étape 3: 🧹 Nettoyer le Navigateur (1 min)

**Dans le navigateur:**
1. Appuyer sur **Ctrl + Shift + Del** (ou Cmd + Shift + Del sur Mac)
2. Cocher "**Cookies**"
3. Cliquer "**Supprimer**"

**Alternative**: DevTools → Application → Cookies → Supprimer tout

---

### Étape 4: ✅ Tester les Changements (5 min)

#### Test A: Se Connecter en tant qu'Admin

1. Aller à `http://172.29.160.160/front/login.html`
2. Se connecter avec un compte **admin**
   - *Si vous n'avez pas de compte admin, créer un en exécutant en SQL:*
     ```sql
     SELECT login FROM Utilisateur LIMIT 1;  -- Trouver un user existant
     UPDATE Utilisateur SET role = 'admin' WHERE login = 'found_login';
     ```

3. **Vérifications** ✅
   - [ ] Redirection vers `/front/admin.html` (pas `index.html`)
   - [ ] Lien "**Admin**" est **VISIBLE** dans la barre de navigation
   - [ ] Console: `localStorage.getItem('userRole')` retourne `"admin"`

#### Test B: Vérifier le Token

1. Dans la console du navigateur (F12):
   ```javascript
   // Afficher le rôle sauvegardé
   console.log('Role:', localStorage.getItem('userRole'));
   
   // Decoder le token JWT
   const token = document.cookie
     .split('; ')
     .find(c => c.startsWith('accessToken='))
     .split('=')[1];
   
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token Role:', payload.role);
   console.log('Tout le payload:', payload);
   ```

2. **Résultat attendu:**
   ```javascript
   Role: "admin"
   Token Role: "admin"
   Tout le payload: {
     role: "admin",
     sub: 1,
     login: "your_username",
     ...
   }
   ```

#### Test C: Se Connecter en tant qu'User

1. Créer un nouvel utilisateur via `inscription.html` **OU** se connecter avec un user existant
2. **Vérifications** ✅
   - [ ] Redirection vers `/front/index.html` (pas `admin.html`)
   - [ ] Lien "**Admin**" est **CACHÉ** (pas visible)
   - [ ] `localStorage.getItem('userRole')` retourne `"user"`

#### Test D: Accès Admin Refusé pour User

1. Être connecté en tant qu'user
2. Essayer d'appliquer les contrôles (bouton "Appliquer")
3. **Résultat attendu:**
   - Erreur **403 Forbidden**
   - Message: `"Accès refusé : privilèges admin requis"`

---

## 📋 Checklist Rapide

### Avant les changements
- [ ] Sauvegarde BD exécutée
- [ ] Configuration étape 1 complétée

### Après les changements
- [ ] Migration SQL exécutée
- [ ] Serveur relancé
- [ ] Cache navigateur vidé
- [ ] Test A réussi (admin connecté)
- [ ] Test B réussi (token contient rôle)
- [ ] Test C réussi (user non-admin)
- [ ] Test D réussi (403 pour user)

**TOUS LES TESTS RÉUSSIS?** → ✅ **Prêt pour la production!**

---

## 🆘 Ça ne Marche Pas? Troubleshooting Rapide

### ❌ "L'admin voit toujours 403"
```sql
-- Vérifier que l'admin a le bon rôle
SELECT login, role FROM Utilisateur WHERE login = 'admin_username';

-- Résultat attendu: role = 'admin' (minuscule)
-- Corriger si nécessaire:
UPDATE Utilisateur SET role = 'admin' WHERE login = 'admin_username';
```

### ❌ "Le lien Admin n'apparaît pas"
```javascript
// Dans la console (F12):
localStorage.getItem('userRole')  // Doit retourner "admin"

// Si null, se reconnecter
// Si correct mais lien pas visible, vérifier le HTML:
document.getElementById('nav-admin').style.display
```

### ❌ "Le serveur ne redémarre pas"
```bash
cd back
npm stop  # Même si erreur
npm install  # Réinstaller les dépendances
npm start  # Relancer
```

### ❌ "Les changements du code ne s'affichent pas"
- Vérifier que vous êtes dans le bon dossier: `/var/www/html/Projet-serre-BTS/`
- Fichiers modifiés: `back/server.js`, `front/login.js`, `front/script.js`
- Vider le cache: **Ctrl+Shift+Del** → Cookies

### ❌ "Base de données n'a pas changé"
```sql
-- Vérifier la requête s'est bien exécutée:
SELECT COUNT(DISTINCT role) FROM Utilisateur;
-- Doit retourner 2 (admin et user)

-- Voir les détails:
SELECT login, role FROM Utilisateur LIMIT 10;
```

---

## 📚 Documentation Complète

Si vous avez besoin de plus de détails:

| Document | Contenu | Quand l'utiliser |
|----------|---------|------------------|
| `README_TOKEN_FIX.md` | Résumé rapide | Comprendre les changements |
| `TOKEN_FIX_GUIDE.md` | Guide complet | Comprendre en profondeur |
| `TESTS_VALIDATION.md` | 7 scénarios de test | Valider le système |
| `CHANGEMENTS.md` | Code avant/après | Revoir les modifications |
| `migration_roles.sql` | Script SQL | Corriger la BD |

---

## ✨ Résumé des Changements

### Problème Original
- Token JWT **ne contenait PAS** le rôle
- Vérification du rôle **case-sensitive** (Admin ≠ admin)
- Admin refusé avec **403 Forbidden**

### Solution Appliquée
- ✅ Rôle **inclus dans le JWT**
- ✅ Rôle **normalisé** (toLowerCase)
- ✅ Vérification **rapide** depuis le token en priorité
- ✅ **Redirection intelligente** après login
- ✅ Administration **plus sécurisée**

### Fichiers Modifiés
```
back/server.js        ← Logique principale
front/login.js        ← Après authentification
front/script.js       ← UI et gestion rôle
```

### Fichiers Créés
```
back/migration_roles.sql  ← Script de nettoyage BD
TOKEN_FIX_GUIDE.md        ← Doc complète
TESTS_VALIDATION.md       ← Tests
CHANGEMENTS.md            ← Avant/après
README_TOKEN_FIX.md       ← Résumé
```

---

## 🎉 Prêt à Tester?

```bash
# Étape 1: Go to MySQL and run migration_roles.sql

# Étape 2: Redémarrer le serveur
cd back && npm restart

# Étape 3: Nettoyer le navigateur (Ctrl+Shift+Del)

# Étape 4: Tester à http://172.29.160.160/front/login.html

# ✅ Terminé!
```

---

**Dernière mise à jour**: April 3, 2026  
**Statut**: 🟢 **PRÊT À TESTER**
