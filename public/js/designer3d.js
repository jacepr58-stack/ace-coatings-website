// 3D view for the court designer. Loaded only when someone taps "3D view".
// World units are feet; 2D (x, y) on the slab maps to 3D (x - L/2, height, y - W/2).
import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const CD = window.CD;
let renderer, scene, camera, controls, box, world, ro, raf = 0, building = 0, lastView = 'orbit';
let hemi, sun;

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: .1, ...o });
const deg = d => d * Math.PI / 180;

function chainTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.strokeStyle = color; x.lineWidth = 3.2;
  x.beginPath(); x.moveTo(0, 32); x.lineTo(32, 0); x.lineTo(64, 32); x.lineTo(32, 64); x.closePath(); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function netTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); x.strokeStyle = '#111'; x.lineWidth = 2;
  x.strokeRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function init(el) {
  box = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, .5, 2000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = deg(88); controls.minDistance = 6; controls.maxDistance = 600;
  hemi = new THREE.HemisphereLight(0xdfeaff, 0x4d6b3a, 1.6); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-60, 120, 80); scene.add(sun);
  ro = new ResizeObserver(size); ro.observe(el);
  size();
}
function size() {
  if (!renderer) return;
  const w = box.clientWidth || 800, h = box.clientHeight || 500;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function loop() { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }

async function build() {
  const ticket = ++building;
  const S = CD.S, L = S.slab.l, W = S.slab.w, night = S.night;
  const tex = await CD.flatTexture(night ? 20 : 24);
  if (ticket !== building) return;
  if (world) { scene.remove(world); world.traverse(o => { o.geometry && o.geometry.dispose(); o.material && [].concat(o.material).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); }); }
  world = new THREE.Group(); scene.add(world);
  const P = (x, y, h = 0) => new THREE.Vector3(x - L / 2, h, y - W / 2);

  // sky, ground, slab
  scene.background = new THREE.Color(night ? 0x060b18 : 0xbfd9f2);
  scene.fog = new THREE.Fog(scene.background, 250, 900);
  hemi.intensity = night ? .05 : 1.6; sun.intensity = night ? .02 : 2.2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), mat(night ? 0x1a2a17 : 0x6f9a57, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; world.add(ground);
  const t = new THREE.CanvasTexture(tex); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshStandardMaterial({ map: t, roughness: .85 }));
  top.rotation.x = -Math.PI / 2; top.position.y = .34; world.add(top);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(L, .33, W), mat(0x9c9c96)); edge.position.y = .165; world.add(edge);

  const dark = mat(0x20252b, { metalness: .5, roughness: .45 });
  const alu = mat(0xb9c0c8, { metalness: .7, roughness: .35 });

  for (const it of S.items) {
    if (it.type === 'hoop') {
      const g = new THREE.Group(), a = deg(CD.hoopFacing(it)), bw = CD.BB[it.bb];
      g.position.copy(P(it.x, it.y, .34)); g.rotation.y = -a;
      const pole = new THREE.Mesh(new THREE.BoxGeometry(.5, 11.5, .5), dark); pole.position.set(0, 5.75, 0); g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(4, .35, .35), dark); arm.position.set(2, 10.4, 0); arm.rotation.z = deg(-8); g.add(arm);
      const board = new THREE.Mesh(new THREE.BoxGeometry(.12, 3.5, bw), new THREE.MeshPhysicalMaterial({ color: 0xeaf3ff, transparent: true, opacity: .35, roughness: .05, metalness: 0 }));
      board.position.set(4, 11.2, 0); g.add(board);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(.16, 3.6, bw + .1), new THREE.MeshBasicMaterial({ color: 0x222222, wireframe: true })); frame.position.copy(board.position); g.add(frame);
      const sq = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.5, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })); sq.position.set(4.02, 10.75, 0); g.add(sq);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.75, .05, 8, 32), mat(0xE2572B, { metalness: .4 })); rim.rotation.x = Math.PI / 2; rim.position.set(5.25, 10, 0); g.add(rim);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(.75, .5, 1.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .6 })); net.position.set(5.25, 9.3, 0); g.add(net);
      world.add(g);
    }
    if (it.type === 'light') {
      const g = new THREE.Group(), a = deg(CD.lightAim(it));
      g.position.copy(P(it.x, it.y, .34)); g.rotation.y = -a;
      const pole = new THREE.Mesh(new THREE.BoxGeometry(.42, 16, .42), it.power === 'solar' ? alu : dark); pole.position.y = 8; g.add(pole);
      for (const s of CD.SPREAD[it.heads]) {
        const h = new THREE.Group(); h.position.y = 16; h.rotation.y = -deg(s);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, .18, .18), dark); arm.position.x = .7; h.add(arm);
        const fx = new THREE.Mesh(new THREE.BoxGeometry(1.1, .25, 1.4), dark); fx.position.set(1.6, -.05, 0); fx.rotation.z = deg(-25); h.add(fx);
        const lens = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.2), new THREE.MeshBasicMaterial({ color: night ? 0xfff6d5 : 0x333a44 })); lens.rotation.x = Math.PI / 2; lens.rotation.y = deg(-25); lens.position.set(1.62, -.2, 0); h.add(lens);
        if (it.power === 'solar') { const pv = new THREE.Mesh(new THREE.BoxGeometry(2.2, .08, 1.6), mat(0x1d3b6b, { metalness: .3, roughness: .3 })); pv.position.set(-.8, .9, 0); pv.rotation.z = deg(20); h.add(pv); }
        g.add(h);
      }
      world.add(g);
    }
    if (it.type === 'fence') {
      const len = CD.fenceLen(it); if (len < .5) continue;
      const col = CD.FENCE_COLORS[it.color][1], fm = mat(col, { metalness: .4, roughness: .5 });
      const g = new THREE.Group(); g.position.copy(P(it.x, it.y, .34)); g.rotation.y = -Math.atan2(it.y2 - it.y, it.x2 - it.x);
      const gates = [...it.gates].sort((a, b) => a.t - b.t); const segs = []; let x = 0;
      for (const q of gates) { if (q.t > x) segs.push([x, q.t, false]); segs.push([q.t, q.t + q.w, true]); x = q.t + q.w; }
      if (x < len) segs.push([x, len, false]);
      const H = it.h;
      for (const [a, b, isGate] of segs) {
        const span = b - a; if (span < .05) continue;
        const ct = chainTexture(col); ct.repeat.set(span / .5, H / .5);
        const pm = new THREE.MeshStandardMaterial({ map: ct, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .6, metalness: .3 });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(span - (isGate ? .3 : 0), H - (isGate ? .4 : 0)), pm);
        mesh.position.set((a + b) / 2, H / 2, 0); g.add(mesh);
        if (isGate) { // frame around the gate leaves
          const leaves = span > 6 ? [[a, (a + b) / 2], [(a + b) / 2, b]] : [[a, b]];
          for (const [p0, p1] of leaves) {
            const fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(p1 - p0 - .2, H - .3)), new THREE.LineBasicMaterial({ color: col }));
            fr.position.set((p0 + p1) / 2, H / 2, 0); g.add(fr);
          }
        } else {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, span, 8), fm); rail.rotation.z = Math.PI / 2; rail.position.set((a + b) / 2, H, 0); g.add(rail);
        }
      }
      const posts = new Set([0, len]); for (let p = 10; p < len; p += 10) posts.add(p);
      for (const q of gates) { posts.add(q.t); posts.add(q.t + q.w); }
      for (const p of posts) { if (gates.some(q => p > q.t + .01 && p < q.t + q.w - .01)) continue; const po = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, H + .2, 10), fm); po.position.set(p, (H + .2) / 2, 0); g.add(po); }
      world.add(g);
    }
    if ((it.type === 'pickleball' || it.type === 'tennis') && it.net) {
      const half = it.type === 'tennis' ? 21 : 11, h = it.type === 'tennis' ? 3.3 : 3;
      const g = new THREE.Group(); g.position.copy(P(it.x, it.y, .34)); g.rotation.y = -deg(it.rot || 0);
      const nt = netTexture(); nt.repeat.set(half * 2 / .25, h / .25);
      const n = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, h - .3), new THREE.MeshBasicMaterial({ map: nt, transparent: true, opacity: .55, side: THREE.DoubleSide, alphaTest: .05 }));
      n.rotation.y = Math.PI / 2; n.position.set(0, (h - .3) / 2 + .1, 0); g.add(n);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(.05, .2, half * 2), mat(0xffffff)); tape.position.set(0, h - .1, 0); g.add(tape);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, h + .1, 10), dark); p.position.set(0, (h + .1) / 2, s * half); g.add(p); }
      world.add(g);
    }
  }

  // lights at night: one spotlight per fixture, aimed at its pool
  if (night) {
    for (const p of CD.pools()) {
      const li = S.items.find(i => i.type === 'light' && Math.hypot(i.x - p.cx, i.y - p.cy) < 40);
      const from = li ? P(li.x, li.y, 16) : P(p.cx, p.cy, 16);
      const to = P(p.cx, p.cy, 0);
      const d = from.distanceTo(to), r = Math.max(p.rx, p.ry);
      const sp = new THREE.SpotLight(0xfff2d6, 260, 0, Math.min(deg(80), Math.atan(r / d) * 1.15), .75, 1.2);
      sp.position.copy(from); sp.target.position.copy(to);
      world.add(sp, sp.target);
    }
  }
  if (!camera.userData.placed) { view(lastView); camera.userData.placed = true; }
}

