const net = require("net");
const Modbus = require("jsmodbus");

// --- CONSTANTES DE MAPPING ---
const MAPPING = {
  NIVEAU_CUVE: 99,   
  COMPTEUR: 100,      
  VANNE: 199,       
  POMPE: 200,
  TEMP_POSEIDON: 6033 // Adresse 6033 avec décalage Base-0 (-1). À tester avec 6033 si erreur.
};

const LITRES_PAR_IMPULSION = 1.0;

class IOPoseidon {
  constructor(ip, port = 502) {
    this.ip = ip;
    this.port = port;
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket, 1);

    this.data = {
      cuvePleine: false,
      impulsions: 505,
      temperature: 0 // Nouvelle variable interne
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

// --- LECTURE ISOLÉE (MODE DEBUG) ---
  async updateAll() {
    if (!this.isConnected) return false;
    
    // 1. Lecture de la Cuve
    try {
      const resNiveau = await this.client.readDiscreteInputs(MAPPING.NIVEAU_CUVE, 1);
      this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;
    } catch (err) {
      console.error(`❌ [Modbus] Erreur lecture CUVE (99) :`, err.message || "Rejet de la trame");
    }

    // 2. Lecture du Compteur
    try {
      const resCompteur = await this.client.readInputRegisters(MAPPING.COMPTEUR, 1);
      this.data.impulsions = resCompteur.response.body.valuesAsArray[0];
    } catch (err) {
      console.error(`❌ [Modbus] Erreur lecture COMPTEUR (100) :`, err.message || "Rejet de la trame");
    }

    // 3. Lecture de la Température Locale
try {
      const resTemp = await this.client.readInputRegisters(MAPPING.TEMP_POSEIDON, 1);
      this.data.temperature = resTemp.response.body.valuesAsArray[0] / 10;
    } catch (err) {
      // Extraction du code d'exception MODBUS
      let codeModbus = "Inconnu";
      if (err.response && err.response.body && err.response.body.exceptionCode) {
         codeModbus = err.response.body.exceptionCode;
      }
      console.error(`❌ [Modbus] Erreur lecture TEMP (${MAPPING.TEMP_POSEIDON}) - Code d'Exception Modbus : ${codeModbus}`);
    }

    return true;
  }

  getTemperature() { return this.data.temperature; }
  isCuvePleine() { return this.data.cuvePleine; }
  
  // Conversion mathématique des impulsions en Litres
  getConsommationLitres() { return this.data.impulsions * LITRES_PAR_IMPULSION; }

  // --- ÉCRITURE ISOLÉE ---
  async setPompe(etat) {
    if (!this.isConnected) return;
    try {
      await this.client.writeSingleCoil(MAPPING.POMPE, etat);
      this.etatPompe = etat; 
    } catch (err) {
      console.error(`❌ [Erreur Modbus] Écriture POMPE refusée à l'adresse Coil ${MAPPING.POMPE}`);
    }
  }

  async setReseauEau(utiliserPluie) {
    if (!this.isConnected) return;
    try {
      await this.client.writeSingleCoil(MAPPING.VANNE, utiliserPluie);
      this.etatVanne = utiliserPluie;
    } catch (err) {
      console.error(`❌ [Erreur Modbus] Écriture VANNE refusée à l'adresse Coil ${MAPPING.VANNE}`);
    }
  }

  // --- INTELLIGENCE MATÉRIELLE 100% AUTONOME ---
  // On n'a plus besoin de recevoir la température en paramètre !
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
      if (!this.etatPompe) console.log(`✅ [ACTIONNEUR] ALLUMAGE POMPE (Relais ${MAPPING.POMPE} -> ON)`);
      await this.setPompe(true);
    } else {
      if (this.etatPompe) console.log(`🛑 [ACTIONNEUR] EXTINCTION POMPE (Relais ${MAPPING.POMPE} -> OFF)`);
      await this.setPompe(false);
    }
  }
}

module.exports = IOPoseidon;