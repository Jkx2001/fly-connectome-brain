import { Brain, PARAMETERS } from './brain.js';
import { World } from './world.js';
import { decodeConnectome } from './load-connectome.js';

let brain, world, timer = null, running = false, mode = 'measured', seed = 42;
let computeMs = 0, actions = [], trace = [], sent = 0;
function stop() { running = false; clearInterval(timer); timer = null; }
function start() { if (timer || !brain) return; running = true; timer = setInterval(tick, 20); }
function snapshot() {
  if (!brain) return;
  postMessage({ type: 'state', world: world.snapshot(), running, mode, ticks: brain.ticks,
    motor: { ...brain.motor }, spikes: brain.totalSpikes, groups: Array.from(brain.groupCounts), computeMs,
    active: brain.n, edges: mode === 'disconnected' ? 0 : brain.e, parameters: PARAMETERS });
}
function tick(force = false) {
  if (!brain) return;
  const t = performance.now();
  const sensors = world.sense(); brain.step(sensors); world.step(brain.motor);
  computeMs = computeMs * 0.9 + (performance.now() - t) * 0.1;
  if (brain.ticks % 10 === 0) trace.push({ tick: brain.ticks, x: world.fly.x, z: world.fly.z, left: brain.motor.left, right: brain.motor.right, spikes: brain.totalSpikes });
  if (trace.length > 18000) trace.shift();
  if (++sent % 5 === 0 || force === true) snapshot();
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      postMessage({ type: 'progress', message: 'Loading measured wiring…' });
      const responses = await Promise.all(['connectome.bin.gz', 'annotations.bin', 'manifest.json'].map(p => fetch(new URL(p, data.dataBase))));
      if (responses.some(r => !r.ok)) throw new Error('Cannot load local connectome assets');
      const [packed, annotations, manifest] = await Promise.all([responses[0].arrayBuffer(), responses[1].arrayBuffer(), responses[2].json()]);
      const binary = await decodeConnectome(packed, manifest.source);
      postMessage({ type: 'progress', message: 'Building 139,255 neural units…' });
      brain = new Brain(binary, new Uint8Array(annotations), manifest, seed); world = new World(seed);
      postMessage({ type: 'ready', manifest }); snapshot(); start();
    } else if (data.type === 'toggle') { running ? stop() : start(); snapshot(); }
    else if (data.type === 'pause') { stop(); snapshot(); }
    else if (data.type === 'step') { stop(); tick(true); }
    else if (data.type === 'reset' || data.type === 'mode') {
      const resume = running; stop();
      if (data.type === 'mode') { mode = data.mode; brain.setMode(mode); }
      if (data.seed !== undefined) seed = Number(data.seed) >>> 0;
      brain.reset(seed); world.reset(seed); actions = []; trace = []; computeMs = 0;
      postMessage({ type: 'reset' }); snapshot(); if (resume) start();
    } else if (data.type === 'action') {
      if (!world) return;
      const a = data.action;
      if (['food', 'wall', 'moveWall'].includes(a.type) && (!Number.isFinite(a.x) || !Number.isFinite(a.z))) return;
      if (a.type === 'light' && !Number.isFinite(a.value)) return;
      if (world.command(a)) actions.push({ tick: brain.ticks, ...a });
      snapshot();
    } else if (data.type === 'export') postMessage({ type: 'export', data: { schema: 1, seed, mode, tick: brain.ticks, dt: 0.02, parameters: PARAMETERS, source: brain.manifest.source, actions, trace, world: world.snapshot(), traceLimit: 18000 } });
  } catch (err) { stop(); postMessage({ type: 'error', message: err.message }); }
};
