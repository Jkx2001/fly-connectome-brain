import { readFileSync } from 'node:fs';
import { loadBrain, loadCircuitBrain } from './load-brain.js';
import { World } from '../src/sim/world.js';

if (!process.argv[2]) throw new Error('Usage: node scripts/replay.js path/to/export.json');
const run = JSON.parse(readFileSync(process.argv[2]));
const brain = run.profile === 'circuit' ? loadCircuitBrain(run.seed) : loadBrain(run.seed), world = new World(run.seed);
if (![1,2].includes(run.schema) || run.source.sha256 !== brain.manifest.source.sha256) throw new Error('Incompatible export or source hash');
if (run.profile === 'circuit' && run.circuitsSha256 !== brain.manifest.circuitsSha256) throw new Error('Circuit annotation version mismatch');
brain.setMode(run.mode); brain.reset(run.seed);
let next = 0, intervention = null;
for (let tick = 0; tick <= run.tick; tick++) {
  while (next < run.actions.length && run.actions[next].tick === tick) {
    const action = run.actions[next++];
    if (action.type === 'probe') intervention = {indices:brain.steeringPools[action.side],rateHz:action.rateHz,remaining:action.durationTicks};
    else world.command(action);
  }
  if (tick < run.tick) { brain.step(world.sense(), intervention || {}); world.step(brain.motor); if (intervention && --intervention.remaining <= 0) intervention = null; }
}
const actual = world.snapshot();
if (JSON.stringify(actual) !== JSON.stringify(run.world)) throw new Error('Replay differs from exported final world');
console.log(`Exact world replay matched: ${run.mode}, seed ${run.seed}, ${run.tick} steps.`);
