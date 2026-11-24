/* Ace Coatings court designer. Plain JS, no dependencies.
   Units: everything is in feet. The slab sits at (0,0)-(L,W) in SVG user space. */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';

/* ---------- palette ---------- */
const COLORS = [
  ['Ace Blue', '#387FE5'], ['Pro Blue', '#1F5FC4'], ['Light Blue', '#79B6EA'], ['Navy', '#1C2E5A'],
  ['Dark Green', '#1F5A3E'], ['Light Green', '#5E9B5A'], ['Gray', '#8A9097'], ['Charcoal', '#3A3F45'],
  ['Purple', '#5B3C9C'], ['Red', '#A8423C'], ['Orange', '#D9733A'], ['Beige', '#C9B48E']];
const LINE_COLORS = [['White', '#FFFFFF'], ['Ghost', 'ghost'], ['Black', '#111418'], ['Yellow', '#F2C230'], ...COLORS];
const colorName = c => {
  if (!c) return 'None';
  if (c === 'ghost') return 'Ghost (lighter shade of the court)';
  const f = [...LINE_COLORS, ...COLORS].find(x => x[1].toLowerCase() === String(c).toLowerCase());
  return f ? f[0] : 'Custom ' + c;
};
const BB_LINES = [['#FFFFFF', 'White'], ['ghost', 'Ghost'], ['#111418', 'Black']]; // basketball line colors we offer
const FENCE_COLORS = { black: ['Black vinyl', '#1b1f24'], galv: ['Galvanized steel', '#9aa3ab'] };

/* ---------- geometry constants ---------- */
const ARC = { backyard: [17, 'Backyard (17 ft arc)'], hs: [19.75, 'High school (19 ft 9 in arc)'], college: [22.146, 'College (22 ft 1.75 in arc)'] };
const PKG = { basic: 'Basic: 3-point line and free throw line only', middle: 'Middle: adds the key (lane lines and the top of the free throw circle)', top: 'Top: the key plus the half court line and free throw lane markers' };
const BB = { 54: 4.5, 60: 5, 72: 6 };
// Light pools per fixture, from Dominator's published coverage:
// 100W solar "covers a 40 x 50 foot area"; 150W wired planner shows a ~30 ft useful radius.
const LIGHT = {
  // Pool sizes chosen so each fixture's area matches Dominator: solar ~40x50 = 2,000 sq ft, wired ~30 ft radius = ~2,800 sq ft.
  wired: { label: '150W wired LED', depth: 28, width: 32, off: 22, sqft: 2800 },
  solar: { label: '100W solar LED', depth: 22.5, width: 28, off: 18, sqft: 2000 } };
const SPREAD = { 1: [0], 2: [-30, 30], 3: [-50, 0, 50] };
const M = 12; // margin around slab shown in the view (ft)

/* ---------- state ---------- */
let S, sel = null, uid = 1, PPF = 10;
const hist = [], fut = [];
const logoCache = {}; // id -> {src, out}

function blank(L = 60, W = 30) { return { v: 1, slab: { l: L, w: W, color: '#1F5A3E' }, items: [], night: false }; }
const PRESETS = {
  pickle: ['Pickleball', 64, 34, s => { add('pickleball', { x: 32, y: 17 }, s) }],
  pickle2: ['Two pickleball', 60, 60, s => { add('pickleball', { x: 30, y: 15 }, s); add('pickleball', { x: 30, y: 45 }, s) }],
  half: ['Half court basketball', 40, 40, s => { addBasket({ x: 0, y: 20, rot: 0, pkg: 'middle', arc: 'hs' }, s, true) }],
  combo: ['Pickleball + hoop', 60, 30, s => { add('pickleball', { x: 30, y: 15 }, s); addBasket({ x: 0, y: 15, rot: 0, pkg: 'basic', arc: 'hs', line: 'ghost' }, s, true) }],
  full: ['Full court basketball', 94, 50, s => { addBasket({ x: 0, y: 25, rot: 0, pkg: 'top', arc: 'hs', ext: 'full', len: 94, key: '#1C2E5A' }, s, true) }],
  tennis: ['Tennis', 120, 60, s => { add('tennis', { x: 60, y: 30 }, s) }],
};

function nid() { return 'i' + (uid++); }
function add(type, o = {}, s = S) {
  const base = {
    pickleball: { fill: true, color: '#387FE5', kitchen: 'border', line: '#FFFFFF', net: true, rot: 0 },
    tennis: { fill: true, color: '#1F5A3E', line: '#FFFFFF', net: true, rot: 0 },
    basket: { pkg: 'middle', arc: 'hs', ext: 'half', len: 84, line: '#FFFFFF', key: '', rot: 0 },
    hoop: { bb: 60 },
    light: { heads: 2, power: 'wired' },
    fence: { h: 6, color: 'black', gates: [] },
    logo: { w: 12, rot: 0 },
    foursquare: { line: '#FFFFFF', rot: 0 },
    hopscotch: { line: '#FFFFFF', rot: 0 },
    shuffle: { line: '#FFFFFF', rot: 0 },
  }[type];
  const it = Object.assign({ id: nid(), type, x: s.slab.l / 2, y: s.slab.w / 2 }, JSON.parse(JSON.stringify(base)), o);
  s.items.push(it);
  return it;
}
function addBasket(o, s = S, withHoops = false) { // hoops are their own item; only the starter layouts include them
  const b = add('basket', o, s);
  const [ux, uy] = dir(b.rot);
  const hoopNear = (x, y) => s.items.some(h => h.type === 'hoop' && Math.hypot(h.x - x, h.y - y) < 6);
  if (!withHoops) return b;
  if (!hoopNear(b.x, b.y)) add('hoop', { x: b.x, y: b.y }, s);
  if (b.ext === 'full' && !hoopNear(b.x + ux * b.len, b.y + uy * b.len)) add('hoop', { x: b.x + ux * b.len, y: b.y + uy * b.len }, s);
  return b;
}
const dir = r => [Math.round(Math.cos(r * Math.PI / 180)), Math.round(Math.sin(r * Math.PI / 180))];

/* ---------- helpers ---------- */
const r2 = v => Math.round(v * 2) / 2; // snap to 6 inches
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ftin = v => { const f = Math.floor(v + 1e-6), i = Math.round((v - f) * 12); return i ? `${f}' ${i}"` : `${f}'`; };
const strokeOf = c => c === 'ghost' ? 'rgba(255,255,255,.34)' : c;
const fenceLen = f => Math.hypot(f.x2 - f.x, f.y2 - f.y);

function hoopFacing(h) { // inward: perpendicular to the nearest slab edge
  const { l, w } = S.slab;
  const d = [[Math.abs(h.x), 0], [Math.abs(l - h.x), 180], [Math.abs(h.y), 90], [Math.abs(w - h.y), 270]];
  d.sort((a, b) => a[0] - b[0]);
  return d[0][1];
}
function lightAim(li) { return hoopFacing(li); } // straight into the court from the nearest edge, never diagonal

function pools() { // every light head's pool, in world coords
  const out = [];
  for (const li of S.items.filter(i => i.type === 'light')) {
    const P = LIGHT[li.power], a0 = lightAim(li);
    for (const s of SPREAD[li.heads]) {
      const a = (a0 + s) * Math.PI / 180;
      out.push({ li: li.id, cx: li.x + Math.cos(a) * P.off, cy: li.y + Math.sin(a) * P.off, rx: P.depth, ry: P.width, deg: a0 + s });
    }
  }
  return out;
}
function litPercent() {
  const P = pools(); if (!P.length) return 0;
  const { l, w } = S.slab; let n = 0, lit = 0;
  for (let x = 0.5; x < l; x += 1) for (let y = 0.5; y < w; y += 1) {
    n++;
    for (const p of P) {
      const a = -p.deg * Math.PI / 180, dx = x - p.cx, dy = y - p.cy;
      const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
      if ((u / p.rx) ** 2 + (v / p.ry) ** 2 < 0.72) { lit++; break; }
    }
  }
  return Math.round(lit / n * 100);
}

