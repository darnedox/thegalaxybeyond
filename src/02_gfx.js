/* ================= RENDERER ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let QUALITY = 'high';
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

/* ================= SHARED TEXTURES ================= */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function glowTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.65)'); gr.addColorStop(0.45, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const GLOW = glowTexture();
function glowSprite(color, scale, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
  s.scale.setScalar(scale); return s;
}
function textSprite(text, color = '#ffffff', size = 1) {
  const c = makeCanvas(512, 96), g = c.getContext('2d');
  g.font = '700 54px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 256, 50); g.fillStyle = color; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(4 * size, 0.75 * size, 1); s.renderOrder = 10; return s;
}

/* ================= MODELS ================= */
function stdMat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.2 }, o)); }

// Realistic rocket exhaust: layered plume shader with turbulent noise, white-hot core,
// orange/red outer flame that cools and fades, and shock diamonds when the nitro is on.
const FLAME_T = { value: 0 };
function flameMaterial(core) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { t: FLAME_T, power: { value: 0.5 }, nitro: { value: 0 }, core: { value: core ? 1 : 0 } },
    vertexShader: `uniform float t; uniform float power; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec3 p = position; float s = 1.0 - uv.y;
        float wob = sin(t*37.0 + s*11.0 + uv.x*25.0)*0.05 + sin(t*23.0 - s*7.0)*0.04;
        p.xz *= 1.0 + wob * s;
        vec4 mv = modelViewMatrix*vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float t; uniform float power; uniform float nitro; uniform float core; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        float s = 1.0 - vUv.y;                              // 0 at the nozzle, 1 at the tip
        float facing = pow(abs(dot(vN, vV)), core > 0.5 ? 2.0 : 1.2);
        float turb = fbm(vec2(vUv.x*7.0, s*5.0 - t*(9.0 + nitro*8.0)));
        float len = min(core > 0.5 ? 0.45 + 0.25*power : 0.6 + 0.22*power, 0.96);
        float fade = (1.0 - smoothstep(len*0.25, len, s)) * smoothstep(0.0, 0.04, s);
        float heat = clamp(fade * (0.55 + 0.75*turb) * facing * (core > 0.5 ? 1.6 : 1.0), 0.0, 1.5);
        float diamonds = nitro * pow(abs(sin(s*28.0)), 10.0) * (1.0 - smoothstep(0.1, 0.7, s));
        heat += diamonds * 1.4 * facing;
        vec3 cool = mix(vec3(0.55,0.06,0.01), vec3(1.0,0.36,0.04), smoothstep(0.1,0.45,heat));
        vec3 hot = mix(vec3(1.0,0.78,0.3), vec3(1.0,0.97,0.9), smoothstep(0.75,1.2,heat));
        vec3 col = mix(cool, hot, smoothstep(0.4,0.85,heat));
        vec3 blue = mix(vec3(0.25,0.45,1.0), vec3(0.85,0.95,1.0), smoothstep(0.4,1.1,heat));
        col = mix(col, blue, nitro*0.85);
        if (core > 0.5) col = mix(col, vec3(0.75,0.85,1.0), 0.35*(1.0-s));
        float a = heat * (0.75 + 0.45*power) * (core > 0.5 ? 1.3 : 1.7) * (1.0 - 0.45*nitro);
        gl_FragColor = vec4(col * a, 1.0);
      }`,
  });
}
function plumeGeo(r0, r1, len) { const g = new THREE.CylinderGeometry(r0, r1, len, 32, 24, true); g.translate(0, -len / 2, 0); return g; }

