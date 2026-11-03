import { random } from './random.js';

export const DT = 0.02;
export const PARAMETERS = Object.freeze({ leak: 0.82, threshold: 1, refractorySteps: 2, synapticGain: 18, stimulusAmplitude: 0.85 });

// One LIF unit per recorded neuron. All retained neuron-pair edges are used.
// Model time is fixed at 20 ms per tick, independent of render frame rate.
export class Brain {
  constructor(buffer, annotations, manifest, seed = 42) {
    const view = new DataView(buffer);
    this.n = view.getUint32(0, true);
    this.e = view.getUint32(4, true);
    if (this.n !== manifest.neurons || this.e !== manifest.edges || buffer.byteLength !== 8 + this.e * 12 + this.n * 3) throw new Error('Connectome length/header mismatch');
    if (annotations.length !== this.n * 2) throw new Error('Annotation length mismatch');
    this.manifest = manifest;
    this.annotations = annotations;
    this.rows = new Uint32Array(this.n + 1);
    this.targets = new Uint32Array(this.e);
    this.weights = new Float32Array(this.e);
    this.originalTargets = new Uint32Array(this.e);
    const incoming = new Float64Array(this.n);
    let prev = -1;
    for (let j = 0; j < this.e; j++) {
      const at = 8 + j * 12, pre = view.getUint32(at, true), post = view.getUint32(at + 4, true), w = view.getFloat32(at + 8, true);
      if (pre >= this.n || post >= this.n || pre < prev || !Number.isFinite(w)) throw new Error('Invalid or unsorted connectome edge');
      prev = pre;
      this.rows[pre + 1]++;
      this.targets[j] = this.originalTargets[j] = post;
      this.weights[j] = w;
      incoming[post] += Math.abs(w);
    }
    for (let i = 1; i <= this.n; i++) this.rows[i] += this.rows[i - 1];
    // Incoming absolute-weight normalization is a modeling assumption, not
    // a measured physiological synaptic efficacy. Negative weights retained.
    for (let j = 0; j < this.e; j++) this.weights[j] *= PARAMETERS.synapticGain / Math.max(1, incoming[this.targets[j]]);
    this.v = new Float32Array(this.n);
    this.refractory = new Uint8Array(this.n);
    this.spikes = new Uint8Array(this.n);
    this.input = new Float32Array(this.n);
    this.groupCounts = new Uint32Array(manifest.groups.length);
    this.mode = 'measured';
    this.reset(seed);
  }

  setMode(mode) {
    if (!['measured', 'shuffled', 'disconnected'].includes(mode)) throw new Error('Unknown wiring mode');
    this.mode = mode;
    this.targets.set(this.originalTargets);
    if (mode === 'shuffled') {
      // Deterministic postsynaptic-label permutation: all edges retained,
      // source outdegree and destination indegree distribution preserved.
      // Neuron annotations and sensory/readout labels stay fixed.
      const rng = random(1986), permutation = Uint32Array.from({ length: this.n }, (_, i) => i);
      for (let i = this.n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
      }
      for (let j = 0; j < this.e; j++) this.targets[j] = permutation[this.originalTargets[j]];
    }
  }

  reset(seed = 42) {
    this.rng = random(seed); this.v.fill(0); this.spikes.fill(0);
    this.refractory.fill(0); this.input.fill(0); this.groupCounts.fill(0);
    this.motor = { left: 0, right: 0 }; this.ticks = 0; this.totalSpikes = 0;
  }

  step(sensors) {
    this.input.fill(0);
    if (this.mode !== 'disconnected') {
      for (let i = 0; i < this.n; i++) {
        if (!this.spikes[i]) continue;
        for (let j = this.rows[i]; j < this.rows[i + 1]; j++) this.input[this.targets[j]] += this.weights[j];
      }
    }
    // Uniform Bernoulli sensory drive within annotated pools. These are
    // artificial sensory encoders, not receptor/glomerulus-specific models.
    const pools = this.manifest.pools;
    for (const key of ['odorLeft', 'odorRight', 'visionLeft', 'visionRight', 'touchLeft', 'touchRight', 'taste']) {
      const strength = Math.max(0, Math.min(1, sensors[key] || 0));
      for (const i of pools[key]) if (this.rng() < strength) this.input[i] += PARAMETERS.stimulusAmplitude;
    }
    this.groupCounts.fill(0);
    this.totalSpikes = 0;
    for (let i = 0; i < this.n; i++) {
      this.spikes[i] = 0;
      if (this.refractory[i]) { this.refractory[i]--; this.v[i] = 0; continue; }
      this.v[i] = Math.max(-1, this.v[i] * PARAMETERS.leak + this.input[i]);
      if (this.v[i] >= PARAMETERS.threshold) {
        this.spikes[i] = 1; this.v[i] = 0; this.refractory[i] = PARAMETERS.refractorySteps;
        this.groupCounts[this.annotations[i * 2]]++; this.totalSpikes++;
      }
    }
    for (const side of ['left', 'right']) {
      const ids = pools[side === 'left' ? 'motorLeft' : 'motorRight'];
      let sum = 0; for (const i of ids) sum += this.spikes[i];
      const fraction = ids.length ? sum / ids.length : 0;
      this.motor[side] += (fraction - this.motor[side]) * 0.12;
    }
    this.ticks++;
    return this.motor;
  }
}
