export class Chart { constructor(c, cfg) { if (!c) throw new Error('canvas inexistente'); Chart.n = (Chart.n || 0) + 1; this.cfg = cfg; } destroy() {} static register() {} }
export const registerables = [];
