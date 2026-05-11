# 💡 Exemples Pratiques WebSocket

Ce fichier contient des exemples réels d'utilisation du WebSocket dans votre application.

---

## 📌 Exemple 1: Afficher les données temps réel

### Avant (REST Polling - 5s de délai)

```javascript
// ❌ Ancien système
setInterval(() => {
    fetch('/api/sensors')
        .then(r => r.json())
        .then(data => updateDisplay(data));
}, 5000);  // Toutes les 5 secondes
```

### Après (WebSocket - instantané)

```javascript
// ✅ Nouveau système
wsClient.on('sensor-data', (data) => {
    console.log('Capteurs mis à jour:', data);
    
    // Mettre à jour l'affichage instantanément
    document.getElementById('temp-value').textContent = data.temperature.toFixed(1) + '°C';
    document.getElementById('humidity-value').textContent = data.humidite.toFixed(1) + '%';
    
    // Mettre à jour un graphique
    updateTemperatureChart(data.temperature);
    
    // Vérifier les seuils
    if (data.temperature > 30) {
        showAlert('⚠️ Température trop élevée!');
    }
});
```

**Avantages**:
- ⚡ Mise à jour instantanée (< 100ms)
- 📊 Plus de 50 requêtes HTTP économisées par minute
- 🎯 Une seule connexion persistante

---

## 📌 Exemple 2: Contrôler l'irrigation

### Avant (REST POST)

```javascript
// ❌ Ancien système
async function changeIrrigation() {
    const response = await fetch('/api/controles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            irrigation: {
                mode: 'active',
                threshold: 40
            }
        })
    });
    const data = await response.json();
    if (data.success) {
        showNotification('Irrigation mise à jour');
    }
}
```

### Après (WebSocket)

```javascript
// ✅ Nouveau système
function changeIrrigation() {
    // Envoyer directement
    wsClient.updateIrrigation('active', 40);
    
    // La confirmation arrive automatiquement
    wsClient.on('server-success', (data) => {
        showNotification('✅ ' + data.message);
    });
}

// Ou plus simplement, s'abonner une seule fois:
wsClient.on('server-success', (data) => {
    showNotification('✅ ' + data.message);
});

// Puis appeler la fonction
document.getElementById('irrigationBtn').addEventListener('click', () => {
    wsClient.updateIrrigation('active', 40);
});
```

**Avantages**:
- ⚡ Réponse instantanée
- 🔄 Pas besoin d'await/Promise
- 📡 Tous les clients reçoivent la mise à jour

---

## 📌 Exemple 3: Dashboard temps réel

### HTML Simplifié

```html
<div class="dashboard">
    <div class="sensor-card">
        <h3>🌡️ Température</h3>
        <p class="value" id="temp">--</p>
        <p class="unit">°C</p>
    </div>
    
    <div class="sensor-card">
        <h3>💧 Humidité</h3>
        <p class="value" id="humidity">--</p>
        <p class="unit">%</p>
    </div>
    
    <div class="control-panel">
        <h3>🚰 Irrigation</h3>
        <select id="irrigationMode">
            <option>inactive</option>
            <option>active</option>
            <option>auto</option>
        </select>
        <button onclick="applyIrrigation()">Appliquer</button>
    </div>
</div>
```

### JavaScript WebSocket

```javascript
// Initialiser
await wsClient.connect();

// S'abonner aux capteurs
wsClient.on('sensor-data', (data) => {
    document.getElementById('temp').textContent = data.temperature.toFixed(1);
    document.getElementById('humidity').textContent = data.humidite.toFixed(1);
});

// S'abonner aux contrôles
wsClient.on('controls', (controls) => {
    document.getElementById('irrigationMode').value = controls.irrigation.mode;
});

// Fonction pour appliquer
function applyIrrigation() {
    const mode = document.getElementById('irrigationMode').value;
    wsClient.updateIrrigation(mode, 30);
}

// Demander les données initiales
wsClient.requestSensorData();
wsClient.requestControls();
```

**Résultat**:
- 📊 Affichage temps réel des capteurs
- 🎮 Contrôle instantané
- 🔄 Synchronisé avec autres clients

---

## 📌 Exemple 4: Alertes intelligentes

### Monitoriser et alerter