/* ---------- drawing ---------- */
function kitchenColor(it) { return it.kitchen === 'border' ? S.slab.color : it.kitchen === 'court' ? it.color : it.kitchen; }
function paintColors() { // distinct paint colors on the slab (lines don't count)
  const c = new Set([S.slab.color.toLowerCase()]);
  for (const i of S.items) {
    if ((i.type === 'pickleball' || i.type === 'tennis') && i.fill) { c.add(i.color.toLowerCase()); if (i.type === 'pickleball') c.add(kitchenColor(i).toLowerCase()); }
    if (i.type === 'basket' && i.key && i.pkg !== 'basic') c.add(i.key.toLowerCase());
  }
  return c.size;
}
function bbox(it) { // local bbox [x,y,w,h]
  switch (it.type) {
    case 'pickleball': return [-22.5, -11.5, 45, 23];
    case 'tennis': return [-39.5, -21.5, 79, 43];
    case 'basket': { const R = ARC[it.arc][0]; const len = it.ext === 'full' ? it.len : Math.max(25.5, 5.25 + R + .5); return [-.5, -R - .5, len + 1, 2 * R + 1]; }
    case 'hoop': { const bw = BB[it.bb]; return [-1.2, -bw / 2 - .6, 6.8, bw + 1.2]; }
    case 'light': return [-2.6, -2.6, 5.2, 5.2];
    case 'foursquare': return [-8.5, -8.5, 17, 17];
    case 'hopscotch': return [-2.5, -8.5, 5, 17];
    case 'shuffle': return [-26.5, -3.5, 53, 7];
    case 'logo': { const h = it.w / (it.ar || 1); return [-it.w / 2, -h / 2, it.w, h]; }
  }
}
function xf(it) {
  if (it.type === 'hoop') return `translate(${it.x} ${it.y}) rotate(${hoopFacing(it)})`;
  if (it.type === 'light') return `translate(${it.x} ${it.y}) rotate(${lightAim(it)})`;
  if (it.type === 'fence') return `translate(${it.x} ${it.y}) rotate(${Math.atan2(it.y2 - it.y, it.x2 - it.x) * 180 / Math.PI})`;
  return `translate(${it.x} ${it.y}) rotate(${it.rot || 0})`;
}

