# Guide de Correction des Problèmes de Token et d'Autorisation

## 🔍 Problèmes Identifiés et Corrigés

### 1. **Token JWT sans rôle**
- **Problème**: Le token n'incluait pas le rôle utilisateur
- **Impact**: Chaque requête admin devait interroger la BD pour vérifier le rôle
- **Solution**: Ajouter le rôle au payload JWT lors de la création du token

### 2. **Vérification du rôle case-sensitive**
- **Problème**: `"Admin" !== "admin"` causait des rejets d'accès
- **Impact**: Les admins ne pouvaient pas accéder aux pages admin
- **Solution**: Ajouter `toLowerCase().trim()` pour normaliser les rôles

### 3. **Pas de rôle par défaut à l'inscription**
- **Problème**: Les utilisateurs étaient créés sans rôle (NULL)
- **Impact**: Les non-admins ne pouvaient pas accéder aux routes publiques
- **Solution**: Définir un rôle par défaut `'user'` à l'inscription

### 4. **Pas de rôle par défaut au login**
- **Problème**: La BD pouvait retourner NULL ou un rôle mal formaté
- **Impact**: L'accès dépendait d'un format exact dans la BD
- **Solution**: Utiliser un default avec `||` et normaliser

## 📝 Changements Effectués

### Backend (`back/server.js`)

#### ✅ Constantes de Rôles
```javascript
const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};
```

#### ✅ Token JWT - Login
```javascript
// Avant: Pas de rôle dans le token
const accessPayload = {
  sub: userId,
  login: user.Login,
  jti,
  type: "accessToken",
};

// Après: Rôle inclus et normalisé
const userRole = (user.role || ROLES.USER).toLowerCase().trim();
const accessPayload = {
  sub: userId,
  login: user.Login,
  role: userRole,  // ✨ NOUVEAU
  jti,
  type: "accessToken",
};
```

#### ✅ Token JWT - Inscription
- Même traitement que le login
- Les nouveaux utilisateurs reçoivent `role: 'user'`

#### ✅ Insertion à l'Inscription
```javascript
// Avant: PAS DE ROLE
const insertQuery =
  "INSERT INTO Utilisateur (nom, prenom, mail, login, mdp) VALUES (?, ?, ?, ?, ?)";

// Après: ROLE PAR DÉFAUT
const insertQuery =
  "INSERT INTO Utilisateur (nom, prenom, mail, login, mdp, role) VALUES (?, ?, ?, ?, ?, ?)";
db.query(insertQuery, 
  [nom, prenom, email, username, hashedPassword, ROLES.USER], ...);
```

#### ✅ Middleware Admin - Avant/Après

**Avant (inefficace et bugué):**
```javascript
function isAdminMiddleware(req, res, next) {
  const userId = req.user?.sub;
  // ❌ Requête BD systématique
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    const user = results[0];
    if (user.role !== "admin") {  // ❌ Case-sensitive et sans trim
      return res.status(403).json({...});
    }
    next();
  });
}
```

**Après (optimal et robuste):**
```javascript
function isAdminMiddleware(req, res, next) {
  const tokenRole = req.user?.role;  // ✨ Vérifier token d'abord
  
  if (tokenRole === ROLES.ADMIN) {
    return next();  // ✨ Pas de requête BD si token valide
  }
  
  // Fallback: Vérifier BD pour compatibilité
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    const dbRole = (user.role || "").toLowerCase().trim();  // ✨ Normalisé
    if (dbRole !== ROLES.ADMIN) {
      return res.status(403).json({...});
    }
    next();
  });
}
```

#### ✅ Endpoint `/api/user-role` - Optimisé
```javascript
// Avant: Requête BD systématique
app.get("/api/user-role", authMiddleware, (req, res) => {
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], ...);
});

// Après: Utilise le token en priorité
app.get("/api/user-role", authMiddleware, (req, res) => {
  const tokenRole = req.user?.role;
  if (tokenRole) {  // ✨ Si dans le token, retourner immédiatement
    return res.json({ success: true, role: tokenRole });
  }
  // Fallback: BD
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], ...);
});
```

### Frontend

