import { loadBrain } from './load-brain.js';
import { World } from '../src/sim/world.js';

const brain = loadBrain();
for (const mode of ['measured', 'shuffled', 'disconnected']) {
  brain.setMode(mode); brain.reset(42);
  const world = new World(42); let spikes = 0, dn = 0;
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    brain.step(world.sense()); world.step(brain.motor);
    spikes += brain.totalSpikes; dn += brain.motor.left + brain.motor.right;
  }
  const elapsed = performance.now() - start;
  console.log(JSON.stringify({ mode, seed: 42, simulatedSeconds: world.time, millisecondsPerStep: elapsed / 1000, neurons: brain.n, edges: mode === 'disconnected' ? 0 : brain.e, meanSpikes: spikes / 1000, meanDescendingFraction: dn / 2000, distance: world.distance, foodConsumed: world.eaten, position: world.fly }));
}