function fillSVG(it) {
  if (it.type === 'pickleball' && it.fill) return `<g transform="${xf(it)}"><rect x="-22" y="-10" width="44" height="20" fill="${it.color}"/><rect x="-7" y="-10" width="14" height="20" fill="${kitchenColor(it)}"/></g>`;
  if (it.type === 'tennis' && it.fill) return `<g transform="${xf(it)}"><rect x="-39" y="-18" width="78" height="36" fill="${it.color}"/></g>`;
  if (it.type === 'basket' && it.key && it.pkg !== 'basic') {
    const k = `<path d="M0 -6H19A6 6 0 0 1 19 6H0Z" fill="${it.key}"/>`; // lane + top half of the free throw circle, like our real courts
    return `<g transform="${xf(it)}">${k}${it.ext === 'full' ? `<g transform="translate(${it.len} 0) scale(-1 1)">${k}</g>` : ''}</g>`;
  }
  return '';
}
function basketEnd(it) { // one end, local coords, baseline at x=0, court toward +x
  const R = ARC[it.arc][0], bx = 5.25;
  let d = `M0 ${-R}H${bx}A${R} ${R} 0 0 1 ${bx} ${R}H0`; // 3-point line
  d += it.pkg === 'basic' ? `M19 -3V3` : `M19 -6V6`; // free throw line: short 6 ft line on its own (like our ghost-line courts), full width with a key
  if (it.pkg !== 'basic') d += `M0 -6H19M0 6H19M19 -6A6 6 0 0 1 19 6`; // lane + top half of the circle (no dashed bottom half)
  let extra = '';
  if (it.pkg === 'top') { // lane blocks + hash marks along both lane lines
    let hd = '';
    for (const sg of [-1, 1]) {
      hd += `M7 ${sg * 6}V${sg * 6.67}H8V${sg * 6}`; // open box at the block, like our Pleasant Grove court
      for (const x of [11, 14, 17]) hd += `M${x} ${sg * 6}V${sg * 6.67}`;
    }
    extra += `<path d="${hd}"/>`;
  }
  return `<path d="${d}"/>${extra}`;
}
function linesSVG(it) {
  const st = strokeOf(it.line);
  const g = (inner, w = .17) => `<g transform="${xf(it)}" fill="none" stroke="${st}" stroke-width="${w}" color="${st}" stroke-linecap="square">${inner}</g>`;
  if (it.type === 'pickleball') return g(`<rect x="-22" y="-10" width="44" height="20"/><path d="M-7 -10V10M7 -10V10M-22 0H-7M7 0H22"/>`);
  if (it.type === 'tennis') return g(`<rect x="-39" y="-18" width="78" height="36"/><path d="M-39 -13.5H39M-39 13.5H39M-21 -13.5V13.5M21 -13.5V13.5M-21 0H21M-39 0H-38.6M39 0H38.6"/>`);
  const num = (x, y, t, fs = 1.1) => `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${st}" stroke="none" font-family="system-ui,sans-serif" font-weight="700">${t}</text>`;
  if (it.type === 'foursquare') return g(`<rect x="-8" y="-8" width="16" height="16"/><path d="M0 -8V8M-8 0H8"/>`); // 16 x 16 ft, four 8 ft squares
  if (it.type === 'hopscotch') { // 2 ft boxes: 1, 2, 3, 4|5, 6, 7|8, 9, then the 10 half circle
    const rows = [[1], [2], [3], [4, 5], [6], [7, 8], [9]]; let b = '', y = 8;
    for (const r of rows) { y -= 2; r.forEach((n, k) => { const x = r.length === 1 ? -1 : -2 + 2 * k; b += `<rect x="${x}" y="${y}" width="2" height="2"/>` + num(x + 1, y + 1, n); }); }
    b += `<path d="M-2 ${y}A2 2 0 0 1 2 ${y}"/>` + num(0, y - .8, 10, .9);
    return g(b);
  }
  if (it.type === 'shuffle') { // 52 x 6 ft lane with a scoring triangle at each end
    let b = `<rect x="-26" y="-3" width="52" height="6"/><path d="M-6.5 -3V3M6.5 -3V3"/>`;
    for (const sg of [-1, 1]) {
      const base = sg * 22.5, tip = sg * 12, mid = (a, t) => base + (tip - base) * t;
      b += `<path d="M${base} -3L${tip} 0L${base} 3ZM${base} -3H${sg * 26}M${mid(0, .33)} ${-3 * .67}V${3 * .67}M${mid(0, .66)} ${-3 * .34}V${3 * .34}M${mid(0, .33)} 0H${base}"/>`;
      b += num(mid(0, .8), 0, 10, .9) + num(mid(0, .5), 0, 8, .9) + num(mid(0, .17), -1.2, 7, .9) + num(mid(0, .17), 1.2, 7, .9) + num(sg * 24.2, 0, '10 OFF', .7);
    }
    return g(b);
  }
  if (it.type === 'basket') {
    let s = basketEnd(it);
    if (it.ext === 'full') {
      s += `<g transform="translate(${it.len} 0) scale(-1 1)">${basketEnd(it)}</g>`;
      const h = it.len / 2;
      s += `<path d="M${h} -40V40"/><circle cx="${h}" cy="0" r="6"/>`;
    }
    return g(s);
  }
  return '';
}
function netSVG(it) {
  if (!it.net) return '';
  const p = it.type === 'tennis' ? 21 : 11;
  return `<g transform="${xf(it)}"><path d="M0 ${-p}V${p}" stroke="#0B1729" stroke-width=".35" stroke-dasharray=".5 .3"/><circle cy="${-p}" r=".45" fill="#0B1729"/><circle cy="${p}" r=".45" fill="#0B1729"/></g>`;
}
function fenceSVG(f) {
  const L = fenceLen(f), [nm, col] = FENCE_COLORS[f.color];
  const gates = [...f.gates].sort((a, b) => a.t - b.t);
  const segs = []; let x = 0;
  for (const g of gates) { if (g.t > x) segs.push([x, g.t]); x = g.t + g.w; }
  if (x < L) segs.push([x, L]);
  const sh = f.h * .32; // shadow length grows with height
  let s = `<g transform="${xf(f)}">`;
  s += segs.map(([a, b]) => `<rect x="${a}" y="0" width="${b - a}" height="${sh}" fill="rgba(0,0,0,.16)"/>`).join('');
  s += segs.map(([a, b]) => `<path d="M${a} 0H${b}" stroke="${col}" stroke-width=".32"/><path d="M${a} 0H${b}" stroke="rgba(255,255,255,.35)" stroke-width=".12" stroke-dasharray=".25 .25"/>`).join('');
  const posts = new Set([0, L]); for (let p = 10; p < L; p += 10) posts.add(p);
  for (const g of gates) { posts.add(g.t); posts.add(g.t + g.w); }
  s += [...posts].filter(p => !gates.some(g => p > g.t + .01 && p < g.t + g.w - .01)).map(p => `<circle cx="${p}" cy="0" r=".32" fill="${col}"/>`).join('');
  // which side of this fence is the court? gates swing that way
  const ux = (f.x2 - f.x) / (L || 1), uy = (f.y2 - f.y) / (L || 1);
  const side = ((S.slab.l / 2 - f.x) * -uy + (S.slab.w / 2 - f.y) * ux) >= 0 ? 1 : -1;
  for (const g of gates) { // gate: lighter panel in the opening plus a swing arc
    s += `<path d="M${g.t + .2} 0H${g.t + g.w - .2}" stroke="${col}" stroke-width=".5" opacity=".55"/>`;
    const leaves = g.w > 6 ? [[g.t, g.w / 2, 1], [g.t + g.w, g.w / 2, -1]] : [[g.t, g.w, 1]];
    s += leaves.map(([x0, lw, sg]) => `<path d="M${x0 + sg * lw} 0A${lw} ${lw} 0 0 ${(sg > 0) === (side > 0) ? 1 : 0} ${x0} ${side * lw}" fill="none" stroke="${col}" stroke-width=".1" stroke-dasharray=".35 .3"/>`).join('');
  }
  const ang = Math.atan2(f.y2 - f.y, f.x2 - f.x) * 180 / Math.PI, flip = ang > 90.5 || ang < -89.5;
  const fs = 11 / PPF;
  s += `<text transform="translate(${L / 2} ${side > 0 ? -fs * .55 : fs * 1.2}) rotate(${flip ? 180 : 0})" dy="${flip ? fs * .35 : 0}" font-size="${fs}" text-anchor="middle" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="${fs * .2}" paint-order="stroke" font-family="system-ui,sans-serif" font-weight="700">${f.h}' fence</text>`;
  return s + '</g>';
}
function hoopSVG(h) {
  const bw = BB[h.bb];
  return `<g transform="${xf(h)}">
    <path d="M.6 .6L4.6 .6" stroke="rgba(0,0,0,.22)" stroke-width=".9"/><rect x="4.3" y="${-bw / 2 + .7}" width=".35" height="${bw}" fill="rgba(0,0,0,.22)"/>
    <rect x="-.4" y="-.4" width=".8" height=".8" fill="#20252b"/>
    <path d="M0 0H4" stroke="#20252b" stroke-width=".35"/>
    <rect x="4" y="${-bw / 2}" width=".22" height="${bw}" fill="#e9eef4" stroke="#20252b" stroke-width=".08"/>
    <circle cx="5.25" cy="0" r=".75" fill="none" stroke="#E2572B" stroke-width=".16"/>
  </g>`;
}
function lightSVG(li) {
  const a = SPREAD[li.heads];
  const ring = sel === li.id && !S.night ? pools().filter(p => p.li === li.id).map(p => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" transform="rotate(${p.deg} ${p.cx} ${p.cy})" fill="rgba(255,226,120,.12)" stroke="#FFD866" stroke-width=".25" stroke-dasharray="1 .6"/>`).join('') : '';
  const fs = 11 / PPF, lab = `${['', 'Single', 'Double', 'Triple'][li.heads]} light`;
  return `${ring}<text x="${li.x}" y="${li.y + (hoopFacing(li) === 270 ? 3.2 : -2.6)}" font-size="${fs}" text-anchor="middle" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="${fs * .2}" paint-order="stroke" font-family="system-ui,sans-serif" font-weight="700">${lab}</text><g transform="${xf(li)} scale(1.7)">
    <circle cx=".7" cy=".7" r=".55" fill="rgba(0,0,0,.25)"/>
    ${a.map(s => `<g transform="rotate(${s})"><path d="M0 0H1" stroke="#20252b" stroke-width=".22"/><rect x=".9" y="-.55" width=".55" height="1.1" rx=".12" fill="${S.night ? '#fff6cf' : '#2a3038'}" stroke="#20252b" stroke-width=".08"/></g>`).join('')}
    <rect x="-.38" y="-.38" width=".76" height=".76" fill="${li.power === 'solar' ? '#3b4250' : '#20252b'}"/>
    ${li.power === 'solar' ? '<rect x="-1.1" y="-.8" width="1.1" height="1.6" fill="#1d3b6b" stroke="#9fb6d8" stroke-width=".06" transform="rotate(180)"/>' : ''}
  </g>`;
}
function logoSVG(it) {
  const c = logoCache[it.id]; if (!c) return '';
  const [x, y, w, h] = bbox(it);
  return `<g transform="${xf(it)}"><image href="${c.out || c.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/></g>`;
}

function render(keepPanel) {
  const { l, w, color } = S.slab;
  const svg = $('#cd-svg');
  const VB = [-M, -M, l + 2 * M, w + 2 * M];
  svg.setAttribute('viewBox', VB.join(' '));
  PPF = (svg.getBoundingClientRect().width || 800) / VB[2];
  const items = S.items;
  const by = t => items.filter(i => i.type === t);
  const courts = items.filter(i => ['pickleball', 'tennis', 'basket', 'foursquare', 'hopscotch', 'shuffle'].includes(i.type));
  let s = `<defs>
    <pattern id="grass" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#6f9a57"/><path d="M0 0h3v6H0z" fill="#76a25d"/></pattern>
    <clipPath id="slabClip"><rect x="0" y="0" width="${l}" height="${w}"/></clipPath>
    <radialGradient id="poolMask"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#000" stop-opacity=".92"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="poolGlow"><stop offset="0" stop-color="#fff4c8" stop-opacity=".3"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></radialGradient>
    <mask id="nightMask" maskUnits="userSpaceOnUse" x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}">
      <rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="#fff"/>
      ${pools().map(p => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" transform="rotate(${p.deg} ${p.cx} ${p.cy})" fill="url(#poolMask)"/>`).join('')}
    </mask>
  </defs>
  <rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="url(#grass)"/>
  <rect x=".6" y=".6" width="${l}" height="${w}" fill="rgba(0,0,0,.18)"/>
  <rect x="0" y="0" width="${l}" height="${w}" fill="${color}"/>
  <g clip-path="url(#slabClip)">
    ${courts.map(fillSVG).join('')}
    ${by('logo').map(logoSVG).join('')}
    ${courts.map(linesSVG).join('')}
  </g>
  <g class="x3d">${courts.map(netSVG).join('')}
  ${by('fence').map(fenceSVG).join('')}
  ${by('hoop').map(hoopSVG).join('')}
  ${by('light').map(lightSVG).join('')}</g>`;
  if (S.night) {
    s += `<g class="x3d">`;
    s += `<rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="#060b18" opacity=".82" mask="url(#nightMask)" pointer-events="none"/>`;
    s += pools().map(p => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" transform="rotate(${p.deg} ${p.cx} ${p.cy})" fill="url(#poolGlow)" pointer-events="none"/>`).join('');
    s += by('light').map(lightSVG).join('');
    s += `</g>`;
  }
  // dimensions
  const dim = `font-size="${13 / PPF}" font-family="system-ui,sans-serif" font-weight="700" fill="#fff" stroke="rgba(0,0,0,.5)" stroke-width=".35" paint-order="stroke" text-anchor="middle"`;
  s += `<text class="cd-dim" x="${l / 2}" y="${-M + 18 / PPF}" ${dim}>${ftin(l)} long</text><text class="cd-dim" ${dim} transform="translate(${-M + 16 / PPF} ${w / 2}) rotate(-90)">${ftin(w)} wide</text>`;
  // hit layer: large items first so small ones win
  const hits = items.filter(i => i.type !== 'fence').map(i => ({ i, b: bbox(i) })).sort((a, b) => b.b[2] * b.b[3] - a.b[2] * a.b[3]);
  s += `<g class="cd-hits">`;
  const mh = 34 / PPF; // keep small things easy to grab with a finger
  s += hits.map(({ i, b }) => { const ew = Math.max(0, mh - b[2]) / 2, eh = Math.max(0, mh - b[3]) / 2; return `<g transform="${xf(i)}"><rect class="hit" data-id="${i.id}" x="${b[0] - ew}" y="${b[1] - eh}" width="${b[2] + 2 * ew}" height="${b[3] + 2 * eh}" fill="transparent"/></g>`; }).join('');
  s += by('fence').map(f => `<g transform="${xf(f)}"><rect class="hit" data-id="${f.id}" x="0" y="${-mh / 2}" width="${fenceLen(f)}" height="${mh}" fill="transparent"/>${f.gates.map((g, k) => `<rect class="hit" data-id="${f.id}" data-h="gate" data-g="${k}" x="${g.t}" y="${-mh / 1.6}" width="${g.w}" height="${mh * 1.25}" fill="transparent"/>`).join('')}</g>`).join('');
  const it = items.find(i => i.id === sel);
  if (it) {
    const hs = 10 / PPF;
    if (it.type === 'fence') {
      s += `<g transform="${xf(it)}" class="cd-sel"><rect x="-.5" y="-.9" width="${fenceLen(it) + 1}" height="1.8"/></g>`;
      s += `<circle class="hit cd-handle" data-id="${it.id}" data-h="p1" cx="${it.x}" cy="${it.y}" r="${hs}"/><circle class="hit cd-handle" data-id="${it.id}" data-h="p2" cx="${it.x2}" cy="${it.y2}" r="${hs}"/>`;
    } else {
      const b = bbox(it);
      s += `<g transform="${xf(it)}" class="cd-sel"><rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}"/></g>`;
      if (it.type === 'logo') s += `<g transform="${xf(it)}"><circle class="hit cd-handle" data-id="${it.id}" data-h="size" cx="${b[0] + b[2]}" cy="${b[1] + b[3]}" r="${hs}"/></g>`;
    }
  }
  s += `</g>`;
  svg.innerHTML = s;
  $('#cd-lit').textContent = S.night ? (by('light').length ? `About ${litPercent()}% of the slab is well lit` : 'Add a light pole to see coverage') : '';
  $('#cd-night').setAttribute('aria-pressed', S.night); $('#cd-night span').textContent = S.night ? 'Turn lights off' : 'Turn lights on';
  $('#cd-stage').classList.toggle('night', S.night);
  const nc = paintColors();
  $('#cd-colors').innerHTML = nc > 2 ? `<b>${nc} colors.</b> Our standard court is 2 colors; each extra color adds cost.` : `<b>${nc}-color court</b> (our standard).`;
  $('#cd-colors').classList.toggle('warn', nc > 2);
  const cur = S.items.find(i => i.id === sel), tb = $('#cd-ontool');
  tb.hidden = !cur;
  if (cur) { const edge = ['hoop', 'light', 'basket'].includes(cur.type); tb.querySelector('[data-c=xy]').textContent = edge ? 'Center on its edge' : 'Center'; tb.querySelectorAll('[data-c=x],[data-c=y]').forEach(b => b.hidden = edge); tb.querySelector('.cd-ontool-name').textContent = NAMES[cur.type];
    $('#cd-onopts').innerHTML = cur.type === 'light' ? seg('heads', cur.heads, cur.power === 'solar' ? [[1, 'Single'], [2, 'Double']] : [[1, 'Single'], [2, 'Double'], [3, 'Triple']]) : cur.type === 'fence' ? seg('h', cur.h, [[4, '4 ft'], [6, '6 ft'], [8, '8 ft']]) : ''; }
  if (!keepPanel) { panel(); syncColors(); } list(); save();
  if (window.CD3 && window.CD3.active) window.CD3.update();
}

