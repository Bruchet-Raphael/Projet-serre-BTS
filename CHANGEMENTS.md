# 📝 Changements Effectués - Fichier par Fichier

## 1. **back/server.js** - Changements Principaux

### ✨ Ajout 1: Constantes ROLES (après ligne 36)
```javascript
// ========================================
// 📋 CONSTANTES RÔLES
// ========================================
const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};
```

### ✨ Ajout 2: Rôle dans le JWT au Login (ligne ~165-180)
**AVANT:**
```javascript
const accessPayload = {
  sub: userId,
  login: user.Login,
  jti,
  type: "accessToken",
};
```

**APRÈS:**
```javascript
const userRole = (user.role || ROLES.USER).toLowerCase().trim();
const accessPayload = {
  sub: userId,
  login: user.Login,
  role: userRole,  // ← NOUVEAU
  jti,
  type: "accessToken",
};
```

### ✨ Ajout 3: Retourner le rôle normalisé (ligne ~203)
**AVANT:**
```javascript
return res.json({
  success: true,
  message: "Connexion réussie",
  role: user.role || "user",
});
```

**APRÈS:**
```javascript
return res.json({
  success: true,
  message: "Connexion réussie",
  role: userRole,  // ← Utilise la variable normalisée
});
```

### ✨ Ajout 4: Rôle par défaut à l'inscription (ligne ~245)
**AVANT:**
```javascript
const insertQuery =
  "INSERT INTO Utilisateur (nom, prenom, mail, login, mdp) VALUES (?, ?, ?, ?, ?)";
db.query(
  insertQuery,
  [nom, prenom, email, username, hashedPassword],
  (err, results) => {
```

**APRÈS:**
```javascript
const insertQuery =
  "INSERT INTO Utilisateur (nom, prenom, mail, login, mdp, role) VALUES (?, ?, ?, ?, ?, ?)";
db.query(
  insertQuery,
  [nom, prenom, email, username, hashedPassword, ROLES.USER],  // ← Rôle ajouté
  (err, results) => {
```

### ✨ Ajout 5: Rôle dans le JWT à l'inscription (ligne ~260)
**AVANT:**
```javascript
const accessPayload = {
  sub: userId,
  login: username,
  jti,
  type: "accessToken",
};
```

**APRÈS:**
```javascript
const accessPayload = {
  sub: userId,
  login: username,
  role: ROLES.USER,  // ← NOUVEAU
  jti,
  type: "accessToken",
};
```

### ✨ Ajout 6: Middleware Admin Amélioré (ligne ~765)
**AVANT:**
```javascript
function isAdminMiddleware(req, res, next) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Utilisateur non authentifié" });
  }
  
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(403).json({ success: false, message: "Utilisateur introuvable" });
    }
    
    const user = results[0];
    if (user.role !== "admin") {  // ❌ Case-sensitive!
      return res.status(403).json({ success: false, message: "Accès refusé : privilèges admin requis" });
    }
    
    next();
  });
}
```

**APRÈS:**
```javascript
function isAdminMiddleware(req, res, next) {
  const userId = req.user?.sub;
  const tokenRole = req.user?.role;  // ← Vérifie le token d'abord
  
  // Vérification du rôle depuis le token (rapide) - PRIORITÉ
  if (tokenRole === ROLES.ADMIN) {
    return next();  // ← Retour immédiat, pas de requête BD
  }
  
  if (!userId) {
    return res.status(401).json({ success: false, message: "Utilisateur non authentifié" });
  }
  
  // Fallback: Vérifier en base de données si le rôle n'est pas dans le token
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(403).json({ success: false, message: "Utilisateur introuvable" });
    }
    
    const user = results[0];
    const dbRole = (user.role || "").toLowerCase().trim();  // ← NORMALISÉ
    
    if (dbRole !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: "Accès refusé : privilèges admin requis" });
    }
    
    next();
  });
}
```

### ✨ Ajout 7: Nouveau Middleware User (après isAdminMiddleware, ~810)
```javascript
// ========================================
// 🔐 User Middleware (Non-Admin only)
// ========================================

function isUserMiddleware(req, res, next) {
  const tokenRole = req.user?.role;
  
  // Empêcher les admins d'accéder aux routes "user only" (si jamais utile)
  // Pour l'instant, ce middleware accepte tout utilisateur authentifié
  next();
}
```

### ✨ Ajout 8: Endpoint `/api/user-role` Optimisé (ligne ~589)
**AVANT:**
```javascript
app.get("/api/user-role", authMiddleware, (req, res) => {
  const userId = req.user.sub;
  
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    // ...
    res.json({
      success: true,
      role: results[0].role || "user",
    });
  });
});
```

