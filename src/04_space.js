/* ================= SPACE SCENE ================= */
const space = new THREE.Scene();
const spaceCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 1, 200000);
space.add(spaceCam);
space.add(new THREE.AmbientLight(0x8090c0, 0.42));
const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.5); sunLight.position.set(0.6, 0.5, 0.62); space.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x8fa4ff, 0.35); fillLight.position.set(-0.5, -0.3, -0.6); space.add(fillLight);

function nebulaTexture() {
  const W = 2048, H = 1024, c = makeCanvas(W, H), g = c.getContext('2d'); g.fillStyle = '#04030b'; g.fillRect(0, 0, W, H);
  const r = mulberry32(77);
  const band = g.createLinearGradient(0, 360, 0, 664); band.addColorStop(0, 'rgba(80,60,160,0)'); band.addColorStop(0.5, 'rgba(160,120,230,.32)'); band.addColorStop(1, 'rgba(80,60,160,0)');
  g.fillStyle = band; g.fillRect(0, 360, W, 304);
  const hues = ['255,90,170', '90,200,255', '160,110,255', '255,150,90', '90,255,200'];
  for (let i = 0; i < 150; i++) {
    const x = r() * W, y = 512 + (r() - 0.5) * (r() < 0.6 ? 320 : 900), rad = 40 + r() * 260, col = hues[Math.floor(r() * hues.length)], a = 0.04 + r() * 0.12;
    for (const ox of [0, -W, W]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2); }
  }
  for (let i = 0; i < 6000; i++) { const x = r() * W, y = r() * H, b = r(); g.fillStyle = `rgba(255,255,255,${b * b * 0.85})`; const s = b > 0.985 ? 2 : 1; g.fillRect(x, y, s, s); }
  // the galaxy's bright core, far away
  const cg = g.createRadialGradient(1500, 520, 0, 1500, 520, 220); cg.addColorStop(0, 'rgba(255,240,210,.9)'); cg.addColorStop(0.2, 'rgba(255,200,150,.35)'); cg.addColorStop(1, 'rgba(255,160,120,0)');
  g.fillStyle = cg; g.fillRect(1280, 300, 440, 440);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
const skyGroup = new THREE.Group(); space.add(skyGroup);
skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(150000, 48, 24), new THREE.MeshBasicMaterial({ map: nebulaTexture(), side: THREE.BackSide, depthWrite: false, fog: false })));
{ // star points
  const N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), r = mulberry32(5);
  for (let i = 0; i < N; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 120000; pos[i * 3] = s * Math.cos(a) * R; pos[i * 3 + 1] = u * R; pos[i * 3 + 2] = s * Math.sin(a) * R; const c = new THREE.Color().setHSL(0.55 + r() * 0.2 - (r() < 0.2 ? 0.5 : 0), 0.5, 0.75 + r() * 0.25); col.set([c.r, c.g, c.b], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  skyGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 3, map: GLOW, vertexColors: true, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
}
{ // drifting space dust close by, for a sense of speed
  const N = 2500, pos = new Float32Array(N * 3), r = mulberry32(8);
  for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * 30000; pos[i * 3 + 1] = (r() - 0.5) * 6000; pos[i * 3 + 2] = -r() * 14000 + 2000; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  space.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 4, color: 0x9fb4ff, map: GLOW, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
}

const atmoVS = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }';
const atmoFS = 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); gl_FragColor = vec4(c*f*1.6, f); }';
const ringVS = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const ringFS = 'uniform vec3 c; uniform float r0; uniform float r1; varying vec2 vP; void main(){ float d = (length(vP)-r0)/(r1-r0); float b = 0.55+0.45*sin(d*40.0)*sin(d*13.0+1.0); float a = smoothstep(0.0,0.08,d)*smoothstep(1.0,0.85,d)*b*0.75; gl_FragColor = vec4(c*b, a); }';