/* ---------- panel ---------- */
function swatches(key, val, opts = COLORS, allowNone = false) {
  const custom = !opts.some(o => o[1].toLowerCase() === String(val).toLowerCase()) && val && val !== 'ghost';
  return `<div class="cd-sw" data-key="${key}">${allowNone ? `<button type="button" data-v="" aria-pressed="${!val}" class="none" title="None">None</button>` : ''}${opts.map(([n, c]) => `<button type="button" data-v="${c}" aria-pressed="${String(val).toLowerCase() === c.toLowerCase()}" title="${n}" aria-label="${n}" style="--c:${c === 'ghost' ? 'transparent' : c}" class="${c === 'ghost' ? 'ghost' : ''}">${c === 'ghost' ? 'Ghost' : ''}</button>`).join('')}<label class="cd-custom" title="Pick any color" aria-pressed="${!!custom}"><input type="color" data-key="${key}" value="${custom ? val : '#ffffff'}"><span>Any</span></label></div>`;
}
const seg = (key, val, opts) => `<div class="cd-seg" data-key="${key}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(val) === String(v)}">${t}</button>`).join('')}</div>`;
const row = (label, html) => `<div class="cd-row"><span class="cd-lbl">${label}</span>${html}</div>`;
const NAMES = { pickleball: 'Pickleball court', tennis: 'Tennis court', basket: 'Basketball lines', hoop: 'Basketball hoop', light: 'Light pole', fence: 'Chain link fence', logo: 'Your logo', foursquare: 'Four square', hopscotch: 'Hopscotch', shuffle: 'Shuffleboard' };

function panel() {
  const box = $('#cd-insp'), it = S.items.find(i => i.id === sel);
  if (!it) { box.innerHTML = `<p class="cd-hint">Tap anything on the court to change it. Drag to move it.</p>`; return; }
  let h = `<div class="cd-insp-head"><b>${NAMES[it.type]}</b><span><button type="button" class="cd-mini" data-act="dup" title="Duplicate">Duplicate</button><button type="button" class="cd-mini warn" data-act="del" title="Delete">Delete</button></span></div>`;
  if (it.type === 'pickleball') {
    h += row('Paint', seg('fill', it.fill, [[true, 'Paint court colors'], [false, 'Lines only']]));
    if (it.fill) h += row('Court color', swatches('color', it.color)) + row('Kitchen color', `<div class="cd-seg" data-key="kitchen"><button type="button" data-v="border" aria-pressed="${it.kitchen === 'border'}">Same as border</button><button type="button" data-v="court" aria-pressed="${it.kitchen === 'court'}">Same as court</button></div><details class="cd-more"${['border', 'court'].includes(it.kitchen) ? '' : ' open'}><summary>Pick a 3rd color (adds cost)</summary>${swatches('kitchen', ['border', 'court'].includes(it.kitchen) ? '' : it.kitchen)}</details>`);
    h += row('Line color', swatches('line', it.line, LINE_COLORS)) + row('Net', seg('net', it.net, [[true, 'Show net'], [false, 'No net']]));
    h += `<div class="cd-btns"><button type="button" class="cd-mini" data-act="rot">Rotate 90°</button></div>`;
  } else if (it.type === 'tennis') {
    h += row('Paint', seg('fill', it.fill, [[true, 'Paint court color'], [false, 'Lines only']]));
    if (it.fill) h += row('Court color', swatches('color', it.color));
    h += row('Line color', swatches('line', it.line, LINE_COLORS)) + row('Net', seg('net', it.net, [[true, 'Show net'], [false, 'No net']]));
    h += `<div class="cd-btns"><button type="button" class="cd-mini" data-act="rot">Rotate 90°</button></div>`;
  } else if (it.type === 'basket') {
    h += row('Line package', seg('pkg', it.pkg, [['basic', 'Basic'], ['middle', 'Middle'], ['top', 'Top']]) + `<small class="cd-note">${PKG[it.pkg]}</small>`);
    h += row('Court', seg('ext', it.ext, [['half', 'Half court'], ['full', 'Full court']]));
    if (it.ext === 'full') h += row('Baseline to baseline', `<label class="cd-num"><input type="number" min="40" max="94" step="1" data-key="len" value="${it.len}"> ft</label>`);
    h += row('Line color', seg('line', it.line, BB_LINES) + `<small class="cd-note">Ghost lines are the court color a few shades lighter.</small>`);
    if (it.pkg !== 'basic') h += row('Paint the key', swatches('key', it.key, COLORS, true));
    h += `<div class="cd-btns"><button type="button" class="cd-mini" data-act="rot">Turn 90°</button><button type="button" class="cd-mini" data-act="hoopHere">Add a hoop here</button></div>`;
  } else if (['foursquare', 'hopscotch', 'shuffle'].includes(it.type)) {
    h += row('Line color', swatches('line', it.line, LINE_COLORS));
    h += `<div class="cd-btns"><button type="button" class="cd-mini" data-act="rot">Rotate 90°</button></div>`;
    h += `<p class="cd-hint">${{ foursquare: '16 x 16 ft with four 8 ft squares.', hopscotch: 'About 4 x 16 ft with 2 ft boxes.', shuffle: '52 x 6 ft lane with scoring triangles at both ends.' }[it.type]}</p>`;
  } else if (it.type === 'hoop') {
    h += row('Backboard', seg('bb', it.bb, [[54, '54"'], [60, '60"'], [72, '72"']]));
    h += `<p class="cd-hint">Hoops turn to face the court on their own. Put the pole on a baseline and the rim lands where the lines expect it.</p>`;
  } else if (it.type === 'light') {
    h += row('Fixtures on the pole', seg('heads', it.heads, it.power === 'solar' ? [[1, 'Single'], [2, 'Double']] : [[1, 'Single'], [2, 'Double'], [3, 'Triple']]));
    h += row('Power', seg('power', it.power, [['wired', '150W wired'], ['solar', '100W solar']]));
    const P = LIGHT[it.power];
    h += `<p class="cd-hint"><b>This pole lights about ${(P.sqft * it.heads).toLocaleString()} sq ft</b> (${it.heads} x ${P.sqft.toLocaleString()} sq ft). 16 ft Dominator pole. ${it.power === 'solar' ? 'Each solar light covers about 40 x 50 ft. Solar comes in single or double.' : 'Each 150W light reaches about 30 ft.'} Lights aim straight into the court from the closest edge. Tap "Turn lights on" to see coverage.</p>`;
  } else if (it.type === 'fence') {
    h += row('Height', seg('h', it.h, [[4, '4 ft'], [6, '6 ft'], [8, '8 ft']]));
    h += row('Color', seg('color', it.color, Object.entries(FENCE_COLORS).map(([k, v]) => [k, v[0]])));
    h += row('Length', `<label class="cd-num"><input type="number" min="2" max="300" step=".5" data-key="flen" value="${Math.round(fenceLen(it) * 2) / 2}"> ft</label>`);
    h += row('Gates', (it.gates.length ? `<ul class="cd-gates">${it.gates.map((g, k) => `<li>${g.w > 6 ? 'Double drive gate' : 'Walk gate'} (${g.w} ft) <button type="button" class="cd-mini warn" data-act="gdel" data-g="${k}">Remove</button></li>`).join('')}</ul>` : '') + `<div class="cd-btns"><button type="button" class="cd-mini" data-act="gate4">+ Walk gate (4 ft)</button><button type="button" class="cd-mini" data-act="gate10">+ Double gate (10 ft)</button></div><small class="cd-note">Drag a gate to slide it along the fence. Drag the round ends to stretch or angle the fence.</small>`);
  } else if (it.type === 'logo') {
    h += row('Size', `<input type="range" min="2" max="${Math.max(10, S.slab.l)}" step=".5" data-key="w" value="${it.w}"><small class="cd-note">${ftin(it.w)} wide</small>`);
    h += row('Turn', `<input type="range" min="-180" max="180" step="1" data-key="rot" value="${it.rot}">`);
    h += row('Background', seg('erase', !!it.erase, [[false, 'Keep background'], [true, 'Erase background']]));
  }
  box.innerHTML = h;
}
function list() {
  const ul = $('#cd-list');
  ul.innerHTML = S.items.length ? S.items.map(i => `<li><button type="button" data-sel="${i.id}" aria-pressed="${i.id === sel}">${NAMES[i.type]}${i.type === 'fence' ? ` · ${i.h} ft, ${Math.round(fenceLen(i))} ft long` : i.type === 'light' ? ` · ${['', 'single', 'double', 'triple'][i.heads]}` : i.type === 'basket' ? ` · ${i.pkg}` : ''}</button></li>`).join('') : '<li class="cd-hint">Nothing added yet.</li>';
}

/* ---------- edits ---------- */
function commit() { hist.push(snap); if (hist.length > 60) hist.shift(); fut.length = 0; snap = JSON.stringify(S); }
let snap = '';
function setProp(it, key, v) {
  if (['fill', 'net', 'erase'].includes(key)) v = v === true || v === 'true';
  if (['heads', 'bb', 'h', 'len', 'w', 'rot'].includes(key)) v = +v;
  if (key === 'flen') {
    const L = fenceLen(it) || 1, n = clamp(+v || 1, 2, 300);
    it.x2 = it.x + (it.x2 - it.x) / L * n; it.y2 = it.y + (it.y2 - it.y) / L * n;
    it.gates = it.gates.filter(g => g.t + g.w <= n);
    return;
  }
  if (key === 'power' && v === 'solar' && it.heads > 2) it.heads = 2;
  if (key === 'ext' && v === 'full' && it.ext !== 'full') {
    const [ux, uy] = dir(it.rot);
    const span = ux ? (ux > 0 ? S.slab.l - it.x : it.x) : (uy > 0 ? S.slab.w - it.y : it.y);
    it.len = clamp(Math.round(span), 40, 94);
    it[key] = v;
    const fx = it.x + ux * it.len, fy = it.y + uy * it.len;
    return;
  }
  if (key === 'erase') { it.erase = v; processLogo(it).then(() => { render(); commit(); }); return; }
  it[key] = v;
}
function act(it, a, g) {
  if (a === 'del') { S.items = S.items.filter(i => i !== it); sel = null; }
  if (a === 'dup') { const c = JSON.parse(JSON.stringify(it)); c.id = nid(); c.x += 3; c.y += 3; if (c.type === 'fence') { c.x2 += 3; c.y2 += 3; } if (c.type === 'logo') logoCache[c.id] = logoCache[it.id]; S.items.push(c); sel = c.id; }
  if (a === 'rot') it.rot = ((it.rot || 0) + 90) % 360;
  if (a === 'hoopHere') { add('hoop', { x: it.x, y: it.y }); }
  if (a === 'gate4' || a === 'gate10') {
    const w = a === 'gate4' ? 4 : 10, L = fenceLen(it);
    if (L < w + 1) { toast('Make the fence longer first.'); return; }
    let t = r2(L / 2 - w / 2);
    for (let k = 0; k < 40 && it.gates.some(q => t < q.t + q.w && t + w > q.t); k++) t = r2((t + w + 1) % (L - w));
    it.gates.push({ t, w });
  }
  if (a === 'gdel') it.gates.splice(+g, 1);
}
$('#cd-insp').addEventListener('click', e => {
  const it = S.items.find(i => i.id === sel); if (!it) return;
  const b = e.target.closest('button'); if (!b) return;
  const grp = b.closest('[data-key]');
  if (b.dataset.act) act(it, b.dataset.act, b.dataset.g);
  else if (grp && b.dataset.v !== undefined) setProp(it, grp.dataset.key, b.dataset.v);
  else return;
  render(); commit();
});
$('#cd-insp').addEventListener('input', e => {
  const it = S.items.find(i => i.id === sel); const k = e.target.dataset.key; if (!it || !k) return;
  setProp(it, k, e.target.value);
  if (e.target.type === 'range') { renderLight(); } else render();
});
$('#cd-insp').addEventListener('change', e => { if (e.target.dataset.key) { render(); commit(); } });
function renderLight() { // re-render but keep the panel (so a slider stays grabbed)
  render(true);
  const it = S.items.find(i => i.id === sel), n = $('#cd-insp .cd-note');
  if (it && it.type === 'logo' && n) n.textContent = `${ftin(it.w)} wide`;
}
$('#cd-list').addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) { sel = b.dataset.sel; render(); } });

function centerItem(it, how) {
  const { l, w } = S.slab;
  if (it.type === 'fence') { const mx = (it.x + it.x2) / 2, my = (it.y + it.y2) / 2, dx = how !== 'y' ? l / 2 - mx : 0, dy = how !== 'x' ? w / 2 - my : 0; it.x += dx; it.x2 += dx; it.y += dy; it.y2 += dy; return; }
  if (it.type === 'basket') {
    const r = ((it.rot || 0) % 360 + 360) % 360;
    if (r === 0 || r === 180) { it.y = w / 2; if (it.ext === 'full') it.x = r === 0 ? (l - it.len) / 2 : (l + it.len) / 2; }
    else { it.x = l / 2; if (it.ext === 'full') it.y = r === 90 ? (w - it.len) / 2 : (w + it.len) / 2; }
    return;
  }
  if (it.type === 'hoop' || it.type === 'light') { const f = hoopFacing(it); if (f === 0 || f === 180) it.y = w / 2; else it.x = l / 2; return; }
  if (how !== 'y') it.x = l / 2; if (how !== 'x') it.y = w / 2;
}
$('#cd-ontool').addEventListener('click', e => {
  const b = e.target.closest('button'), it = S.items.find(i => i.id === sel); if (!b || !it) return;
  const g = b.closest('[data-key]');
  if (b.dataset.c) centerItem(it, b.dataset.c); else if (b.dataset.act) act(it, b.dataset.act); else if (g && b.dataset.v !== undefined) setProp(it, g.dataset.key, b.dataset.v); else return;
  render(); commit();
});

/* slab */
function syncSlab() {
  $('#cd-L').value = S.slab.l; $('#cd-W').value = S.slab.w;
}
$('#cd-slabform').addEventListener('change', () => {
  S.slab.l = clamp(Math.round(+$('#cd-L').value || 60), 10, 200); S.slab.w = clamp(Math.round(+$('#cd-W').value || 30), 10, 200);
  syncSlab(); render(); commit();
});
/* court colors: border, play area, kitchen (applies to every painted court) */
function syncColors() {
  const courts = S.items.filter(i => (i.type === 'pickleball' || i.type === 'tennis') && i.fill), pb = courts.find(i => i.type === 'pickleball');
  let h = row('Border', swatches('border', S.slab.color));
  if (courts.length) {
    h += row('Play area', swatches('play', courts[0].color));
    if (pb) {
      const k = pb.kitchen, std = ['border', 'court'].includes(k);
      h += row('Kitchen', `<div class="cd-seg" data-key="kitchen"><button type="button" data-v="border" aria-pressed="${k === 'border'}">Same as border</button><button type="button" data-v="court" aria-pressed="${k === 'court'}">Same as play area</button></div><details class="cd-more"${std ? '' : ' open'}><summary>Pick a 3rd color (adds cost)</summary>${swatches('kitchen', std ? '' : k)}</details>`);
    }
  } else h += `<p class="cd-hint">Add pickleball or tennis lines to pick the play area and kitchen colors.</p>`;
  $('#cd-colorsbox').innerHTML = h;
}
function setColor(key, v) {
  if (key === 'border') S.slab.color = v;
  for (const i of S.items) {
    if (key === 'play' && (i.type === 'pickleball' || i.type === 'tennis') && i.fill) i.color = v;
    if (key === 'kitchen' && i.type === 'pickleball') i.kitchen = v;
  }
}
$('#cd-colorsbox').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]'), g = b && b.closest('[data-key]'); if (!g) return;
  setColor(g.dataset.key, b.dataset.v); render(); commit();
});
$('#cd-colorsbox').addEventListener('input', e => { if (e.target.type === 'color') { setColor(e.target.dataset.key, e.target.value); render(true); } });
$('#cd-colorsbox').addEventListener('change', e => { if (e.target.type === 'color') { render(); commit(); } });
$('#cd-presets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button type="button" class="cd-chip" data-p="${k}">${p[0]}<small>${p[1]} x ${p[2]}</small></button>`).join('');
$('#cd-presets').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  if (S.items.length && !confirmSoft(b)) return;
  const [, L, W, fn] = PRESETS[b.dataset.p];
  const keepColor = S.slab.color; S = blank(L, W); S.slab.color = keepColor; fn(S); sel = null; syncSlab(); render(); commit();
});
function confirmSoft(b) { // two-tap confirm instead of a browser dialog
  if (b.dataset.armed) return true;
  b.dataset.armed = 1; const t = b.innerHTML; b.innerHTML = 'Tap again to replace your design';
  setTimeout(() => { delete b.dataset.armed; b.innerHTML = t; }, 2600);
  return false;
}

