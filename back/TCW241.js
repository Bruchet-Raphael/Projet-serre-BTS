class TCW241 {
    constructor() {
        this.temperature = null;
        this.h1 = null;
        this.h2 = null;
        this.h3 = null;
        this.humiditeSol = null;
        this.humair = null;
        this.r1 = null;
        this.r2 = null;
        this.r3 = null;
        this.r4 = null;
        this.timestamp = new Date();
    }

    async getTemp(client) {
        const reg = await client.readHoldingRegisters(19800, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[0], 0);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[1], 2);
        return buf.readFloatBE(0);
    }

    async getH1(client) {
        const reg = await client.readHoldingRegisters(17500, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[0], 0);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[1], 2);
        const volts = buf.readFloatBE(0);
        return (volts / 5) * 100;
    }

    async getH2(client) {
        const reg = await client.readHoldingRegisters(17502, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[0], 0);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[1], 2);
        const volts = buf.readFloatBE(0);
        return (volts / 5) * 100;
    }

    async getH3(client) {
        const reg = await client.readHoldingRegisters(17504, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[0], 0);
        buf.writeUInt16BE(reg.response._body.valuesAsArray[1], 2);
        const volts = buf.readFloatBE(0);
        return (volts / 5) * 100;
    }

async setRelay1(client) {
  const s = await client.readCoils(100, 1);
  await client.writeSingleCoil(100, !s.response._body.valuesAsArray[0]);
}

async setRelay2(client) {
  const s = await client.readCoils(101, 1);
  await client.writeSingleCoil(101, !s.response._body.valuesAsArray[0]);
}

async setRelay3(client) {
  const s = await client.readCoils(102, 1);
  await client.writeSingleCoil(102, !s.response._body.valuesAsArray[0]);
}

async getHumAir(client){
    const reg = await client.readHoldingRegisters(19802, 2);
    const buf = Buffer.alloc(4);
    buf.writeUInt16BE(reg.response._body.valuesAsArray[0], 0);
    buf.writeUInt16BE(reg.response._body.valuesAsArray[1], 2);
    return buf.readFloatBE(0); 
}

async setRelay4(client) {
  const s = await client.readCoils(103, 1);
  await client.writeSingleCoil(103, !s.response._body.valuesAsArray[0]);
}


    async getRelaysState(client) {
    const r1 = await client.readCoils(100, 1);
    const r2 = await client.readCoils(101, 1);
    const r3 = await client.readCoils(102, 1);
    const r4 = await client.readCoils(103, 1);

    return {
        relay1: r1.response._body.valuesAsArray[0],
        relay2: r2.response._body.valuesAsArray[0],
        relay3: r3.response._body.valuesAsArray[0],
        relay4: r4.response._body.valuesAsArray[0]
    };
}


    async getAll(client) {
    const temperature = await this.getTemp(client);
    const h1 = await this.getH1(client);
    const h2 = await this.getH2(client);
    const h3 = await this.getH3(client);
    const humair = await this.getHumAir(client);
    const relays = await this.getRelaysState(client);

    this.setTemperature(temperature);
    this.setHumidites(h1, h2, h3);

    return {
        temperature: this.temperature,
        h1: this.h1,
        h2: this.h2,
        h3: this.h3,
        humiditeSol: this.humiditeMoyenne,
        humair : this.humair,
        relays,
        timestamp: this.timestamp
    };
}

    setTemperature(value) {
        this.temperature = value;
        this.timestamp = new Date();
    }

    setHumAir(value){
        this.humair = value;
    }

    setHumidites(h1, h2, h3) {
        this.h1 = h1;
        this.h2 = h2;
        this.h3 = h3;
        this.humiditeMoyenne = (h1 + h2 + h3) / 3;
        this.timestamp = new Date();
    }

    toJSON() {
        return {
            temperature: this.temperature,
            h1: this.h1,
            h2: this.h2,
            h3: this.h3,
            humiditeSol: this.humiditeMoyenne,
            timestamp: this.timestamp
        };
    }