// Rocket: the one smooth, detailed model in the game. Built nose-up (+Y).
function buildRocket(paint = '#ff3b5c') {
  const g = new THREE.Group();
  const prof = [[0, -3], [0.95, -3], [1.18, -2.1], [1.25, -0.4], [1.12, 1.4], [0.8, 2.6], [0.62, 3.0]].map(p => new THREE.Vector2(p[0], p[1]));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), stdMat('#e9eef6', { metalness: 0.6, roughness: 0.25 }));
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.63, 1.5, 40), stdMat(paint, { metalness: 0.4, roughness: 0.3 }));
  nose.position.y = 3.75; g.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.265, 1.265, 0.38, 40, 1, true), stdMat(paint, { metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide }));
  band.position.y = 0.3; g.add(band);
  const band2 = band.clone(); band2.scale.set(0.97, 0.5, 0.97); band2.position.y = -1.6; g.add(band2);
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 18), stdMat('#7ff6ff', { emissive: '#2fd8ff', emissiveIntensity: 0.9, metalness: 0.9, roughness: 0.05 }));
  win.scale.set(1, 1.15, 0.55); win.position.set(0, 1.55, 1.0); g.add(win);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 10, 32), stdMat('#b9c3d6', { metalness: 0.9, roughness: 0.2 }));
  rim.position.set(0, 1.55, 1.03); rim.scale.set(1, 1.15, 1); g.add(rim);
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(1.3, -0.9); finShape.lineTo(1.35, -2.0); finShape.lineTo(0, -1.4); finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  finGeo.translate(0, 0, -0.07);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(finGeo, stdMat(i % 2 ? '#ff8a1f' : paint, { metalness: 0.35, roughness: 0.35 }));
    const a = i * Math.PI / 2 + Math.PI / 4; f.position.set(Math.sin(a) * 1.05, -1.1, Math.cos(a) * 1.05); f.rotation.y = a - Math.PI / 2; g.add(f);
  }
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.9, 0.7, 28, 1, true), stdMat('#3a3f4c', { metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }));
  noz.position.y = -3.35; g.add(noz);
  const flameMat = flameMaterial(false), innerMat = flameMaterial(true);
  const flame = new THREE.Mesh(plumeGeo(0.58, 0.95, 7.5), flameMat); flame.position.y = -3.55;
  const inner = new THREE.Mesh(plumeGeo(0.42, 0.28, 3.2), innerMat); inner.position.y = -3.55;
  g.add(flame, inner);
  const eg = glowSprite('#ff9a4a', 4, 0.9); eg.position.y = -3.9; g.add(eg);
  g.userData = { flame, inner, eg, flameMat, innerMat };
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  flame.castShadow = inner.castShadow = false;
  return g;
}

// Shape helpers for smooth, rounded characters.
const SPH = new THREE.SphereGeometry(1, 24, 16), CYL = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
function ball(m, sx, sy, sz, x = 0, y = 0, z = 0) { const b = new THREE.Mesh(SPH, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; return b; }
// a capsule hanging down from its pivot (top at y=0)
function limb(m, r, len) {
  const g = new THREE.Group(); const c = new THREE.Mesh(CYL, m); c.scale.set(r, len, r); c.position.y = -len / 2; c.castShadow = true;
  g.add(c, ball(m, r, r, r, 0, 0, 0), ball(m, r, r, r, 0, -len, 0)); return g;
}
function cone(m, r, h, x, y, z, rx = 0, rz = 0) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), m); c.position.set(x, y, z); c.rotation.set(rx, 0, rz); c.castShadow = true; return c; }