/* add buttons + the options new items start with */
const ADD = { heads: 1, power: 'wired', h: 6 };
$('.cd-panel').addEventListener('click', e => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  const { l, w } = S.slab; let it;
  switch (b.dataset.add) {
    case 'pickleball': it = add('pickleball', { x: l / 2, y: w / 2, rot: l >= w ? 0 : 90 }); break;
    case 'tennis': it = add('tennis', { x: l / 2, y: w / 2, rot: l >= w ? 0 : 90 }); break;
    case 'basket': it = addBasket(l >= w ? { x: 0, y: w / 2, rot: 0 } : { x: w / 2, y: 0, rot: 90 }); break;
    case 'hoop': it = add('hoop', { x: 0, y: w / 2 }); break;
    case 'light': {
      const spots = [[l / 2, -2], [l / 4, -2], [3 * l / 4, -2], [l / 2, w + 2], [l / 4, w + 2], [3 * l / 4, w + 2], [-2, w / 2], [l + 2, w / 2]];
      const free = spots.find(([x, y]) => !S.items.some(i => i.type === 'light' && Math.hypot(i.x - x, i.y - y) < 6)) || [l / 2, -2];
      it = add('light', { x: free[0], y: free[1], heads: ADD.heads, power: ADD.power }); break;
    }
    case 'fence': it = add('fence', { x: 0, y: w + 0, x2: Math.min(30, l), y2: w, h: ADD.h }); break;
    case 'fenceall': {
      const pts = [[0, 0], [l, 0], [l, w], [0, w]];
      pts.forEach((p, k) => { const q = pts[(k + 1) % 4]; it = add('fence', { x: p[0], y: p[1], x2: q[0], y2: q[1], h: ADD.h }); });
      it.gates.push({ t: r2(w / 2 - 2), w: 4 });
      break;
    }
    case 'logo': $('#cd-logofile').click(); return;
    case 'foursquare': case 'hopscotch': it = add(b.dataset.add, { x: l / 2, y: w / 2 }); break;
    case 'shuffle': it = add('shuffle', { x: l / 2, y: w / 2, rot: l >= w ? 0 : 90 }); break;
  }
  sel = it.id; render(); commit();
  if (matchMedia('(max-width: 900px)').matches) $('#cd-stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* logo upload + background eraser */
$('#cd-logofile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Please pick an image file (PNG, JPG or SVG).'); return; }
  const src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  const img = await loadImg(src).catch(() => null);
  if (!img) { toast('That image could not be opened.'); return; }
  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const it = add('logo', { x: S.slab.l / 2, y: S.slab.w / 2, w: Math.round(Math.min(S.slab.l, S.slab.w) * .4), ar: c.width / c.height, erase: false });
  logoCache[it.id] = { src: c.toDataURL('image/png') };
  sel = it.id; render(); commit();
});
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function processLogo(it) {
  const c0 = logoCache[it.id]; if (!c0) return;
  if (!it.erase) { c0.out = null; return; }
  const img = await loadImg(c0.src), c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, W = c.width, H = c.height;
  // background = most common color around the border
  const tally = {}; let best = null, bn = 0;
  const at = (i, j) => (j * W + i) * 4;
  const border = []; for (let i = 0; i < W; i++) border.push([i, 0], [i, H - 1]); for (let j = 0; j < H; j++) border.push([0, j], [W - 1, j]);
  for (const [i, j] of border) { const k = at(i, j); if (p[k + 3] < 20) continue; const q = (p[k] >> 4) + ',' + (p[k + 1] >> 4) + ',' + (p[k + 2] >> 4); tally[q] = (tally[q] || 0) + 1; if (tally[q] > bn) { bn = tally[q]; best = [p[k], p[k + 1], p[k + 2]]; } }
  if (!best) { c0.out = null; toast('This logo already has a clear background.'); return; }
  const dist = k => Math.hypot(p[k] - best[0], p[k + 1] - best[1], p[k + 2] - best[2]);
  const T = 60, seen = new Uint8Array(W * H), stack = [];
  for (const [i, j] of border) stack.push(j * W + i);
  while (stack.length) { // flood fill from the edges so the inside of letters stays
    const n = stack.pop(); if (seen[n]) continue; seen[n] = 1;
    const k = n * 4, dd = dist(k);
    if (dd > T * 1.6) continue;
    p[k + 3] = dd < T ? 0 : Math.round(p[k + 3] * (dd - T) / (T * .6));
    if (dd >= T) continue;
    const i = n % W, j = (n / W) | 0;
    if (i > 0) stack.push(n - 1); if (i < W - 1) stack.push(n + 1); if (j > 0) stack.push(n - W); if (j < H - 1) stack.push(n + W);
  }
  x.putImageData(d, 0, 0); c0.out = c.toDataURL('image/png');
}

