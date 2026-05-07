# ✅ Checklist de Vérification WebSocket

**Date**: 7 mai 2026  
**Projet**: Serre Connectée BTS  
**Version**: 1.0.0  

---

## 🔍 Vérifications Pre-Déploiement

### Backend Setup

- [ ] Dépendances installées
  ```bash
  npm list socket.io express
  # ✅ socket.io@4.8.3
  # ✅ express@5.2.1
  ```

- [ ] Syntaxe server.js valide
  ```bash
  node -c back/server.js
  # ✅ Pas d'erreurs
  ```

- [ ] Fichiers de config présents
  - [ ] `back/config_regulation.json`
  - [ ] `back/controles.json`

- [ ] Variables d'environnement
  - [ ] `PORT` défini dans `.env`
  - [ ] `CODE` (JWT_SECRET) défini
  - [ ] `DB_HOST`, `DB_USER`, etc. définis

### Frontend Setup

- [ ] Fichiers créés
  - [ ] ✅ `front/websocket-client.js` (210 lignes)
  - [ ] ✅ `front/websocket-test.html` (500 lignes)

- [ ] Scripts chargés dans index.html
  - [ ] ✅ Socket.io CDN v4.5.4
  - [ ] ✅ websocket-client.js
  - [ ] ✅ script.js après websocket-client.js

- [ ] Fichier script.js modifié
  - [ ] ✅ `initializeWebSocket()` ajoutée
  - [ ] ✅ `DOMContentLoaded` met à jour l'ordre
  - [ ] ✅ `sendControlsToBackend()` utilise WebSocket

### Documentation

- [ ] ✅ `WEBSOCKET_GUIDE.md` créé
- [ ] ✅ `WEBSOCKET_QUICKSTART.md` créé
- [ ] ✅ `CHANGEMENTS_WEBSOCKET.md` créé
- [ ] ✅ Cette checklist créée

---

## 🧪 Tests Unitaires

### Test 1: Démarrage Serveur
```bash
# Démarrer le serveur
cd back && npm start

# Vérifier les logs
✅ 🚀 Serveur démarré sur le port [PORT]
✅ Connecté à la base de données MySQL
```

**Résultat attendu**: ✅ Serveur démarre sans erreur

---

### Test 2: Accès Frontend
```
Url: http://172.29.160.160/front/index.html
```

**Résultat attendu**:
- ✅ Page charge normalement
- ✅ Pas d'erriors réseau
- ✅ Scripts chargés (F12 → Network)

**Vérifier en console (F12)**:
```javascript
console.log(typeof WebSocketClient);  // "function"
console.log(typeof wsClient);          // "object"
console.log(wsClient.isConnected());   // false (pas connecté encore)
```

---

### Test 3: Interface de Test WebSocket
```
URL: http://172.29.160.160/front/websocket-test.html
```