// Hero: rounded space suit, about 1.8 units tall, feet at y=0.
function buildHero(h) {
  const g = new THREE.Group();
  const suit = stdMat(h.suit, { roughness: 0.45, metalness: 0.15 }), acc = stdMat(h.accent, { roughness: 0.4, metalness: 0.2 }), vis = stdMat(h.visor, { emissive: h.visor, emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.7 });
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  legL.position.set(-0.14, 0.7, 0); legR.position.set(0.14, 0.7, 0);
  for (const l of [legL, legR]) l.add(limb(suit, 0.12, 0.5), ball(acc, 0.15, 0.11, 0.2, 0, -0.62, 0.04));
  const torso = ball(suit, 0.31, 0.36, 0.23, 0, 1.06, 0);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 10, 28), acc); belt.rotation.x = Math.PI / 2; belt.scale.set(1.08, 0.78, 1); belt.position.y = 0.84;
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), vis); chest.position.set(0, 1.14, 0.225);
  armL.position.set(-0.36, 1.3, 0); armR.position.set(0.36, 1.3, 0);
  for (const a of [armL, armR]) a.add(limb(suit, 0.09, 0.44), ball(acc, 0.11, 0.11, 0.11, 0, -0.54, 0));
  const head = new THREE.Group(); head.position.y = 1.62;
  head.add(ball(h.style === 'robot' ? acc : suit, 0.3, 0.29, 0.29));
  const visor = ball(vis, 0.24, 0.16, 0.14, 0, 0.02, 0.17); head.add(visor);
  const shine = ball(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }), 0.05, 0.03, 0.02, -0.09, 0.08, 0.3); shine.castShadow = false; head.add(shine);
  if (h.style === 'dome') { const r = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 10, 32), acc); r.rotation.x = Math.PI / 2; r.position.y = 0.06; head.add(r); }
  if (h.style === 'horns') head.add(cone(acc, 0.06, 0.26, -0.19, 0.3, 0, 0, 0.4), cone(acc, 0.06, 0.26, 0.19, 0.3, 0, 0, -0.4));
  if (h.style === 'crest') { const c = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 24, Math.PI), acc); c.rotation.y = Math.PI / 2; c.position.y = 0.06; head.add(c); }
  if (h.style === 'robot') { const a = limb(suit, 0.025, 0.24); a.rotation.x = Math.PI; a.position.y = 0.26; head.add(a, ball(vis, 0.06, 0.06, 0.06, 0, 0.53, 0)); }
  if (h.style === 'antenna') for (const x of [-0.14, 0.14]) { const a = limb(acc, 0.02, 0.24); a.rotation.x = Math.PI; a.position.set(x, 0.24, 0); head.add(a, ball(vis, 0.055, 0.055, 0.055, x, 0.5, 0)); }
  if (h.style === 'ears') head.add(ball(acc, 0.07, 0.13, 0.05, -0.17, 0.28, 0), ball(acc, 0.07, 0.13, 0.05, 0.17, 0.28, 0));
  if (h.style === 'mohawk') for (let i = 0; i < 4; i++) head.add(cone(acc, 0.05, 0.2, 0, 0.3 - Math.abs(i - 1.5) * 0.02, 0.14 - i * 0.1, -0.3 + i * 0.1));
  if (h.style === 'jetpack') { for (const x of [-0.11, 0.11]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.46, 18), acc); c.position.set(x, 1.08, -0.3); c.castShadow = true; g.add(c, ball(vis, 0.07, 0.04, 0.07, x, 0.83, -0.3)); } }
  else g.add(ball(acc, 0.22, 0.24, 0.1, 0, 1.08, -0.22));
  g.add(legL, legR, torso, belt, chest, armL, armR, head);
  g.userData = { legL, legR, armL, armR, head, walk: 0 };
  return g;
}
function animateHero(g, speed, dt) {
  const u = g.userData; u.walk += dt * (4 + speed * 1.6) * (speed > 0.2 ? 1 : 0);
  const s = speed > 0.2 ? Math.sin(u.walk) * 0.7 : damp(u.legL.rotation.x, 0, 10, dt);
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = u.swing > 0 ? -1.6 + Math.sin(u.swing * 12) * 0.6 : s * 0.8;
  if (u.swing > 0) u.swing -= dt;
  if (u.swim) { u.walk += dt * 5; const k = Math.sin(u.walk * 1.2); u.armL.rotation.x = -1.4 + k * 1.1; u.armR.rotation.x = u.swing > 0 ? u.armR.rotation.x : -1.4 - k * 1.1; u.legL.rotation.x = Math.sin(u.walk * 2.4) * 0.5; u.legR.rotation.x = -u.legL.rotation.x; }
}

// Villager / helper: short round alien with a class hat.
const HELPER_CLASSES = {
  miner: { label: 'Miner', hat: '#ff8a1f', tip: 'digs up minerals for you' },
  fighter: { label: 'Fighter', hat: '#ff3b5c', tip: 'zaps monsters near you' },
  builder: { label: 'Builder', hat: '#ffd34d', tip: 'brings you building pieces' },
  farmer: { label: 'Farmer', hat: '#5fd35a', tip: 'grows star fruit that heals you' },
};
function buildVillager(bodyColor, cls) {
  const g = new THREE.Group();
  const m = stdMat(bodyColor, { roughness: 0.55, metalness: 0 });
  const body = ball(m, 0.32, 0.36, 0.28, 0, 0.42, 0);
  const head = new THREE.Group(); head.position.y = 0.98; head.add(ball(m, 0.3, 0.27, 0.27));
  const ew = stdMat('#ffffff', { roughness: 0.2 }), ep = new THREE.MeshBasicMaterial({ color: '#111' });
  for (const x of [-0.11, 0.11]) head.add(ball(ew, 0.085, 0.1, 0.05, x, 0.03, 0.23), ball(ep, 0.045, 0.055, 0.03, x, 0.02, 0.27));
  const ant = limb(m, 0.025, 0.2); ant.rotation.x = Math.PI; ant.position.y = 0.22;
  const tip = ball(stdMat('#fff6a0', { emissive: '#ffe14d', emissiveIntensity: 1 }), 0.06, 0.06, 0.06, 0, 0.45, 0);
  head.add(ant, tip);
  g.add(body, head);
  if (cls) {
    const hc = stdMat(HELPER_CLASSES[cls].hat, { roughness: 0.4 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 28), hc); brim.position.y = 0.2;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hc); top.position.y = 0.2;
    head.add(brim, top); ant.visible = tip.visible = false;
  }
  for (const x of [-0.15, 0.15]) g.add(ball(m, 0.1, 0.09, 0.12, x, 0.08, 0.02));
  g.userData = { body, head, hop: Math.random() * 6 };
  return g;
}

