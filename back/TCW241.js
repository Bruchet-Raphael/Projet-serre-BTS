class TCW241 {
    constructor() {
        this.temperature = null;
        this.h1 = null;
        this.h2 = null;
        this.h3 = null;
        this.humiditeMoyenne = null;
        this.humair = null;
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
    const temp = this.temperature;
    const hum = this.humiditeMoyenne;
    const humair = this.humair;

    const relays = await this.getRelaysState(client);

    console.log("Régulation :", { temp, hum, consigne });

    if(consigne.relay0 == 0){
        // ============================
        // 💧 RÉGULATION BRUMISATION
        // ============================
        if (consigne.humiditeair !== null && humair !== null) {

            // Humidité trop basse → activer BRUMISATION (relay1)
            if (humair < consigne.humidite_air - 2) {
                await client.writeSingleCoil(100, true);
            }

            // Humidité trop haute → couper brumisation
            if (humair > consigne.humidite + 2) {
                await client.writeSingleCoil(100, false);
            }

            // Humidité OK → OFF
            if (humair >= consigne.humidite - 1 && hum <= consigne.humidite + 1) {
                await client.writeSingleCoil(100, false);
            }
        }
    }
    if(consigne.relay0 == 1){
        await client.writeSingleCoil(100, false);
    }
    if(consigne.relay0 == 2){
        await client.writeSingleCoil(100, true);
    }

    if(consigne.relay1 == 0){
        // ============================
        // 💧 RÉGULATION AROSAGE
        // ============================
        if (consigne.humidite !== null && hum !== null) {

            // Humidité trop basse → activer BRUMISATION (relay1)
            if (hum < consigne.humidite - 2) {
                await client.writeSingleCoil(101, true);
            }

            // Humidité trop haute → couper brumisation
            if (hum > consigne.humidite + 2) {
                await client.writeSingleCoil(101, false);
            }

            // Humidité OK → OFF
            if (hum >= consigne.humidite - 1 && hum <= consigne.humidite + 1) {
                await client.writeSingleCoil(101, false);
            }
        }
    }
    if(consigne.relay1 == 1){
        await client.writeSingleCoil(101, false);
    }
    if(consigne.relay1 == 2){
        await client.writeSingleCoil(101, true);
    }


    
// ----------------------------
// RÉGULATION TEMPÉRATURE - CHAUFFAGE (relay2 -> coil 102)
// ----------------------------
if (consigne.relay2 == 0) {
    // automatique : la logique est appliquée dans le bloc température ci-dessous
    // (on n'écrit rien ici pour éviter les écritures redondantes)
}
if (consigne.relay2 == 1) {
    await client.writeSingleCoil(102, false);
}
if (consigne.relay2 == 2) {
    await client.writeSingleCoil(102, true);
}

// ----------------------------
// RÉGULATION TEMPÉRATURE - FENÊTRE (relay3 -> coil 103)
// ----------------------------
if (consigne.relay3 == 0) {
    // automatique : la logique est appliquée dans le bloc température ci-dessous
}
if (consigne.relay3 == 1) {
    await client.writeSingleCoil(103, false);
}
if (consigne.relay3 == 2) {
    await client.writeSingleCoil(103, true);
}

// ----------------------------
// LOGIQUE DE RÉGULATION SELON LA TEMPÉRATURE
// ----------------------------
if (consigne.temperature !== null && temp !== null) {

    // Trop froid → activer CHAUFFAGE (coil 102) et fermer FENÊTRE (coil 103)
    if (temp < consigne.temperature - 0.5) {
        if (consigne.relay2 == 0) {
            await client.writeSingleCoil(102, true);  // Chauffage ON
        }
        if (consigne.relay3 == 0) {
            await client.writeSingleCoil(103, false); // Fenêtre FERMÉE
        }
    }

    // Trop chaud → couper CHAUFFAGE et ouvrir FENÊTRE
    if (temp > consigne.temperature + 0.5) {
        if (consigne.relay2 == 0) {
            await client.writeSingleCoil(102, false); // Chauffage OFF
        }
        if (consigne.relay3 == 0) {
            await client.writeSingleCoil(103, true);  // Fenêtre OUVERTE
        }
    }

    // Température OK → tout OFF
    if (temp >= consigne.temperature - 0.2 && temp <= consigne.temperature + 0.2) {
        if (consigne.relay2 == 0) {
            await client.writeSingleCoil(102, false); // Chauffage OFF
        }
        if (consigne.relay3 == 0) {
            await client.writeSingleCoil(103, false); // Fenêtre FERMÉE
        }
    }
}


    

    

    return true;
}

}



module.exports = TCW241;
