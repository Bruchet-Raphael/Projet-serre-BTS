class TCW241 {
    constructor() {
        this.temperature = null;
        this.h1 = null;
        this.h2 = null;
        this.h3 = null;
        this.humiditeMoyenne = null;
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

    setTemperature(value) {
        this.temperature = value;
        this.timestamp = new Date();
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
            humidite1: this.h1,
            humidite2: this.h2,
            humidite3: this.h3,
            humiditeSol: this.humiditeMoyenne,
            timestamp: this.timestamp
        };
    }
}

module.exports = TCW241;