// Small themed monster: round and squishy.
function buildMob(th) {
  const d = th.mob, g = new THREE.Group();
  const mat = stdMat(d.color, { roughness: d.crystal ? 0.15 : d.jelly ? 0.2 : 0.5, metalness: d.crystal ? 0.5 : 0, emissive: d.glow ? d.color : '#000000', emissiveIntensity: d.glow ? 0.6 : 0, transparent: !!d.jelly, opacity: d.jelly ? 0.85 : 1, flatShading: !!d.crystal });
  const body = d.crystal ? new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat) : ball(mat, 0.5, d.fly ? 0.36 : d.jelly ? 0.4 : 0.42, 0.5);
  body.position.y = d.fly ? 0 : 0.42; body.castShadow = true; g.add(body);
  const ew = stdMat('#ffffff', { roughness: 0.2 }), ep = new THREE.MeshBasicMaterial({ color: d.eye });
  for (const x of [-0.18, 0.18]) g.add(ball(ew, 0.12, 0.13, 0.08, x, body.position.y + 0.1, 0.42), ball(ep, 0.06, 0.07, 0.04, x, body.position.y + 0.08, 0.5));
  if (d.spikes) for (let i = 0; i < 4; i++) g.add(cone(stdMat('#ff6fb5'), 0.09, 0.3, -0.27 + i * 0.18, 0.86, -0.05, -0.2));
  const wings = [];
  if (d.wings) for (const sx of [-1, 1]) { const w = new THREE.Group(); w.add(ball(stdMat(shade(d.color, 0.85), { transparent: true, opacity: 0.85 }), 0.38, 0.03, 0.24, sx * 0.36, 0, 0)); w.position.set(sx * 0.3, 0.05, 0); g.add(w); wings.push(w); }
  const legs = [];
  if (d.legs) for (let i = 0; i < 6; i++) { const sx = i < 3 ? -1 : 1, l = limb(stdMat(shade(d.color, 0.7)), 0.04, 0.4); l.position.set(sx * 0.42, 0.4, -0.25 + (i % 3) * 0.25); l.rotation.z = sx * 0.9; g.add(l); legs.push(l); }
  if (d.legs) for (const sx of [-1, 1]) g.add(ball(stdMat(shade(d.color, 1.1)), 0.14, 0.1, 0.16, sx * 0.5, 0.45, 0.45));
  g.userData = { body, wings, legs, mat };
  return g;
}

