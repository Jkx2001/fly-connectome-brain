import { TableScene } from './scene.js';

const icon = (name) => ({ food:'◒', wall:'▥', touch:'✳', inspect:'⌖' }[name]);
document.querySelector('#app').innerHTML = `
<header class="topbar"><a class="brand" href="/" aria-label="Fly Table home"><span class="brand-mark">✳</span> fly table<span class="brand-dot">.</span></a><span class="header-caption">A SMALL WORLD. A REAL WIRING DIAGRAM.</span><button class="text-button" id="methods-open">About the model <span>↗</span></button></header>
<main class="layout"><section class="world-column" aria-label="Fly world">
<div class="world-heading"><div><div class="eyebrow">EXPERIMENT 001</div><h1>A fly. A little world.<br><span>A lot of connections.</span></h1><p>Leave a little food. Change the surroundings.<br>Watch what the wiring does.</p></div><div class="specimen-tag"><span class="status-dot"></span> DROSOPHILA<br><small>FAFB · v783</small></div></div>
<div class="stage-shell"><div id="stage" data-tool="food"></div>
<div class="stage-top"><span class="pill"><span class="status-dot" id="run-dot"></span><span id="run-label">LOADING BRAIN</span></span><span class="pill subtle" id="clock">00:00.00</span></div>
<div class="loading" id="loading"><div class="loader"></div><strong>Unpacking a tiny brain</strong><span id="load-message">Loading measured wiring…</span><small>139,255 neurons · 2.70 million connections<br>First load downloads a 12 MB local dataset.</small></div>
<div class="view-controls"><button id="odor-toggle" aria-pressed="false">◉ Odor field</button><button id="view-toggle" aria-pressed="false">⌗ Overhead</button></div>
<div class="scale-mark">└────┘<span>1 WORLD UNIT</span></div>
<div class="stage-tip" id="stage-tip">Click the tabletop to place food</div></div>
<div class="world-toolbar"><div class="tools" role="group" aria-label="Interaction tool">${[['food','Food'],['wall','Walls'],['touch','Touch'],['inspect','Inspect']].map(([key,name])=>`<button class="tool ${key==='food'?'selected':''}" data-tool="${key}" aria-pressed="${key==='food'}"><span>${icon(key)}</span>${name}</button>`).join('')}</div><div class="transport"><button id="play" class="play-button" disabled>Ⅱ Pause</button><button id="step" title="Pause and advance one 20 ms step" disabled>Step →</button><button id="reset" title="Reset the brain and world using the current seed" disabled>↺ Reset</button></div></div>
<div class="below-stage"><span id="notice" role="status">Right-drag to orbit · scroll to zoom · Space to pause</span><span class="local-tag">● COMPUTED ON YOUR DEVICE</span></div>
</section>
<aside class="panel" aria-label="Experiment controls"><div class="panel-heading"><span class="eyebrow">UNDER THE SURFACE</span><h2>The brain, in motion.</h2><p>Measured connections. Modeled dynamics.</p></div>
<div class="brain-summary"><div class="brain-symbol" aria-hidden="true"><svg viewBox="0 0 220 120"><path d="M110 100C76 120 19 100 25 62C2 20 65 0 93 25L110 39L127 25C160 0 216 20 195 62C201 100 144 120 110 100Z"/><path d="M110 39V100M32 48L80 35L110 61L153 39L193 53M29 78L75 83L110 61L153 84L193 76M80 35L75 83M153 39V84"/>${[[32,48],[80,35],[110,61],[153,39],[193,53],[29,78],[75,83],[153,84],[193,76],[110,100]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</svg><span>SCHEMATIC · NOT ANATOMICAL</span></div><div class="count-grid"><div><strong>139,255</strong><span>neural units</span></div><div><strong id="edge-count">2,698,236</strong><span>enabled connections</span></div></div></div>
<section class="panel-section"><div class="section-label">WIRING CONTROL <span class="help" title="Switching resets both brain and world to the same seed.">ⓘ</span></div><div class="segmented" role="group" aria-label="Wiring mode"><button data-mode="measured" class="active" aria-pressed="true">Measured</button><button data-mode="shuffled" aria-pressed="false">Shuffled</button><button data-mode="disconnected" aria-pressed="false">Off</button></div><p class="helper" id="mode-note">Full retained graph. No neurons or connections removed.</p></section>
<section class="panel-section"><div class="section-label">SENSORY INPUT <span class="section-unit">NORMALIZED 0–1</span></div><div class="sensor-row"><span>Left antenna</span><div class="meter"><i id="odor-left-bar"></i></div><output id="odor-left">0.00</output></div><div class="sensor-row"><span>Right antenna</span><div class="meter"><i id="odor-right-bar"></i></div><output id="odor-right">0.00</output></div><label class="light-label" for="light">Ambient light <output id="light-value">25%</output></label><input id="light" type="range" min="0" max="100" value="25"><p class="helper">Odor, light, touch, and taste drive annotated sensory pools.</p></section>
<section class="panel-section"><div class="section-label">NEURAL ACTIVITY <span class="section-unit">SPIKES / STEP</span></div><canvas id="activity-chart" width="600" height="100" aria-label="Recent total neural spike counts" role="img"></canvas><div class="activity-total"><strong id="spike-count">—</strong><span>neurons fired in the latest step</span></div><div id="group-bars"></div></section>
<section class="panel-section"><div class="section-label">DESCENDING OUTPUT <span class="section-unit">SMOOTHED SPIKE FRACTION</span></div><div class="motor-row"><span>Left <b id="motor-left">0.000</b></span><span>Right <b id="motor-right">0.000</b></span></div><p class="helper">A fixed artificial decoder maps descending activity to ground movement. No food coordinates enter it.</p></section>
<section class="panel-section compact"><div class="metrics"><div><strong id="distance">0.00</strong><span>distance · units</span></div><div><strong id="food-eaten">0.00</strong><span>food consumed</span></div></div><div class="seed-row"><label for="seed">Trial seed</label><input id="seed" type="number" value="42" min="0" max="4294967295" step="1"><button id="export" disabled>Export run ↗</button></div><p class="helper" id="performance">Preparing simulation…</p></section>
<div class="honesty-note"><span>↳</span><p><strong>A model, not a recreated animal.</strong> Real wiring does not establish biological behavior. The controls help test what the wiring contributes.</p></div></aside></main>
<footer><span>FLY TABLE <span class="version">POC / 0.1</span></span><span>FlyWire whole-brain connectome · Dorkenwald et al., Nature (2024)</span><button class="text-button" id="sources-open">Sources & assumptions ↗</button></footer>
<dialog id="methods"><div class="dialog-head"><span class="eyebrow">MODEL CARD</span><button id="methods-close" aria-label="Close model details">✕</button></div><h2>Real wiring. Explicit assumptions.</h2><p>This POC computes activity for <strong>all 139,255 neurons and 2,698,236 directed neuron-pair connections in its packaged FlyWire FAFB v783 graph</strong>. Connections aggregate synaptic contacts; this is not a count of individual synapses.</p><h3>What comes from data</h3><p>The packaged graph and neuron classifications are sourced from <a href="https://github.com/snedea/flybrain/tree/9191824d17871b7851645782d53d23f213ddb938" target="_blank" rel="noreferrer">snedea/flybrain (pinned revision)</a>, derived from FlyWire. The loader checks the compressed graph’s SHA-256 before running. See <a href="https://doi.org/10.1038/s41586-024-07558-y" target="_blank" rel="noreferrer">Dorkenwald et al. (2024)</a>. Data packaging is traced to upstream; this POC has not independently audited the original reconstruction.</p><h3>What we assume</h3><ul><li>Identical leaky integrate-and-fire units: 20 ms steps, leak 0.82, threshold 1, two refractory steps. Incoming absolute synapse-count weights are normalized with gain 18.</li><li>Transmitter signs inherit upstream assumptions, including excitatory glutamate and simplified modulatory effects. These are not universally correct physiological signs.</li><li>Scalar odor, light, touch, and taste become random input pulses in annotated pools. Odor receptors are not modeled individually. Ambient light has no rendered directional source.</li><li>Left/right descending spike fractions drive speed and turning through a fixed decoder. There is no measured ventral nerve cord, muscle model, flight, trained navigation policy, or LLM.</li><li>Food consumption occurs by contact. Collision handling constrains position; it does not choose avoidance turns. Walls do not block this POC’s analytic odor field.</li></ul><h3>What the controls establish</h3><p><strong>Shuffled</strong> permutes postsynaptic neuron labels with a fixed seed while preserving all edge weights and source degrees. The destination degree distribution is retained, but assignments change. <strong>Off</strong> disables synaptic propagation while leaving sensory stimulation enabled. Both reset the world and brain to the same seed.</p><p>Changed activity or movement shows dependence on connectivity. It does <strong>not</strong> demonstrate natural navigation, learning, or accurate fly behavior. No learning is implemented. Different controls change which neurons become active, so performance differences require repeated trials.</p><h3>Reproducibility</h3><p>Simulation runs in a worker, separately from the 3D renderer. Each step advances exactly 20 ms of model time. If computation is slow, model time runs slower than wall time. Seed, wiring mode, action ticks, model parameters, source hash, final state, and a bounded trajectory are included in JSON exports. See README for headless checks and replay instructions.</p><button class="primary" id="methods-done">Back to the tabletop</button></dialog>`;