```javascript
let previousTemp = null;

wsClient.on('sensor-data', (data) => {
    // Alerte si température critique
    if (data.temperature > 35) {
        addAlert('DANGER', '🔥 Température TRÈS ÉLEVÉE: ' + data.temperature + '°C', 'error');
        
        // Activer la ventilation automatiquement
        if (confirm('Activer la ventilation?')) {
            wsClient.updateVentilation('active', 3);
        }
    }
    
    // Alerte si changement rapide
    if (previousTemp !== null) {
        const delta = Math.abs(data.temperature - previousTemp);
        if (delta > 5) {
            console.warn('⚠️ Changement rapide de température:', delta + '°C');
        }
    }
    
    previousTemp = data.temperature;
});
```

---

## 📌 Exemple 5: Graphique en temps réel

### Avec Chart.js

```javascript
let chart;
const chartData = {
    labels: [],
    datasets: [{
        label: 'Température',
        data: [],
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        tension: 0.4
    }]
};

// Initialiser le graphique
function initChart() {
    const ctx = document.getElementById('tempChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                title: { text: 'Température en temps réel' },
                legend: { position: 'top' }
            },
            scales: {
                y: { min: 0, max: 40 }
            }
        }
    });
}

// Ajouter les données au graphique
wsClient.on('sensor-data', (data) => {
    const now = new Date().toLocaleTimeString();
    
    // Garder les 20 derniers points
    if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
    }
    
    chartData.labels.push(now);
    chartData.datasets[0].data.push(data.temperature);
    
    chart.update();  // Rafraîchir le graphique
});

// Démarrer
initChart();
wsClient.connect();
```

---

## 📌 Exemple 6: Gestion des erreurs

### Fallback et reconnexion

```javascript
async function robustConnect() {
    try {
        await wsClient.connect();
        console.log('✅ Connecté WebSocket');
    } catch (err) {
        console.warn('⚠️ WebSocket échoué, utiliser REST');
        useFallbackRest();
    }
}

function useFallbackRest() {
    // Fallback: utiliser REST HTTP
    setInterval(async () => {
        try {
            const response = await fetch('/api/sensor-data');
            const data = await response.json();
            updateDisplay(data);
        } catch (err) {
            console.error('❌ Erreur REST aussi:', err);
        }
    }, 5000);
}

// Gérer les déconnexions
wsClient.on('disconnected', () => {
    console.warn('Déconnecté, tentative reconnexion...');
    // Le client WebSocket se reconnectera automatiquement
});

// Démarrer
robustConnect();
```

---

## 📌 Exemple 7: Interface de test personnalisée

### Panel de contrôle complet

```html
<div class="control-dashboard">
    <div class="status">
        <span id="wsStatus" class="badge disconnected">● Déconnecté</span>
    </div>
    
    <div class="controls">
        <div class="control-group">
            <label>Irrigation</label>
            <select id="irrMode">
                <option value="inactive">Off</option>
                <option value="active">On</option>
                <option value="auto">Auto</option>
            </select>
            <input type="range" id="irrThreshold" min="0" max="100" value="30">
            <span id="irrValue">30%</span>
            <button onclick="updateControl('irrigation')">✓</button>
        </div>
        
        <div class="control-group">
            <label>Chauffage</label>
            <select id="heatingMode">
                <option value="inactive">Off</option>
                <option value="active">On</option>
                <option value="auto">Auto</option>
            </select>
            <input type="range" id="heatingTarget" min="0" max="50" value="20">
            <span id="heatingValue">20°C</span>
            <button onclick="updateControl('heating')">✓</button>
        </div>
    </div>
</div>

<script>
// Mise à jour du statut
wsClient.on('connected', () => {
    document.getElementById('wsStatus').textContent = '● Connecté';
    document.getElementById('wsStatus').className = 'badge connected';
});

wsClient.on('disconnected', () => {
    document.getElementById('wsStatus').textContent = '● Déconnecté';
    document.getElementById('wsStatus').className = 'badge disconnected';
});

// Sliders en direct
document.getElementById('irrThreshold').addEventListener('input', (e) => {
    document.getElementById('irrValue').textContent = e.target.value + '%';
});

// Envoyer les mises à jour
function updateControl(type) {
    if (type === 'irrigation') {
        const mode = document.getElementById('irrMode').value;
        const threshold = parseInt(document.getElementById('irrThreshold').value);
        wsClient.updateIrrigation(mode, threshold);
    } else if (type === 'heating') {
        const mode = document.getElementById('heatingMode').value;
        const target = parseInt(document.getElementById('heatingTarget').value);
        wsClient.updateHeating(mode, target);
    }
}
</script>
```

---

## 📌 Exemple 8: Logging et monitoring