/* ---------- dragging ---------- */
const svg = $('#cd-svg');
let drag = null;
function pt(e) { const m = svg.getScreenCTM().inverse(); const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return [p.x, p.y]; }
svg.addEventListener('pointerdown', e => {
  const t = e.target.closest('.hit');
  if (!t) { if (sel) { sel = null; render(); } return; }
  e.preventDefault();
  const it = S.items.find(i => i.id === t.dataset.id); if (!it) return;
  if (sel !== it.id) { sel = it.id; render(); }
  drag = { it, h: t.dataset.h || 'move', g: +t.dataset.g, p0: pt(e), o: JSON.parse(JSON.stringify(it)), moved: false };
  svg.setPointerCapture(e.pointerId);
});
svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const [x, y] = pt(e), dx = x - drag.p0[0], dy = y - drag.p0[1], { it, o, h } = drag;
  if (!drag.moved && Math.hypot(dx, dy) < .3) return;
  drag.moved = true;
  const { l, w } = S.slab;
  const cx = v => clamp(v, -M + 1, l + M - 1), cy = v => clamp(v, -M + 1, w + M - 1);
  if (h === 'move') {
    if (it.type === 'fence') {
      const nx = r2(o.x + dx) - o.x, ny = r2(o.y + dy) - o.y;
      it.x = o.x + nx; it.y = o.y + ny; it.x2 = o.x2 + nx; it.y2 = o.y2 + ny;
    } else {
      it.x = r2(cx(o.x + dx)); it.y = r2(cy(o.y + dy));
      if (it.type === 'basket' || it.type === 'hoop') { // snap baselines to slab edges
        if (Math.abs(it.x) < 1.5) it.x = 0; if (Math.abs(it.x - l) < 1.5) it.x = l;
        if (Math.abs(it.y) < 1.5) it.y = 0; if (Math.abs(it.y - w) < 1.5) it.y = w;
      }
    }
  } else if (h === 'p1' || h === 'p2') {
    const ax = h === 'p1' ? o.x2 : o.x, ay = h === 'p1' ? o.y2 : o.y;
    let nx = (h === 'p1' ? o.x : o.x2) + dx, ny = (h === 'p1' ? o.y : o.y2) + dy;
    let ang = Math.atan2(ny - ay, nx - ax), len = Math.max(2, r2(Math.hypot(nx - ax, ny - ay)));
    const q = Math.round(ang / (Math.PI / 4)) * Math.PI / 4; if (Math.abs(ang - q) < .09) ang = q;
    nx = ax + Math.cos(ang) * len; ny = ay + Math.sin(ang) * len;
    // snap to slab corners and edges
    for (const v of [0, l]) if (Math.abs(nx - v) < 1) nx = v;
    for (const v of [0, w]) if (Math.abs(ny - v) < 1) ny = v;
    if (h === 'p1') { it.x = nx; it.y = ny; } else { it.x2 = nx; it.y2 = ny; }
    const L = fenceLen(it); it.gates = o.gates.filter(g => g.t + g.w <= L);
  } else if (h === 'gate') { // slide along any fence; hop to whichever fence is closest
    const g = drag.gate || (drag.gate = it.gates[drag.g]);
    let best = null;
    for (const f of S.items.filter(i => i.type === 'fence')) {
      const L = fenceLen(f); if (L < g.w) continue;
      const ux = (f.x2 - f.x) / L, uy = (f.y2 - f.y) / L;
      const t = clamp((x - f.x) * ux + (y - f.y) * uy, 0, L), d = Math.hypot(f.x + ux * t - x, f.y + uy * t - y);
      if (!best || d < best.d) best = { f, t, L, d };
    }
    if (best) {
      if (best.f !== drag.it) {
        drag.it.gates = drag.it.gates.filter(q => q !== g); best.f.gates.push(g);
        drag.it = best.f; sel = best.f.id;
      }
      g.t = clamp(r2(best.t - g.w / 2), 0, best.L - g.w);
    }
  } else if (h === 'size') {
    const a = -(it.rot || 0) * Math.PI / 180;
    const lx = (x - it.x) * Math.cos(a) - (y - it.y) * Math.sin(a);
    it.w = clamp(r2(lx * 2), 2, Math.max(10, l));
  }
  render(true);
});
const endDrag = () => { if (drag) { if (drag.moved) { render(); commit(); } drag = null; } };
svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  const it = S.items.find(i => i.id === sel); if (!it) return;
  const mv = { ArrowLeft: [-.5, 0], ArrowRight: [.5, 0], ArrowUp: [0, -.5], ArrowDown: [0, .5] }[e.key];
  if (mv) { e.preventDefault(); it.x += mv[0]; it.y += mv[1]; if (it.type === 'fence') { it.x2 += mv[0]; it.y2 += mv[1]; } render(); commit(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act(it, 'del'); render(); commit(); }
});