async regulate(client, consigne) {
    const temp   = this.temperature;
    const hum    = this.humiditeMoyenne;
    const humair = this.humair;

    console.log("Régulation :", { temp, hum, humair, consigne });

    // Helper pour convertir les modes
    const normalizeMode = (mode) => {
        if (!mode) return "auto";
        if (mode === "active") return "on";
        if (mode === "inactive") return "off";
        return mode; // auto / on / off
    };

    // ============================
    // 🌱 IRRIGATION (coil 101)
    // ============================
    const irrigationMode = normalizeMode(consigne.irrigation.mode);
    const irrigationThreshold = consigne.irrigation.threshold;

    if (irrigationMode === "auto" && hum != null) {
        if (hum < irrigationThreshold - 2) {
            await client.writeSingleCoil(101, true);
        } else if (hum > irrigationThreshold + 2) {
            await client.writeSingleCoil(101, false);
        } else {
            await client.writeSingleCoil(101, false);
        }
    } else if (irrigationMode === "on") {
        await client.writeSingleCoil(101, true);
    } else if (irrigationMode === "off") {
        await client.writeSingleCoil(101, false);
    }

    // ============================
    // 💧 BRUMISATION (coil 100)
    // ============================
    const mistingMode = normalizeMode(consigne.misting.mode);
    const mistingTarget = consigne.misting.intensity;

    if (mistingMode === "auto" && humair != null) {
        if (humair < mistingTarget - 2) {
            await client.writeSingleCoil(100, true);
        } else if (humair > mistingTarget + 2) {
            await client.writeSingleCoil(100, false);
        } else {
            await client.writeSingleCoil(100, false);
        }
    } else if (mistingMode === "on") {
        await client.writeSingleCoil(100, true);
    } else if (mistingMode === "off") {
        await client.writeSingleCoil(100, false);
    }

    // ============================
    // 🔥 CHAUFFAGE (coil 102)
    // 🌬️ VENTILATION (coil 103)
    // ============================
    const heatingMode = normalizeMode(consigne.heating.mode);
    const heatingTarget = consigne.heating.target;

    const ventilationMode = normalizeMode(consigne.ventilation.mode);

    // Modes forcés
    if (heatingMode === "on") await client.writeSingleCoil(102, true);
    if (heatingMode === "off") await client.writeSingleCoil(102, false);

    if (ventilationMode === "on") await client.writeSingleCoil(103, true);
    if (ventilationMode === "off") await client.writeSingleCoil(103, false);

    // Logique auto température
    if (temp != null && heatingTarget != null) {

        // Trop froid
        if (temp < heatingTarget - 0.5) {
            if (heatingMode === "auto") await client.writeSingleCoil(102, true);
            if (ventilationMode === "auto") await client.writeSingleCoil(103, false);
        }

        // Trop chaud
        else if (temp > heatingTarget + 0.5) {
            if (heatingMode === "auto") await client.writeSingleCoil(102, false);
            if (ventilationMode === "auto") await client.writeSingleCoil(103, true);
        }

        // Zone OK
        else {
            if (heatingMode === "auto") await client.writeSingleCoil(102, false);
            if (ventilationMode === "auto") await client.writeSingleCoil(103, false);
        }
    }

    return true;
}

 static parseNumber(v) {
    if (v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  static fromMonitor(monitor) {
    const obj = new TCW241();

    const s1 = monitor?.S?.S1 || {};
    obj.temperature = TCW241.parseNumber(s1.item1?.value ?? null);
    obj.humair = TCW241.parseNumber(s1.item2?.value ?? null);

    obj.h1 = TCW241.parseNumber(monitor?.AI?.AI1?.value ?? null);
    obj.h2 = TCW241.parseNumber(monitor?.AI?.AI2?.value ?? null);
    obj.h3 = TCW241.parseNumber(monitor?.AI?.AI3?.value ?? null);

    obj.r1 = TCW241.parseNumber(monitor?.R?.R1?.valuebin ?? null);
    obj.r2 = TCW241.parseNumber(monitor?.R?.R2?.valuebin ?? null);
    obj.r3 = TCW241.parseNumber(monitor?.R?.R3?.valuebin ?? null);
    obj.r4 = TCW241.parseNumber(monitor?.R?.R4?.valuebin ?? null);

    const hs = [obj.h1, obj.h2, obj.h3].filter(v => v !== null);
    obj.humiditeSol = (hs.length > 0
      ? Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 100) / 5
      : null)

    obj.timestamp = new Date();
    return obj;
  }

  toJSON() {
    return {
      temperature: this.temperature,
      h1: this.h1/5*100,
      h2: this.h2/5*100,
      h3: this.h3/5*100,
      humiditeSol: this.humiditeSol/5*100,
      humair: this.humair,
      r1: this.r1,
      r2: this.r2,
      r3: this.r3,
      r4: this.r4,
      timestamp: this.timestamp.toISOString()
    };
  }

    static store = [];
}



module.exports = TCW241;