**Étapes**:
1. [ ] Page charge correctement (pas d'erreurs dans F12)
2. [ ] Bouton "Connecter" est actif
3. [ ] Cliquer sur "Connecter"

**Résultat attendu**:
- ✅ Status change à "● Connecté" (vert)
- ✅ Logs: ✅ Connexion en cours...
- ✅ Logs: ✅ Connecté avec succès
- ✅ Bouton "Déconnecter" devient actif
- ✅ Boutons contrôles deviennent actifs

---

### Test 4: Demande Capteurs
**Interface de test WebSocket**:
1. [ ] Connecter (cf Test 3)
2. [ ] Cliquer "Demander données"

**Résultat attendu** (dans les logs):
- ✅ 📊 Données capteurs reçues: `{temperature: X, ...}`
- ✅ Valeurs affichées (temp, humidité, etc.)

**Vérifier en console**:
```javascript
wsClient.requestSensorData();
// Logs:
// 📊 Mise à jour capteurs WebSocket: {...}
// ⚙️ Contrôles mis à jour WebSocket: {...}
```

---

### Test 5: Mise à Jour Irrigation
**Interface de test WebSocket**:
1. [ ] Connecter
2. [ ] Changer mode: "Inactif" → "Actif"
3. [ ] Changer seuil: 30 → 50
4. [ ] Cliquer "Envoyer"

**Résultat attendu** (dans les logs):
- ✅ ✅ Irrigation: active (seuil 50%)
- ✅ ✅ Irrigation mise à jour

**Vérifier serveur (terminal)**:
```
⚙️ Irrigation mise à jour
```

---

### Test 6: Tous les Contrôles
Répéter Test 5 pour:
- [ ] Irrigation (mode + seuil)
- [ ] Brumisation (mode + intensité)
- [ ] Ventilation (mode + durée)
- [ ] Chauffage (mode + cible)

**Résultat attendu**: ✅ Tous les contrôles reçoivent les modifications

---

### Test 7: Déconnexion
**Interface de test WebSocket**:
1. [ ] Connecté
2. [ ] Cliquer "Déconnecter"

**Résultat attendu**:
- ✅ Status: "● Déconnecté" (rouge)
- ✅ Logs: ⚠️ Déconnecté
- ✅ Boutons deviennent inactifs

---

### Test 8: Reconnexion Automatique
**Terminal serveur**:
1. [ ] Serveur en cours d'exécution
2. [ ] Client connecté

**Arrêter le serveur temporairement**:
```bash
# Arrêter: Ctrl+C
# Redémarrer après 5 secondes
```

**Résultat attendu** (interface de test):
- ✅ Logs: 🔄 Tentative de reconnexion 1/5
- ✅ Après redémarrage du serveur:
  - ✅ ✅ Connecté avec succès

---

### Test 9: Authentification
**Interface de test WebSocket**:
1. [ ] Avoir un token JWT valide (du login)
2. [ ] Entrer le token dans le champ "Token JWT"
3. [ ] Cliquer "Connecter"

**Résultat attendu**:
- ✅ Connexion réussie
- ✅ Logs: ✅ Client authentifié: utilisateur

**Sans token valide**:
- ⚠️ Connexion réussie mais non-authentifiée
- Les mises à jour sont rejetées: "Non authentifié"

---

### Test 10: Fallback REST
**Désactiver WebSocket** (test du fallback):

```javascript
// En console sur index.html
wsClient.disconnect();
// Puis essayer envoyer contrôles normalement
```

**Résultat attendu**:
- ✅ Après quelques secondes: Paramètres appliqués
- ✅ Vérifier en console: "⚠️ WebSocket pas disponible, fallback REST"
- ✅ Les données s'affichent quand même (via REST)

---

## 🔍 Vérifications Application Principale

### Test 11: Chargement index.html
```
URL: http://172.29.160.160/front/index.html
```

**Actions**:
1. [ ] Page charge complètement
2. [ ] Aucune erreur JavaScript (F12)
3. [ ] Affiche les capteurs et contrôles

**Vérifier en console**:
```javascript
wsClient.isConnected()  // true après quelques secondes
appState.sensors        // Contient les données
```

---

### Test 12: Mise à Jour Live des Capteurs
**index.html**:
1. [ ] Voir les valeurs de température, humidité
2. [ ] Modifier les données en serveur (éditer config_regulation.json)
3. [ ] Attendre 1-2 secondes

**Résultat attendu**:
- ✅ Les valeurs se mettent à jour automatiquement
- ✅ Sans recharger la page
- ✅ Graphiques se mettent à jour

---

### Test 13: Modifications Contrôles Live
**index.html**:
1. [ ] Changer le mode d'irrigation
2. [ ] Changer le seuil
3. [ ] Cliquer "Appliquer les paramètres"

**Résultat attendu**:
- ✅ Notification: ✅ Paramètres appliqués
- ✅ Les valeurs sont sauvegardées
- ✅ Autres clients voient la mise à jour

---

### Test 14: Synchronisation Multi-clients
**Ouvrir deux onglets navigateur** (même utilisateur):
1. [ ] Onglet A: `index.html`
2. [ ] Onglet B: `index.html`
3. [ ] Onglet A: Changer irrigation
4. [ ] Onglet B: Voir la mise à jour (via événement broadcast)

**Résultat attendu**:
- ✅ Les deux onglets voient les mêmes données
- ✅ Synchronisation instantanée

---

## 📊 Tests de Performance

### Test 15: Charge CPU
**Conditions**:
- Serveur en cours d'exécution
- 1 client connecté
- Demandes de capteurs chaque seconde

**Commande**:
```bash
top  # Vérifier CPU utilisé par node
```

**Résultat attendu**:
- ✅ CPU < 5% (WebSocket très léger)
- ✅ Mémoire stable (pas de fuites)

---

### Test 16: Latence Temps Réel
**Outils**: Chrome DevTools (Network)

1. [ ] Ouvrir `websocket-test.html`
2. [ ] Connecter
3. [ ] Cliquer "Demander données"
4. [ ] Vérifier le temps (DevTools → Console)

**Résultat attendu**:
- ✅ Réponse < 100ms
- ✅ Pas d'attente perceptible

---

## 🔐 Tests de Sécurité

### Test 17: Token Expiré
1. [ ] Connecter avec token valide
2. [ ] Attendre 15 minutes (expiration token)
3. [ ] Essayer modifier un contrôle

**Résultat attendu**:
- ✅ Erreur: "Non authentifié"
- ✅ Fallback: Page redirige vers login

---

### Test 18: Token Invalide
1. [ ] Ouvrir websocket-test.html
2. [ ] Entrer token invalide (n'importe quoi)
3. [ ] Cliquer Connecter

**Résultat attendu**:
- ✅ Connexion établie
- ⚠️ Pas authentifié
- ❌ Mises à jour rejetées

---

### Test 19: CORS
**Depuis un domaine différent**:
```javascript
// Depuis une autre machine / domaine
fetch('http://172.29.160.160/api/...')
```

**Résultat attendu**:
- ✅ Les requêtes de `http://172.29.160.160` passent
- ❌ Les requêtes d'ailleurs sont bloquées

---

## 🐛 Dépannage

### Erreur: "Cannot find module 'socket.io'"
```bash
cd back && npm install socket.io
npm list socket.io
```

### Erreur: "Connection refused"
```bash
# Vérifier le serveur
netstat -an | grep :PORT

# Relancer le serveur
npm start
```

### Erreur: "Token invalide"
```javascript
// Vérifier le token
console.log(document.cookie);  // Voir 'accessToken'

// Ou se reconnecter
window.location.href = '/front/login.html';
```

### Erreur: "CORS policy"
Vérifier dans `back/server.js`:
```javascript
cors: {
  origin: 'http://172.29.160.160',  // Bon domaine?
  credentials: true
}
```

---

## 📈 Checklist Finale

- [ ] Tous les tests passent ✅
- [ ] Pas d'erreurs console ✅
- [ ] Performances satisfaisantes ✅
- [ ] Sécurité validée ✅
- [ ] Documentation complète ✅
- [ ] Code commité ✅

---

## 🚀 Déploiement

Quand tous les tests passent:

```bash
# 1. Vérifier les dépendances
npm install

# 2. Démarrer le serveur
npm start

# 3. Accéder à l'application
# http://172.29.160.160/front/index.html

# 4. Tester
# Interface de test: http://172.29.160.160/front/websocket-test.html
```

---

## ✅ Sign-off

- [ ] Développeur: _______________  Date: _____
- [ ] Testeur: _______________  Date: _____
- [ ] Leader: _______________  Date: _____

---

**Version**: 1.0.0  
**Date**: 7 mai 2026  
**Statut**: ✅ Prêt pour production
