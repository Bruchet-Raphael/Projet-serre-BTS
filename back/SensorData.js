class SensorData {
  constructor() {
    this.temperature = null;
    this.h1 = null;
    this.h2 = null;
    this.h3 = null;
    this.humiditeMoyenne = null;
    this.humair = null;
    this.timestamp = new Date();
  }

  static parseNumber(v) {
    if (v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  static fromMonitor(monitor) {
    const obj = new SensorData();

    const s1 = monitor?.S?.S1 || {};
    obj.temperature = SensorData.parseNumber(s1.item1?.value ?? null);
    obj.humair = SensorData.parseNumber(s1.item2?.value ?? null);

    obj.h1 = SensorData.parseNumber(monitor?.AI?.AI1?.value ?? null);
    obj.h2 = SensorData.parseNumber(monitor?.AI?.AI2?.value ?? null);
    obj.h3 = SensorData.parseNumber(monitor?.AI?.AI3?.value ?? null);

    const hs = [obj.h1, obj.h2, obj.h3].filter(v => v !== null);
    obj.humiditeMoyenne = hs.length > 0
      ? Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 100) / 100
      : null;

    obj.timestamp = new Date();
    return obj;
  }

  toJSON() {
    return {
      temperature: this.temperature,
      h1: this.h1,
      h2: this.h2,
      h3: this.h3,
      humiditeMoyenne: this.humiditeMoyenne,
      humair: this.humair,
      timestamp: this.timestamp.toISOString()
    };
  }

  static store = [];
}

module.exports = SensorData;