#### ✅ `login.js` - Sauvegarde du rôle
```javascript
// Nouveau: Sauvegarder le rôle en localStorage
const data = await response.json();
if (data.success && data.role) {
  localStorage.setItem('userRole', data.role);
}

// Nouveau: Redirection intelligente basée sur le rôle
const redirectUrl = data.role === 'admin' 
  ? "/front/admin.html" 
  : "/front/index.html";
window.location.href = redirectUrl;
```

#### ✅ `script.js` - updateAuthButton amélioré
```javascript
// Avant: Pas de normalisation du rôle
if (roleData.role === 'admin' && navAdmin) {
  navAdmin.style.display = "inline-block";
}

// Après: Normalisation + localStorage
const userRole = roleData.role?.toLowerCase().trim();
localStorage.setItem('userRole', userRole);
if (userRole === 'admin' && navAdmin) {
  navAdmin.style.display = "inline-block";
}

// Nouveau: Supprimer le rôle à la déconnexion
localStorage.removeItem('userRole');
```

## 🛠️ Nettoyage de la Base de Données

### Pour corriger les rôles existants:

```sql
-- Voir les rôles actuels
SELECT id, login, role FROM Utilisateur;

-- Normaliser les rôles existants en minuscules
UPDATE Utilisateur SET role = LOWER(TRIM(role)) WHERE role IS NOT NULL;

-- Définir un rôle par défaut pour les utilisateurs sans rôle
UPDATE Utilisateur SET role = 'user' WHERE role IS NULL OR role = '';

-- Vérifier le résultat
SELECT id, login, role FROM Utilisateur;
```

### Pour promouvoir un utilisateur en admin:

```sql
-- Trouver l'utilisateur
SELECT id, login, role FROM Utilisateur WHERE login = 'your_username';

-- Promouvoir en admin
UPDATE Utilisateur SET role = 'admin' WHERE id = 123;  -- Remplacer 123 par l'ID

-- Vérifier
SELECT id, login, role FROM Utilisateur WHERE id = 123;
```

## ✅ Checklist de Validation

### Backend
- [ ] Les constantes ROLES sont définies
- [ ] Les tokens JWT incluent le rôle
- [ ] Le rôle est normalisé à la création du token
- [ ] L'inscription crée un utilisateur avec `role = 'user'`
- [ ] Le middleware admin vérifie le token en priorité
- [ ] L'endpoint `/api/user-role` retourne le rôle du token d'abord
- [ ] Tous les rôles sont normalisés en base (lowercase)

### Frontend
- [ ] Login sauvegarde le rôle en localStorage
- [ ] Redirection basée sur le rôle après login
- [ ] updateAuthButton normalise le rôle
- [ ] Le lien admin n'apparaît que pour les admins
- [ ] La déconnexion supprime le rôle du localStorage

### Base de Données
- [ ] Tous les utilisateurs ont un rôle défini
- [ ] Les rôles sont en minuscules ('admin' ou 'user')
- [ ] L'admin a le rôle 'admin'
- [ ] Les utilisateurs réguliers ont le rôle 'user'

## 🚀 Déploiement

1. **Sauvegarder les données:**
   ```bash
   mysqldump -u user -p database > backup.sql
   ```

2. **Exécuter les corrections SQL** (voir section nettoyage)

3. **Redémarrer le serveur Backend:**
   ```bash
   cd back
   npm restart
   ```

4. **Nettoyer le cache du navigateur:** Ctrl+Shift+Del

5. **Tester les accès:**
   - User normal: Pas d'accès au lien admin ✓
   - Admin: Accès complet au lien admin ✓
   - Routes protégées: Erreur 403 sans token valid ✓

## 📞 Troubleshooting

### Problème: Admin toujours rejeté 403
- **Cause**: Rôle mal formaté en BD (espace, majuscules)
- **Solution**: Exécuter le nettoyage SQL

### Problème: Lien admin n'apparaît pas
- **Cause**: Le rôle n'est pas retourné correctement
- **Solution**: Vérifier `/api/user-role` retourne bien le rôle

### Problème: Redirect après login vers mauvaise page
- **Cause**: localStorage corrompu
- **Solution**: Nettoyer localStorage (Dev Tools > Application > Storage)

### Problème: Token encore sans rôle
- **Cause**: Tokens générés avant la mise à jour
- **Solution**: Se reconnecter pour générer un nouveau token

---
**Dernière mise à jour:** April 3, 2026
**Auteur:** Correction Token/Role System