function planetColor(th, n, v) {
  const ramp = th.ramp; let t = clamp((n - 0.3) / 0.42, 0, 0.999);
  if (th.key === 'candy' || th.key === 'desert') t = clamp(t * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(v.y * 9 + n * 6)), 0, 0.999);
  const f = t * (ramp.length - 1), i = Math.floor(f), c = new THREE.Color(ramp[i]).lerp(new THREE.Color(ramp[i + 1]), f - i);
  if (Math.abs(v.y) > 0.82 && (th.key === 'ice' || th.key === 'jungle' || th.key === 'ocean')) c.lerp(new THREE.Color('#ffffff'), 0.85);
  return c.convertSRGBToLinear();
}
function buildPlanet(p) {
  const th = p.theme, g = new THREE.Group(); g.position.copy(p.pos);
  const geo = new THREE.SphereGeometry(p.radius, 48, 32), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new V3();
  const sea = th.key === 'ocean' ? 0.56 : th.key === 'jungle' ? 0.47 : -1;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm3(v.x * 2.3 + 11, v.y * 2.3, v.z * 2.3, p.seed, 5);
    const e = sea > 0 && n < sea ? 0 : (n - Math.max(sea, 0.45)) * 0.14;
    pos.setXYZ(i, v.x * p.radius * (1 + Math.max(e, 0)), v.y * p.radius * (1 + Math.max(e, 0)), v.z * p.radius * (1 + Math.max(e, 0)));
    const c = planetColor(th, n, v); col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }));
  g.add(mesh);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.07, 48, 32), new THREE.ShaderMaterial({ uniforms: { c: { value: linCol(th.atmo) } }, vertexShader: atmoVS, fragmentShader: atmoFS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(atmo);
  if (p.ring) {
    const r0 = p.radius * 1.4, r1 = p.radius * 2.2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 128, 1), new THREE.ShaderMaterial({ uniforms: { c: { value: linCol(th.ramp[3]) }, r0: { value: r0 }, r1: { value: r1 } }, vertexShader: ringVS, fragmentShader: ringFS, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2 + 0.35; ring.rotation.y = 0.2; g.add(ring);
  }
  const dot = glowSprite(th.atmo, p.radius * 3, 0.9); g.add(dot);
  const beacon = glowSprite('#ff4060', p.radius * 0.7, 0.9); beacon.position.y = p.radius * 1.3; beacon.visible = false; g.add(beacon);
  g.rotation.z = (hash3(p.id, 1, 2, 3) - 0.5) * 0.6;
  space.add(g);
  p.g = g; p.mesh = mesh; p.dot = dot; p.beacon = beacon;
}
PLANETS.forEach(buildPlanet);

/* Home: Earth + Space Inc. station at the start point */
const START = GALAXY.start.clone();
const earth = (() => {
  const R = 380, g = new THREE.Group(); g.position.set(START.x - 900, START.y - 380, START.z + 900);
  const geo = new THREE.SphereGeometry(R, 72, 48), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize(); const n = fbm3(v.x * 2 + 5, v.y * 2, v.z * 2, 42, 5);
    let c = n < 0.5 ? new THREE.Color('#0b4fa8').lerp(new THREE.Color('#1e88e5'), n / 0.5) : new THREE.Color('#3a9a3a').lerp(new THREE.Color('#c9b57a'), clamp((n - 0.5) * 4, 0, 1));
    if (Math.abs(v.y) > 0.85) c = new THREE.Color('#ffffff');
    c.convertSRGBToLinear(); col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
  const cl = makeCanvas(1024, 512), cg = cl.getContext('2d'), r = mulberry32(3);
  for (let i = 0; i < 260; i++) { const x = r() * 1024, y = 60 + r() * 392, w = 30 + r() * 120; const gr = cg.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(x - w, y - w, w * 2, w * 2); }
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.015, 64, 40), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cl), transparent: true, depthWrite: false, roughness: 1 }));
  g.add(clouds);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 32), new THREE.ShaderMaterial({ uniforms: { c: { value: linCol('#6fb8ff') } }, vertexShader: atmoVS, fragmentShader: atmoFS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  g.userData.clouds = clouds; space.add(g); return g;
})();
const station = (() => {
  const g = new THREE.Group(); g.position.set(START.x, START.y, START.z + 34);
  const metal = stdMat('#c9d2e0', { metalness: 0.7, roughness: 0.3 });
  const gate = new THREE.Mesh(new THREE.TorusGeometry(16, 1.6, 16, 64), metal); gate.position.z = -30; g.add(gate);
  const gateGlow = new THREE.Mesh(new THREE.TorusGeometry(16, 0.5, 8, 64), new THREE.MeshBasicMaterial({ color: '#5affc8' })); gateGlow.position.z = -30; g.add(gateGlow);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 30, 32), metal); hub.rotation.x = Math.PI / 2; hub.position.set(0, 0, 10); g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 2.4, 12, 64), metal); ring.position.z = 10; g.add(ring);
  for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 18, 1.2), metal); sp.position.z = 10; sp.rotation.z = i * Math.PI / 2; sp.position.x = Math.cos(i * Math.PI / 2 + Math.PI / 2) * 17; sp.position.y = Math.sin(i * Math.PI / 2 + Math.PI / 2) * 17; g.add(sp); }
  const panelMat = stdMat('#1b3f9a', { metalness: 0.8, roughness: 0.25, emissive: '#0a1f5a', emissiveIntensity: 0.4 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 12), panelMat); p.position.set(sx * 46, 0, 10); g.add(p); }
  const sc = makeCanvas(1024, 256), sg = sc.getContext('2d'); sg.fillStyle = '#0a0f2a'; sg.fillRect(0, 0, 1024, 256); sg.font = '400 150px Bungee, Impact, sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = '#ffd34d'; sg.fillText('SPACE INC.', 512, 135);
  const st = new THREE.CanvasTexture(sc); st.encoding = THREE.sRGBEncoding;
  for (const sx of [-1, 1]) { const sign = new THREE.Mesh(new THREE.PlaneGeometry(28, 7), new THREE.MeshBasicMaterial({ map: st, toneMapped: false })); sign.position.set(sx * 8.1, 0, 10); sign.rotation.y = sx * Math.PI / 2; g.add(sign); }
  const lights = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, l = glowSprite(i % 2 ? '#ff3b5c' : '#5affc8', 5, 1); l.position.set(Math.cos(a) * 16, Math.sin(a) * 16, -30); g.add(l); lights.push(l); }
  g.userData = { ring, lights }; space.add(g); return g;
})();

