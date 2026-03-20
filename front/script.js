// ========================================
// CONFIGURATION & VARIABLES GLOBALES
// ========================================

const CONFIG = {
    // Si tu es sur la VM, vérifie que l'IP ici est la bonne pour accéder au back
    apiUrl: 'http://172.29.160.160/api', // Ou '/api' si le front est servi par node
    updateInterval: 5000,
    chartMaxPoints: 100,
};

const appState = {
    sensors: {
        temperature: null, // TCW241
        humidity: null,    // TCW241
        humAir: null,      // Humidité de l'air (TCW241)
        
        // --- [ETUDIANT 2] Ajouts EAU ---
        consoEau: 0,
        cuvePleine: false,
        reseauPluie: false
    },
    isConnected: false,
    alerts: []
};

const chartData = {
    timestamps: [],
    temperature: [],
    humidity: [],
    humAir: []
};

let charts = {};
let chartViewOffset = 0;  // Pour naviguer dans l'historique

// ========================================
// INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeCharts();
    startDataPolling();
    setupControlsListeners();
    setupChartNavigation();
    loadControles();
    updateAuthButton(); // Appel initial pour l'état de connexion
});

// ========================================
// EVENT LISTENERS
// ========================================

function initializeEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // Permettre au lien Admin de naviguer normalement
            if (href && (href.startsWith('/') || href.startsWith('http'))) {
                return; // Laisser la navigation par défaut
            }
            
            // Pour les ancres, faire un smooth scroll
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    
                    // Smooth scroll
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // Écouteur pour le bouton de connexion/déconnexion
    const btnAuth = document.getElementById("btn-auth");
    if (btnAuth) {
        btnAuth.addEventListener('click', gererConnexion);
    }
}

// Gestion des contrôles automatiques
function setupControlsListeners() {
    // Sliders pour mise à jour des valeurs affichées
    document.getElementById('irrigation-slider')?.addEventListener('input', (e) => {
        document.getElementById('irrigation-threshold').textContent = e.target.value;
    });
    
    document.getElementById('mist-slider')?.addEventListener('input', (e) => {
        document.getElementById('mist-intensity').textContent = e.target.value;
    });
    
    // Slider de durée de ventilation
    document.getElementById('ventilation-duration-slider')?.addEventListener('input', (e) => {
        document.getElementById('ventilation-duration').textContent = e.target.value;
    });
    
    document.getElementById('heating-slider')?.addEventListener('input', (e) => {
        document.getElementById('heating-target').textContent = e.target.value;
    });
    
    // Récupérer les panneaux
    const panels = document.querySelectorAll('.control-panel');
    const ventilationPanel = panels[2];
    const heatingPanel = panels[3];
    const ventilationDurationSlider = document.getElementById('ventilation-duration-slider');
    const ventilationDurationInfo = document.querySelector('.duration-info');
    
    // Mode Buttons - Inactif / Actif / Auto
    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const modeButtons = e.target.parentElement.querySelectorAll('.mode-btn');
            const selectedMode = e.target.getAttribute('data-mode');
            
            // Règle: Si ventilation est "active", chauffage ne peut pas être "active"
            if (heatingPanel && e.target.parentElement === heatingPanel.querySelector('.mode-buttons')) {
                if (selectedMode === 'active') {
                    const ventilationMode = ventilationPanel?.querySelector('.mode-btn.active')?.getAttribute('data-mode');
                    if (ventilationMode === 'active') {
                        console.warn('Le chauffage ne peut pas être actif si la ventilation est active');
                        addAlert('warning', 'Conflit', 'Le chauffage ne peut pas être actif si la ventilation est active');
                        return;
                    }
                }
            }
            
            // Règle: Si ventilation devient "active", forcer chauffage en "inactive"
            if (ventilationPanel && e.target.parentElement === ventilationPanel.querySelector('.mode-buttons')) {
                if (selectedMode === 'active') {
                    const heatingInactiveBtn = heatingPanel?.querySelector('[data-mode="inactive"]');
                    const heatingModeButtons = heatingPanel?.querySelector('.mode-buttons')?.querySelectorAll('.mode-btn');
                    
                    if (heatingModeButtons && heatingInactiveBtn) {
                        heatingModeButtons.forEach(b => b.classList.remove('active'));
                        heatingInactiveBtn.classList.add('active');
                    }
                }
                
                // Gestion du slider de durée pour ventilation
                if (ventilationDurationSlider && ventilationDurationInfo) {
                    if (selectedMode === 'active') {
                        ventilationDurationSlider.disabled = false;
                        ventilationDurationInfo.textContent = 'Durée: max 6h';
                    } else if (selectedMode === 'auto') {
                        ventilationDurationSlider.disabled = true;
                        ventilationDurationInfo.textContent = 'Mode Auto: paramètre global';
                    } else {
                        ventilationDurationSlider.disabled = true;
                        ventilationDurationInfo.textContent = '';
                    }
                }
            }
            
            // Mettre à jour le bouton cliqué
            modeButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Bouton Appliquer
    document.getElementById('apply-controls-btn')?.addEventListener('click', applyControls);
}

