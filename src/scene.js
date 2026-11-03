import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const material = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });

export class TableScene {
  constructor(host, onAction, onStatus) {
    this.host = host; this.onAction = onAction; this.onStatus = onStatus; this.tool = 'food'; this.state = null;
    this.foodMeshes = new Map(); this.wallMeshes = new Map(); this.drag = null; this.pointerDown = null; this.odor = false; this.overhead = false;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#e7e8df');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#e7e8df');
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D fly tabletop. Use the controls to add food, place or drag walls, and touch the fly.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); onStatus('Graphics context lost. Reload to restore the tabletop.'); });
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(10.4, 12.8, 13.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0); this.controls.enableDamping = true; this.controls.enablePan = false;
    this.controls.minDistance = 9; this.controls.maxDistance = 25; this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#a4b7a2', 2.8));
    const sun = new THREE.DirectionalLight('#fff4d8', 3.2); sun.position.set(-4, 10, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 }); sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    const base = this.box(10.6, 0.35, 10.6, '#aa8863'); base.position.y = -0.23; base.receiveShadow = true; this.scene.add(base);
    const table = this.box(10.25, 0.12, 10.25, '#f2eddd'); table.position.y = -0.03; table.receiveShadow = true; this.scene.add(table);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), material('#e7e8df')); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.43; floor.receiveShadow = true; this.scene.add(floor);
    // A quiet grid gives world scale without implying anatomical coordinates.
    const grid = new THREE.GridHelper(10, 20, '#c6c6b2', '#d9d6c5'); grid.position.y = 0.035; grid.material.transparent = true; grid.material.opacity = 0.25; this.scene.add(grid);
    const rimMat = material('#d3c7aa');
    for (const [x, z, w, d] of [[0,-5.08,10.3,.08],[0,5.08,10.3,.08],[-5.08,0,.08,10.3],[5.08,0,.08,10.3]]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), rimMat); rim.position.set(x, .05, z); rim.castShadow = true; this.scene.add(rim);
    }
    this.fly = this.makeFly(); this.scene.add(this.fly);
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(.22, .26, 40), new THREE.MeshBasicMaterial({ color: '#338c77', transparent: true, opacity: .8, side: THREE.DoubleSide }));
    this.ghost.rotation.x = -Math.PI / 2; this.ghost.position.y = .065; this.ghost.visible = false; this.scene.add(this.ghost);
    this.odorCanvas = document.createElement('canvas'); this.odorCanvas.width = this.odorCanvas.height = 160;
    this.odorTexture = new THREE.CanvasTexture(this.odorCanvas); this.odorTexture.colorSpace = THREE.SRGBColorSpace;
    this.odorMesh = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshBasicMaterial({ map: this.odorTexture, transparent: true, depthWrite: false, opacity: .58 }));
    this.odorMesh.rotation.x = -Math.PI / 2; this.odorMesh.position.y = .045; this.odorMesh.visible = false; this.scene.add(this.odorMesh);
    this.pathGeometry = new THREE.BufferGeometry();
    this.pathLine = new THREE.Line(this.pathGeometry, new THREE.LineBasicMaterial({ color: '#4d8a7a', transparent: true, opacity: .4 })); this.scene.add(this.pathLine);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    this.bindPointer();
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
    this.lastTime = performance.now(); this.frame = this.frame.bind(this); this.renderer.setAnimationLoop(this.frame);
  }
  box(w,h,d,color) { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material(color)); m.castShadow = true; m.receiveShadow = true; return m; }
  ellipsoid(parent, position, scale, mat) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat); mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  makeFly() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); this.flyBody = body;
    const dark = material('#37372c'), abdomen = material('#79734e'), eye = material('#a9462d', .45);
    this.ellipsoid(body, [-.07,.18,0], [.24,.14,.13], abdomen);
    this.ellipsoid(body, [.13,.21,0], [.13,.14,.13], dark);
    this.ellipsoid(body, [.29,.23,0], [.115,.1,.12], dark);
    for (const side of [-1,1]) {
      this.ellipsoid(body, [.32,.25,side*.08], [.075,.075,.055], eye);
      const wingMat = new THREE.MeshPhysicalMaterial({ color:'#e5ebd3', transparent:true, opacity:.55, roughness:.3, side:THREE.DoubleSide, depthWrite:false });
      const wing = this.ellipsoid(body, [-.08,.32,side*.14], [.32,.012,.1], wingMat); wing.rotation.y = side * -.27;
      this.line(body, [[.36,.28,side*.03],[.47,.29,side*.09]], '#393c2c', .015);
    }
    this.legs = [];
    for (const side of [-1,1]) for (let i=0; i<3; i++) {
      const leg = new THREE.Group(); leg.position.set(.16-i*.12,.17,side*.07);
      this.line(leg, [[0,0,0],[.08-i*.08,.04,side*.17],[.13-i*.12,-.13,side*.28]], '#48483b', .014);
      body.add(leg); this.legs.push({ mesh:leg, phase:i*Math.PI*.7+(side===1?Math.PI:0) });
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(.42,.435,64), new THREE.MeshBasicMaterial({color:'#438675',transparent:true,opacity:.65,side:THREE.DoubleSide})); halo.rotation.x=-Math.PI/2; halo.position.y=.055; root.add(halo);
    return root;
  }
  line(parent, points, color, width) {
    const mat = material(color);
    for (let i=1;i<points.length;i++) {
      const a = new THREE.Vector3(...points[i-1]), b = new THREE.Vector3(...points[i]), d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(width,width,d.length(),6),mat);
      m.position.copy(a.add(b).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); parent.add(m);
    }
  }
  makeFood() {
    const group = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.34,.31,.035,32),material('#ddd6bc')); plate.position.y=.065; plate.receiveShadow=true; group.add(plate);
    this.ellipsoid(group,[0,.16,0],[.23,.12,.17],material('#dba65f'));
    this.ellipsoid(group,[-.03,.23,-.015],[.14,.025,.11],material('#f0c97e'));
    const leaf = this.ellipsoid(group,[.15,.23,.02],[.12,.015,.04],material('#758f54')); leaf.rotation.y=-.5;
    return group;
  }
  update(state) {
    this.state = state;
    const w=state.world;
    for (const [id,m] of this.foodMeshes) if (!w.food.some(f=>f.id===id)) { this.scene.remove(m); this.disposeObject(m); this.foodMeshes.delete(id); }
    for (const f of w.food) {
      let mesh=this.foodMeshes.get(f.id);
      if (!mesh) {mesh=this.makeFood(); this.scene.add(mesh); this.foodMeshes.set(f.id,mesh);}
      mesh.position.set(f.x,0,f.z); mesh.scale.setScalar(.55+.45*f.amount);
    }
    for (const [id,m] of this.wallMeshes) if (!w.walls.some(f=>f.id===id)) {this.scene.remove(m); this.disposeObject(m); this.wallMeshes.delete(id);}
    for (const wall of w.walls) {
      let mesh=this.wallMeshes.get(wall.id);
      if (!mesh) {mesh=this.box(wall.width,.48,wall.depth,'#b8c2ad'); mesh.userData.wallId=wall.id; this.scene.add(mesh); this.wallMeshes.set(wall.id,mesh);}
      mesh.position.set(wall.x,.28,wall.z);
    }
    this.pathGeometry.setFromPoints(w.path.map(([x,z])=>new THREE.Vector3(x,.055,z)));
    if(this.odor) this.drawOdor();
  }
  drawOdor() {
    if(!this.state) return;
    const ctx=this.odorCanvas.getContext('2d'), image=ctx.createImageData(160,160);
    for(let y=0;y<160;y++) for(let x=0;x<160;x++) {
      let c=0; for(const f of this.state.world.food) c+=f.amount*Math.exp(-Math.hypot(x/16-5-f.x,y/16-5-f.z)/1.8);
      const i=(y*160+x)*4; image.data[i]=78; image.data[i+1]=153; image.data[i+2]=114; image.data[i+3]=Math.round(Math.min(1,c)*210);
    }
    ctx.putImageData(image,0,0); this.odorTexture.needsUpdate=true;
  }
  setOdor(value) { this.odor=value; this.odorMesh.visible=value; if(value)this.drawOdor(); }
  setOverhead(value) {
    this.overhead=value; this.camera.position.set(...(value?[0,18,.01]:[10.4,12.8,13.4])); this.controls.target.set(0,0,0); this.controls.update();
  }
  setTool(tool) {this.tool=tool; this.host.dataset.tool=tool; this.ghost.visible=false;}
  point(event) {
    const r=this.renderer.domElement.getBoundingClientRect(); this.pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1); this.raycaster.setFromCamera(this.pointer,this.camera);
    const p=new THREE.Vector3(); return this.raycaster.ray.intersectPlane(this.plane,p)?p:null;
  }
  bindPointer() {
    const canvas=this.renderer.domElement;
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0 || !this.state) return;
      const p=this.point(e); if(!p)return;
      this.pointerDown={x:e.clientX,y:e.clientY};
      if(this.tool==='wall') {
        const hit=this.raycaster.intersectObjects([...this.wallMeshes.values()])[0];
        if(hit) {this.drag={id:hit.object.userData.wallId,dx:hit.object.position.x-p.x,dz:hit.object.position.z-p.z}; canvas.setPointerCapture(e.pointerId);}
      }
    });
    canvas.addEventListener('pointermove',e=>{
      const p=this.point(e); if(!p)return;
      this.ghost.visible=Math.abs(p.x)<4.8&&Math.abs(p.z)<4.8&&this.tool!=='inspect'; this.ghost.position.set(p.x,.065,p.z);
      if(this.drag)this.onAction({type:'moveWall',id:this.drag.id,x:p.x+this.drag.dx,z:p.z+this.drag.dz});
    });
    canvas.addEventListener('pointerleave',()=>{this.ghost.visible=false;});
    const release=e=>{
      if(e.button!==0)return;
      const hadDrag=!!this.drag; this.drag=null;
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(!this.pointerDown)return;
      const distance=Math.hypot(e.clientX-this.pointerDown.x,e.clientY-this.pointerDown.y); this.pointerDown=null;
      if(hadDrag||distance>7)return;
      const p=this.point(e); if(!p||Math.abs(p.x)>4.8||Math.abs(p.z)>4.8)return;
      if(this.tool==='food'||this.tool==='wall')this.onAction({type:this.tool,x:p.x,z:p.z});
      if(this.tool==='touch') {
        if(Math.hypot(p.x-this.state.world.fly.x,p.z-this.state.world.fly.z)<.65) {this.onAction({type:'touch'}); this.onStatus('Touch pulse sent to annotated mechanosensory neurons.');}
        else this.onStatus('Click close to the fly to give a touch stimulus.');
      }
      if(this.tool==='inspect')this.onStatus(`Position ${p.x.toFixed(1)}, ${p.z.toFixed(1)} · green ring marks the simulated fly.`);
    };
    canvas.addEventListener('pointerup',release);
    canvas.addEventListener('pointercancel',()=>{this.drag=null;this.pointerDown=null;});
  }
  resize() {const {width,height}=this.host.getBoundingClientRect(); if(!width||!height)return;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);}
  frame(now) {
    // Keep graphics from competing unnecessarily with full-brain computation.
    if (document.hidden || now - this.lastTime < 1000 / 30) return;
    const dt=Math.min((now-this.lastTime)/1000,.1);this.lastTime=now;
    if(this.state){const f=this.state.world.fly;this.fly.position.lerp(new THREE.Vector3(f.x,0,f.z),1-Math.exp(-dt*18));const target=-f.heading;let diff=target-this.fly.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));this.fly.rotation.y+=diff*(1-Math.exp(-dt*18));
      for(const leg of this.legs)leg.mesh.rotation.y=this.state.running?Math.sin(this.state.world.time*30+leg.phase)*Math.min(.35,f.speed*.5):0;
    }
    this.controls.update();this.renderer.render(this.scene,this.camera);
  }
  disposeObject(object) {object.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}
}