### Voir tous les événements

```javascript
// Mode debug: afficher tous les événements
function enableDebugMode() {
    const originalEmit = wsClient.emit.bind(wsClient);
    
    wsClient.emit = function(eventName, data) {
        console.log(`[WebSocket Event] ${eventName}:`, data);
        return originalEmit(eventName, data);
    };
}

// Ou créer un tableau de bord de monitoring
const monitor = {
    eventsReceived: 0,
    eventsSent: 0,
    lastUpdate: null,
    startTime: Date.now()
};

wsClient.on('*', (event, data) => {
    if (event.includes('update')) monitor.eventsSent++;
    else monitor.eventsReceived++;
    monitor.lastUpdate = new Date();
    
    // Afficher les stats
    console.log(`
        📊 WebSocket Monitor:
        - Événements reçus: ${monitor.eventsReceived}
        - Événements envoyés: ${monitor.eventsSent}
        - Durée: ${((Date.now() - monitor.startTime) / 1000).toFixed(1)}s
        - Dernier: ${monitor.lastUpdate.toLocaleTimeString()}
    `);
});
```

---

## 📌 Exemple 9: Commandes personnalisées

### Créer vos propres événements

```javascript
// Sur le serveur (server.js), ajouter:
socket.on('custom-command', (command) => {
    console.log('Commande reçue:', command);
    
    if (command.type === 'get-history') {
        // Envoyer l'historique
        socket.emit('history', { /* données */ });
    } else if (command.type === 'export-csv') {
        // Exporter les données
        socket.emit('csv-ready', { url: 'download/export.csv' });
    }
});

// Sur le client (JavaScript):
function requestHistory() {
    wsClient.socket.emit('custom-command', { type: 'get-history' });
}

wsClient.socket.on('history', (historyData) => {
    console.log('Historique reçu:', historyData);
    displayHistory(historyData);
});
```

---

## 📌 Exemple 10: Multi-utilisateurs

### Synchronisation temps réel entre utilisateurs

```javascript
// Quand un utilisateur change l'irrigation
wsClient.updateIrrigation('active', 35);

// TOUS les clients reçoivent (même l'autre utilisateur)
wsClient.on('controls', (controls) => {
    console.log('Un autre utilisateur a changé les contrôles!');
    console.log('Nouvelle configuration:', controls.irrigation);
    
    // Afficher les contrôles mis à jour
    refreshUI(controls);
});

// Afficher qui a fait le changement
function logChange(action, user) {
    const log = document.getElementById('changeLog');
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toLocaleTimeString()} - ${user}: ${action}`;
    log.appendChild(entry);
}
```

---

## 🎯 Cas d'Usage Courants

### Cas 1: Alerte de dépassement
```javascript
const TEMP_MAX = 35;
const HUMIDITY_MAX = 80;

wsClient.on('sensor-data', (data) => {
    if (data.temperature > TEMP_MAX) {
        showCriticalAlert('🔥 Température' ' + data.temperature + '°C!');
    }
    if (data.humidite > HUMIDITY_MAX) {
        showCriticalAlert('💦 Humidité ' + data.humidite + '%!');
    }
});
```

### Cas 2: Historique des contrôles
```javascript
const changeLogs = [];

wsClient.on('server-success', (data) => {
    changeLogs.push({
        timestamp: new Date(),
        action: data.message,
        user: currentUser
    });
    
    if (changeLogs.length > 100) changeLogs.shift();  // Garder 100
});
```

### Cas 3: Statistiques
```javascript
const stats = {
    timeOnline: 0,
    updateCount: 0,
    commandsSent: 0
};

setInterval(() => stats.timeOnline++, 1000);

wsClient.on('sensor-data', () => stats.updateCount++);
wsClient.socket.onAny((event) => {
    if (event.includes('update')) stats.commandsSent++;
});

// Afficher les stats
console.log('📊 Statistiques:', stats);
```

---

## 🚀 Conclusion

Ces exemples montrent comment:
- ✅ Afficher les données en temps réel
- ✅ Envoyer des commandes
- ✅ Gérer les erreurs
- ✅ Créer des interfaces interactives
- ✅ Synchroniser plusieurs utilisateurs
- ✅ Logger et monitorer

**Utilisez-les comme base pour votre application complète!**

---

**Plus d'exemples**: Voir `WEBSOCKET_GUIDE.md`  
**Tests interactifs**: Utiliser `websocket-test.html`  
**Documentation complète**: Consulter le README du projet
