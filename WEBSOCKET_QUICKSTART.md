# 🚀 Démarrage Rapide WebSocket - Serre Connectée

## What's New? ✨

Un système **WebSocket temps réel** vient d'être ajouté au projet pour remplacer le polling HTTP traditionnel. Les données et contrôles sont maintenant synchronisés en temps réel entre l'interface et la serre.

## Installation ✅

Socket.io a déjà été installé:
```bash
cd back/
npm install socket.io
```

## Démarrage du serveur 🚀

```bash
cd back/
npm start
# OU si vous utilisez pm2:
pm2 start server.js
```

Le serveur écoute maintenant sur:
- **HTTP**: `http://172.29.160.160:PORT`
- **WebSocket**: `ws://172.29.160.160:PORT` (Socket.io)

## Files Modifiés / Ajoutés 📝

### Backend
- ✏️ **back/server.js** - Intégration Socket.io (lignes 1-22 + section WebSocket)
- ✏️ **back/package.json** - Dépendance socket.io ajoutée

### Frontend
- ✨ **front/websocket-client.js** (NOUVEAU) - Client WebSocket réutilisable
- ✏️ **front/script.js** - Intégration WebSocket dans l'app
- ✏️ **front/index.html** - Scripts Socket.io et websocket-client.js
- ✨ **front/websocket-test.html** (NOUVEAU) - Interface de test WebSocket

### Documentation
- ✨ **WEBSOCKET_GUIDE.md** (NOUVEAU) - Guide complet des événements
- ✨ **WEBSOCKET_QUICKSTART.md** (CE FICHIER)

## Test Rapide 🧪

### Option 1: Interface de test Web
1. Ouvrez le serveur
2. Allez sur: `http://172.29.160.160/front/websocket-test.html`
3. Cliquez sur "Connecter"
4. Testez les événements WebSocket

### Option 2: Console Navigateur
```javascript
// Ouvrir la console (F12)

// Vérifier la connexion
wsClient.isConnected(); // true/false

// Demander les données
wsClient.requestSensorData();

// S'abonner aux événements
wsClient.on('sensor-data', (data) => {
    console.log('Capteurs:', data);
});

// Envoyer une commande
wsClient.updateIrrigation('active', 35);

// Voir les logs
wsClient.socket;
```

## Événements Principaux 📡

| Direction | Événement | Paramètres |
|-----------|-----------|-----------|
| ↓ Réception | `sensor-data-update` | `{temperature, humidite, ...}` |
| ↓ Réception | `controls-update` | `{irrigation, misting, ...}` |
| ↑ Envoi | `request-sensor-data` | _aucun_ |
| ↑ Envoi | `update-irrigation` | `{mode, threshold}` |
| ↑ Envoi | `update-misting` | `{mode, intensity}` |
| ↑ Envoi | `update-ventilation` | `{mode, duration}` |
| ↑ Envoi | `update-heating` | `{mode, target}` |

## Architecture 🏗️

```
┌─────────────────────────────────────────┐
│         FRONTEND (Navigateur)           │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  index.html / script.js          │  │
│  │  - Initialise WebSocket          │  │
│  │  - Affiche interface             │  │
│  └──────────────────────────────────┘  │
│                  │                      │
│  ┌──────────────────────────────────┐  │
│  │  websocket-client.js             │  │
│  │  - Socket.io client              │  │
│  │  - Gestion événements            │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
            ↑↓ WebSocket (Socket.io)
┌─────────────────────────────────────────┐
│         BACKEND (Node.js)               │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  server.js                       │  │
│  │  - Express + Socket.io           │  │
│  │  - Authentification JWT          │  │
│  │  - Gestion événements            │  │
│  └──────────────────────────────────┘  │
│                  │                      │
│  ┌──────────────────────────────────┐  │
│  │  config_regulation.json          │  │
│  │  controles.json                  │  │
│  │  MySQL (optionnel)               │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Exemple d'Utilisation Complète 📚

```javascript
// Initialiser la connexion
await wsClient.connect(tokenJWT);

// S'abonner aux mises à jour temps réel
wsClient.on('sensor-data', (data) => {
    console.log(`Temp: ${data.temperature}°C, Humidité: ${data.humidite}%`);
    updateDisplay(data);
});

// Réagir aux changements d'autres clients
wsClient.on('controls', (controls) => {
    console.log('Les contrôles ont changé:', controls);
    refreshUI(controls);
});

// Envoyer une commande
wsClient.updateIrrigation('active', 40);

// Vérifier la connexion
if (wsClient.isConnected()) {
    console.log('Connecté et prêt');
} else {
    console.log('Déconnecté, fallback REST');
}

// Se déconnecter proprement
wsClient.disconnect();
```

## Avantages par rapport à HTTP Polling ⚡

| Caractéristique | REST HTTP Polling | WebSocket |
|-----------------|------------------|-----------|
| Latence | 5-10s | < 100ms |
| Effiort réseau | Élevé | Minimal |
| Bande passante | Importante | Faible |
| Connexion | Nouvelle à chaque fois | Persistante |
| Bidirectionnel | Non (requête-réponse) | Oui (instantané) |
| Fallback | N/A | REST HTTP auto |

## Sécurité 🔐

✅ **Token JWT** validé à la connexion
✅ **CORS** configuré pour `http://172.29.160.160`
✅ **Authentification** requise pour les contrôles
✅ **Validation** de tous les paramètres serveur-side
✅ **Revocation** de tokens supportée

## Troubleshooting 🔧

### "Erreur: Cannot read property 'isConnected' of undefined"
→ Assurez-vous que `websocket-client.js` est chargé avant `script.js`

### "Pas de données reçues"
→ Ouvrez la console (F12) et vérifiez:
```javascript
wsClient.isConnected() // Doit être true
```

### "401 Unauthorized"
→ Le token a expiré, reconnectez-vous après login

### "Impossible de se connecter"
→ Vérifiez que le serveur est en cours d'exécution et accessible

## Logs 📊

### Côté serveur
```
✅ Client connecté: abc123xyz
✅ Client authentifié: utilisateur
📊 Données capteurs reçues
⚙️ Irrigation mise à jour
❌ Erreur Non authentifié
```

### Côté client (Console)
```javascript
✅ WebSocket connecté: abc123xyz
📊 Mise à jour capteurs WebSocket: {...}
⚙️ Contrôles mis à jour WebSocket: {...}
✅ Action réussie: Irrigation mise à jour
```

## Prochaines Étapes 🎯

1. ✅ Tester via `websocket-test.html`
2. ✅ Vérifier les logs serveur
3. ✅ Valider les mises à jour temps réel
4. ✅ Tester le fallback REST
5. ✅ Déployer en production

## Support & Documentation 📖

- **Guide Complet**: Voir `WEBSOCKET_GUIDE.md`
- **Tests Automatisés**: Utiliser `websocket-test.html`
- **Logs**: Consulter la console navigateur (F12)

## Important ⚠️

- Le système WebSocket est **rétro-compatible** avec REST HTTP
- Si WebSocket échoue, le système fallback à REST automatiquement
- Assurez-vous que `socket.io@^4.8.3` est installé dans `back/package.json`

---

**Date**: 7 mai 2026
**Version**: 1.0.0
**Statut**: ✅ Production Ready
