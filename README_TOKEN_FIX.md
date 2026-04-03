# 🔧 Correction Rapide: Problèmes de Token Admin

## ✅ Problème Résolu

**Avant**: L'admin n'avait pas accès aux pages admin car le token JWT ne contenait pas le rôle.

**Après**: Le token JWT contient maintenant le rôle, et la vérification du rôle est robuste.

---

## 📋 Changements Résumé

### Backend (4 fichiers modifiés)

1. **server.js - Ajouter le rôle au token JWT**
   - Ajout de constantes `ROLES = { ADMIN: 'admin', USER: 'user' }`
   - Le token JWT inclut maintenant le rôle de l'utilisateur
   - Normalisation du rôle en minuscules

2. **server.js - Middleware admin amélioré**
   - Vérification prioritaire du rôle dans le token (rapide)
   - Fallback à vérification BD si le token ne contient pas le rôle
   - Rôle normalisé: `toLowerCase().trim()` pour éviter les erreurs case-sensitive

3. **server.js - Endpoint `/api/user-role` optimisé**
   - Retourne le rôle du token en priorité (pas de requête BD)
   - Fallback à BD pour compatibilité

4. **Inscription - Rôle par défaut**
   - Les nouveaux utilisateurs reçoivent automatiquement `role = 'user'`

### Frontend (2 fichiers modifiés)

1. **login.js - Sauvegarde du rôle**
   - Sauvegarde du rôle en `localStorage`
   - Redirection intelligente: admins → admin.html, users → index.html

2. **script.js - Gestion du rôle**
   - Normalisation du rôle reçu
   - Affichage du lien admin seulement pour les admins
   - Suppression du rôle à la déconnexion

---

## 🚀 À Faire Maintenant

### 1️⃣ Nettoyer la Base de Données
```sql
-- Exécuter ce script SQL dans MySQL/PHPMyAdmin
-- (voir le fichier: back/migration_roles.sql)

UPDATE Utilisateur SET role = LOWER(TRIM(COALESCE(role, 'user')));
UPDATE Utilisateur SET role = 'user' WHERE role IS NULL OR role = '';

-- Promouvoir un admin (remplacer 'your_admin' par le login réel):
UPDATE Utilisateur SET role = 'admin' WHERE login = 'your_admin';
```

### 2️⃣ Redémarrer le Serveur
```bash
cd back
npm restart
# ou
npm start
```

### 3️⃣ Nettoyer le Navigateur
- Appuyer sur `Ctrl + Shift + Del`
- Cocher: Cookies
- Supprimer

### 4️⃣ Tester
- Ouvrir `/front/login.html`
- Se connecter avec un compte **admin**
- Vérifier que le lien "Admin" apparaît
- Vérifier que vous pouvez appliquer les contrôles
- Tester avec un compte **user** (403 attendu)

---

## 📊 Avant/Après

| Aspect | Avant ❌ | Après ✅ |
|--------|---------|---------|
| Token contient rôle | Non | **OUI** |
| Vérification rapide | Non (requête BD) | **OUI** (du token) |
| Case-sensitive | Oui (bug) | **Non** (toLowerCase) |
| Rôle par défaut | Non (NULL) | **Oui** (user) |
| Lien admin | Toujours visible | **Seulement si admin** |
| Redirection login | Fixed (/) | **Intelligente** (admin vs user) |

---

## 🔐 Sécurité

✅ **Améliorations:**
- Rôle validé dans le JWT (ne peut pas être falsifié côté client)
- Fallback à BD si token sans rôle (compatibilité)
- Normalisation stricte du rôle
- Middleware admin robuste

✅ **HttpOnly Cookies:**
- Tokens stockés en cookies HttpOnly (pas accessibles à JavaScript)
- Protection contre le XSS

---

## ❓ Questions Fréquentes

**Q: Pourquoi je dois redémarrer le serveur?**
A: Pour que les changements du code JS prennent effet et que les tokens générés après incluent le nouveau rôle.

**Q: Comment je promoue un utilisateur en admin?**
A: 
```sql
UPDATE Utilisateur SET role = 'admin' WHERE login = 'username';
```

**Q: Mes tokens anciens fonctionnent encore?**
A: Oui, le middleware a un fallback BD. Mais après redémarrage, ils faudra se reconnecter pour avoir le rôle dans le token.

**Q: Comment je sais si c'est un token avec rôle?**
A: Vérifier dans DevTools → Application → Cookies → accessToken → Voir le payload en base64 sur jwt.io

---

## 📞 Support

Si vous avez un problème:
1. Vérifier le fichier `TOKEN_FIX_GUIDE.md` pour les détails complets
2. Exécuter les tests dans `TESTS_VALIDATION.md`
3. Vérifier les logs du serveur: `npm start` (voir les erreurs)

---

**Fichiers créés/modifiés:**
- Modified: `back/server.js`
- Modified: `front/login.js`
- Modified: `front/script.js`
- Created: `back/migration_roles.sql` (script SQL)
- Created: `TOKEN_FIX_GUIDE.md` (documentation complète)
- Created: `TESTS_VALIDATION.md` (tests de validation)

**Statut**: ✅ Prêt à tester!