/* ---------- undo, night, save, share ---------- */
function undo() { if (!hist.length) return; fut.push(snap); snap = hist.pop(); S = JSON.parse(snap); sel = null; syncSlab(); render(); }
function redo() { if (!fut.length) return; hist.push(snap); snap = fut.pop(); S = JSON.parse(snap); sel = null; syncSlab(); render(); }
$('#cd-undo').onclick = undo;
$('#cd-night').onclick = () => { S.night = !S.night; render(); };
$('#cd-reset').onclick = e => { if (!confirmSoft(e.currentTarget)) return; S = blank(); sel = null; syncSlab(); render(); commit(); };
function save() {
  try { localStorage.setItem('ace-court-design', JSON.stringify(S)); } catch (e) { }
  try { const L = {}; for (const i of S.items) if (i.type === 'logo' && logoCache[i.id]) L[i.id] = logoCache[i.id].src; localStorage.setItem('ace-court-logos', JSON.stringify(L)); } catch (e) { }
}
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function shareLink() {
  const lite = JSON.parse(JSON.stringify(S)); lite.items = lite.items.filter(i => i.type !== 'logo'); lite.night = false;
  return location.origin + location.pathname + '#d=' + b64(JSON.stringify(lite));
}
$('#cd-share').onclick = async () => {
  const u = shareLink();
  try { await navigator.clipboard.writeText(u); toast('Link copied. Logos are not included in links.'); } catch (e) { prompt('Copy this link:', u); }
};
function toast(m) { const t = $('#cd-toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3400); }

/* ---------- summary + image ---------- */
function summary() {
  const { l, w, color } = S.slab, it = S.items, nc = paintColors(), out = [`Slab: ${l} x ${w} ft, border color ${colorName(color)}`, `Paint colors: ${nc}${nc > 2 ? ' (more than our standard 2-color court)' : ' (standard)'}`];
  const n = {};
  for (const i of it) {
    n[i.type] = (n[i.type] || 0) + 1; const k = `${NAMES[i.type]} ${n[i.type]}`;
    if (i.type === 'pickleball' || i.type === 'tennis') out.push(`${k}: ${i.fill ? `court ${colorName(i.color)}${i.type === 'pickleball' ? `, kitchen ${i.kitchen === 'border' ? 'same as border' : i.kitchen === 'court' ? 'same as court' : colorName(i.kitchen)}` : ''}` : 'lines only'}, lines ${colorName(i.line)}${i.net ? ', net' : ''}`);
    if (i.type === 'basket') out.push(`${k}: ${i.ext === 'full' ? `full court (${i.len} ft)` : 'half court'}, ${i.pkg} package, high school lines, lines ${colorName(i.line)}${i.key && i.pkg !== 'basic' ? `, key painted ${colorName(i.key)}` : ''}`);
    if (['foursquare', 'hopscotch', 'shuffle'].includes(i.type)) out.push(`${k}: lines ${colorName(i.line)}`);
    if (i.type === 'hoop') out.push(`${k}: ${i.bb}" backboard`);
    if (i.type === 'light') out.push(`${k}: 16 ft pole, ${i.heads} x ${LIGHT[i.power].label}`);
  }
  const fences = it.filter(i => i.type === 'fence');
  if (fences.length) {
    const by = {}; let gw = 0, gd = 0;
    for (const f of fences) { const key = `${f.h} ft ${FENCE_COLORS[f.color][0].toLowerCase()}`; by[key] = (by[key] || 0) + fenceLen(f); for (const g of f.gates) g.w > 6 ? gd++ : gw++; }
    out.push('Chain link fence: ' + Object.entries(by).map(([k, v]) => `${Math.round(v)} ft of ${k}`).join(', ') + (gw ? `, ${gw} walk gate${gw > 1 ? 's' : ''}` : '') + (gd ? `, ${gd} double gate${gd > 1 ? 's' : ''}` : ''));
  }
  const logos = it.filter(i => i.type === 'logo').length; if (logos) out.push(`Custom logo: ${logos}`);
  return out.join('\n');
}
async function pngData(width = 1600) {
  const keepSel = sel, keepNight = S.night; sel = null; render();
  const clone = svg.cloneNode(true); clone.setAttribute('xmlns', NS);
  clone.querySelectorAll('.cd-hits').forEach(n => n.remove());
  const vb = svg.viewBox.baseVal, H = Math.round(width * vb.height / vb.width);
  clone.setAttribute('width', width); clone.setAttribute('height', H);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = await loadImg(url);
  const foot = 64, c = document.createElement('canvas'); c.width = width; c.height = H + foot;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, width, H);
  x.fillStyle = '#12243F'; x.fillRect(0, H, width, foot);
  x.fillStyle = '#fff'; x.font = '700 26px system-ui, sans-serif'; x.textBaseline = 'middle';
  x.fillText('ACE COATINGS  ·  Court design', 28, H + foot / 2);
  x.textAlign = 'right'; x.font = '500 22px system-ui, sans-serif'; x.fillText(`${S.slab.l} x ${S.slab.w} ft  ·  acecoatingsutah.com  ·  385-269-0060`, width - 28, H + foot / 2);
  sel = keepSel; S.night = keepNight; render();
  return c.toDataURL('image/png');
}
$('#cd-png').onclick = async () => {
  const d = await pngData(); const a = document.createElement('a'); a.href = d; a.download = 'ace-coatings-court-design.png'; document.body.appendChild(a); a.click(); a.remove();
};

/* ---------- send ---------- */
const dlg = $('#cd-send');
$('#cd-export').onclick = () => { dlg.hidden = false; $('#cd-sum').textContent = summary(); setTimeout(() => $('#cd-name').focus(), 50); dlg.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('#cd-cancel').onclick = () => { dlg.hidden = true; };
$('#cd-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.currentTarget, msg = $('#cd-msg'), btn = $('#cd-go');
  const name = f.name.value.trim(), email = f.email.value.trim(), phone = f.phone.value.trim();
  if (!name) return say('Please add your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Please check your email address.');
  if (phone.replace(/\D/g, '').length < 10) return say('Please add a 10-digit phone number.');
  btn.disabled = true; btn.textContent = 'Sending…'; say('');
  try {
    const png = await pngData(1400);
    const r = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, phone, company: f.company.value, summary: summary(), link: shareLink(), png, page: location.href.split('#')[0], submitted_at: new Date().toISOString() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
    try { window.gtag && (gtag('event', 'generate_lead', { form: 'court_designer' }), gtag('event', 'conversion', { send_to: 'AW-730409131/V7sBCLvul_IYEKvRpNwC', value: 1, currency: 'USD' })); window.fbq && fbq('track', 'Lead'); } catch (er) { }
    f.hidden = true;
    $('#cd-done').hidden = false;
    $('#cd-done-msg').textContent = j.emailed ? `Sent! Your design is on its way to ${email}. We'll reach out soon with a quote.` : `Got it! We have your design and will reach out soon with a quote. Save a copy with the download button.`;
  } catch (er) {
    say('That did not go through. Please try again or call 385-269-0060.');
  } finally { btn.disabled = false; btn.textContent = 'Email my design'; }
  function say(m) { msg.textContent = m; return false; }
});
$('#cd-done-png').onclick = () => $('#cd-png').click();

/* ---------- boot ---------- */
function boot() {
  let loaded = null;
  const m = location.hash.match(/d=([\w-]+)/);
  if (m) { try { loaded = JSON.parse(unb64(m[1])); } catch (e) { } }
  if (!loaded) { try { loaded = JSON.parse(localStorage.getItem('ace-court-design')); const L = JSON.parse(localStorage.getItem('ace-court-logos') || '{}'); for (const k in L) logoCache[k] = { src: L[k] }; } catch (e) { } }
  if (loaded && loaded.slab && Array.isArray(loaded.items)) {
    S = loaded; S.items = S.items.filter(i => NAMES[i.type] && (i.type !== 'logo' || logoCache[i.id]));
    for (const i of S.items) { const n = +String(i.id).slice(1); if (n >= uid) uid = n + 1; }
  } else { S = blank(); PRESETS.combo[3](S); }
  S.night = false;
  for (const i of S.items) { if (i.type === 'basket') i.arc = 'hs'; if (i.type === 'fence' && !FENCE_COLORS[i.color]) i.color = 'black'; if (i.type === 'basket' && !BB_LINES.some(o => o[0] === i.line)) i.line = '#FFFFFF'; }
  Promise.all(S.items.filter(i => i.type === 'logo' && i.erase).map(processLogo)).then(() => render());
  syncSlab(); render(); snap = JSON.stringify(S);
}
// hooks for the 3D view (designer3d.js)
async function flatTexture(ppf = 24) { // the slab paint only, as a canvas
  const { l, w } = S.slab;
  const clone = svg.cloneNode(true); clone.setAttribute('xmlns', NS);
  clone.querySelectorAll('.cd-hits,.x3d,.cd-dim').forEach(n => n.remove());
  const k = Math.min(ppf, 4096 / Math.max(l, w));
  clone.setAttribute('viewBox', `0 0 ${l} ${w}`); clone.setAttribute('width', Math.round(l * k)); clone.setAttribute('height', Math.round(w * k));
  const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone)));
  const c = document.createElement('canvas'); c.width = Math.round(l * k); c.height = Math.round(w * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
window.CD = { get S() { return S; }, flatTexture, hoopFacing, lightAim, fenceLen, pools, SPREAD, LIGHT, BB, FENCE_COLORS };
let view3d = false;
$('#cd-3d').onclick = async () => {
  view3d = !view3d; const b = $('#cd-3d');
  b.setAttribute('aria-pressed', view3d); b.querySelector('span').textContent = view3d ? 'Back to 2D' : '3D view';
  $('#cd-stage').classList.toggle('is3d', view3d); $('#cd-views').hidden = !view3d;
  if (view3d) {
    if (!window.CD3) { b.disabled = true; try { await import('/js/designer3d.js'); } catch (e) { toast('3D view could not load on this device.'); view3d = false; $('#cd-stage').classList.remove('is3d'); } b.disabled = false; }
    if (view3d) window.CD3.open($('#cd-3dbox'));
  } else if (window.CD3) window.CD3.close();
};
$('#cd-views').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b && window.CD3) window.CD3.view(b.dataset.view); });
boot();
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => render(true), 150); });
})();