function applyControls() {
    // Fonction helper pour récupérer le mode sélectionné
    const getMode = (panelElement) => {
        if (!panelElement) return 'inactive';
        const activeBtn = panelElement.querySelector('.mode-btn.active');
        return activeBtn?.getAttribute('data-mode') || 'inactive';
    };
    
    // Récupérer les panneaux de contrôle
    const panels = document.querySelectorAll('.control-panel');
    
    const controls = {
        irrigation: {
            mode: getMode(panels[0]),
            threshold: parseInt(document.getElementById('irrigation-slider')?.value || 30)
        },
        misting: {
            mode: getMode(panels[1]),
            intensity: parseInt(document.getElementById('mist-slider')?.value || 50)
        },
        ventilation: {
            mode: getMode(panels[2]),
            duration: getMode(panels[2]) === 'active' ? parseInt(document.getElementById('ventilation-duration-slider')?.value || 3) : null
        },
        heating: {
            mode: getMode(panels[3]),
            target: parseInt(document.getElementById('heating-slider')?.value || 20)
        }
    };
    
    console.log('Paramètres appliqués:', controls);
    
    // Envoyer les contrôles au backend
    sendControlsToBackend(controls);
}

function showApplyNotification() {
    const btn = document.getElementById('apply-controls-btn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">✓</span> Paramètres appliqués!';
    btn.style.background = 'linear-gradient(135deg, #45a049, #357a3f)';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
    }, 2000);
}

async function sendControlsToBackend(controls) {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/controles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Envoyer les cookies HttpOnly
            body: JSON.stringify(controls)
        });

        const data = await response.json();

        if (response.status === 403) {
            console.error('Accès refusé:', data.message);
            addAlert('danger', 'Accès refusé', data.message || 'Vous n\'avez pas les droits admin');
            return;
        }

        if (response.status === 401) {
            window.location.href = '/front/login.html';
            return;
        }

        if (!data.success) {
            console.error('Erreur serveur:', data.message);
            addAlert('danger', 'Erreur', data.message || 'Une erreur est survenue');
            return;
        }

        // Afficher une notification de succès
        showApplyNotification();
        addAlert('success', 'Succès', 'Paramètres appliqués et sauvegardés en base de données');

    } catch (err) {
        console.error('Erreur réseau:', err);
        addAlert('danger', 'Erreur réseau', 'Impossible de communiquer avec le serveur');
    }
}

// ========================================
// CHARGER LES CONTRÔLES DEPUIS LA BDD
// ========================================