// Boss: big themed creature.
function buildBoss(th) {
  const b = th.boss, g = new THREE.Group();
  const coreMat = stdMat(b.color, { roughness: 0.4, metalness: 0.2, emissive: b.color, emissiveIntensity: 0.18 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 5), coreMat); core.castShadow = true; g.add(core);
  const spikeMat = stdMat(b.accent, { emissive: b.accent, emissiveIntensity: 0.3 });
  const n = 16;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), a = i * 2.39996, dir = new V3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    if (dir.z > 0.6) continue;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 20), spikeMat); s.position.copy(dir).multiplyScalar(2.4); s.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); s.castShadow = true; g.add(s);
  }
  const eyeW = stdMat('#ffffff', { roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.2 }), pupil = new THREE.MeshBasicMaterial({ color: '#120010' });
  const eyes = [];
  for (const x of [-0.85, 0.85]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), eyeW); e.position.set(x, 0.6, 2.05);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), pupil); p.position.set(0, 0, 0.42); e.add(p);
    const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 12), spikeMat); brow.rotation.z = Math.PI / 2; brow.position.set(x * 0.95, 1.3, 2.1); brow.rotation.z = Math.PI / 2 + (x > 0 ? 0.4 : -0.4);
    g.add(e, brow); eyes.push(e);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12),  new THREE.MeshBasicMaterial({ color: '#200008' })); mouth.scale.set(0.8, 0.22, 0.2); mouth.position.set(0, -0.7, 2.15); g.add(mouth);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), eyeW); t.position.set(-0.6 + i * 0.3, -0.55, 2.35); t.rotation.x = Math.PI; g.add(t); }
  const tentacles = [];
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, chain = new THREE.Group(); chain.position.set(Math.cos(a) * 1.4, -2, Math.sin(a) * 1.4);
    let parent = chain;
    for (let j = 0; j < 5; j++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(0.38 - j * 0.05, 10, 8), coreMat); seg.position.y = j === 0 ? 0 : -0.55; parent.add(seg); parent = seg; }
    g.add(chain); tentacles.push(chain);
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 8, 24), new THREE.MeshBasicMaterial({ color: b.accent })); crown.rotation.x = Math.PI / 2; crown.position.y = 3.1; g.add(crown);
  const aura = glowSprite(b.accent, 9, 0.35); g.add(aura);
  g.userData = { core, coreMat, eyes, tentacles, crown, aura };
  return g;
}