const $ = id => document.getElementById(id);
let worker, scene, ready = false, latest, manifest, history = [];
const notice = text => { $('notice').textContent=text; };
const send = data => worker?.postMessage(data);
function error(message) {
  $('loading').hidden=false; $('loading').classList.add('failed'); $('loading').querySelector('strong').textContent='The simulation could not start';
  $('load-message').textContent=message; $('loading').querySelector('small').textContent='Check browser support and reload. No fallback brain or scripted fly is used.';
  $('run-label').textContent='STOPPED'; notice(message); send({type:'pause'});
}
function setEnabled(value) {for(const id of ['play','step','reset','export','seed','light'])$(id).disabled=!value;document.querySelectorAll('[data-mode], .tool').forEach(b=>b.disabled=!value);}
setEnabled(false);
try {
  scene = new TableScene($('stage'), action=>{if(ready)send({type:'action',action});}, notice);
  worker = new Worker(new URL('./sim/worker.js',import.meta.url),{type:'module'});
  worker.onerror=e=>error(e.message || 'Worker failed');
  worker.onmessage=({data})=>{
    if(data.type==='progress')$('load-message').textContent=data.message;
    if(data.type==='error'){ready=false;setEnabled(false);error(data.message);}
    if(data.type==='ready') {
      ready=true;manifest=data.manifest;$('loading').hidden=true;setEnabled(true);
      $('group-bars').innerHTML=[2,5,7,8,9].map(i=>`<div class="group-row"><span>${manifest.groups[i]}</span><div class="meter"><i id="group-${i}"></i></div><output id="group-count-${i}">0</output></div>`).join('');
      notice('Brain loaded · right-drag to orbit · scroll to zoom');
    }
    if(data.type==='reset'){history=[];scene.fly.position.set(-.8,0,1.8);}
    if(data.type==='state')update(data);
    if(data.type==='export') {
      const blob=new Blob([JSON.stringify(data.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fly-table-${data.data.mode}-seed-${data.data.seed}-tick-${data.data.tick}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Run exported with seed, source hash, actions, and trajectory.');
    }
  };
  // Vite serves public/ at its base URL. A plain static repository preview
  // serves that directory by name and resolves Three.js through the import map.
  const dataPath = import.meta.env ? `${import.meta.env.BASE_URL}data/` : './public/data/';
  send({type:'init',dataBase:new URL(dataPath,document.baseURI).href});
}catch(e){error(e.message);}

function update(s) {
  latest=s;scene?.update(s);const w=s.world;
  $('play').textContent=s.running?'Ⅱ Pause':'▶ Run';$('run-label').textContent=s.running?'SIMULATION LIVE':'PAUSED';$('run-dot').classList.toggle('paused',!s.running);
  $('clock').textContent=`${String(Math.floor(w.time/60)).padStart(2,'0')}:${(w.time%60).toFixed(2).padStart(5,'0')}`;
  $('edge-count').textContent=s.edges.toLocaleString();$('spike-count').textContent=s.spikes.toLocaleString();
  for(const side of ['left','right']){const v=w.sensors[side==='left'?'odorLeft':'odorRight']||0;$(`odor-${side}`).value=v.toFixed(2);$(`odor-${side}-bar`).style.width=`${v*100}%`;$(`motor-${side}`).textContent=s.motor[side].toFixed(3);}
  $('distance').textContent=w.distance.toFixed(2);$('food-eaten').textContent=w.eaten.toFixed(2);
  if(document.activeElement!==$('light'))$('light').value=Math.round(w.light*100);$('light-value').value=`${Math.round(w.light*100)}%`;
  $('seed').value=w.seed;
  $('performance').textContent=`${s.computeMs.toFixed(1)} ms compute / 20 ms budget · tick ${s.ticks.toLocaleString()}`;
  for(const i of [2,5,7,8,9]){if(!$(`group-${i}`))continue;$(`group-${i}`).style.width=`${Math.min(100,s.groups[i]/Math.max(1,manifest.groupCounts[i])*400)}%`;$(`group-count-${i}`).value=s.groups[i].toLocaleString();}
  history.push(s.spikes);if(history.length>120)history.shift();drawChart();
}
function drawChart(){const c=$('activity-chart'),ctx=c.getContext('2d'),max=Math.max(10,...history);ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#e2e5da';ctx.beginPath();ctx.moveTo(0,95);ctx.lineTo(600,95);ctx.stroke();if(history.length<2)return;ctx.beginPath();history.forEach((v,i)=>{const x=i/119*600,y=95-v/max*85;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#418a73';ctx.lineWidth=2.5;ctx.stroke();ctx.lineTo((history.length-1)/119*600,100);ctx.lineTo(0,100);ctx.closePath();ctx.fillStyle='#418a7314';ctx.fill();}

const tips={food:'Click the tabletop to place food',wall:'Click to add a wall · drag existing walls to move',touch:'Click close to the fly to stimulate touch neurons',inspect:'Click a point to inspect · right-drag to orbit'};
document.querySelectorAll('.tool').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.tool').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});scene?.setTool(button.dataset.tool);$('stage-tip').textContent=tips[button.dataset.tool];}));
$('play').onclick=()=>send({type:'toggle'});$('step').onclick=()=>send({type:'step'});$('reset').onclick=()=>send({type:'reset',seed:Number($('seed').value)});
$('seed').onchange=()=>{const n=Number($('seed').value);if(!Number.isInteger(n)||n<0||n>4294967295){$('seed').value=latest?.world.seed||42;return;}send({type:'reset',seed:n});};
$('export').onclick=()=>send({type:'export'});$('light').oninput=()=>send({type:'action',action:{type:'light',value:Number($('light').value)/100}});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(!ready)return;send({type:'mode',mode:b.dataset.mode});document.querySelectorAll('[data-mode]').forEach(btn=>{btn.classList.toggle('active',btn===b);btn.setAttribute('aria-pressed',String(btn===b));});$('mode-note').textContent={measured:'Full retained graph. No neurons or connections removed.',shuffled:'Destination labels permuted. Same edges and weights; changed wiring.',disconnected:'Synaptic propagation disabled. Sensory inputs remain enabled.'}[b.dataset.mode];notice('Brain and world reset to the same seed for comparison.');});
$('odor-toggle').onclick=()=>{const value=$('odor-toggle').getAttribute('aria-pressed')!=='true';$('odor-toggle').setAttribute('aria-pressed',String(value));scene?.setOdor(value);};
$('view-toggle').onclick=()=>{const value=$('view-toggle').getAttribute('aria-pressed')!=='true';$('view-toggle').setAttribute('aria-pressed',String(value));scene?.setOverhead(value);};
for(const id of ['methods-open','sources-open'])$(id).onclick=()=>{$('methods').showModal();};
for(const id of ['methods-close','methods-done'])$(id).onclick=()=>$('methods').close();
$('methods').addEventListener('click',e=>{if(e.target===$('methods')){const r=$('methods').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('methods').close();}});
window.addEventListener('keydown',e=>{if(!ready||$('methods').open||['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();send({type:'toggle'});}if(e.key.toLowerCase()==='r')send({type:'reset',seed:latest.world.seed});if(e.key==='.')send({type:'step'});});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready){send({type:'pause'});notice('Paused while the tab is hidden. Press Run to resume.');}});
