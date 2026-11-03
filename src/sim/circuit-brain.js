import { Brain, DT } from './brain.js';

// Equations and constants from Shiu & Spiller's MIT-licensed research model,
// model.py @ 91bdd1e7dcf193f3e7ca5a8933497fcef63b7960.
// This browser adaptation is NOT a validated reproduction of their results.
export const CIRCUIT_PARAMETERS = Object.freeze({
  profile: 'circuit-v1', stepMs: 0.2, frameMs: 20, restMv: -52, thresholdMv: -45,
  resetMv: -52, membraneTauMs: 20, synapseTauMs: 5, refractoryMs: 2.2,
  delayMs: 1.8, weightMvPerSynapse: 0.275, maxInputHz: 150, inputWeightMv: 68.75,
  idleToleranceMv: 1e-8,
});

export function integrateLif(v, g, dtMs = 0.2) {
  const a = Math.exp(-dtMs / 20), b = Math.exp(-dtMs / 5);
  return { v: v * a + g * (5 / 15) * (a - b), g: g * b };
}

export class CircuitBrain extends Brain {
  constructor(buffer, annotations, manifest, circuits, signs, seed = 42, stepMs = 0.2) {
    super(buffer, annotations, manifest, seed, { rawSynapseCounts: true });
    if (signs.length !== this.n) throw new Error('Transmitter-sign annotation length mismatch');
    if (![0.1, 0.2].includes(stepMs)) throw new Error('Unsupported circuit timestep');
    this.circuits = circuits; this.stepMs = stepMs;
    this.parameters = { ...CIRCUIT_PARAMETERS, stepMs };
    this.sensoryPools = Object.fromEntries(['left','right'].map(side => [side, circuits.groups.ORN_DM1.filter(n => n.side === side).map(n => n.index)]));
    // DNa02 alone supplies steering. DNp09 is an explicitly provisional
    // walking readout. Accept an exact hemibrain label only when cell_type
    // is absent; explicitly conflicting DNp71/DNp09 labels are excluded.
    const matched = (n, name) => n.cellType === name || (!n.cellType && n.hemibrainType === name);
    this.steeringPools = Object.fromEntries(['left','right'].map(side => [side, circuits.groups.DNa02.filter(n => matched(n, 'DNa02') && n.side === side).map(n => n.index)]));
    this.walkingPool = circuits.groups.DNp09.filter(n => matched(n, 'DNp09')).map(n => n.index);
    for (let pre = 0; pre < this.n; pre++) for (let j = this.rows[pre]; j < this.rows[pre + 1]; j++) this.weights[j] = Math.abs(this.weights[j]) * signs[pre] * 0.275;
    this.g = new Float64Array(this.n); this.voltage = new Float64Array(this.n);
    this.until = new Uint32Array(this.n); this.activeMask = new Uint8Array(this.n);
    this.spikeCounts = new Uint32Array(this.n); this.activeList = [];
    this.silenced = new Set(); this.reset(seed);
  }
  reset(seed = 42) {
    super.reset(seed);
    if (!this.g) return;
    this.g.fill(0); this.voltage.fill(0); this.until.fill(0); this.activeMask.fill(0);
    this.spikeCounts.fill(0); this.activeList = []; this.microTick = 0;
    this.delaySteps = Math.round(1.8 / this.stepMs);
    this.queue = Array.from({ length: this.delaySteps + 1 }, () => []);
    this.silenced = new Set(); this.motor = { left: 0, right: 0, forward: 0 };
    this.readoutHz = { left: 0, right: 0, walking: 0 }; this.totalEvents = 0;
  }
  activate(i) { if (!this.activeMask[i]) { this.activeMask[i] = 1; this.activeList.push(i); } }
  step(sensors = {}, intervention = {}) {
    this.spikeCounts.fill(0); this.spikes.fill(0); this.groupCounts.fill(0);
    const dt = this.stepMs, steps = Math.round(DT * 1000 / dt);
    const a = Math.exp(-dt / 20), b = Math.exp(-dt / 5), factor = (5 / 15) * (a - b);
    const external = [];
    for (const side of ['left', 'right']) {
      const strength = Math.max(0, Math.min(1, sensors[side === 'left' ? 'odorLeft' : 'odorRight'] || 0));
      for (const i of this.sensoryPools[side]) external.push([i, strength * 150 * dt / 1000]);
    }
    const direct = intervention.indices || [];
    for (const i of direct) {
      if (!Number.isInteger(i) || i < 0 || i >= this.n) throw new Error('Invalid intervention neuron');
      external.push([i, Math.max(0, Math.min(1000, intervention.rateHz || 0)) * dt / 1000]);
    }
    const externallyDriven = new Set(external.filter(([, p]) => p > 0).map(([i]) => i));
    for (let step = 0; step < steps; step++) {
      const now = this.microTick;
      const arrivals = this.queue[now % this.queue.length];
      if (this.mode !== 'disconnected') for (const pre of arrivals) {
        // Silencing means no outgoing synaptic transmission, following the
        // reference model. It is applied at arrival as well as scheduling.
        if (this.silenced.has(pre)) continue;
        for (let j = this.rows[pre]; j < this.rows[pre + 1]; j++) {
          const target = this.targets[j]; this.g[target] += this.weights[j]; this.activate(target);
        }
      }
      arrivals.length = 0;
      // Exact subthreshold integration; refractory state freezes both ODEs,
      // as in the reference. Delayed arrivals can accumulate while frozen.
      for (const i of this.activeList) if (now >= this.until[i]) {
        this.voltage[i] = this.voltage[i] * a + this.g[i] * factor; this.g[i] *= b;
      }
      for (const [i, probability] of external) if (this.rng() < probability) {
        this.voltage[i] += 68.75; this.activate(i);
      }
      const due = this.queue[(now + this.delaySteps) % this.queue.length];
      let kept = 0;
      for (const i of this.activeList) {
        if (this.voltage[i] > 7 && now >= this.until[i]) {
          this.spikeCounts[i]++; this.voltage[i] = 0; this.g[i] = 0;
          this.until[i] = now + (externallyDriven.has(i) ? 0 : Math.round(2.2 / dt));
          if (!this.silenced.has(i)) due.push(i);
        }
        if (Math.abs(this.voltage[i]) > 1e-8 || Math.abs(this.g[i]) > 1e-8) this.activeList[kept++] = i;
        else { this.voltage[i] = 0; this.g[i] = 0; this.activeMask[i] = 0; }
      }
      this.activeList.length = kept; this.microTick++;
    }
    this.totalSpikes = 0; this.totalEvents = 0;
    for (let i = 0; i < this.n; i++) if (this.spikeCounts[i]) {
      this.spikes[i] = 1; this.totalSpikes++; this.totalEvents += this.spikeCounts[i]; this.groupCounts[this.annotations[i * 2]]++;
    }
    const hz = ids => ids.length ? ids.reduce((sum, i) => sum + this.spikeCounts[i], 0) / ids.length / DT : 0;
    this.readoutHz = { left: hz(this.steeringPools.left), right: hz(this.steeringPools.right), walking: hz(this.walkingPool) };
    // Scaling is an artificial body decoder, not part of the research model.
    // No sensory gradient or target position is available here.
    for (const side of ['left','right']) this.motor[side] += (this.readoutHz[side] / 100 - this.motor[side]) * 0.12;
    this.motor.forward += (this.readoutHz.walking / 50 - this.motor.forward) * 0.12;
    this.ticks++; return this.motor;
  }
}
