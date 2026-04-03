# 🧪 Tests de Validation - Système de Tokens et Rôles

## Avant de tester

1. **Exécuter la migration SQL** (voir `migration_roles.sql`)
2. **Redémarrer le serveur Backend**: `npm restart` dans le dossier `back/`
3. **Nettoyer les cookies du navigateur**: Ctrl+Shift+Del → Cookies
4. **Ouvrir les DevTools**: F12

## 🧪 Scénario 1: Inscription d'un Nouvel Utilisateur

### Étapes:
1. Aller à `/front/inscription.html`
2. Remplir le formulaire avec:
   - Prenom: Test
   - Nom: User
   - Email: testuser@example.com
   - Username: testuser123
   - Password: Test123456

### Vérifications:
- [ ] ✅ Inscription réussit
- [ ] ✅ Redirection vers `/front/index.html` (pas admin)
- [ ] ✅ Lien "Admin" n'apparaît PAS
- [ ] ✅ Dans DevTools → Cookies: `accessToken` et `refreshToken` présents

### Vérification Backend:
```javascript
// Dans la console du navigateur:
const token = document.cookie.split('; ').find(c => c.startsWith('accessToken=')).split('=')[1];
// Copier les données et les décoder sur jwt.io pour vérifier:
// {
//   "role": "user",  // ✅ Le rôle doit être présent
//   "sub": 123,
//   "login": "testuser123",
//   ...
// }
```

## 🧪 Scénario 2: Login d'Un Utilisateur Régulier

### Étapes:
1. Aller à `/front/login.html`
2. Se connecter avec le nouvel utilisateur créé
3. Observer la redirection

### Vérifications:
- [ ] ✅ Login réussit
- [ ] ✅ Redirection vers `/front/index.html`
- [ ] ✅ Lien "Admin" n'apparaît PAS
- [ ] ✅ localStorage.userRole = "user"
- [ ] ✅ Token contient `"role": "user"`

### Vérification du Token:
```javascript
// Console du navigateur:
localStorage.getItem('userRole');  // ✅ Doit retourner "user"

// Vérifier le payload du token:
const token = document.cookie
  .split('; ')
  .find(c => c.startsWith('accessToken='))
  .split('=')[1];
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload.role);  // ✅ Doit afficher "user"
```

## 🧪 Scénario 3: Login d'Un Admin

### Prérequis:
Avoir un utilisateur admin en base de données. Si vous n'en avez pas:

```sql
-- Connectez-vous à MySQL et exécutez:
UPDATE Utilisateur SET role = 'admin' WHERE login = 'your_admin_username';
```

### Étapes:
1. Aller à `/front/login.html`
2. Se connecter avec un compte admin
3. Observer la redirection et les changements

### Vérifications:
- [ ] ✅ Login réussit
- [ ] ✅ Redirection vers `/front/admin.html` (pas index.html!)
- [ ] ✅ Lien "Admin" APPARAÎT
- [ ] ✅ localStorage.userRole = "admin"
- [ ] ✅ Token contient `"role": "admin"`

### Vérification du Token Admin:
```javascript
// Console:
localStorage.getItem('userRole');  // ✅ "admin"
const payload = JSON.parse(atob(
  document.cookie
    .split('; ')
    .find(c => c.startsWith('accessToken='))
    .split('=')[1]
    .split('.')[1]
));
console.log(payload.role);  // ✅ "admin"
```

## 🧪 Scénario 4: Accès aux Routes Admin

### Prérequis:
Être connecté en tant qu'admin