function view(v) {
  const S = CD.S, L = S.slab.l, W = S.slab.w, D = Math.max(L, W);
  lastView = v;
  controls.target.set(0, 2, 0);
  if (v === 'top') camera.position.set(0, D * 1.35, .01);
  else if (v === 'side') camera.position.set(0, 7, W / 2 + D * .9);
  else if (v === 'court') {
    const hoop = S.items.find(i => i.type === 'hoop');
    if (hoop) {
      const a = deg(CD.hoopFacing(hoop)), hx = hoop.x - L / 2, hz = hoop.y - W / 2;
      camera.position.set(hx + Math.cos(a) * 22, 5.5, hz + Math.sin(a) * 22);
      controls.target.set(hx + Math.cos(a) * 5, 8, hz + Math.sin(a) * 5);
    } else { camera.position.set(-L / 2 + 4, 5.5, 0); controls.target.set(L / 2, 4, 0); }
  } else camera.position.set(-L * .75, D * .45, W * .95 + 10);
  controls.update();
}

window.CD3 = {
  active: false,
  open(el) {
    if (!renderer) init(el);
    this.active = true; size(); build(); if (!raf) loop();
  },
  close() { this.active = false; cancelAnimationFrame(raf); raf = 0; },
  update() { clearTimeout(this.t); this.t = setTimeout(build, 120); },
  view,
};
