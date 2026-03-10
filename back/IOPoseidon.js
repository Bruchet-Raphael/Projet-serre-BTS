const net = require('net');
const Modbus = require('jsmodbus');

// --- CONSTANTES DE MAPPING ---
const MAPPING = {
    TEMP_EXT: 5,        // Registre Holding 5 (Simulateur)
    NIVEAU_CUVE: 100,   // Input 100
    COMPTEUR: 1,        // Registre Holding 1 (Débitmètre)
    POMPE: 151,         // Coil 151
    VANNE: 152          // Coil 152
};

const LITRES_PAR_IMPULSION = 1.0; // À ajuster selon le capteur réel

class IOPoseidon {
    constructor(ip, port = 502) {
        this.ip = ip;
        this.port = port;
        this.socket = new net.Socket();
        // UnitId = 1 pour le simulateur Node.js
        this.client = new Modbus.client.TCP(this.socket, 1);
        
        // Cache de données (Dernières valeurs lues)
        this.data = {
            temperature: 0,
            cuvePleine: false,
            impulsions: 0
        };

        this.isConnected = false;
    }

    // --- CONNEXION ---
    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect({ host: this.ip, port: this.port });

            this.socket.on('connect', () => {
                console.log(`✅ [Poseidon] Connecté sur ${this.ip}`);
                this.isConnected = true;
                resolve(true);
            });

            this.socket.on('error', (err) => {
                // On log juste l'erreur sans crasher l'app
                console.error(`❌ [Poseidon] Erreur connexion: ${err.message}`);
                this.isConnected = false;
                // On ne reject pas forcément ici pour permettre les retry
            });

            this.socket.on('close', () => {
                this.isConnected = false;
                console.log('⚠️ [Poseidon] Connexion fermée');
            });
        });
    }

    disconnect() {
        this.socket.end();
        this.isConnected = false;
    }

    // --- LECTURE OPTIMISÉE (UpdateAll) ---
    async updateAll() {
        if (!this.isConnected) return false;

        try {
            // 1. LECTURE GROUPÉE (Block Read - Holding Registers)
            // On demande 5 registres contigus en partant de l'adresse 1 (MAPPING.COMPTEUR)
            // Le tableau "values" contiendra les index 0 à 4 correspondant aux adresses 1 à 5.
            const resHolding = await this.client.readHoldingRegisters(MAPPING.COMPTEUR, 5);
            
            this.data.impulsions = resHolding.response.body.values[0];  // Index 0 = Adresse 1 (Compteur)
            this.data.temperature = resHolding.response.body.values[4]; // Index 4 = Adresse 5 (Température)

            // 2. LECTURE DISCRETE INPUT (Capteur niveau)
            // Requête séparée requise car c'est un autre type d'espace mémoire (Inputs vs Registers)
            const resNiveau = await this.client.readDiscreteInputs(MAPPING.NIVEAU_CUVE, 1);
            this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;

            return true;

        } catch (err) {
            console.error('⚠️ [Poseidon] Erreur lecture groupée:', err.message);
            return false;
        }
    }

    // --- GETTERS (Accesseurs) ---
    getTemperature() { return this.data.temperature; }
    isCuvePleine() { return this.data.cuvePleine; }
    getImpulsions() { return this.data.impulsions; }
    
    // Tâche : Calculer la consommation
    getConsommationLitres() {
        return this.data.impulsions * LITRES_PAR_IMPULSION;
    }

    // --- ECRITURE (Actionneurs) ---
    async setPompe(etat) {
        if (!this.isConnected) return;
        try {
            await this.client.writeSingleCoil(MAPPING.POMPE, etat);
        } catch (err) {
            console.error('Erreur écriture Pompe:', err.message);
        }
    }

    async setReseauEau(utiliserPluie) {
        if (!this.isConnected) return;
        try {
            await this.client.writeSingleCoil(MAPPING.VANNE, utiliserPluie);
        } catch (err) {
            console.error('Erreur écriture Vanne:', err.message);
        }
    }

    // --- INTELLIGENCE (Algorithmes) ---

    // Tâche : Algorithme Choix Réseau
    async gererChoixReseau() {
        const pasDeGel = this.data.temperature >= 1;
        // Si Cuve Pleine ET Pas de gel -> EAU DE PLUIE
        if (this.data.cuvePleine && pasDeGel) {
            await this.setReseauEau(true); 
        } else {
            await this.setReseauEau(false); // Sinon VILLE (Sécurité)
        }
    }

    // Tâche : Algorithme Pompe
    async gererPompe(besoinEau) {
        const pasDeGel = this.data.temperature >= 1;
        // Si Besoin ET Cuve Pleine ET Pas de gel -> POMPE ON
        if (besoinEau && this.data.cuvePleine && pasDeGel) {
            await this.setPompe(true);
        } else {
            await this.setPompe(false);
        }
    }
}

module.exports = IOPoseidon;