/* Edge Gate: the way out of the galaxy */
const edgeGate = (() => {
  const g = new THREE.Group(); g.position.copy(EDGE_GATE); g.lookAt(START);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(220, 18, 16, 96), stdMat('#ffd34d', { metalness: 0.8, roughness: 0.25, emissive: '#8a5a00', emissiveIntensity: 0.6 }));
  g.add(frame);
  const portalMat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, open: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float t; uniform float open; varying vec2 vU; void main(){ vec2 p = vU*2.0-1.0; float r = length(p); float a = atan(p.y,p.x); float s = 0.5+0.5*sin(a*6.0 + r*18.0 - t*3.0); vec3 sealed = vec3(0.6,0.4,0.1)*s*0.5; vec3 op = mix(vec3(0.3,0.9,1.0), vec3(1.0,0.4,0.9), s); vec3 c = mix(sealed, op, open); float al = smoothstep(1.0,0.85,r)*(0.35+0.5*s)*(0.4+0.6*open); gl_FragColor = vec4(c, al); }' });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(205, 64), portalMat); g.add(portal);
  const glow = glowSprite('#ffd34d', 1400, 0.5); g.add(glow);
  g.userData = { portalMat, frame }; space.add(g); return g;
})();

/* Asteroid fields between planets */
const asteroids = (() => {
  const fields = [], r = mulberry32(404);
  for (let i = 0; i < PLANETS.length - 1; i++) { const a = PLANETS[i].pos, b = PLANETS[i + 1].pos; fields.push(a.clone().lerp(b, 0.5)); }
  fields.push(START.clone().lerp(PLANETS[0].pos, 0.6)); fields.push(PLANETS[PLANETS.length - 1].pos.clone().lerp(EDGE_GATE, 0.5));
  const per = 70, N = fields.length * per;
  const geo = new THREE.IcosahedronGeometry(1, 3); const p = geo.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.75 + 0.45 * vnoise3(v.x * 2 + 3, v.y * 2, v.z * 2, 7); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#8a7f78', roughness: 0.9, metalness: 0.05 }), N);
  mesh.frustumCulled = false;
  const list = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), col = new THREE.Color();
  for (let f = 0; f < fields.length; f++) for (let k = 0; k < per; k++) {
    const c = fields[f], u = r() * Math.PI * 2, rad = 120 + r() * 480;
    const pos = new V3(c.x + Math.cos(u) * rad, c.y + (r() - 0.5) * 260, c.z + Math.sin(u) * rad);
    const size = 3 + Math.pow(r(), 3) * 30;
    const a = { pos, size, rot: new THREE.Euler(r() * 6, r() * 6, r() * 6), spin: new V3((r() - 0.5) * 0.6, (r() - 0.5) * 0.6, 0), alive: true };
    list.push(a); col.setHSL(0.06 + r() * 0.05, 0.15 + r() * 0.2, 0.35 + r() * 0.3); mesh.setColorAt(list.length - 1, col);
  }
  function update(dt) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; a.rot.x += a.spin.x * dt; a.rot.y += a.spin.y * dt; q.setFromEuler(a.rot); s.setScalar(a.alive ? a.size : 0.0001);
      m.compose(a.pos, q, s); mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0); space.add(mesh);
  return { list, update, mesh };
})();