async function loadControles() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/controles`, {
            method: 'GET',
            credentials: 'include' // Envoyer les cookies HttpOnly
        });

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = '/front/login.html';
            return;
        }

        if (!data.success || !data.controles) {
            console.log('Aucun contrôle enregistré en base');
            return;
        }

        const controles = data.controles;
        const panels = document.querySelectorAll('.control-panel');
        
        if (panels.length < 4) return; // Sécurité si les panneaux ne sont pas trouvés

        // ========================================
        // 1. IRRIGATION
        // ========================================
        const irrigationPanel = panels[0];
        setModeButton(irrigationPanel, controles.irrigation_mode);
        const irrigationSlider = document.getElementById('irrigation-slider');
        const irrigationThreshold = document.getElementById('irrigation-threshold');
        if (irrigationSlider && controles.irrigation_threshold !== null) {
            irrigationSlider.value = controles.irrigation_threshold;
            irrigationThreshold.textContent = controles.irrigation_threshold;
        }

        // ========================================
        // 2. BRUMISATEUR (MISTING)
        // ========================================
        const mistingPanel = panels[1];
        setModeButton(mistingPanel, controles.misting_mode);
        const mistingSlider = document.getElementById('mist-slider');
        const mistingIntensity = document.getElementById('mist-intensity');
        if (mistingSlider && controles.misting_intensity !== null) {
            mistingSlider.value = controles.misting_intensity;
            mistingIntensity.textContent = controles.misting_intensity;
        }

        // ========================================
        // 3. VENTILATION
        // ========================================
        const ventilationPanel = panels[2];
        setModeButton(ventilationPanel, controles.ventilation_mode);
        const ventilationDurationSlider = document.getElementById('ventilation-duration-slider');
        const ventilationDuration = document.getElementById('ventilation-duration');
        const durationInfo = document.querySelector('.duration-info');
        
        // Mettre à jour le slider selon le mode
        if (controles.ventilation_mode === 'active' && ventilationDurationSlider) {
            ventilationDurationSlider.disabled = false;
            if (controles.ventilation_duration !== null) {
                ventilationDurationSlider.value = controles.ventilation_duration;
                if(ventilationDuration) ventilationDuration.textContent = controles.ventilation_duration;
            }
        } else if (controles.ventilation_mode === 'auto' && ventilationDurationSlider) {
            ventilationDurationSlider.disabled = true;
            if(durationInfo) durationInfo.textContent = 'Mode Auto: paramètre global';
        } else if (ventilationDurationSlider) {
            ventilationDurationSlider.disabled = true;
            if(durationInfo) durationInfo.textContent = '';
        }

        // ========================================
        // 4. CHAUFFAGE (HEATING)
        // ========================================
        const heatingPanel = panels[3];
        setModeButton(heatingPanel, controles.heating_mode);
        const heatingSlider = document.getElementById('heating-slider');
        const heatingTarget = document.getElementById('heating-target');
        if (heatingSlider && controles.heating_target !== null) {
            heatingSlider.value = controles.heating_target;
            if(heatingTarget) heatingTarget.textContent = controles.heating_target;
        }

        console.log('✓ Contrôles chargés depuis la base de données:', controles);
        // addAlert('info', 'Chargement', 'Derniers paramètres appliqués restaurés'); // Optionnel

    } catch (err) {
        console.error('Erreur lors du chargement des contrôles:', err);
    }
}

// Fonction helper pour définir le bouton de mode actif
function setModeButton(panel, mode) {
    if (!panel) return;
    const buttons = panel.querySelectorAll('.mode-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = panel.querySelector(`[data-mode="${mode}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    applyEffectsFromLoadedControles();
}

// ========================================
// COMMUNICATION AVEC LE BACKEND
// ========================================

