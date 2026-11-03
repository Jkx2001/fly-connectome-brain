import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrain } from '../scripts/load-brain.js';
import { World, decodeMotor } from '../src/sim/world.js';

test('full data integrity, sensory annotations, and propagation controls', () => {
  const brain = loadBrain();
  assert.equal(brain.n, 139255); assert.equal(brain.e, 2698236);
  assert.equal(brain.rows[brain.n], brain.e);
  assert.equal(brain.manifest.pools.motorLeft.length, 647);
  assert.equal(brain.manifest.pools.motorRight.length, 650);
  assert.ok(brain.weights.some(w => w < 0), 'inhibitory weights retained');
  const results = {};
  for (const mode of ['measured', 'shuffled', 'disconnected']) {
    brain.setMode(mode); brain.reset(42); const world = new World(42);
    for (let i = 0; i < 180; i++) {brain.step(world.sense());world.step(brain.motor);}
    results[mode] = { spikes: brain.totalSpikes, motor: {...brain.motor}, distance: world.distance };
    assert.ok(Number.isFinite(world.fly.x)); assert.ok(!world.blocked(world.fly.x,world.fly.z));
    if(mode === 'disconnected') {
      assert.equal(brain.groupCounts[9], 0, 'descending neurons are not directly stimulated');
      assert.equal(world.distance, 0, 'no scripted locomotion with disconnected wiring');
      assert.ok(brain.totalSpikes > 0, 'sensory units still respond');
    }
  }
  assert.ok(results.measured.distance > 0, 'measured connectivity produces motor activity');
  assert.notDeepEqual(results.measured, results.shuffled);
});

test('same seed and action ticks reproduce full-brain state after reset', () => {
  const brain = loadBrain(17);
  function trial() {
    brain.reset(17); const world = new World(17);
    for(let i=0;i<120;i++) {
      if(i===20)world.command({type:'food',x:1,z:2});
      if(i===40)world.command({type:'touch'});
      brain.step(world.sense());world.step(brain.motor);
    }
    return {world:world.snapshot(),voltage:brain.v.slice(),spikes:brain.spikes.slice()};
  }
  assert.deepEqual(trial(),trial());
});

test('collision constraints and wall dragging cannot push a wall through the fly', () => {
  const world = new World();world.fly={x:4.82,z:3,heading:0,speed:0};
  for(let i=0;i<100;i++)world.step({left:.12,right:.12});
  assert.ok(world.fly.x <= 4.84);
  const w=world.walls[0];const before={...w};
  assert.equal(world.command({type:'moveWall',id:w.id,x:world.fly.x,z:world.fly.z}),false);
  assert.deepEqual(w,before);
  assert.equal(world.command({type:'food',x:6,z:0}),false);
});

test('motor decoder depends only on descending outputs and stops at zero', () => {
  assert.deepEqual(decodeMotor({left:0,right:0}),{speed:0,turn:0});
  assert.ok(decodeMotor({left:.02,right:.08}).turn > 0);
  assert.ok(decodeMotor({left:.08,right:.02}).turn < 0);
  assert.deepEqual(decodeMotor({left:.02,right:.08,foodX:200}),decodeMotor({left:.02,right:.08}));
});
