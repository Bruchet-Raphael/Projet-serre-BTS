const net = require('net');
const Modbus = require('jsmodbus');

// --- CONSTANTES DE MAPPING ---
const MAPPING = {
    TEMP_EXT: 5,        // Registre Holding 5 (Température Extérieure pour le Gel)
    NIVEAU_CUVE: 100,   // Input 100
    COMPTEUR: 1,        // Registre Holding 1 (Débitmètre)
    POMPE: 151,         // Coil 151
    VANNE: 152          // Coil 152
};

const LITRES_PAR_IMPULSION = 1.0; 

class IOPoseidon {
    constructor(ip, port = 502) {
        this.ip = ip;
        this.port = port;
        this.socket = new net.Socket();
        this.client = new Modbus.client.TCP(this.socket, 1);
        
        this.data = {
            temperature: 0,
            cuvePleine: false,
            impulsions: 0
        };
        this.isConnected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect({ host: this.ip, port: this.port });
            this.socket.on('connect', () => {
                console.log(`✅ [Poseidon] Connecté sur ${this.ip}`);
                this.isConnected = true;
                resolve(true);
            });
            this.socket.on('error', (err) => {
                console.error(`❌ [Poseidon] Erreur connexion: ${err.message}`);
                this.isConnected = false;
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

    // --- LECTURE OPTIMISÉE (Block Read) ---
    async updateAll() {
        if (!this.isConnected) return false;
        try {
            // 1. Lecture Groupée : On lit 5 registres d'un coup (de l'adresse 1 à 5)
            const resHolding = await this.client.readHoldingRegisters(MAPPING.COMPTEUR, 5);
            
            // On extrait les bonnes cases du tableau
            this.data.impulsions = resHolding.response.body.values[0];  // Index 0 = Registre 1
            this.data.temperature = resHolding.response.body.values[4]; // Index 4 = Registre 5

            // 2. Lecture Séparée pour la Cuve (Car c'est un Input TOR)
            const resNiveau = await this.client.readDiscreteInputs(MAPPING.NIVEAU_CUVE, 1);
            this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;

            return true;
        } catch (err) {
            console.error('⚠️ [Poseidon] Erreur lecture groupée:', err.message);
            return false;
        }
    }

    getTemperature() { return this.data.temperature; }
    isCuvePleine() { return this.data.cuvePleine; }
    getConsommationLitres() { return this.data.impulsions * LITRES_PAR_IMPULSION; }

    async setPompe(etat) {
        if (!this.isConnected) return;
        try { await this.client.writeSingleCoil(MAPPING.POMPE, etat); } 
        catch (err) { console.error('Erreur Pompe:', err.message); }
    }

    async setReseauEau(utiliserPluie) {
        if (!this.isConnected) return;
        try { await this.client.writeSingleCoil(MAPPING.VANNE, utiliserPluie); } 
        catch (err) { console.error('Erreur Vanne:', err.message); }
    }

    // --- INTELLIGENCE (Utilise SA propre température extérieure) ---
    async gererChoixReseau() {
        const pasDeGel = this.data.temperature >= 1;
        if (this.data.cuvePleine && pasDeGel) {
            await this.setReseauEau(true); 
        } else {
            await this.setReseauEau(false); 
        }
    }

    async gererPompe(besoinEau) {
        const pasDeGel = this.data.temperature >= 1;
        if (besoinEau && this.data.cuvePleine && pasDeGel) {
            await this.setPompe(true);
        } else {
            await this.setPompe(false);
        }
    }
}

module.exports = IOPoseidon;