async function fetchSensorData() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/info`, {
            credentials: 'include' // Envoyer les cookies HttpOnly
        });

        if (response.status === 401) {
            window.location.href = "/front/login.html";
            return;
        }

        if (!response.ok && response.status !== 401) {
             throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Mise à jour unifiée (TCW + POSEIDON)
            updateSensorData({
                temperature: data.temperature !== null ? parseFloat(data.temperature) : null,
                humidity: data.humiditeSol !== null ? parseFloat(data.humiditeSol) : null,
                humAir: data.humair !== null ? parseFloat(data.humair) : null,
                
                // Récupération de tes données
                consoEau: data.consoEau !== null ? parseFloat(data.consoEau) : 0,
                cuvePleine: data.cuvePleine || false,
                reseauPluie: data.reseauPluie || false
            });
            updateConnectionStatus(true);
        } else {
             updateConnectionStatus(false);
        }

    } catch (error) {
        console.error("Erreur API :", error);
        updateConnectionStatus(false);
    }
}

function startDataPolling() {
    fetchSensorData();
    fetchHistorique24h(); // Récupérer l'historique au démarrage
    
    // Mise à jour des données temps réel
    setInterval(fetchSensorData, CONFIG.updateInterval);
    
    // Mise à jour des graphiques tous les 5 secondes
    setInterval(fetchHistorique24h, 5000);
}


// ==========================================
// 🔐 GESTION CONNEXION / DECONNEXION
// ==========================================

async function updateAuthButton() {
    const btn = document.getElementById("btn-auth");
    const navAdmin = document.getElementById("nav-admin");

    if (!btn) return; // Sécurité si le bouton n'existe pas sur la page actuelle

    try {
        // Vérifier si l'utilisateur est authentifié en appelant une route protégée
        const response = await fetch(`${CONFIG.apiUrl}/info`, {
            credentials: 'include'
        });

        if (response.ok) {
            // L'utilisateur est connecté
            btn.innerText = "Déconnexion";
            btn.style.backgroundColor = "#e74c3c";
            btn.style.color = "white";

            // Récupérer le rôle de l'utilisateur
            try {
                const roleResponse = await fetch(`${CONFIG.apiUrl}/user-role`, {
                    credentials: 'include'
                });

                if (roleResponse.ok) {
                    const roleData = await roleResponse.json();
                    if (roleData.role === 'admin' && navAdmin) {
                        navAdmin.style.display = "inline-block";
                    }
                } else {
                    if (navAdmin) navAdmin.style.display = "none";
                }
            } catch (err) {
                console.error('Erreur lors du chargement du rôle:', err);
                if (navAdmin) navAdmin.style.display = "none";
            }
        } else {
            // L'utilisateur n'est pas connecté
            btn.innerText = "Connexion";
            btn.style.backgroundColor = "#2ecc71";
            btn.style.color = "white";
            if (navAdmin) navAdmin.style.display = "none";
        }
    } catch (err) {
        // Erreur réseau
        btn.innerText = "Connexion";
        btn.style.backgroundColor = "#2ecc71";
        btn.style.color = "white";
        if (navAdmin) navAdmin.style.display = "none";
    }
}

async function gererConnexion() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/info`, {
            credentials: 'include'
        });

        if (response.ok) {
            // --- ACTION : SE DÉCONNECTER ---
            // 1. Appeler l'API de logout
            await fetch(`${CONFIG.apiUrl}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            
            // 2. Rediriger vers login
            alert("Vous avez été déconnecté.");
            window.location.href = "/front/login.html"; 
        } else {
            // --- ACTION : ALLER VERS CONNEXION ---
            window.location.href = "/front/login.html";
        }
    } catch (err) {
        alert("Erreur lors de la déconnexion.");
        window.location.href = "/front/login.html";
    }
}

// ========================================
// MISE À JOUR DE L'INTERFACE
// ========================================

function updateSensorData(data) {
    // Stockage dans l'état global
    appState.sensors.temperature = data.temperature;
    appState.sensors.humidity = data.humidity;
    appState.sensors.humAir = data.humAir;
    appState.sensors.consoEau = data.consoEau;
    appState.sensors.cuvePleine = data.cuvePleine;
    appState.sensors.reseauPluie = data.reseauPluie;

    updateDisplay();
    addToHistory(data);
    updateCharts();
    checkAlerts(data);
}

function updateDisplay() {
    const { temperature, humidity, humAir, consoEau, cuvePleine, reseauPluie } = appState.sensors;

    // --- Affichage TCW (Existant) ---
    const heroTemp = document.getElementById('hero-temp');
    if(heroTemp) heroTemp.textContent = temperature !== null ? `${temperature.toFixed(1)}°C` : '--';

    const heroHum = document.getElementById('hero-humidity');
    if(heroHum) heroHum.textContent = humidity !== null ? `${humidity.toFixed(1)}%` : '--';

    updateCard('temp', temperature, '°C', getTemperatureStatus);
    updateCard('humidity', humidity, '%', getHumidityStatus);
    updateCard('soil', humAir, '%', getHumidityStatus);

    // --- Affichage EAU (Nouveau) ---
    // 1. Consommation
    const elConso = document.getElementById('valeur-conso');
    if (elConso) {
        elConso.textContent = `${consoEau.toFixed(1)} L`;
    }

    // 2. État de la Cuve
    const elCuve = document.getElementById('etat-cuve');
    if (elCuve) {
        elCuve.textContent = cuvePleine ? 'PLEINE' : 'VIDE';
        // Changement de classe CSS pour la couleur (Bootstrap badges)
        elCuve.className = cuvePleine ? 'badge bg-success' : 'badge bg-danger';
    }

    // 3. Réseau Actif
    const elReseau = document.getElementById('etat-reseau');
    if (elReseau) {
        elReseau.textContent = reseauPluie ? 'EAU DE PLUIE' : 'EAU DE VILLE';
        elReseau.style.color = reseauPluie ? 'green' : 'orange';
    }
}

function updateCard(type, value, unit, statusFunction) {
    const valueElement = document.getElementById(`${type}-value`);
    const statusElement = document.getElementById(`${type}-status`);

    if (valueElement && statusElement) {
        if (value !== null && value !== undefined && !isNaN(value)) {
            valueElement.textContent = value.toFixed(1) + unit;
            const status = statusFunction(value);
            statusElement.textContent = status.text;
            statusElement.className = `card-status text-${status.level}`;
        } else {
            valueElement.textContent = '--' + unit;
            statusElement.textContent = 'Aucune donnée';
            statusElement.className = 'card-status';
        }
    }
}

function getTemperatureStatus(temp) {
    if (temp < 15) return { text: 'Trop froid', level: 'danger' };
    if (temp < 18) return { text: 'Froid', level: 'warning' };
    if (temp <= 28) return { text: 'Optimal', level: 'success' };
    if (temp <= 32) return { text: 'Chaud', level: 'warning' };
    return { text: 'Trop chaud', level: 'danger' };
}

function getHumidityStatus(h) {
    if (h < 20) return { text: 'Trop sec', level: 'danger' };
    if (h < 40) return { text: 'Sec', level: 'warning' };
    if (h <= 70) return { text: 'Optimal', level: 'success' };
    if (h <= 85) return { text: 'Humide', level: 'warning' };
    return { text: 'Trop humide', level: 'danger' };
}

function updateConnectionStatus(isConnected) {
    appState.isConnected = isConnected;
    const indicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    const footerStatus = document.getElementById('footer-status');

    if (indicator && statusText) {
        if (isConnected) {
            indicator.classList.add('online');
            indicator.classList.remove('offline');
            statusText.textContent = 'Connecté';
            if(footerStatus) footerStatus.textContent = 'Tous les systèmes opérationnels';
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            statusText.textContent = 'Déconnecté';
            if(footerStatus) footerStatus.textContent = 'Connexion au système en cours...';
        }
    }
}

// ========================================
// ALERTES
// ========================================

function checkAlerts(data) {
    const { temperature, humidity } = data;

    if (temperature !== null) {
        if (temperature > 32) addAlert('danger', 'Température élevée', `${temperature.toFixed(1)}°C`);
        else if (temperature < 15) addAlert('danger', 'Température basse', `${temperature.toFixed(1)}°C`);
    }
}

function addAlert(type, title, message) {
    const alert = {
        id: Date.now(),
        type,
        title,
        message,
        timestamp: new Date()
    };

    appState.alerts.unshift(alert);
    if (appState.alerts.length > 10) appState.alerts.pop();

    displayAlert(alert);
}

function displayAlert(alert) {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${alert.type}`;
    alertElement.innerHTML = `
        <strong>${alert.title}</strong><br>
        ${alert.message}<br>
        <small>${alert.timestamp.toLocaleTimeString()}</small>
    `;

    container.insertBefore(alertElement, container.firstChild);

    while (container.children.length > 5) {
        container.removeChild(container.lastChild);
    }
}

// ========================================
// NAVIGATION GRAPHIQUES
// ========================================

function setupChartNavigation() {
    const btnPrev = document.getElementById('btn-chart-prev');
    const btnNext = document.getElementById('btn-chart-next');

    if (!btnPrev || !btnNext) return;

    btnPrev.addEventListener('click', () => {
        chartViewOffset = Math.min(chartViewOffset + 10, 100);
        // Récupérer et afficher les données
        const allData = [];
        for (let i = 0; i < chartData.timestamps.length; i++) {
            allData.push({
                timestamp: chartData.timestamps[i],
                temperature: chartData.temperature[i],
                humiditeMoyenne: chartData.humidity[i],
                humAir: chartData.humAir[i]
            });
        }
        updateChartsWithHistorique(allData);
    });

    btnNext.addEventListener('click', () => {
        chartViewOffset = Math.max(chartViewOffset - 10, 0);
        // Récupérer et afficher les données
        const allData = [];
        for (let i = 0; i < chartData.timestamps.length; i++) {
            allData.push({
                timestamp: chartData.timestamps[i],
                temperature: chartData.temperature[i],
                humiditeMoyenne: chartData.humidity[i],
                humAir: chartData.humAir[i]
            });
        }
        updateChartsWithHistorique(allData);
    });
}

// ========================================
// GRAPHIQUES DYNAMIQUES
// ========================================

function initializeCharts() {
    const tempCtx = document.getElementById('temp-humidity-chart');
    if (tempCtx && typeof Chart !== 'undefined') {
        charts.temp = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { 
                        label: 'Température (°C)', 
                        data: [], 
                        borderColor: '#F44336', 
                        backgroundColor: 'rgba(244, 67, 54, 0.15)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        yAxisID: 'y'
                    },
                    { 
                        label: 'Humidité (%)', 
                        data: [], 
                        borderColor: '#2196F3', 
                        backgroundColor: 'rgba(33, 150, 243, 0.15)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        yAxisID: 'y1'
                    },
                    { 
                        label: 'Humidité Air (%)', 
                        data: [], 
                        borderColor: '#FF9800', 
                        backgroundColor: 'rgba(255, 152, 0, 0.15)',
                        tension: 0.4,
                        fill: false,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        displayColors: true,
                        borderColor: '#ddd',
                        borderWidth: 1,
                        boxPadding: 6
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Température (°C)',
                            font: { size: 13, weight: 'bold' }
                        },
                        min: -80,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: true
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Humidité (%)',
                            font: { size: 13, weight: 'bold' }
                        },
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            font: { size: 11 }
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        ticks: {
                            maxTicksLimit: 15,
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            drawBorder: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                }
            }
        });
    }
}

