/* ================= EASY BUILD MODE =================
   B toggles build mode. A see-through preview shows exactly where the piece goes
   (green = ok, red = can't). Pieces face the way you look; R turns them, G picks
   the next piece, Z undoes. Left click places, right click removes built blocks. */
const PIECES = [
  { name: 'Block', icon: '▪', cells: () => [[0, 0, 0]] },
  { name: 'Wall', icon: '▮', cells: () => { const c = []; for (let w = -1; w <= 1; w++) for (let y = 0; y < 3; y++) c.push([w, y, 0]); return c; } },
  { name: 'Floor', icon: '▬', cells: () => { const c = []; for (let w = -1; w <= 1; w++) for (let f = 0; f < 3; f++) c.push([w, 0, f]); return c; } },
  { name: 'Pillar', icon: '┃', cells: () => [[0, 0, 0], [0, 1, 0], [0, 2, 0]] },
  { name: 'Stairs', icon: '◢', cells: () => { const c = []; for (let w = -1; w <= 1; w++) for (let f = 0; f < 3; f++) for (let y = 0; y <= f; y++) c.push([w, y, f]); return c; } },
  { name: 'Big wall', icon: '█', cells: () => { const c = []; for (let w = -2; w <= 2; w++) for (let y = 0; y < 4; y++) c.push([w, y, 0]); return c; } },
];
const BUILD = { on: false, piece: 1, rot: 0, undo: [], ghost: null, plan: null };
function buildGhost() {
  if (BUILD.ghost && BUILD.ghost.parent === P.scene) return BUILD.ghost;
  const mat = new THREE.MeshBasicMaterial({ color: '#5affc8', transparent: true, opacity: 0.35, depthWrite: false });
  const g = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), mat, 32);
  g.renderOrder = 15; g.frustumCulled = false; g.visible = false;
  g.userData.mat = mat; BUILD.ghost = g; P.scene.add(g);
  return g;
}
function buildToggle(force) {
  if (mode !== 'planet') return;
  BUILD.on = force === undefined ? !BUILD.on : force;
  if (!BUILD.on && BUILD.ghost) BUILD.ghost.visible = false;
  toast(BUILD.on ? 'Build mode ON' : 'Build mode off', BUILD.on ? 'good' : '');
  buildHud();
}
function buildHud() {
  const box = $('buildBar'); if (!box) return;
  box.hidden = !BUILD.on || mode !== 'planet';
  if (box.hidden) return;
  const t = HOTBAR[PL.sel], need = PIECES[BUILD.piece].cells().length;
  $('buildPieces').innerHTML = PIECES.map((p, i) => `<button type="button" class="piece${i === BUILD.piece ? ' sel' : ''}" data-i="${i}"><span class="pi">${p.icon}</span>${p.name}<small>${p.cells().length}</small></button>`).join('');
  $('buildInfo').innerHTML = `<b>${PIECES[BUILD.piece].name}</b> of <b>${escapeHtml(BLOCK_INFO[t].name)}</b> · needs ${need}, you have ${save.blocks[t] || 0}<br><kbd>Left click</kbd> place · <kbd>Right click</kbd> remove · <kbd>G</kbd> next piece · <kbd>R</kbd> turn · <kbd>Z</kbd> undo · <kbd>B</kbd> exit`;
}
function buildPlan(hit) {
  if (!hit) return null;
  const ax = hit.x + hit.nx, ay = hit.y + hit.ny, az = hit.z + hit.nz;
  // face the way the player looks, plus extra quarter turns from R
  const r = ((Math.round(-PL.yaw / (Math.PI / 2)) + BUILD.rot) % 4 + 4) % 4;
  const fx = [0, 1, 0, -1][r], fz = [-1, 0, 1, 0][r]; // forward
  const sx = -fz, sz = fx;                               // sideways
  const t = HOTBAR[PL.sel], cells = [], skip = [];
  for (const [w, y, f] of PIECES[BUILD.piece].cells()) {
    const x = ax + sx * w + fx * f, z = az + sz * w + fz * f, yy = ay + y;
    if (x < 0 || z < 0 || x >= W || z >= D || yy < 1 || yy >= H) continue;
    if (getB(x, yy, z)) { skip.push([x, yy, z]); continue; }
    cells.push([x, yy, z]);
  }
  let why = '';
  if (!cells.length) why = 'No room here';
  else if ((save.blocks[t] || 0) < cells.length) why = `Need ${cells.length} ${BLOCK_INFO[t].name}, you have ${save.blocks[t] || 0}`;
  else {
    for (const [x, y, z] of cells) setB(x, y, z, t);
    const stuck = collides(PL.pos.x, PL.pos.y, PL.pos.z);
    for (const [x, y, z] of cells) setB(x, y, z, 0);
    if (stuck) why = 'You are standing in the way';
  }
  return { cells, t, why };
}
function buildUpdate(hit, ctrl) {
  const g = buildGhost();
  if (!BUILD.on || !ctrl) { g.visible = false; BUILD.plan = null; return; }
  const plan = BUILD.plan = buildPlan(hit);
  if (!plan || !plan.cells.length) { g.visible = false; return; }
  const m = new THREE.Matrix4();
  plan.cells.forEach(([x, y, z], i) => { if (i < 32) g.setMatrixAt(i, m.makeTranslation(x + 0.5, y + 0.5, z + 0.5)); });
  g.count = Math.min(32, plan.cells.length); g.instanceMatrix.needsUpdate = true;
  g.userData.mat.color.set(plan.why ? '#ff5a7a' : '#5affc8');
  g.userData.mat.opacity = 0.45 + Math.sin(nowT * 6) * 0.1;
  g.visible = true;
}
function buildPlace() {
  const plan = BUILD.plan;
  if (!plan || !plan.cells.length) return;
  if (plan.why) { toast(plan.why, 'bad'); return; }
  for (const [x, y, z] of plan.cells) setB(x, y, z, plan.t);
  save.blocks[plan.t] -= plan.cells.length;
  BUILD.undo.push({ t: plan.t, cells: plan.cells }); if (BUILD.undo.length > 40) BUILD.undo.shift();
  buildRemesh(plan.cells); SFX.place(); renderHotbar(); buildHud(); queueSave();
  const c = plan.cells[0]; P.parts.burst(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, blockSwatch(plan.t), 10, 2);
}
function buildRemove(hit) {
  if (!hit) return;
  const mine = BUILD.undo.some(u => u.cells.some(c => c[0] === hit.x && c[1] === hit.y && c[2] === hit.z));
  if (!BUILT.has(hit.b) && !mine) { toast('Right click removes blocks you built. Use your mining laser for the ground (B to leave build mode).'); return; }
  setB(hit.x, hit.y, hit.z, 0); addBlock(hit.b, 1); rebuildMeshes(hit.x, hit.z);
  P.parts.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, blockSwatch(hit.b), 10); SFX.brk(); renderHotbar(); buildHud(); queueSave();
}
function buildUndo() {
  const u = BUILD.undo.pop(); if (!u) { toast('Nothing to undo.'); return; }
  let n = 0; for (const [x, y, z] of u.cells) if (getB(x, y, z) === u.t) { setB(x, y, z, 0); n++; }
  addBlock(u.t, n); buildRemesh(u.cells); SFX.brk(); renderHotbar(); buildHud(); queueSave();
  toast(`Undo: got back ${n} ${BLOCK_INFO[u.t].name}`);
}
function buildRemesh(cells) {
  const done = new Set();
  for (const [x, , z] of cells) { const k = Math.floor(x / 4) + ',' + Math.floor(z / 4); if (done.has(k)) continue; done.add(k); rebuildMeshes(x, z); }
}
function buildKey(c) {
  if (mode !== 'planet') return false;
  if (c === 'KeyB') { buildToggle(); return true; }
  if (!BUILD.on) return false;
  if (c === 'KeyG') { BUILD.piece = (BUILD.piece + 1) % PIECES.length; buildHud(); return true; }
  if (c === 'KeyR') { BUILD.rot = (BUILD.rot + 1) % 4; SFX.place(); return true; }
  if (c === 'KeyZ') { buildUndo(); return true; }
  return false;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#buildPieces .piece'); if (!b) return;
  BUILD.piece = +b.dataset.i; buildHud();
});
