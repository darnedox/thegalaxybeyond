/* ================= 1.7: FARM ANIMALS + TAMABLE WOLVES =================
   Farm animals (cows, pigs, sheep, chickens) are peaceful. They never attack; when hit they run, and when
   defeated they turn into a puff of smoke and drop meat. Wild wolves never attack either. Walk up to one and
   press E to feed it meat. After a few bites it becomes your pet: it follows you to every planet and
   fights monsters and bosses for you. */
const FARM_THEMES = ['jungle', 'autumn', 'blossom', 'dino', 'tropic', 'honey', 'swamp', 'fungus', 'earth'];
const WOLF_THEMES = ['ice', 'autumn', 'aurora', 'dino', 'blossom', 'jungle', 'shadow', 'earth'];
const WOLF_NAMES = ['Shadow', 'Luna', 'Ziggy', 'Blaze', 'Comet', 'Biscuit', 'Nova', 'Pepper', 'Rocket', 'Maple', 'Storm', 'Scout', 'Pickles', 'Astro', 'Waffles', 'Echo', 'Bandit', 'Sprocket', 'Nugget', 'Orbit'];
const COLLARS = ['#ff4a5a', '#3a8aff', '#ffd21a', '#5aff8a', '#c05aff', '#ff8a1a', '#2affe0', '#ff5ac8'];
const MAX_PETS = 6;