// Récupérer l'historique 24h depuis la base de données
async function fetchHistorique24h() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/historique-24h`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            console.warn("Non authentifié pour l'historique");
            return;
        }

        const result = await response.json();
        if (result.success && result.data) {
            updateChartsWithHistorique(result.data);
        }
    } catch (error) {
        console.error("Erreur récupération historique:", error);
    }
}

// Mettre à jour les graphiques avec les données de l'historique
function updateChartsWithHistorique(data) {
    if (!data || data.length === 0) return;

    // Calculer le nombre de points à afficher (100 maximum)
    const maxPoints = Math.min(CONFIG.chartMaxPoints, 100);
    
    // Appliquer l'offset de navigation
    let historique = data.slice(-maxPoints);
    const totalAvailable = data.length;
    const currentStart = Math.max(0, totalAvailable - maxPoints);

    // Si on a un offset, décaler les données affichées
    if (chartViewOffset > 0 && chartViewOffset < historique.length) {
        historique = historique.slice(0, historique.length - chartViewOffset);
    }

    if (historique.length === 0) return;

    // Préparer les labels (timestamps)
    const labels = historique.map(item => {
        const time = item.timestamp;
        // Si c'est déjà formaté, utilise-le sinon formate
        return typeof time === 'string' ? time : new Date(time).toLocaleTimeString('fr-FR');
    });

    // Préparer les données
    const temperatures = historique.map(item => item.temperature);
    const humidites = historique.map(item => item.humiditeMoyenne);
    const humAirs = historique.map(item => item.humAir);

    // Calculer les informations à afficher
    let infoText = 'En direct';
    if (chartViewOffset > 0) {
        const pointsBack = chartViewOffset;
        if (pointsBack >= 60) {
            const hoursBack = Math.floor(pointsBack / 12);
            infoText = `Il y a ${hoursBack}h environ`;
        } else {
            infoText = `${pointsBack * 5} min en arrière`;
        }
    }
    const infoElement = document.getElementById('chart-info');
    if (infoElement) {
        infoElement.textContent = infoText;
    }

    // Mettre à jour les boutons de navigation
    updateNavigationButtons(chartViewOffset, data.length);

    // Mettre à jour le graphique Température & Humidité
    if (charts.temp) {
        charts.temp.data.labels = labels;
        charts.temp.data.datasets[0].data = temperatures;
        charts.temp.data.datasets[1].data = humidites;
        charts.temp.data.datasets[2].data = humAirs;
        charts.temp.update('none');
    }
}

function updateNavigationButtons(offset, totalPoints) {
    const btnPrev = document.getElementById('btn-chart-prev');
    const btnNext = document.getElementById('btn-chart-next');
    
    if (btnPrev) {
        btnPrev.disabled = offset >= totalPoints - 20;
    }
    if (btnNext) {
        btnNext.disabled = offset <= 0;
    }
}

function addToHistory(data) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    chartData.timestamps.push(timeLabel);
    chartData.temperature.push(data.temperature);
    chartData.humidity.push(data.humidity);
    chartData.humAir.push(data.humAir);

    if (chartData.timestamps.length > CONFIG.chartMaxPoints) {
        chartData.timestamps.shift();
        chartData.temperature.shift();
        chartData.humidity.shift();
        chartData.humAir.shift();
    }
}

function updateCharts() {
    // Cette fonction est appelée par updateSensorData pour garder la compatibilité
    // mais elle ne fait rien car les graphiques sont mis à jour par fetchHistorique24h
}