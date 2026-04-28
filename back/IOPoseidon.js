const net = require("net");
const Modbus = require("jsmodbus");

// --- CONSTANTES DE MAPPING (Standard HW Group Poseidon) ---
const MAPPING = {
  NIVEAU_CUVE: 0,  
  COMPTEUR: 1,    
  VANNE: 151,       // Les adresses DO (Relais)
  POMPE: 152       // Les adresses DO (Relais)
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
      impulsions: 0,
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
        console.log("⚠️ [Poseidon] Connexion fermée");
      });
    });
  }

  disconnect() {
    this.socket.end();
    this.isConnected = false;
  }

  // --- LECTURE ---
  async updateAll() {
    if (!this.isConnected) return false;
    try {
      // HACK TEMPORAIRE : On simule une température de 15°C et 505 impulsions
      this.data.temperature = 15;
      this.data.impulsions = 505;

      // Lecture de la Cuve
      const resNiveau = await this.client.readDiscreteInputs(MAPPING.NIVEAU_CUVE, 1);
      this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;

      return true;
    } catch (err) {
      console.error("⚠️ [Poseidon] Erreur lecture:", err.message);
      return false;
    }
  }

  getTemperature() { return this.data.temperature; }
  isCuvePleine() { return this.data.cuvePleine; }
  getConsommationLitres() { return this.data.impulsions * LITRES_PAR_IMPULSION; }

  // ==========================================
  // 🔥 FIN DE LA SIMULATION : VRAIES COMMANDES
  // ==========================================

  async setPompe(etat) {
    if (!this.isConnected) return;
    try {
      // ON ENVOIE LE VRAI SIGNAL À LA CARTE MAINTENANT !
      await this.client.writeSingleCoil(MAPPING.POMPE, etat);
      this.etatPompe = etat; 
    } catch (err) {
      console.error("Erreur d'écriture Pompe:", err.message);
    }
  }

  async setReseauEau(utiliserPluie) {
    if (!this.isConnected) return;
    try {
      // ON ENVOIE LE VRAI SIGNAL DE LA VANNE !
      await this.client.writeSingleCoil(MAPPING.VANNE, utiliserPluie);
      this.etatVanne = utiliserPluie;
    } catch (err) {
      console.error("Erreur d'écriture Vanne:", err.message);
    }
  }

  // --- INTELLIGENCE MATÉRIELLE ---
  
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
    
    // 1. SÉCURITÉ (Fail-Safe) : Si pas de cuve ou si gel, on bloque !
    if (!this.data.cuvePleine || !pasDeGel) {
      if (besoinEau) {
        console.log(`⚠️ [SÉCURITÉ] Pompe bloquée ! (Cuve Pleine: ${this.data.cuvePleine} | Temp: ${this.data.temperature}°C)`);
      }
      await this.setPompe(false);
      return;
    }

    // 2. SI TOUT EST OK, ON ÉCOUTE L'IHM
    if (besoinEau) {
      // On met un console.log pour que tu le voies dans PM2
      if (!this.etatPompe) console.log(`✅ [ACTIONNEUR] ALLUMAGE POMPE (Relais ${MAPPING.POMPE} -> ON)`);
      await this.setPompe(true);
    } else {
      if (this.etatPompe) console.log(`🛑 [ACTIONNEUR] EXTINCTION POMPE (Relais ${MAPPING.POMPE} -> OFF)`);
      await this.setPompe(false);
    }
  }
}

module.exports = IOPoseidon;