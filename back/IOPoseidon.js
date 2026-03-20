const net = require("net");
const Modbus = require("jsmodbus");

// --- CONSTANTES DE MAPPING (Standard HW Group Poseidon) ---
const MAPPING = {
  NIVEAU_CUVE: 99, // Chez HW Group, le DI 1 est à l'adresse 99
  COMPTEUR: 100, // Le DI 2 (Débitmètre) est à 100
  VANNE: 99, // L'ID 99 de la Vanne
  POMPE: 100, // L'ID 100 de la Pompe
};

const LITRES_PAR_IMPULSION = 1.0;

class IOPoseidon {
  constructor(ip, port = 502) {
    this.ip = ip;
    this.port = port;
    this.socket = new net.Socket();
    // Le vrai Poseidon utilise généralement l'ID 1 ou 2 (on laisse 1 par défaut)
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

  // --- LECTURE OPTIMISÉE ---
  async updateAll() {
    if (!this.isConnected) return false;
    try {
      // HACK TEMPORAIRE : On simule une température extérieure de 15°C (car on n'a pas de capteur réel)
      this.data.temperature = 15;

      // Lecture de la Cuve (DI 1 -> Adresse 0)
      const resNiveau = await this.client.readDiscreteInputs(
        MAPPING.NIVEAU_CUVE,
        1,
      );

      // HW Group met à "1" quand c'est On, et "0" quand c'est Off
      this.data.cuvePleine = resNiveau.response.body.valuesAsArray[0] === 1;

      // HACK TEMPORAIRE : On simule 505 impulsions (car on n'a pas de capteur réel)
      this.data.impulsions = 505;
      return true;
    } catch (err) {
      console.error("⚠️ [Poseidon] Erreur lecture:", err.message);
      return false;
    }
  }

  getTemperature() {
    return this.data.temperature;
  }
  isCuvePleine() {
    return this.data.cuvePleine;
  }
  getConsommationLitres() {
    return this.data.impulsions * LITRES_PAR_IMPULSION;
  }

  async setPompe(etat) {
    if (!this.isConnected) return;
    try {
      await this.client.writeSingleCoil(MAPPING.POMPE, etat);
    } catch (err) {
      console.error("Erreur Pompe:", err.message);
    }
  }

  async setReseauEau(utiliserPluie) {
    if (!this.isConnected) return;
    try {
      await this.client.writeSingleCoil(MAPPING.VANNE, utiliserPluie);
    } catch (err) {
      console.error("Erreur Vanne:", err.message);
    }
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
