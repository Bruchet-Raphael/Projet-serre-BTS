const net = require("net");
const Modbus = require("jsmodbus");

// --- CONSTANTES DE MAPPING ---
const MAPPING = {
  NIVEAU_CUVE: 99,   
  COMPTEUR: 100,      
  VANNE: 99,       
  POMPE: 100       
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

  // --- LECTURE ISOLÉE ---
  async updateAll() {
    if (!this.isConnected) return false;
    
    try {
      const resNiveau = await this.client.readDiscreteInputs(MAPPING.NIVEAU_CUVE, 1);
      this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;
    } catch (err) {
      console.error(`❌ [Erreur Modbus] Lecture CUVE refusée à l'adresse DI ${MAPPING.NIVEAU_CUVE}`);
    }

    return true;
  }

  getTemperature() { return this.data.temperature; }
  isCuvePleine() { return this.data.cuvePleine; }
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

  // --- INTELLIGENCE MATÉRIELLE ---
async gererChoixReseau(temperatureTCW) {
    const pasDeGel = temperatureTCW >= 1;
    await this.setReseauEau(this.data.cuvePleine && pasDeGel);
  }

  // On ajoute le paramètre "temperatureTCW"
  async gererPompe(besoinEau, temperatureTCW) {
    const pasDeGel = temperatureTCW >= 1;
    
    if (!this.data.cuvePleine || !pasDeGel) {
      if (besoinEau) console.log(`⚠️ [SÉCURITÉ] Pompe bloquée ! (Cuve Pleine: ${this.data.cuvePleine} | Temp TCW: ${temperatureTCW}°C)`);
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
