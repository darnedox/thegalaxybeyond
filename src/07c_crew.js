/* ---------- BUILDER ORDERS (1.6.5): press H, pick a building, your builders build it ---------- */
function bpHouse() {
  const c = [];
  for (let y = 0; y < 3; y++) for (let w = -2; w <= 2; w++) for (let f = 0; f <= 4; f++) {
    if (!(Math.abs(w) === 2 || f === 0 || f === 4)) continue;
    if (f === 0 && w === 0 && y < 2) continue; // door
    const win = y === 1 && ((Math.abs(w) === 2 && f === 2) || (f === 4 && w === 0));
    c.push([w, y, f, win ? B.GLASS : B.BRICKS]);
  }
  for (let w = -2; w <= 2; w++) for (let f = 0; f <= 4; f++) c.push([w, 3, f, w === 0 && f === 2 ? B.GLOW : B.PLANKS]);
  for (let w = -1; w <= 1; w++) for (let f = 1; f <= 3; f++) c.push([w, 4, f, B.PLANKS]);
  c.push([0, 5, 2, B.PLANKS]);
  return c;
}
function bpTower() {
  const c = [];
  for (let y = 0; y < 8; y++) for (let w = -1; w <= 1; w++) for (let f = 1; f <= 3; f++) {
    if (w === 0 && f === 2) continue;
    if (f === 1 && w === 0 && y < 2) continue;
    c.push([w, y, f, y % 3 === 2 && (w === 0 || f === 2) ? B.GLASS : B.BRICKS]);
  }
  for (let w = -2; w <= 2; w++) for (let f = 0; f <= 4; f++) c.push([w, 8, f, B.PLANKS]);
  for (let w = -2; w <= 2; w++) for (let f = 0; f <= 4; f++) if ((Math.abs(w) === 2 || f === 0 || f === 4) && (w + f) % 2 === 0) c.push([w, 9, f, B.BRICKS]);
  c.push([0, 9, 2, B.GLOW]);
  return c;
}
function bpWall() {
  const c = [];
  for (let w = -5; w <= 5; w++) { for (let y = 0; y < 4; y++) c.push([w, y, 2, B.BRICKS]); if (w % 2 === 0) c.push([w, 4, 2, B.BRICKS]); }
  c.push([-5, 5, 2, B.GLOW], [5, 5, 2, B.GLOW]);
  return c;
}
function bpFort() {
  const c = [];
  for (let w = -4; w <= 4; w++) for (let f = 0; f <= 8; f++) {
    const edge = Math.abs(w) === 4 || f === 0 || f === 8; if (!edge) continue;
    const corner = Math.abs(w) === 4 && (f === 0 || f === 8);
    const top = corner ? 5 : 3;
    for (let y = 0; y < top; y++) { if (f === 0 && Math.abs(w) <= 1 && y < 2) continue; c.push([w, y, f, B.BRICKS]); }
    if (!corner && (w + f) % 2 === 0) c.push([w, 3, f, B.BRICKS]);
    if (corner) c.push([w, 5, f, B.GLOW]);
  }
  return c;
}
function bpPyramid() {
  const c = [];
  for (let y = 0; y < 5; y++) for (let w = -4 + y; w <= 4 - y; w++) for (let f = y; f <= 8 - y; f++) {
    const shell = Math.abs(w) === 4 - y || f === y || f === 8 - y || y === 4; if (!shell) continue;
    c.push([w, y, f, y === 4 ? B.GLOW : B.PLANKS]);
  }
  return c;
}
function bpBridge() {
  const c = [];
  for (let f = 0; f <= 12; f++) { for (let w = -1; w <= 1; w++) c.push([w, 2, f, B.PLANKS]); for (const w of [-2, 2]) c.push([w, 3, f, f % 4 === 0 ? B.GLOW : B.PLANKS]); }
  for (const f of [0, 6, 12]) for (const w of [-1, 1]) for (let y = 0; y < 2; y++) c.push([w, y, f, B.BRICKS]);
  return c;
}
const BLUEPRINTS = [
  { key: 'house', name: 'Cozy house', icon: '🏠', fn: bpHouse },
  { key: 'tower', name: 'Watch tower', icon: '🗼', fn: bpTower },
  { key: 'wall', name: 'Castle wall', icon: '🧱', fn: bpWall },
  { key: 'fort', name: 'Fort', icon: '🏰', fn: bpFort },
  { key: 'pyramid', name: 'Pyramid', icon: '🔺', fn: bpPyramid },
  { key: 'bridge', name: 'Bridge', icon: '🌉', fn: bpBridge },
];
const CREW = { job: null };
function openCrew() {
  if (mode !== 'planet' || !P) return;
  const n = helperCount('builder');
  $('crewInfo').innerHTML = n ? `You have <b>${n}</b> builder${n > 1 ? 's' : ''}. They bring their own blocks! Pick something and they will build it right in front of you.${CREW.job ? `<br>Now building: <b>${CREW.job.name}</b> (${CREW.job.i}/${CREW.job.cells.length})` : ''}`
    : 'You have no builders yet. Beat a boss and save its village to get a builder helper!';
  $('crewList').innerHTML = BLUEPRINTS.map((b, i) => `<button type="button" class="btn crewbtn" data-bp="${i}" ${n ? '' : 'disabled'}><span>${b.icon}</span>${b.name}<small>${b.fn().length} blocks</small></button>`).join('')
    + (CREW.job ? '<button type="button" class="btn ghost crewbtn" data-bp="stop"><span>✋</span>Stop building</button>' : '');
  showSheet('crewBox');
}
function crewOrder(i) {
  hideSheet('crewBox'); requestLock();
  if (i === 'stop') { if (CREW.job) { toast(`Builders stopped. ${CREW.job.i} blocks placed.`); crewEnd(); } return; }
  const bp = BLUEPRINTS[i]; if (!bp) return;
  // face the way you look, start 3 blocks in front of you
  const r = ((Math.round(-PL.yaw / (Math.PI / 2))) % 4 + 4) % 4;
  const fx = [0, 1, 0, -1][r], fz = [-1, 0, 1, 0][r], sx = -fz, sz = fx;
  const ox = Math.floor(PL.pos.x) + fx * 3, oz = Math.floor(PL.pos.z) + fz * 3;
  // sit on the ground under the middle of the building
  const raw = bp.fn(); let maxF = 0; for (const c of raw) maxF = Math.max(maxF, c[2]);
  const mx = ox + fx * Math.floor(maxF / 2), mz = oz + fz * Math.floor(maxF / 2), baseY = groundY(mx, mz);
  const cells = raw.map(([w, y, f, t]) => [ox + sx * w + fx * f, baseY + y, oz + sz * w + fz * f, t])
    .filter(([x, y, z]) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && y < H)
    .sort((a, b) => a[1] - b[1] || (a[0] + a[2]) - (b[0] + b[2]));
  if (!cells.length) { toast('No room to build here.', 'bad'); return; }
  if (CREW.job) crewEnd();
  CREW.job = { name: bp.name, cells, i: 0, t: 0, center: new V3(mx + 0.5, baseY, mz + 0.5), stuck: [] };
  SFX.place(); banner('Builders on the way!', `Your builders are building a ${bp.name.toLowerCase()}. Watch them work!`, 2200);
}
function crewEnd() { CREW.job = null; if (CREW.ghost) { P && P.scene.remove(CREW.ghost); CREW.ghost.geometry.dispose(); CREW.ghost = null; } }
function crewGhost() {
  const j = CREW.job; if (!j) return;
  if (!CREW.ghost || CREW.ghost.parent !== P.scene) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.18, depthWrite: false });
    CREW.ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), mat, Math.min(400, j.cells.length)); CREW.ghost.renderOrder = 14; CREW.ghost.frustumCulled = false; P.scene.add(CREW.ghost);
  }
  const m = new THREE.Matrix4(); let k = 0;
  for (let n = j.i; n < j.cells.length && k < CREW.ghost.instanceMatrix.count; n++, k++) { const [x, y, z] = j.cells[n]; CREW.ghost.setMatrixAt(k, m.makeTranslation(x + 0.5, y + 0.5, z + 0.5)); }
  CREW.ghost.count = k; CREW.ghost.instanceMatrix.needsUpdate = true;
}
// where each builder stands while working
function crewSpot(hp, a, time) {
  const j = CREW.job; if (!j || hp.h.cls !== 'builder') return null;
  const c = j.cells[Math.min(j.cells.length - 1, j.i + hp.i)] || j.cells[j.cells.length - 1];
  return { x: c[0] + 0.5 + Math.cos(a + time) * 1.4, z: c[2] + 0.5 + Math.sin(a + time) * 1.4 };
}
function updateCrew(dt) {
  const j = CREW.job; if (!j || !P) return;
  const builders = P.helpers.filter(h => h.h.cls === 'builder'); if (!builders.length) { crewEnd(); return; }
  j.t += dt * (3 + builders.length * 2.5); // blocks per second
  let placed = 0, touched = [];
  while (j.t >= 1 && j.i < j.cells.length) {
    j.t -= 1; const c = j.cells[j.i++]; const [x, y, z, t] = c;
    if (getB(x, y, z)) continue; // something is already there
    if (Math.abs(x + 0.5 - PL.pos.x) < 0.9 && Math.abs(z + 0.5 - PL.pos.z) < 0.9 && y >= Math.floor(PL.pos.y) - 0.1 && y <= PL.pos.y + 1.8) { j.stuck.push(c); continue; }
    setB(x, y, z, t); touched.push(c); placed++;
    const b = builders[(j.i) % builders.length];
    if (placed <= 2) { zapLine(b.g.position, new V3(x + 0.5, y, z + 0.5)); P.parts.burst(x + 0.5, y + 0.5, z + 0.5, blockSwatch(t), 6, 2); }
  }
  if (touched.length) { buildRemesh(touched); SFX.place(); crewGhost(); }
  else if (!CREW.ghost) crewGhost();
  if (j.i >= j.cells.length) {
    // try spots you were standing in once more
    if (j.stuck.length) { j.cells.push(...j.stuck.splice(0)); if (!j.retried) { j.retried = true; return; } }
    banner(`${j.name} finished!`, 'Your builders did a great job.', 2200); SFX.win(); crewEnd();
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#crewList [data-bp]'); if (!b || b.disabled) return;
  crewOrder(b.dataset.bp === 'stop' ? 'stop' : +b.dataset.bp);
});