**APRÈS:**
```javascript
app.get("/api/user-role", authMiddleware, (req, res) => {
  const tokenRole = req.user?.role;
  const userId = req.user.sub;
  
  // Si le rôle est dans le token JWT (après mise à jour), le retourner directement
  if (tokenRole) {
    return res.json({
      success: true,
      role: tokenRole,  // ← Pas de requête BD!
    });
  }
  
  // Fallback: Récupérer le rôle depuis la BD (pour compatibilité avec les tokens anciens)
  const query = "SELECT role FROM Utilisateur WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    // ...
    const dbRole = (results[0].role || ROLES.USER).toLowerCase().trim();
    res.json({
      success: true,
      role: dbRole,
    });
  });
});
```

---

## 2. **front/login.js** - Changements

### ✨ Changement: Sauvegarde et Redirection Intelligente
**AVANT:**
```javascript
successBox.textContent = "Connexion réussie !";
successBox.style.display = "block";

setTimeout(() => {
  window.location.href = "/";
}, 1);
```

**APRÈS:**
```javascript
// Sauvegarder le rôle dans localStorage pour utilisation côté client
if (data.role) {
  localStorage.setItem('userRole', data.role);
}

successBox.textContent = "Connexion réussie !";
successBox.style.display = "block";

// Redirection intelligente basée sur le rôle
const redirectUrl = data.role === 'admin' 
  ? "/front/admin.html" 
  : "/front/index.html";

setTimeout(() => {
  window.location.href = redirectUrl;
}, 500);
```

---

## 3. **front/script.js** - Fonction updateAuthButton()

### ✨ Changement: Normalisation et Gestion du Rôle
**AVANT:**
```javascript
if (roleResponse.ok) {
  const roleData = await roleResponse.json();
  if (roleData.role === 'admin' && navAdmin) {
    navAdmin.style.display = "inline-block";
  }
} else {
  if (navAdmin) navAdmin.style.display = "none";
}
```

**APRÈS:**
```javascript
if (roleResponse.ok) {
  const roleData = await roleResponse.json();
  const userRole = roleData.role?.toLowerCase().trim();  // ← NORMALISÉ
  
  // Sauvegarder le rôle localement
  if (userRole) {
    localStorage.setItem('userRole', userRole);
  }
  
  // Afficher le lien admin si l'utilisateur est admin
  if (userRole === 'admin' && navAdmin) {
    navAdmin.style.display = "inline-block";
  } else if (navAdmin) {
    navAdmin.style.display = "none";
  }
} else {
  if (navAdmin) navAdmin.style.display = "none";
}
```

### ✨ Ajout: Suppression du Rôle à la Déconnexion
**AVANT:**
```javascript
} else {
  // L'utilisateur n'est pas connecté
  btn.innerText = "Connexion";
  btn.style.backgroundColor = "#2ecc71";
  btn.style.color = "white";
  if (navAdmin) navAdmin.style.display = "none";
}
```

**APRÈS:**
```javascript
} else {
  // L'utilisateur n'est pas connecté
  btn.innerText = "Connexion";
  btn.style.backgroundColor = "#2ecc71";
  btn.style.color = "white";
  if (navAdmin) navAdmin.style.display = "none";
  localStorage.removeItem('userRole');  // ← NOUVEAU
}
```

---

## 4. **Fichiers Créés**

### ✨ `back/migration_roles.sql`
Script SQL pour nettoyer et normaliser les rôles en base de données.
- Normalise tous les rôles en minuscules
- Donne un rôle par défaut aux utilisateurs sans rôle
- Vérifie les changements

### ✨ `TOKEN_FIX_GUIDE.md`
Documentation complète des problèmes, solutions et déploiement.

### ✨ `TESTS_VALIDATION.md`
7 scénarios de test pour valider le système complet.

### ✨ `README_TOKEN_FIX.md`
Résumé rapide pour l'utilisateur (ce qu'il faut faire).

### ✨ `CHANGEMENTS.md` (ce fichier)
Détails ligne par ligne de tous les changements.

---

## 📊 Résumé des Changements

| Type | Nombre | Détails |
|------|--------|---------|
| Lignes ajoutées | ~80 | Code de gestion du rôle en JWT |
| Lignes modifiées | ~40 | Améliorations middleware et endpoints |
| Constantes ajoutées | 1 | `ROLES = {ADMIN, USER}` |
| Fichiers modifiés | 3 | server.js, login.js, script.js |
| Fichiers créés | 4 | Migration SQL + 3 docs |
| Endpoints modifiés | 2 | `/api/user-role`, middleware admin |
| Sécurité | ✅ | Rôle en JWT, validation stricte |

---

## 🔍 Points Clés à Vérifier

1. ✅ **JWT contient rôle**: Vérifier sur jwt.io
2. ✅ **Normalisation**: toLowerCase().trim()
3. ✅ **Fallback BD**: Pour anciens tokens
4. ✅ **Redirection login**: admin.html vs index.html
5. ✅ **Lien admin**: Seulement si role === 'admin'
6. ✅ **403 Forbidden**: Pour non-admins

---

**Dernière mise à jour**: April 3, 2026
