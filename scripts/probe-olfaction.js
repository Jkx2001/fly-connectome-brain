import { writeFileSync } from 'node:fs';
import { loadCircuitBrain } from './load-brain.js';

const brain = loadCircuitBrain(), results = [];
const seeds = process.argv.includes('--quick') ? [42] : [17,42,91];
for (const seed of seeds) for (const condition of ['no-odor','left-odor','right-odor','bilateral-odor','disconnected-left','silenced-ORN-left','DNa02-left','DNa02-right']) {
  brain.reset(seed); brain.setMode(condition === 'disconnected-left' ? 'disconnected' : 'measured');
  const sensors = { odorLeft: condition.includes('left') && !condition.startsWith('DNa02') ? .6 : 0, odorRight: ['right-odor','bilateral-odor'].includes(condition) ? .6 : 0 };
  if (condition === 'bilateral-odor') sensors.odorLeft = .6;
  if (condition === 'silenced-ORN-left') for (const n of brain.circuits.groups.ORN_DM1) brain.silenced.add(n.index);
  const injection = condition.startsWith('DNa02') ? {indices:brain.steeringPools[condition.endsWith('left') ? 'left' : 'right'],rateHz:100} : {};
  const counts = Object.fromEntries(Object.keys(brain.circuits.groups).map(g => [g,0]));
  let dnLeft=0,dnRight=0,total=0,maxActive=0;
  const start = performance.now(), frames = 25;
  for (let f=0;f<frames;f++) {
    brain.step(sensors,injection);
    for (const [name,members] of Object.entries(brain.circuits.groups)) for (const n of members) counts[name]+=brain.spikeCounts[n.index];
    for (const i of brain.steeringPools.left) dnLeft+=brain.spikeCounts[i];
    for (const i of brain.steeringPools.right) dnRight+=brain.spikeCounts[i];
    total+=brain.totalEvents; maxActive=Math.max(maxActive,brain.totalSpikes);
  }
  const duration=frames*.02;
  const result={seed,condition,durationSeconds:duration,mode:brain.mode,millisecondsPerFrame:(performance.now()-start)/frames,totalSpikeEvents:total,maxSpikingNeuronsPerFrame:maxActive,meanHz:Object.fromEntries(Object.entries(counts).map(([g,n])=>[g,n/brain.circuits.groups[g].length/duration])),DNa02Hz:{left:dnLeft/duration,right:dnRight/duration}};
  results.push(result);console.log(JSON.stringify(result));
}
if (process.argv.includes('--save')) writeFileSync(new URL('../docs/olfaction-results.json', import.meta.url), JSON.stringify({schema:1,parameters:brain.parameters,annotationSource:brain.circuits.source,researchModel:brain.circuits.researchModel,graph:brain.manifest.source,results},null,2)+'\n');
