import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBrain, integrateLif } from '../src/sim/circuit-brain.js';
import { loadCircuitBrain } from '../scripts/load-brain.js';
import { decodeMotor } from '../src/sim/world.js';

function fixture(signs = new Int8Array([1,1,1,1,1,1])) {
  const n=6, edges=[[0,2,200],[1,2,200],[2,3,200]], e=edges.length;
  const bytes=new ArrayBuffer(8+e*12+n*3), view=new DataView(bytes);
  view.setUint32(0,n,true);view.setUint32(4,e,true);
  edges.forEach(([pre,post,w],i)=>{view.setUint32(8+i*12,pre,true);view.setUint32(12+i*12,post,true);view.setFloat32(16+i*12,w,true);});
  const member=(index,side,cellType,hemibrainType=cellType)=>({index,side,cellType,hemibrainType});
  const circuits={groups:{ORN_DM1:[member(0,'left','ORN_DM1'),member(1,'right','ORN_DM1')],DM1_lPN:[member(2,'left','DM1_lPN')],DNa02:[member(3,'left','','DNa02'),member(4,'right','DNa02')],DNp09:[member(5,'right','DNp71','DNp09')]}};
  const manifest={neurons:n,edges:e,groups:['test'],pools:{}};
  return new CircuitBrain(bytes,new Uint8Array(n*2),manifest,circuits,signs,42);
}

test('exact passive integration agrees across timesteps and preserves resting state',()=>{
  const whole=integrateLif(3,20,.2),half=integrateLif(3,20,.1),twice=integrateLif(half.v,half.g,.1);
  assert.ok(Math.abs(whole.v-twice.v)<1e-12);assert.ok(Math.abs(whole.g-twice.g)<1e-12);
  assert.deepEqual(integrateLif(0,0),{v:0,g:0});
});

test('source input propagates through measured edges; disconnection and source silencing remove downstream responses',()=>{
  const b=fixture();
  for(let i=0;i<25;i++)b.step({odorLeft:.6});
  assert.ok(b.spikeCounts[2]>0); assert.ok(b.motor.left>0);
  for(const control of ['disconnected','silenced']){
    b.reset(42);b.setMode(control==='disconnected'?'disconnected':'measured');
    if(control==='silenced')b.silenced.add(0);
    let source=0,downstream=0;
    for(let i=0;i<25;i++){b.step({odorLeft:.6});source+=b.spikeCounts[0];downstream+=b.spikeCounts[2]+b.spikeCounts[3];}
    assert.ok(source>0);assert.equal(downstream,0);
  }
});

test('inhibitory transmitter assignment prevents excitation of a downstream target',()=>{
  const b=fixture(new Int8Array([1,1,-1,1,1,1]));let projection=0,descending=0;
  for(let i=0;i<25;i++){b.step({odorLeft:.6});projection+=b.spikeCounts[2];descending+=b.spikeCounts[3];}
  assert.ok(projection>0);assert.equal(descending,0);
});

test('named interventions have opposite decoder signs without supplying forward drive',()=>{
  const b=fixture();assert.deepEqual(b.walkingPool,[], 'conflicting DNp71 alias excluded');
  for(const side of ['left','right']){
    b.reset(42);b.setMode('disconnected');
    for(let i=0;i<10;i++)b.step({}, {indices:b.steeringPools[side],rateHz:100});
    const motor=decodeMotor(b.motor);assert.equal(motor.speed,0);
    assert.ok(side==='left'?motor.turn<0:motor.turn>0);
  }
});

test('circuit runs are deterministic and remain silent without external input',()=>{
  const b=fixture();for(let i=0;i<10;i++)b.step({});assert.equal(b.totalEvents,0);assert.equal(b.motor.forward,0);
  const trial=()=>{b.reset(17);for(let i=0;i<20;i++)b.step({odorLeft:.4});return {v:b.voltage.slice(),g:b.g.slice(),spikes:b.spikeCounts.slice(),motor:{...b.motor}};};
  assert.deepEqual(trial(),trial());
});

test('full graph, exact named pairs, and literature sign provenance load with verified hashes',()=>{
  const b=loadCircuitBrain();assert.equal(b.n,139255);assert.equal(b.e,2698236);
  assert.equal(b.sensoryPools.left.length,35);assert.equal(b.sensoryPools.right.length,33);
  assert.equal(b.steeringPools.left.length,1);assert.equal(b.steeringPools.right.length,1);assert.equal(b.walkingPool.length,2);
  assert.ok(b.circuits.transmitterSigns.knownOverrides.length>0);
  b.step({});assert.equal(b.totalEvents,0);
});