/* ================= BLOCK TEXTURES ================= */
function blockTex(base, o = {}) {
  const S = 32, c = makeCanvas(S, S), g = c.getContext('2d'), col = new THREE.Color(base), r = mulberry32(hashStr(base + JSON.stringify(o)));
  const img = g.createImageData(S, S), fr = []; for (let x = 0; x < S; x++) fr.push(5 + Math.floor(r() * 5));
  const fc = o.fringe ? new THREE.Color(o.fringe) : null;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let k = 1 + (r() - 0.5) * 2 * (o.n || 0.1);
    if (o.grain) k *= 0.9 + 0.12 * Math.sin(x * 1.3 + Math.sin(y * 0.3) * 2);
    if (o.rings) { const d = Math.hypot(x - 15.5, y - 15.5); k *= 0.88 + 0.14 * Math.sin(d * 1.4); }
    if (o.planks) { if (y % 8 === 0) k *= 0.7; if ((x + (Math.floor(y / 8) % 2) * 16) % 16 === 0 && y % 8 !== 0) k *= 0.78; }
    if (o.bricks) { if (y % 8 === 0 || ((x + (Math.floor(y / 8) % 2) * 8) % 16 === 0)) k *= 0.62; }
    if (o.bevel !== false) { if (x < 2 || y < 2) k *= 1.12; if (x > S - 3 || y > S - 3) k *= 0.8; }
    let cr = col.r, cg = col.g, cb = col.b;
    if (fc && y < fr[x]) { cr = fc.r; cg = fc.g; cb = fc.b; }
    const i = (y * S + x) * 4; img.data[i] = clamp(cr * k * 255, 0, 255); img.data[i + 1] = clamp(cg * k * 255, 0, 255); img.data[i + 2] = clamp(cb * k * 255, 0, 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (o.cracks) { g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 12; y += (r() - 0.5) * 12; g.lineTo(x, y); } g.stroke(); } }
  if (o.dots) { g.fillStyle = o.dots; for (let i = 0; i < 6; i++) { g.globalAlpha = 0.55; g.beginPath(); g.arc(4 + r() * 24, 4 + r() * 24, 1.5 + r() * 2.5, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (o.glass) { g.clearRect(3, 3, S - 6, S - 6); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(3, 3, S - 6, S - 6); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(7, 7, 3, 10); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; t.magFilter = THREE.NearestFilter; return t;
}
function oreTex(rockHex, mHex) {
  const base = blockTex(rockHex, { n: 0.16, cracks: true }), S = 32;
  const c = makeCanvas(S, S), g = c.getContext('2d'); g.drawImage(base.image, 0, 0);
  const e = makeCanvas(S, S), ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const r = mulberry32(hashStr(mHex + rockHex));
  for (let i = 0; i < 6; i++) {
    const x = 4 + r() * 24, y = 4 + r() * 24, s = 2.5 + r() * 3;
    for (const [ctx, col] of [[g, mHex], [ge, '#ffffff']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 1, y - s * 0.6, 1.5, 1.5);
  }
  const map = new THREE.CanvasTexture(c), emap = new THREE.CanvasTexture(e);
  map.encoding = THREE.sRGBEncoding; map.magFilter = emap.magFilter = THREE.NearestFilter; map.anisotropy = MAX_ANISO; base.dispose();
  return { map, emap };
}

/* ---------- realistic item surfaces: reflections, brushed metal, grips, and drawn inventory icons ---------- */
function canvasTex(size, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; return t;
}
// a soft studio sky for shiny things to reflect
const ITEM_ENV = (() => {
  try {
    const tex = canvasTex(256, (x, s) => {
      const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#dff1ff'); g.addColorStop(0.45, '#8fb6e0'); g.addColorStop(0.52, '#4a5468'); g.addColorStop(1, '#1b1e26');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      x.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, w] of [[40, 30], [150, 50], [215, 20]]) x.fillRect(cx, 30, w, 40);
    });
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.encoding = THREE.sRGBEncoding;
    const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(tex).texture; pm.dispose(); tex.dispose(); return env;
  } catch (e) { return null; }
})();
const BRUSHED = canvasTex(256, (x, s) => {
  x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) { const v = 150 + Math.random() * 90 | 0; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 90, 1); }
  x.strokeStyle = 'rgba(70,70,70,.35)'; x.lineWidth = 0.7;
  for (let i = 0; i < 18; i++) { x.beginPath(); const a = Math.random() * s, b = Math.random() * s; x.moveTo(a, b); x.lineTo(a + (Math.random() - 0.5) * 60, b + (Math.random() - 0.5) * 60); x.stroke(); }
});
const KNURL = canvasTex(128, (x, s) => {
  x.fillStyle = '#5a5a5a'; x.fillRect(0, 0, s, s); x.strokeStyle = '#1c1c1c'; x.lineWidth = 2;
  for (let i = -s; i < s * 2; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke(); x.beginPath(); x.moveTo(i, s); x.lineTo(i + s, 0); x.stroke(); }
}, 3);
const LEATHER = canvasTex(128, (x, s) => {
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 1500; i++) { const v = 90 + Math.random() * 90 | 0; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, Math.random() * 1.6, 0, 6.3); x.fill(); }
  x.strokeStyle = 'rgba(30,30,30,.7)'; x.lineWidth = 3; for (let y = 0; y < s; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + 10); x.stroke(); }
}, 2);
// turn a plain material into a realistic one
function itemSurface(m, kind) {
  if (ITEM_ENV) { m.envMap = ITEM_ENV; m.envMapIntensity = kind === 'gem' ? 1.4 : 1.0; }
  if (kind === 'metal') { m.map = BRUSHED; m.roughnessMap = BRUSHED; m.metalness = Math.max(m.metalness, 0.75); m.roughness = 0.55; }
  if (kind === 'grip') { m.map = KNURL; m.bumpMap = KNURL; m.bumpScale = 0.004; m.metalness = 0.2; m.roughness = 0.8; }
  if (kind === 'leather') { m.map = LEATHER; m.bumpMap = LEATHER; m.bumpScale = 0.003; m.metalness = 0; m.roughness = 0.75; }
  if (kind === 'gem') { m.roughness = 0.06; m.metalness = 0.15; m.flatShading = true; }
  m.needsUpdate = true; return m;
}

