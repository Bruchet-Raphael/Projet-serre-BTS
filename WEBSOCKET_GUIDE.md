# 🌐 Guide WebSocket - Communication Temps Réel

## Vue d'ensemble

Le système WebSocket a été intégré pour permettre une communication temps réel bidirectionnelle entre l'interface web et le serveur de la serre. Cela remplace le polling HTTP traditionnel par une connexion persistante et efficace.

## Architecture

### Backend (Node.js + Express)

**Fichier modifié:** `back/server.js`

- **Socket.io**: Bibliothèque WebSocket utilisée
- **Port**: Même port que le serveur Express (défini dans `process.env.PORT`)
- **CORS**: Configuré pour autoriser `http://172.29.160.160`
- **Authentication**: Utilise les tokens JWT existants

### Frontend (JavaScript vanilla)

**Fichiers:**
- `front/websocket-client.js` - Client WebSocket personnalisé
- `front/script.js` - Intégration dans l'application

## Événements WebSocket

### 📡 Événements de données (Direction: Serveur → Client)

#### `sensor-data-update`
Reçoit les données des capteurs en temps réel.

```javascript
socket.on('sensor-data-update', (data) => {
    console.log('Données reçues:', data);
    // {
    //   temperature: 28.5,
    //   humidite: 45.2,
    //   humiditeair: 65.0,
    //   timestamp: "2026-05-07T10:30:00.000Z",
    //   relay0: null,
    //   relay1: null,
    //   relay2: null,
    //   relay3: null
    // }
});
```

#### `controls-update`
Reçoit la configuration actuelle de tous les contrôles.

```javascript
socket.on('controls-update', (controls) => {
    console.log('Contrôles reçus:', controls);
    // {
    //   irrigation: { mode: 'inactive', threshold: 30 },
    //   misting: { mode: 'inactive', intensity: 50 },
    //   ventilation: { mode: 'inactive', duration: 3 },
    //   heating: { mode: 'inactive', target: 20 }
    // }
});
```

### 🎮 Événements de contrôle (Direction: Client → Serveur)

#### `request-sensor-data`
Demander les données capteurs.

```javascript
wsClient.requestSensorData();
```

#### `request-controls`
Demander les contrôles actuels.

```javascript
wsClient.requestControls();
```

#### `update-irrigation`
Mettre à jour le contrôle d'irrigation.

```javascript
wsClient.updateIrrigation('active', 35);
// Paramètres:
// - mode: 'inactive' | 'active' | 'auto'
// - threshold: nombre (0-100)
```

#### `update-misting`
Mettre à jour le contrôle de brumisation.

```javascript
wsClient.updateMisting('auto', 60);
// Paramètres:
// - mode: 'inactive' | 'active' | 'auto'
// - intensity: nombre (0-100)
```

#### `update-ventilation`
Mettre à jour le contrôle de ventilation.

```javascript
wsClient.updateVentilation('active', 3);
// Paramètres:
// - mode: 'inactive' | 'active' | 'auto'
// - duration: nombre heures
```

#### `update-heating`
Mettre à jour le contrôle de chauffage.

```javascript
wsClient.updateHeating('inactive', 22);
// Paramètres:
// - mode: 'inactive' | 'active' | 'auto'
// - target: température cible (°C)
```

### ✅ Événements de statut

#### `success`
Confirmation qu'une action a réussi.

```javascript
socket.on('success', (data) => {
    console.log('✅', data.message); // "Irrigation mise à jour"
});
```

#### `error`
Erreur lors d'une opération.

```javascript
socket.on('error', (data) => {
    console.error('❌', data.message);
});
```

#### `connected`
Établissement de la connexion WebSocket.

```javascript
socket.on('connected', () => {
    console.log('🌐 Connecté au serveur');
});
```

#### `disconnected`
Perte de la connexion WebSocket.

```javascript
socket.on('disconnected', (data) => {
    console.log('⚠️ Déconnecté:', data.reason);
});
```

## Client WebSocket (Classe)

### Utilisation