function buildAnimal(kind, r, collar) {
  const g = new THREE.Group(), legs = [], M = (c, o) => stdMat(c, Object.assign({ roughness: 0.65 }, o));
  const ball = (rad, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
  const eyes = (y, z, gap, rad, parent = g) => { for (const sd of [-1, 1]) { const e = ball(rad, M('#ffffff', { roughness: 0.2 }), sd * gap, y, z, 1, 1, 1, parent); const p = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.55, 10, 8), new THREE.MeshBasicMaterial({ color: '#111' })); p.position.z = rad * 0.6; e.add(p); } };
  const leg = (mat, x, z, len, rad) => { const l = new THREE.Group(); l.position.set(x, len, z); const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.85, len, 8), mat); m.position.y = -len / 2; m.castShadow = true; l.add(m); g.add(l); legs.push(l); };
  let head = new THREE.Group(); g.add(head);
  if (kind === 'cow') {
    const wh = M('#f4f0e8'), bl = M('#2a2420'), pink = M('#ffb0b8');
    ball(0.55, wh, 0, 1.0, 0, 0.9, 0.8, 1.4); for (let i = 0; i < 5; i++) ball(0.2, bl, (r() < 0.5 ? -1 : 1) * 0.42, 0.95 + (r() - 0.5) * 0.4, (r() - 0.5) * 1.1, 0.4, 1, 1.2);
    head.position.set(0, 1.25, 0.8); ball(0.3, wh, 0, 0, 0, 0.95, 0.9, 1.1, head); ball(0.2, pink, 0, -0.12, 0.25, 1.2, 0.8, 0.8, head);
    for (const sd of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 8), M('#f8e8c0')); h.position.set(sd * 0.2, 0.28, -0.05); h.rotation.z = -sd * 0.6; head.add(h); ball(0.09, wh, sd * 0.32, 0.1, -0.05, 1.4, 0.5, 0.8, head); }
    eyes(0.1, 0.24, 0.13, 0.06, head);
    for (const [x, z] of [[-0.25, 0.45], [0.25, 0.45], [-0.25, -0.45], [0.25, -0.45]]) leg(wh, x, z, 0.62, 0.09);
    return { g, legs, head, kind, hp: 24, spd: 0.9, drop: 2, h: 0.6 };
  }
  if (kind === 'pig') {
    const pk = M('#ffaab8'), dk = M('#e07888');
    ball(0.4, pk, 0, 0.55, 0, 0.95, 0.85, 1.25);
    head.position.set(0, 0.7, 0.5); ball(0.26, pk, 0, 0, 0, 1, 0.95, 0.95, head); const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 16), dk); sn.rotation.x = Math.PI / 2; sn.position.set(0, -0.04, 0.26); head.add(sn);
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), pk); e.position.set(sd * 0.15, 0.22, -0.02); e.rotation.z = -sd * 0.4; head.add(e); }
    eyes(0.08, 0.2, 0.1, 0.045, head);
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12, Math.PI * 1.6), pk); tail.position.set(0, 0.65, -0.5); g.add(tail);
    for (const [x, z] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]]) leg(pk, x, z, 0.3, 0.07);
    return { g, legs, head, kind, hp: 18, spd: 1.0, drop: 2, h: 0.45 };
  }
  if (kind === 'sheep') {
    const wool = M('#fbfbf6', { roughness: 0.95 }), face = M('#3a3030');
    for (let i = 0; i < 9; i++) ball(0.28, wool, (r() - 0.5) * 0.4, 0.72 + (r() - 0.5) * 0.2, (r() - 0.5) * 0.7);
    ball(0.42, wool, 0, 0.72, 0, 1, 0.85, 1.2);
    head.position.set(0, 0.85, 0.55); ball(0.2, face, 0, 0, 0.05, 0.9, 1, 1.2, head); ball(0.17, wool, 0, 0.14, -0.02, 1, 0.7, 1, head);
    for (const sd of [-1, 1]) ball(0.06, face, sd * 0.2, 0.02, 0, 1.6, 0.6, 0.8, head);
    eyes(0.06, 0.22, 0.09, 0.045, head);
    for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) leg(face, x, z, 0.42, 0.05);
    return { g, legs, head, kind, hp: 18, spd: 0.85, drop: 1, h: 0.55 };
  }
  if (kind === 'chicken') {
    const wh = M('#fffaf0'), red = M('#ff3a3a'), yel = M('#ffb01a');
    ball(0.2, wh, 0, 0.36, 0, 0.9, 0.95, 1.2); ball(0.1, wh, 0, 0.42, -0.24, 0.8, 1.2, 0.8);
    head.position.set(0, 0.6, 0.15); ball(0.12, wh, 0, 0, 0, 1, 1.1, 1, head);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 8), yel); bk.rotation.x = Math.PI / 2; bk.position.set(0, -0.01, 0.14); head.add(bk);
    ball(0.05, red, 0, 0.13, 0.02, 0.5, 1, 1.4, head); ball(0.03, red, 0, -0.08, 0.1, 0.6, 1.2, 0.6, head);
    eyes(0.04, 0.09, 0.07, 0.03, head);
    for (const sd of [-1, 1]) leg(yel, sd * 0.08, 0.02, 0.22, 0.02);
    return { g, legs, head, kind, hp: 8, spd: 1.4, drop: 1, h: 0.4 };
  }
  // wolf
  const fur = M(['#9aa0a8', '#6a6e76', '#c8ccd2', '#5a4a3a'][Math.floor(r() * 4)]), light = M('#eef0f2'), nose = M('#1a1a1a');
  ball(0.32, fur, 0, 0.7, 0, 0.85, 0.85, 1.55); ball(0.2, light, 0, 0.62, 0.18, 0.8, 0.7, 1.1);
  head.position.set(0, 0.95, 0.55); ball(0.22, fur, 0, 0, 0, 1, 0.95, 1, head); ball(0.12, light, 0, -0.07, 0.2, 0.9, 0.7, 1.3, head); ball(0.045, nose, 0, -0.03, 0.36, 1, 1, 1, head);
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), fur); e.position.set(sd * 0.12, 0.22, -0.03); head.add(e); }
  eyes(0.06, 0.17, 0.09, 0.045, head);
  for (const [x, z] of [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]]) leg(fur, x, z, 0.5, 0.06);
  const tail = new THREE.Group(); tail.position.set(0, 0.78, -0.5); g.add(tail); const tm = ball(0.1, fur, 0, 0.18, -0.12, 0.9, 0.9, 2.4, tail); tm.rotation.x = -0.6;
  const col = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 20), M(collar || '#ff4a5a', { emissive: collar || '#ff4a5a', emissiveIntensity: 0.3 })); col.position.set(0, 0.86, 0.42); col.rotation.x = Math.PI / 2 - 0.5; col.visible = !!collar; g.add(col);
  return { g, legs, head, kind, tail, collar: col, hp: 999, spd: 2.2, h: 0.75 };
}
function animalGround(x, z) { if (x < 2 || z < 2 || x >= W - 2 || z >= D - 2) return null; const y = groundY(x, z); if (P.liq && y < P.liq.y + 0.2) return null; if (y > P.hm[Math.floor(x) + Math.floor(z) * W] + 2.5) return null; return y; }
function randomLandSpot(r, avoidVillage) {
  for (let t = 0; t < 60; t++) { const x = 4 + r() * (W - 8), z = 4 + r() * (D - 8), y = animalGround(x, z); if (y === null) continue; if (avoidVillage && P.vc && Math.hypot(x - P.vc.x, z - P.vc.z) < 13) continue; return new V3(x, y, z); }
  return null;
}
function addAnimal(kind, at, r, wild) {
  const a = buildAnimal(kind, r); a.g.position.copy(at); a.head0 = a.head.position.clone(); a.dir = r() * 6.28; a.t = r() * 10; a.wait = r() * 3; a.flee = 0; a.hitT = 0; a.maxHp = a.hp; a.wild = !!wild;
  if (wild) { a.need = 1 + Math.floor(r() * 3); a.fed = 0; }
  P.scene.add(a.g); (wild ? P.wolves : P.farm).push(a); return a;
}
function spawnAnimals() {
  P.farm = []; P.wolves = []; P.pets = []; P.farmT = 20;
  const key = P.p.earth ? 'earth' : P.p.theme.key, r = mulberry32(P.p.seed + 31337);
  if (FARM_THEMES.includes(key)) {
    const kinds = ['cow', 'pig', 'sheep', 'chicken'];
    for (let herd = 0; herd < 5; herd++) { // little herds of the same animal
      const at = randomLandSpot(r, true); if (!at) continue; const kind = kinds[Math.floor(r() * kinds.length)];
      for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) { const x = at.x + (r() - 0.5) * 4, z = at.z + (r() - 0.5) * 4, y = animalGround(x, z); if (y !== null) addAnimal(kind, new V3(x, y, z), r); }
    }
  }
  if (WOLF_THEMES.includes(key)) {
    for (let pack = 0; pack < 2; pack++) { const at = randomLandSpot(r, true); if (!at) continue; for (let k = 0, n = 2 + Math.floor(r() * 2); k < n; k++) { const x = at.x + (r() - 0.5) * 3, z = at.z + (r() - 0.5) * 3, y = animalGround(x, z); if (y !== null) addAnimal('wolf', new V3(x, y, z), r, true); } }
  }
  spawnPets();
}
function spawnPets() {
  if (!P) return;
  (P.pets || []).forEach(p => P.scene.remove(p.g)); P.pets = [];
  (save.wolves || []).slice(0, MAX_PETS).forEach((w, i) => {
    const a = buildAnimal('wolf', mulberry32(hashStr(w.name) + i), w.collar), tag = textSprite(w.name, w.collar, 0.4); tag.position.y = 1.5; a.g.add(tag);
    a.g.position.set(PL.pos.x - 1.5 + i * 0.7, PL.pos.y, PL.pos.z - 2); a.head0 = a.head.position.clone(); a.t = Math.random() * 10; a.biteT = 0; a.w = w; a.i = i;
    P.scene.add(a.g); P.pets.push(a);
  });
}
// laser and sword can hit farm animals (wolves can't be hurt)
function aimFarm(o, d, bt) {
  let best = null;
  for (const a of P.farm || []) { if (a.dead) continue; const t = raySphere(o, d, _c.copy(a.g.position).add(_w.set(0, a.h, 0)), a.kind === 'chicken' ? 0.5 : 0.8); if (t < bt) { bt = t; best = { kind: 'animal', o: a, t }; } }
  return best;
}
function hitAnimal(a, dmg, dir) {
  a.hp -= dmg; a.hitT = 0.15; a.flee = 4; a.wait = 0; a.dir = Math.atan2(dir.x, dir.z); SFX.hit();
  P.parts.burst(a.g.position.x, a.g.position.y + a.h, a.g.position.z, '#ffffff', 6, 3);
  if (a.hp <= 0) {
    a.dead = true; P.scene.remove(a.g); SFX.pop ? SFX.pop() : SFX.brk();
    P.parts.burst(a.g.position.x, a.g.position.y + a.h, a.g.position.z, '#e8e8e8', 24, 4); // a soft puff of smoke
    for (let k = 0; k < a.drop; k++) spawnDrop('meat', 0, a.g.position);
    P.farm.splice(P.farm.indexOf(a), 1);
  }
}
function nearestWildWolf() {
  let best = null, bd = 3.2;
  for (const w of P.wolves || []) { const d = Math.hypot(w.g.position.x - PL.pos.x, w.g.position.z - PL.pos.z); if (d < bd) { bd = d; best = w; } }
  return best;
}
function wolfPrompt() {
  const w = nearestWildWolf(); if (!w) return null;
  const n = save.meat | 0;
  if ((save.wolves || []).length >= 20) return 'This wolf is happy, but your pack is full!';
  return n > 0 ? `Press <kbd>E</kbd> to feed this wolf meat (you have ${n})` : 'A wild wolf! Get <b>meat</b> from farm animals to tame it.';
}
function feedWolf() {
  const w = nearestWildWolf(); if (!w) return false;
  if ((save.meat | 0) <= 0) { toast('You need meat! Farm animals drop meat.', 'bad'); return true; }
  if ((save.wolves || []).length >= 20) return true;
  save.meat--; w.fed++; SFX.pickup();
  w.dir = Math.atan2(PL.pos.x - w.g.position.x, PL.pos.z - w.g.position.z); w.wait = 1.5; w.wag = 2;
  for (let k = 0; k < 3; k++) heartPop(w.g.position);
  if (w.fed >= w.need) {
    save.wolves = save.wolves || [];
    const used = new Set(save.wolves.map(x => x.name)); let nm = WOLF_NAMES[Math.floor(Math.random() * WOLF_NAMES.length)], k = 2; while (used.has(nm)) nm = WOLF_NAMES[Math.floor(Math.random() * WOLF_NAMES.length)] + ' ' + k++;
    save.wolves.push({ name: nm, collar: COLLARS[save.wolves.length % COLLARS.length] });
    P.scene.remove(w.g); P.wolves.splice(P.wolves.indexOf(w), 1);
    for (let i = 0; i < 8; i++) heartPop(w.g.position);
    banner('Wolf tamed!', `${nm} joined your pack! Your wolves follow you to every planet and fight monsters for you.`, 3600); SFX.win();
    spawnPets(); const pet = P.pets.find(p => p.w.name === nm); if (pet) pet.g.position.copy(w.g.position);
  } else pickupToast(`The wolf liked that! (${w.fed}/${w.need})`);
  queueSave(); return true;
}
function heartPop(at) {
  const s = textSprite('❤', '#ff5a8a', 0.5); s.position.set(at.x + (Math.random() - 0.5) * 0.8, at.y + 1.2, at.z + (Math.random() - 0.5) * 0.8);
  P.scene.add(s); (P.hearts = P.hearts || []).push({ s, t: 0 });
}
function stepAnimal(a, dt, spd) {
  const p = a.g.position, nx = p.x + Math.sin(a.dir) * spd * dt, nz = p.z + Math.cos(a.dir) * spd * dt, ny = animalGround(nx, nz);
  if (ny === null || ny - groundY(p.x, p.z) > 1.2) { a.dir += Math.PI * (0.5 + Math.random()); return false; }
  if (P.vc && P.boss && !P.boss.dead && Math.hypot(nx - P.vc.x, nz - P.vc.z) < 11) { a.dir += Math.PI; return false; } // stay out of the force field
  p.x = nx; p.z = nz; return true;
}
function poseAnimal(a, dt, moving, fast) {
  const p = a.g.position; a.t += dt;
  p.y += (groundY(p.x, p.z) - p.y) * Math.min(1, dt * 12);
  let dh = a.dir - a.g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.g.rotation.y += dh * Math.min(1, dt * 7);
  const sp = fast ? 16 : 9; a.legs.forEach((l, k) => l.rotation.x = moving ? Math.sin(a.t * sp + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.6 : 0);
  if (!moving && a.kind !== 'wolf' && a.head0) a.head.position.y = a.head0.y - 0.12 - Math.max(0, Math.sin(a.t * 0.8)) * 0.18; // grazing
  else if (a.head0) a.head.position.y = a.head0.y;
  if (a.tail) a.tail.rotation.y = Math.sin(a.t * (a.wag > 0 ? 20 : 3)) * (a.wag > 0 ? 0.7 : 0.2);
  if (a.wag > 0) a.wag -= dt;
}
function updateAnimals(dt, time) {
  if (!P.farm) return;
  // hearts float up and fade
  if (P.hearts) for (let i = P.hearts.length - 1; i >= 0; i--) { const h = P.hearts[i]; h.t += dt; h.s.position.y += dt * 1.2; h.s.material.opacity = Math.max(0, 1 - h.t); if (h.t > 1) { P.scene.remove(h.s); P.hearts.splice(i, 1); } }
  for (const a of P.farm) {
    if (a.g.position.distanceToSquared(PL.pos) > 90 * 90) continue;
    let moving = false;
    if (a.flee > 0) { a.flee -= dt; moving = stepAnimal(a, dt, a.spd * 3); }
    else if (a.wait > 0) a.wait -= dt;
    else { moving = stepAnimal(a, dt, a.spd); if (Math.random() < dt * 0.35) { a.wait = 2 + Math.random() * 4; a.dir += (Math.random() - 0.5) * 2.5; } }
    if (a.hitT > 0) a.hitT -= dt;
    poseAnimal(a, dt, moving, a.flee > 0);
  }
  // farms slowly fill back up
  P.farmT -= dt;
  if (P.farmT <= 0) { P.farmT = 25; const key = P.p.earth ? 'earth' : P.p.theme.key; if (FARM_THEMES.includes(key) && P.farm.length < 10) { const r = Math.random, at = randomLandSpot(r, true); if (at && at.distanceTo(PL.pos) > 25) addAnimal(['cow', 'pig', 'sheep', 'chicken'][Math.floor(r() * 4)], at, r); } }
  // wild wolves wander in packs, never attack
  for (const w of P.wolves) {
    let moving = false; const dP = Math.hypot(w.g.position.x - PL.pos.x, w.g.position.z - PL.pos.z);
    if (w.fed > 0 && dP < 8 && dP > 1.8 && w.wait <= 0) { w.dir = Math.atan2(PL.pos.x - w.g.position.x, PL.pos.z - w.g.position.z); moving = stepAnimal(w, dt, 1.4); w.wag = 0.5; } // a wolf you fed trots after you
    else if (w.wait > 0) w.wait -= dt;
    else { moving = stepAnimal(w, dt, 1.3); if (Math.random() < dt * 0.4) { w.wait = 1.5 + Math.random() * 3; w.dir += (Math.random() - 0.5) * 2.5; } }
    if (dP < 3.2 && w.wait > 0) w.dir = Math.atan2(PL.pos.x - w.g.position.x, PL.pos.z - w.g.position.z);
    poseAnimal(w, dt, moving, false);
  }
  updatePets(dt);
}
function updatePets(dt) {
  for (const a of P.pets) {
    const p = a.g.position, dP = Math.hypot(p.x - PL.pos.x, p.z - PL.pos.z);
    if (dP > 32 || PL.deadT > 0) { p.set(PL.pos.x - 1 + a.i * 0.5, PL.pos.y, PL.pos.z - 1.5); continue; } // got lost: catch up
    a.biteT -= dt;
    // find something to fight near you: monsters first, then an awake boss
    let foe = null, fd = 14;
    for (const m of P.mobs) { if (m.dead) continue; const d = Math.hypot(m.g.position.x - PL.pos.x, m.g.position.z - PL.pos.z); if (d < fd) { fd = d; foe = { kind: 'mob', o: m }; } }
    if (!foe && P.boss && !P.boss.dead && P.boss.awake && Math.hypot(P.boss.g.position.x - PL.pos.x, P.boss.g.position.z - PL.pos.z) < 24) foe = { kind: 'boss', o: P.boss };
    let moving = false, fast = false;
    if (foe) {
      const fp = foe.o.g.position, d = Math.hypot(fp.x - p.x, fp.z - p.z), reach = foe.kind === 'boss' ? 3.4 : 1.3;
      a.dir = Math.atan2(fp.x - p.x, fp.z - p.z);
      if (d > reach) { moving = stepAnimal(a, dt, 5.5); fast = true; if (!moving) { p.x += Math.sin(a.dir) * 5.5 * dt; p.z += Math.cos(a.dir) * 5.5 * dt; moving = true; } }
      else if (a.biteT <= 0) { a.biteT = 0.7; const dmg = 6 + 2 * gearStats().weaponTier; damageEnemy(foe, foe.kind === 'boss' ? dmg * 0.6 : dmg, _v.set(fp.x - p.x, 0, fp.z - p.z)); a.head.position.z = a.head0.z + 0.15; P.parts.burst(fp.x, p.y + 0.8, fp.z, '#ffffff', 5, 3); }
    } else if (dP > 3.5) {
      a.dir = Math.atan2(PL.pos.x - p.x, PL.pos.z - p.z); const spd = dP > 8 ? 6 : 3.2; fast = dP > 8;
      moving = stepAnimal(a, dt, spd); if (!moving) { p.x += Math.sin(a.dir) * spd * dt; p.z += Math.cos(a.dir) * spd * dt; moving = true; }
    }
    if (a.head.position.z > a.head0.z) a.head.position.z = Math.max(a.head0.z, a.head.position.z - dt);
    a.wag = moving ? 0 : 0.3;
    poseAnimal(a, dt, moving, fast);
  }
}

function meatModel() { // a cartoon drumstick
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), itemSurface(new THREE.MeshStandardMaterial({ color: '#b8502e', roughness: 0.5, emissive: '#6a2010', emissiveIntensity: 0.3 }), 'gem')); m.scale.set(1, 1, 1.3); g.add(m);
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), new THREE.MeshStandardMaterial({ color: '#fff8e8', roughness: 0.4 })); bone.rotation.x = Math.PI / 2; bone.position.z = -0.32; g.add(bone);
  for (const sd of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bone.material); k.position.set(sd * 0.04, 0, -0.46); g.add(k); }
  g.rotation.x = 0.4; return g;
}
