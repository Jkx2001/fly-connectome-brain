import { Brain, PARAMETERS } from './brain.js';
import { World } from './world.js';
import { decodeConnectome } from './load-connectome.js';
import { CircuitBrain } from './circuit-brain.js';

let brain, world, timer = null, running = false, mode = 'measured', seed = 42;
let computeMs = 0, actions = [], trace = [], sent = 0;
let profile = 'circuit', assets, intervention = null;
function createBrain() {
  brain = profile === 'circuit' ? new CircuitBrain(assets.binary, assets.annotations, assets.manifest, assets.circuits, assets.signs, seed) : new Brain(assets.binary, assets.annotations, assets.manifest, seed);
  brain.setMode(mode); intervention = null;
}
function stop() { running = false; clearTimeout(timer); timer = null; }
function pump() { if (!running) return; tick(); timer = setTimeout(pump, Math.max(0, 20 - computeMs)); }
function start() { if (timer || !brain) return; running = true; timer = setTimeout(pump, 0); }
function snapshot() {
  if (!brain) return;
  postMessage({ type: 'state', world: world.snapshot(), running, mode, ticks: brain.ticks,
    motor: { ...brain.motor }, spikes: brain.totalSpikes, groups: Array.from(brain.groupCounts), computeMs,
    active: brain.n, edges: mode === 'disconnected' ? 0 : brain.e, parameters: brain.parameters || PARAMETERS,
    profile, readoutHz: brain.readoutHz || null, pulseFrames: intervention?.remaining || 0 });
}
function tick(force = false) {
  if (!brain) return;
  const t = performance.now();
  const sensors = world.sense(); brain.step(sensors, intervention || {}); world.step(brain.motor);
  if (intervention && --intervention.remaining <= 0) intervention = null;
  computeMs = computeMs * 0.9 + (performance.now() - t) * 0.1;
  if (brain.ticks % 10 === 0) trace.push({ tick: brain.ticks, x: world.fly.x, z: world.fly.z, left: brain.motor.left, right: brain.motor.right, spikes: brain.totalSpikes });
  if (trace.length > 18000) trace.shift();
  if (++sent % 5 === 0 || force === true) snapshot();
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      postMessage({ type: 'progress', message: 'Loading measured wiring…' });
      const responses = await Promise.all(['connectome.bin.gz', 'annotations.bin', 'manifest.json', 'circuits.json', 'circuit-signs.bin'].map(p => fetch(new URL(p, data.dataBase))));
      if (responses.some(r => !r.ok)) throw new Error('Cannot load local connectome assets');
      const [packed, annotations, manifest, circuitBytes, signBytes] = await Promise.all([responses[0].arrayBuffer(), responses[1].arrayBuffer(), responses[2].json(), responses[3].arrayBuffer(), responses[4].arrayBuffer()]);
      const binary = await decodeConnectome(packed, manifest.source);
      const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (await hash(circuitBytes) !== manifest.circuitsSha256) throw new Error('Circuit annotation SHA-256 integrity check failed');
      const circuits = JSON.parse(new TextDecoder().decode(circuitBytes));
      if (await hash(signBytes) !== circuits.transmitterSigns.sha256) throw new Error('Transmitter-sign SHA-256 integrity check failed');
      postMessage({ type: 'progress', message: 'Building 139,255 neural units…' });
      assets = { binary, annotations: new Uint8Array(annotations), manifest, circuits, signs: new Int8Array(signBytes) };
      createBrain(); world = new World(seed);
      postMessage({ type: 'ready', manifest }); snapshot(); start();
    } else if (data.type === 'toggle') { running ? stop() : start(); snapshot(); }
    else if (data.type === 'pause') { stop(); snapshot(); }
    else if (data.type === 'step') { stop(); tick(true); }
    else if (data.type === 'reset' || data.type === 'mode' || data.type === 'profile') {
      const resume = running; stop();
      if (data.type === 'profile') {
        if (!['circuit', 'legacy'].includes(data.profile)) throw new Error('Unknown dynamics profile');
        profile = data.profile; createBrain();
      }
      if (data.type === 'mode') { mode = data.mode; brain.setMode(mode); }
      if (data.seed !== undefined) seed = Number(data.seed) >>> 0;
      brain.reset(seed); world.reset(seed); actions = []; trace = []; computeMs = 0; intervention = null;
      postMessage({ type: 'reset' }); snapshot(); if (resume) start();
    } else if (data.type === 'probe') {
      if (profile !== 'circuit' || !['left','right'].includes(data.side)) return;
      brain.reset(seed); world.reset(seed); world.food = []; trace = []; computeMs = 0;
      actions = [{tick:0,type:'clear'}]; postMessage({type:'reset'});
      intervention = { indices: brain.steeringPools[data.side], rateHz: 100, remaining: 25 };
      actions.push({tick:brain.ticks,type:'probe',side:data.side,durationTicks:25,rateHz:100}); snapshot();
    } else if (data.type === 'action') {
      if (!world) return;
      const a = data.action;
      if (['food', 'wall', 'moveWall'].includes(a.type) && (!Number.isFinite(a.x) || !Number.isFinite(a.z))) return;
      if (a.type === 'light' && !Number.isFinite(a.value)) return;
      if (world.command(a)) actions.push({ tick: brain.ticks, ...a });
      snapshot();
    } else if (data.type === 'export') postMessage({ type: 'export', data: { schema: 2, seed, mode, profile, tick: brain.ticks, dt: 0.02, parameters: brain.parameters || PARAMETERS, source: brain.manifest.source, circuitsSha256: brain.manifest.circuitsSha256, actions, trace, world: world.snapshot(), traceLimit: 18000 } });
  } catch (err) { stop(); postMessage({ type: 'error', message: err.message }); }
};