```javascript
// Créer une instance
const ws = new WebSocketClient('http://172.29.160.160');

// Se connecter avec token JWT
await ws.connect(tokenJWT);

// S'abonner aux événements
ws.on('sensor-data', (data) => {
    console.log('Capteurs:', data);
});

// Envoyer des commandes
ws.updateIrrigation('active', 40);

// Vérifier la connexion
if (ws.isConnected()) {
    console.log('Connecté');
}

// Déconnecter proprement
ws.disconnect();
```

### Méthodes principales

| Méthode | Description |
|---------|-------------|
| `connect(token)` | Établir la connexion WebSocket |
| `disconnect()` | Fermer la connexion |
| `isConnected()` | Vérifier si connecté |
| `on(event, callback)` | S'abonner à un événement |
| `off(event, callback)` | Se désabonner d'un événement |
| `requestSensorData()` | Demander les données capteurs |
| `requestControls()` | Demander les contrôles |
| `updateIrrigation(mode, threshold)` | Contrôler l'irrigation |
| `updateMisting(mode, intensity)` | Contrôler la brumisation |
| `updateVentilation(mode, duration)` | Contrôler la ventilation |
| `updateHeating(mode, target)` | Contrôler le chauffage |

## Intégration dans l'application

### Initialisation automatique

À chaque chargement de la page, `initializeWebSocket()` est appelée automatiquement:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket().then(() => {
        // Les données sont maintenant synchronisées
        loadControles();
    });
});
```

### Envoi des contrôles

Lorsqu'un utilisateur clique sur "Appliquer les paramètres":

1. **Via WebSocket** (prioritaire): Envoi des données temps réel
2. **Fallback REST**: Si WebSocket n'est pas disponible

```javascript
async function sendControlsToBackend(controls) {
    if (wsClient.isConnected()) {
        // Envoi WebSocket
        wsClient.updateIrrigation(controls.irrigation.mode, controls.irrigation.threshold);
        // ...
    } else {
        // Fallback REST HTTP
        fetch('/api/controles', { method: 'POST', body: JSON.stringify(controls) });
    }
}
```

## Sécurité

- ✅ **Authentification JWT**: Le token est validé lors de la connexion
- ✅ **Isolement des données**: Chaque client ne reçoit que ses propres données
- ✅ **Validation côté serveur**: Tous les contrôles sont validés
- ✅ **Revocation de token**: Les tokens revoqués ne peuvent plus utiliser WebSocket

## Avantages

✨ **Temps réel**: Pas de délai d'attente pour les mises à jour
⚡ **Économe**: Moins de requêtes réseau
🔄 **Bidirectionnel**: Communication dans les deux sens
📊 **Efficace**: Une seule connexion pour toutes les données
🔐 **Sécurisé**: Authentification intégrée

## Monitoring

### Vérifier la connexion dans la console

```javascript
// Afficher l'état
console.log(wsClient.isConnected()); // true/false

// Afficher le socket
console.log(wsClient.socket);

// Afficher les événements
wsClient.on('*', (event, data) => {
    console.log(`Événement: ${event}`, data);
});
```

### Logs serveur

Le serveur affiche les événements WebSocket:

```
✅ Client connecté: abc123xyz
✅ Client authentifié: utilisateur
📊 Données capteurs reçues: {...}
⚙️ Contrôles mis à jour: {...}
❌ Erreur WebSocket [abc123xyz]: ...
```

## Dépannage

### "WebSocket pas connecté"
- Vérifier que le serveur est en cours d'exécution
- Vérifier le token JWT est valide
- Vérifier les paramètres CORS

### "Erreur authentification"
- Le token a expiré, se reconnecter
- Vérifier le token dans les cookies

### Pas de mise à jour temps réel
- Vérifier la console pour les erreurs
- Vérifier que WebSocket est bien connecté: `wsClient.isConnected()`
- Le système fallback REST devrait toujours fonctionner

## Dépendances

```json
{
  "socket.io": "^4.x"
}
```

Frontend: Socket.io client chargé via CDN (4.5.4)

## Fichiers modifiés

- ✏️ `back/server.js` - Intégration Socket.io
- ✨ `front/websocket-client.js` - Client WebSocket (nouveau)
- ✏️ `front/script.js` - Intégration application
- ✏️ `front/index.html` - Chargement des scripts

---

**Date**: 7 mai 2026  
**Auteur**: GitHub Copilot  
**Version**: 1.0.0
