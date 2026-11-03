import { readFileSync } from 'node:fs';
import { loadBrain } from './load-brain.js';
import { World } from '../src/sim/world.js';

if (!process.argv[2]) throw new Error('Usage: node scripts/replay.js path/to/export.json');
const run = JSON.parse(readFileSync(process.argv[2]));
const brain = loadBrain(run.seed), world = new World(run.seed);
if (run.schema !== 1 || run.source.sha256 !== brain.manifest.source.sha256) throw new Error('Incompatible export or source hash');
brain.setMode(run.mode); brain.reset(run.seed);
let next = 0;
for (let tick = 0; tick <= run.tick; tick++) {
  while (next < run.actions.length && run.actions[next].tick === tick) world.command(run.actions[next++]);
  if (tick < run.tick) { brain.step(world.sense()); world.step(brain.motor); }
}
const actual = world.snapshot();
if (JSON.stringify(actual) !== JSON.stringify(run.world)) throw new Error('Replay differs from exported final world');
console.log(`Exact world replay matched: ${run.mode}, seed ${run.seed}, ${run.tick} steps.`);