/* Your ship */
const ship = { g: new THREE.Group(), bank: new THREE.Group(), model: buildRocket(), vel: 0, nitro: 100, nitroOn: false, hull: 100, yawV: 0, pitchV: 0, rollV: 0, shake: 0, lastPlanet: -1 };
ship.model.rotation.x = -Math.PI / 2; ship.bank.add(ship.model); ship.g.add(ship.bank); space.add(ship.g);
function shipStats() { const s = save.ship; return { maxV: 260 + s.engine * 70, nitroMax: 100 + s.nitro * 50, hullMax: 100 + s.hull * 60, accel: 150 + s.engine * 30 }; }
function resetShipAtStart() { ship.g.position.copy(START); ship.g.quaternion.identity(); ship.vel = 0; ship.hull = shipStats().hullMax; ship.nitro = shipStats().nitroMax; ship.bank.rotation.set(0, 0, 0); }
resetShipAtStart();

/* Engine particles */
const trail = (() => {
  const N = 500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), life = new Float32Array(N), vel = []; for (let i = 0; i < N; i++) vel.push(new V3());
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, map: GLOW, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; space.add(pts);
  let head = 0; const base = new THREE.Color();
  function emit(p, v, color) { const i = head; head = (head + 1) % N; pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; vel[i].copy(v); life[i] = 1; base.set(color); col[i * 3] = base.r; col[i * 3 + 1] = base.g; col[i * 3 + 2] = base.b; }
  function update(dt) {
    for (let i = 0; i < N; i++) { if (life[i] <= 0) continue; life[i] -= dt * 1.6; const k = Math.max(life[i], 0); pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; col[i * 3] *= 0.97; col[i * 3 + 1] *= 0.95; col[i * 3 + 2] *= 0.93; if (k === 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; } }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  return { emit, update };
})();

/* Speed lines for nitro */
const speedLines = (() => {
  const N = 140, pos = new Float32Array(N * 6), seeds = [], r = mulberry32(12);
  for (let i = 0; i < N; i++) seeds.push({ x: (r() - 0.5) * 60, y: (r() - 0.5) * 40, z: -r() * 120 });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#cfe9ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; spaceCam.add(lines);
  function update(dt, amount, speed) {
    mat.opacity = damp(mat.opacity, amount * 0.6, 6, dt);
    for (let i = 0; i < N; i++) {
      const s = seeds[i]; s.z += speed * dt * 0.25; if (s.z > 2) { s.z = -120; }
      if (Math.hypot(s.x, s.y) < 6) s.x += 8;
      const len = 2 + speed * 0.012;
      pos.set([s.x, s.y, s.z, s.x, s.y, s.z - len], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { update };
})();

/* Other players' ships (online) */
const remoteShips = new Map();
function remoteShip(id, st) {
  let o = remoteShips.get(id);
  if (!o) { const g = new THREE.Group(), m = buildRocket(HEROES[st.h % 8]?.accent || '#5affc8'); m.rotation.x = -Math.PI / 2; g.add(m); const tag = textSprite(st.n || 'Pilot', '#5affc8', 3); tag.position.y = 9; g.add(tag); space.add(g); o = { g, m, tag, name: st.n }; remoteShips.set(id, o); }
  return o;
}