// drawn icons for the inventory (cached data URLs)
const ICONS = {};
function drawIcon(kind, hex) {
  const key = kind + hex; if (ICONS[key]) return ICONS[key];
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
  const base = new THREE.Color(hex), col = (k, a = 1) => { const q = base.clone().multiplyScalar(k); return `rgba(${Math.min(255, q.r * 255) | 0},${Math.min(255, q.g * 255) | 0},${Math.min(255, q.b * 255) | 0},${a})`; };
  const rnd = (() => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; })();
  const speckle = (n, r, lo, hi, a) => { for (let i = 0; i < n; i++) { x.fillStyle = col(lo + rnd() * (hi - lo), a); x.beginPath(); x.arc(rnd() * s, rnd() * s, r * (0.4 + rnd()), 0, 6.3); x.fill(); } };
  if (kind === 'gem' || kind === 'orb') {
    const g = x.createRadialGradient(24, 20, 2, 32, 32, 34); g.addColorStop(0, col(1.9)); g.addColorStop(0.5, col(1)); g.addColorStop(1, col(0.35));
    x.fillStyle = g;
    if (kind === 'orb') { x.beginPath(); x.arc(32, 32, 26, 0, 6.3); x.fill(); }
    else {
      const P2 = [[32, 4], [56, 22], [48, 58], [16, 58], [8, 22]]; x.beginPath(); P2.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill();
      // facets
      const facet = (pts, k) => { x.fillStyle = col(k, 0.55); x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); };
      facet([[32, 4], [56, 22], [32, 26]], 1.6); facet([[32, 4], [8, 22], [32, 26]], 1.25); facet([[8, 22], [32, 26], [16, 58]], 0.8); facet([[56, 22], [32, 26], [48, 58]], 0.6); facet([[16, 58], [32, 26], [48, 58]], 0.95);
      x.strokeStyle = col(2.2, 0.6); x.lineWidth = 1.2; x.beginPath(); P2.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(24, 18, 6, 3, -0.6, 0, 6.3); x.fill();
  } else {
    x.fillStyle = col(1); x.fillRect(0, 0, s, s);
    if (kind === 'grass') { speckle(60, 3, 0.75, 1.25, 0.8); x.lineWidth = 1.4; for (let i = 0; i < 90; i++) { const a = rnd() * s, b = rnd() * s; x.strokeStyle = col(0.7 + rnd() * 0.7, 0.9); x.beginPath(); x.moveTo(a, b); x.lineTo(a + (rnd() - 0.5) * 4, b - 5 - rnd() * 6); x.stroke(); } }
    if (kind === 'dirt') { speckle(140, 2, 0.6, 1.3, 0.7); speckle(10, 4, 1.25, 1.6, 0.9); }
    if (kind === 'rock') { for (let y = 0; y < s; y += 9) { x.fillStyle = col(0.8 + rnd() * 0.4, 0.6); x.fillRect(0, y + rnd() * 4, s, 4 + rnd() * 4); } speckle(80, 1.5, 0.6, 1.4, 0.6); x.strokeStyle = col(0.4, 0.8); x.lineWidth = 1.5; x.beginPath(); x.moveTo(10, 0); x.lineTo(22, 20); x.lineTo(18, 34); x.lineTo(30, 64); x.stroke(); }
    if (kind === 'wood') { for (let i = 0; i < 14; i++) { x.strokeStyle = col(0.7 + rnd() * 0.5, 0.7); x.lineWidth = 1 + rnd() * 2; x.beginPath(); const y0 = rnd() * s; x.moveTo(0, y0); x.bezierCurveTo(20, y0 + 6, 40, y0 - 6, s, y0 + 2); x.stroke(); } x.fillStyle = col(0.45, 0.9); x.fillRect(0, 21, s, 2); x.fillRect(0, 43, s, 2); }
    if (kind === 'panel') { const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, col(1.3)); g.addColorStop(1, col(0.75)); x.fillStyle = g; x.fillRect(0, 0, s, s); x.strokeStyle = col(0.4); x.lineWidth = 2; x.strokeRect(2, 2, 60, 60); x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 62); x.stroke(); x.fillStyle = col(1.6); for (const [a, b] of [[8, 8], [56, 8], [8, 56], [56, 56], [26, 32], [38, 32]]) { x.beginPath(); x.arc(a, b, 2.2, 0, 6.3); x.fill(); } }
    if (kind === 'glass') { x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(8, 56); x.lineTo(30, 8); x.lineTo(40, 8); x.lineTo(18, 56); x.fill(); x.fillRect(44, 8, 4, 30); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.strokeRect(2, 2, 60, 60); }
    if (kind === 'glow') { const g = x.createRadialGradient(32, 32, 2, 32, 32, 34); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col(1.2)); g.addColorStop(1, col(0.6)); x.fillStyle = g; x.fillRect(0, 0, s, s); }
    if (kind === 'cap') { speckle(18, 5, 1.2, 1.6, 0.8); speckle(40, 2, 0.6, 0.9, 0.6); }
    // light from top-left, shadow bottom-right
    const sh = x.createLinearGradient(0, 0, s, s); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = sh; x.fillRect(0, 0, s, s);
  }
  return (ICONS[key] = `url(${c.toDataURL()}) center/cover`);
}