### Étapes:
1. Depuis `/front/admin.html` (ou n'importe quelle page)
2. Cliquer sur le bouton "Appliquer les paramètres"
3. Cela envoie une requête POST à `/api/controles` (route admin)

### Vérifications:
- [ ] ✅ La requête POST `/api/controles` retourne 200 (succès)
- [ ] ✅ Les contrôles sont appliqués
- [ ] ✅ Pas d'erreur 403 "Accès refusé"

### Vérification dans DevTools (Network):
```
POST /api/controles
Status: 200 ✅
Response: {"success": true, "message": "Contrôles appliqués et sauvegardés"}
```

## 🧪 Scénario 5: Accès Admin Refusé pour Non-Admin

### Prérequis:
Être connecté en tant qu'utilisateur régulier

### Étapes:
1. Depuis `/front/index.html` (connecté en tant qu'user)
2. Dans la console, envoyer une requête admin:

```javascript
fetch('/api/controles', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  credentials: 'include',
  body: JSON.stringify({
    irrigation: {mode: 'inactive', threshold: 30},
    misting: {mode: 'inactive', intensity: 50},
    ventilation: {mode: 'inactive', duration: null},
    heating: {mode: 'inactive', target: 20}
  })
}).then(r => r.json()).then(console.log);
```

### Vérifications:
- [ ] ✅ Erreur 403: "Accès refusé : privilèges admin requis"
- [ ] ✅ PAS 500 (erreur serveur)
- [ ] ✅ Le message est clair

## 🧪 Scénario 6: Déconnexion

### Étapes:
1. Cliquer sur "Déconnexion"
2. Observer l'état après déconnexion

### Vérifications:
- [ ] ✅ Redirection vers `/front/login.html`
- [ ] ✅ localStorage.userRole est supprimé
- [ ] ✅ Cookies supprimés (accessToken, refreshToken)
- [ ] ✅ Lien "Admin" disparaît

```javascript
// Après déconnexion, dans la console:
localStorage.getItem('userRole');  // ✅ null (pas d'utilisateur)
document.cookie;  // ✅ Pas de accessToken
```

## 🧪 Scénario 7: Token Expiré (15 minutes)

### Étapes avancées:
1. Se connecter normalement
2. Attendre 15 minutes OU modifier le `expiresIn` du JWT en `"5s"` pour test rapide
3. Essayer de faire une requête API

### Vérifications:
- [ ] ✅ Erreur 401: "Token invalide ou expiré"
- [ ] ✅ Redirection automatique vers login

## 📊 Résumé des Cas de Test

| Scénario | User vs Admin | Résultat Attendu | Status |
|----------|--------------|-------------------|--------|
| Inscription | user | Rôle=user, Redirect index | ✅ |
| Login user | user | Pas d'accès admin | ✅ |
| Login admin | admin | Accès admin visible | ✅ |
| POST /controles (admin) | admin | 200 OK | ✅ |
| POST /controles (user) | user | 403 Forbidden | ✅ |
| Déconnexion | - | Data supprimée | ✅ |
| Token expiré | - | 401 Unauthorized | ✅ |

## 🐛 Troubleshooting

### Admin voit toujours 403

**Cause likely**: Rôle pas à jour en BD ou token pas regénéré

```bash
# 1. Vérifier la BD
SELECT login, role FROM Utilisateur WHERE login = 'admin_user';

# 2. Se reconnecter pour générer un nouveau token
# ou nettoyer les cookies et relancer la page
```

### Lien Admin n'aparaît toujours pas

**Cause**: updateAuthButton() n'a pas mis à jour le DOM

```javascript
// Dans la console:
document.getElementById('nav-admin').style.display;  // Vérifier la valeur
localStorage.getItem('userRole');  // Vérifier le stockage
```

### Redirect vers admin.html échoue

**Cause**: Page n'existe pas ou chemin incorrect

```javascript
// Dans login.js, vérifier:
const redirectUrl = data.role === 'admin' 
  ? "/front/admin.html"  // ✅ Le chemin est correct?
  : "/front/index.html";
```

## 📋 Checklist Final

- [ ] Migration SQL exécutée
- [ ] Serveur backend redémarré
- [ ] Cache du navigateur nettoydé
- [ ] Tous les scénarios testés
- [ ] Les 7 cas de test TOUS réussissent ✅
- [ ] Pas d'erreurs 500 ou inattendues
- [ ] Les messages d'erreur 403 sont clairs
- [ ] La documentation est à jour

---
**Date**: April 3, 2026
**Version**: 1.0
