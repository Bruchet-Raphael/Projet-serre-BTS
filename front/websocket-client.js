// ========================================
// 🌐 CLIENT WEBSOCKET - Communication temps réel
// ========================================

class WebSocketClient {
  constructor(serverUrl = 'http://172.29.160.160') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.connected = false;
    this.reconnectInterval = 5000;
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = 0;
    this.listeners = {};
  }

  /**
   * Enregistrer les listeners Socket.io permanents
   * (appelé une fois à la connexion et maintenu lors des reconnexions)
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Nettoyer les anciens listeners pour éviter les doublons
    this.socket.off('error');
    this.socket.off('success');
    this.socket.off('sensor-data-update');
    this.socket.off('controls-update');

    // Gérer les erreurs personnalisées
    this.socket.on('error', (data) => {
      console.error('❌ Erreur serveur:', data);
      this.emit('server-error', data);
    });

    // Gérer les messages de succès
    this.socket.on('success', (data) => {
      console.log('✅ Succès serveur:', data);
      this.emit('server-success', data);
    });

    // Réception des données capteurs
    this.socket.on('sensor-data-update', (data) => {
      console.log('📊 Données capteurs reçues:', data);
      this.emit('sensor-data', data);
    });

    // Réception des contrôles
    this.socket.on('controls-update', (controls) => {
      console.log('⚙️ Contrôles mis à jour:', controls);
      this.emit('controls', controls);
    });
  }

  /**
   * Établir la connexion WebSocket
   */
  connect(token = null) {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        console.log('✅ WebSocket déjà connecté');
        resolve(this.socket);
        return;
      }

      try {
        const socketOptions = {
          reconnection: true,
          reconnectionDelay: this.reconnectInterval,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ['websocket', 'polling']
        };

        if (token) {
          socketOptions.auth = { token };
        }

        this.socket = io(this.serverUrl, socketOptions);

        // Événement de connexion réussie (déclenché aussi à chaque reconnexion)
        this.socket.on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log(`✅ WebSocket connecté: ${this.socket.id}`);
          
          // Enregistrer les listeners permanents à chaque connexion/reconnexion
          this.setupSocketListeners();
          
          this.emit('connected', { id: this.socket.id });
          resolve(this.socket);
        });

        // Événement d'erreur de connexion
        this.socket.on('connect_error', (error) => {
          console.error('❌ Erreur connexion WebSocket:', error);
          this.emit('connection-error', error);
          reject(error);
        });

        // Événement de reconnexion
        this.socket.on('reconnect_attempt', () => {
          this.reconnectAttempts++;
          console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          this.emit('reconnecting', { attempt: this.reconnectAttempts });
        });

        // Événement de déconnexion
        this.socket.on('disconnect', (reason) => {
          this.connected = false;
          console.log(`⚠️ Déconnecté du WebSocket:`, reason);
          this.emit('disconnected', { reason });
        });

      } catch (err) {
        console.error('❌ Erreur initiation WebSocket:', err);
        reject(err);
      }
    });
  }

  /**
   * Demander les données capteurs en temps réel
   */
  requestSensorData() {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ WebSocket pas connecté');
      return;
    }
    this.socket.emit('request-sensor-data');
  }

  /**
   * Demander les contrôles actuels
   */
  requestControls() {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ WebSocket pas connecté');
      return;
    }
    this.socket.emit('request-controls');
  }

  /**
   * Mettre à jour l'irrigation
   */
  updateIrrigation(mode, threshold) {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ WebSocket pas connecté');
      return;
    }
    this.socket.emit('update-irrigation', { mode, threshold });
  }

  /**
   * Mettre à jour la brumisation
   */
  updateMisting(mode, intensity) {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ WebSocket pas connecté');
      return;
    }
    this.socket.emit('update-misting', { mode, intensity });
  }

  /**
   * Mettre à jour la ventilation
   */
  updateVentilation(mode, duration) {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ WebSocket pas connecté');
      return;
    }
    this.socket.emit('update-ventilation', { mode, duration });
  }

  /**
   * Mettre à jour le chauffage
   */
  updateHeating(mode, target) {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ WebSocket pas connecté');
      return;
    }
    this.socket.emit('update-heating', { mode, target });
  }

  /**
   * S'abonner à un événement WebSocket
   */
  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  /**
   * Se désabonner d'un événement
   */
  off(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }
  }

  /**
   * Émettre un événement personnalisé
   */
  emit(eventName, data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Erreur callback pour ${eventName}:`, err);
        }
      });
    }
  }

  /**
   * Vérifier si connecté
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  /**
   * Déconnecter proprement
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}

// Créer une instance globale du client WebSocket
const wsClient = new WebSocketClient();
