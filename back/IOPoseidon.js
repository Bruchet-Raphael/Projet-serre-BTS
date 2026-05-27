const net = require("net");
const Modbus = require("jsmodbus");

// --- CONSTANTES DE MAPPING ---
const MAPPING = {
  NIVEAU_CUVE: 99,   
  COMPTEUR: 100,      
  VANNE: 199,       
  POMPE: 200,
  TEMP_POSEIDON: 100 // Adresse 100, mais qui sera lue sur le SLAVE 2
};

const LITRES_PAR_IMPULSION = 1.0;

class IOPoseidon {
  constructor(ip, port = 502) {
    this.ip = ip;
    this.port = port;
    this.socket = new net.Socket();
    
    // L'astuce industrielle : Deux clients logiques sur un seul câble physique
    this.clientSlave1 = new Modbus.client.TCP(this.socket, 1); // Cœur de l'automate (Eau, Relais)
    this.clientSlave2 = new Modbus.client.TCP(this.socket, 2); // Bus externe (Capteur Température)

    this.data = {
      cuvePleine: false,
      impulsions: 0,
      temperature: 0
    };
    this.isConnected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket.connect({ host: this.ip, port: this.port });
      this.socket.on("connect", () => {
        console.log(`✅ [Poseidon] Connecté sur ${this.ip}`);
        this.isConnected = true;
        resolve(true);
      });
      this.socket.on("error", (err) => {
        console.error(`❌ [Poseidon] Erreur connexion: ${err.message}`);
        this.isConnected = false;
      });
      this.socket.on("close", () => {
        this.isConnected = false;
      });
    });
  }

  disconnect() {
    this.socket.end();
    this.isConnected = false;
  }

  // --- LECTURE (MULTI-SLAVES) ---
  async updateAll() {
    if (!this.isConnected) return false;
    
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // 1. Lecture de la Cuve (Sur le Slave 1)
    try {
      const resNiveau = await this.clientSlave1.readDiscreteInputs(MAPPING.NIVEAU_CUVE, 1);
      this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;
    } catch (err) {
      console.error(`❌ [Modbus] Erreur lecture CUVE :`, err.message);
    }

    await sleep(50); // Pause de courtoisie matérielle

    // 2. Lecture du Compteur (Sur le Slave 1)
    try {
      const resCompteur = await this.clientSlave1.readInputRegisters(MAPPING.COMPTEUR, 1);
      this.data.impulsions = resCompteur.response.body.valuesAsArray[0];
    } catch (err) {
      console.error(`❌ [Modbus] Erreur lecture COMPTEUR :`, err.message);
    }

    await sleep(50);

    // 3. Lecture de la Température (Sur le Slave 2 !)
    try {
      const resTemp = await this.clientSlave2.readInputRegisters(MAPPING.TEMP_POSEIDON, 1); 
      this.data.temperature = resTemp.response.body.valuesAsArray[0] / 10;
    } catch (err) {
      console.error(`❌ [Modbus] Erreur lecture TEMP (Slave 2) :`, err.message);
    }

    return true;
  }

  getTemperature() { return this.data.temperature; }
  isCuvePleine() { return this.data.cuvePleine; }
  getConsommationLitres() { return this.data.impulsions * LITRES_PAR_IMPULSION; }

  // --- ÉCRITURE (Sur le Slave 1) ---
  async setPompe(etat) {
    if (!this.isConnected) return;
    try {
      await this.clientSlave1.writeSingleCoil(MAPPING.POMPE, etat);
      this.etatPompe = etat; 
    } catch (err) {
      console.error(`❌ [Erreur Modbus] Écriture POMPE refusée`);
    }
  }

  async setReseauEau(utiliserPluie) {
    if (!this.isConnected) return;
    try {
      await this.clientSlave1.writeSingleCoil(MAPPING.VANNE, utiliserPluie);
      this.etatVanne = utiliserPluie;
    } catch (err) {
      console.error(`❌ [Erreur Modbus] Écriture VANNE refusée`);
    }
  }

  // --- INTELLIGENCE MATÉRIELLE (Fail-Safe) ---
  async gererChoixReseau() {
    const pasDeGel = this.data.temperature >= 1;
    await this.setReseauEau(this.data.cuvePleine && pasDeGel);
  }

  async gererPompe(besoinEau) {
    const pasDeGel = this.data.temperature >= 1;
    
    if (!this.data.cuvePleine || !pasDeGel) {
      if (besoinEau) console.log(`⚠️ [SÉCURITÉ] Pompe bloquée ! (Cuve Pleine: ${this.data.cuvePleine} | Temp Locale: ${this.data.temperature}°C)`);
      await this.setPompe(false);
      return;
    }

    if (besoinEau) {
      if (!this.etatPompe) console.log(`✅ [ACTIONNEUR] ALLUMAGE POMPE (Relais ON)`);
      await this.setPompe(true);
    } else {
      if (this.etatPompe) console.log(`🛑 [ACTIONNEUR] EXTINCTION POMPE (Relais OFF)`);
      await this.setPompe(false);
    }
  }
}

module.exports = IOPoseidon;