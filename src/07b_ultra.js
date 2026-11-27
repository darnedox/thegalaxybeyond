/* ---------- ULTRA BOSS (1.6.2): roams every tier 10 planet ---------- */
const ULTRA_NAMES = ['Zarex Voidking', 'Omnicron', 'Nebulor', 'Kaliax', 'Vortaxx', 'Solaris Prime'];
const ULTRA_COLS = [['#2a1050', '#ff3af0', '#5affff'], ['#101a40', '#ffd23a', '#ff5a3a'], ['#08202a', '#3affb0', '#b05aff'], ['#30080a', '#ff6a2a', '#ffe05a']];
const ultraKey = p => GALAXY_SEED + ':' + p.id;
// only ONE tier 10 planet per galaxy has the ultra boss (picked by the galaxy seed)
let ULTRA_ID = null;
function ultraPlanetId() { if (ULTRA_ID === null) { const t10 = PLANETS.filter(p => p.tier >= 10); ULTRA_ID = t10.length ? t10[Math.floor(mulberry32(GALAXY_SEED * 13 + 555)() * t10.length)].id : -99; } return ULTRA_ID; }
function ultraHere(p) { return !p.earth && p.id === ultraPlanetId(); }
function buildUltra(c) {
  const g = new THREE.Group(), [base, glowA, glowB] = c;
  const coreMat = stdMat(base, { roughness: 0.25, metalness: 0.6, emissive: glowA, emissiveIntensity: 0.25 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 2), coreMat); core.castShadow = true; g.add(core);
  coreMat.flatShading = true;
  // glowing veins: a slightly bigger wireframe shell
  const vein = new THREE.Mesh(new THREE.IcosahedronGeometry(3.45, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(glowA).multiplyScalar(2.2), wireframe: true, transparent: true, opacity: 0.8, toneMapped: false })); g.add(vein);
  // crown of horns
  const hornMat = stdMat('#f2f0ff', { roughness: 0.2, metalness: 0.5, emissive: glowB, emissiveIntensity: 0.35 });
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2, h = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6 - Math.abs(i - 3) * 0.35, 12), hornMat); h.position.set(Math.sin(a) * 2.6, 2.6 + Math.cos(a) * 0.6, Math.cos(a) * 0.6); h.rotation.z = -a * 0.7; h.castShadow = true; g.add(h); }
  // three big eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowB).multiplyScalar(3), toneMapped: false }), eyes = [];
  for (const [x, y, s] of [[-1.3, 0.7, 0.55], [1.3, 0.7, 0.55], [0, 1.6, 0.7]]) { const e = new THREE.Mesh(new THREE.SphereGeometry(s, 18, 12), eyeMat); e.position.set(x, y, 3.05); g.add(e); eyes.push(e); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 10, 28, Math.PI), eyeMat); mouth.position.set(0, -0.9, 3.1); mouth.rotation.z = Math.PI; g.add(mouth);
  // orbiting rings + crystal shards
  const rings = [];
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(5 + k * 0.9, 0.12, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 2 ? glowB : glowA).multiplyScalar(2), toneMapped: false })); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(r); rings.push(r); }
  const shards = new THREE.Group(), shardMat = stdMat(glowB, { roughness: 0.1, metalness: 0.2, emissive: glowB, emissiveIntensity: 0.9, flatShading: true });
  for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), shardMat); const a = i / 10 * Math.PI * 2; s.position.set(Math.cos(a) * 6.5, Math.sin(a * 3) * 1.2, Math.sin(a) * 6.5); s.scale.y = 1.8; shards.add(s); }
  g.add(shards);
  const aura = glowSprite(glowA, 18, 0.45); g.add(aura);
  g.userData = { core, coreMat, vein, rings, shards, eyes, aura };
  return g;
}
function spawnUltra() {
  const p = P.p; P.ultra = null;
  if (!ultraHere(p) || (save.ultra || []).includes(ultraKey(p))) return;
  // find open ground far from the rocket (and the village)
  const r = mulberry32(p.seed + 404); let best = null, bd = -1;
  for (let i = 0; i < 40; i++) {
    const x = 10 + r() * (W - 20), z = 10 + r() * (D - 20), gy = groundY(x, z);
    if (P.liq && gy < P.liq.y + 1) continue;
    let d = Math.hypot(x - P.spawn.x, z - P.spawn.z); if (P.vc && p.boss) d = Math.min(d, Math.hypot(x - P.vc.x, z - P.vc.z) * 1.6);
    if (d > bd) { bd = d; best = { x, z, gy }; }
  }
  if (!best) return;
  const c = ULTRA_COLS[p.seed % ULTRA_COLS.length], name = ULTRA_NAMES[p.seed % ULTRA_NAMES.length];
  const g = buildUltra(c); g.position.set(best.x, best.gy + 7, best.z); P.scene.add(g);
  const tag = textSprite('ULTRA BOSS', '#ffd23a', 2.4); tag.position.y = 8.5; g.add(tag);
  const tag2 = textSprite(name, '#ff9fe8', 2); tag2.position.y = 7.2; g.add(tag2);
  const hp = 9000;
  P.ultra = { g, c, name, hp, maxHp: hp, awake: false, dead: false, home: new V3(best.x, best.gy, best.z), atkT: 2, rainT: 6, sumT: 12, beamT: 9, hitT: 0, ang: 0, rage: false };
}
function wakeUltra() {
  const u = P.ultra; if (u.awake) return; u.awake = true; SFX.boss(); setMusicIntensity(2);
  $('bossBar').hidden = false; $('bossName').textContent = '⚡ ULTRA BOSS: ' + u.name;
  banner('ULTRA BOSS!', `${u.name} is the strongest monster in the galaxy. Bring your best gear and friends!`, 3200);
}
function hitUltra(dmg) {
  const u = P.ultra; if (!u || u.dead) return; if (!u.awake) wakeUltra();
  u.hp -= dmg; u.hitT = 0.12; SFX.hit();
  P.parts.burst(u.g.position.x, u.g.position.y, u.g.position.z, u.c[1], 16, 8);
  if (u.hp <= 0) defeatUltra();
}
function ultraOrb(pos, vel, noHome, dmg) {
  const c = P.ultra.c[1], g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.3), toneMapped: false })), glowSprite(c, 2.4, 0.7));
  g.position.copy(pos); P.scene.add(g); P.orbs.push({ g, vel, life: 6, dmg: dmg || 45, noHome });
}
function updateUltra(dt, time) {
  const u = P.ultra; if (!u || u.dead) return;
  const ud = u.g.userData, toP = _v.set(PL.pos.x - u.g.position.x, PL.pos.y + 1 - u.g.position.y, PL.pos.z - u.g.position.z), d = toP.length();
  ud.rings.forEach((r, k) => { r.rotation.x += dt * (0.6 + k * 0.3) * (u.rage ? 2 : 1); r.rotation.y += dt * 0.4; });
  ud.shards.rotation.y += dt * (u.rage ? 2.2 : 0.8); ud.vein.rotation.y -= dt * 0.2;
  ud.aura.material.opacity = 0.35 + 0.15 * Math.sin(time * 3) + (u.rage ? 0.2 : 0);
  ud.coreMat.emissiveIntensity = u.hitT > 0 ? 1.2 : u.rage ? 0.6 + 0.4 * Math.sin(time * 9) : 0.25; if (u.hitT > 0) u.hitT -= dt;
  if (!u.awake && d < 26 && PL.deadT <= 0) wakeUltra();
  // drift near home, chase a little when awake
  u.ang += dt * (u.rage ? 0.6 : 0.3);
  const ox = u.home.x + Math.cos(u.ang) * 6, oz = u.home.z + Math.sin(u.ang) * 6;
  const tx = u.awake ? lerp(ox, PL.pos.x, 0.35) : ox, tz = u.awake ? lerp(oz, PL.pos.z, 0.35) : oz;
  u.g.position.x = damp(u.g.position.x, tx, 0.9, dt); u.g.position.z = damp(u.g.position.z, tz, 0.9, dt);
  u.g.position.y = damp(u.g.position.y, groundY(u.g.position.x, u.g.position.z) + 7 + Math.sin(time * 1.1) * 0.8, 2, dt);
  u.g.rotation.y = Math.atan2(toP.x, toP.z);
  if (!u.awake) return;
  $('bossFill').style.width = (Math.max(0, u.hp) / u.maxHp * 100) + '%';
  if (d > 80 || PL.deadT > 0 && d > 40) { u.awake = false; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3); $('bossBar').hidden = true; setMusicIntensity(1); toast(`${u.name} floated back to its lair.`); return; }
  if (!u.rage && u.hp < u.maxHp * 0.5) { u.rage = true; SFX.boss(); setMusicIntensity(3); banner('ULTRA RAGE!', `${u.name} is getting serious. Keep moving!`, 2600); }
  if (PL.deadT > 0) return;
  // aimed fan of orbs
  u.atkT -= dt;
  if (u.atkT <= 0) {
    u.atkT = u.rage ? 1.0 : 1.4; const n = u.rage ? 7 : 5, spd = u.rage ? 17 : 14;
    for (let k = 0; k < n; k++) { const dir = toP.clone().normalize(); dir.applyAxisAngle(AXY, (k - (n - 1) / 2) * 0.18); ultraOrb(u.g.position.clone().addScaledVector(dir, 4), dir.multiplyScalar(spd)); }
  }
  // meteor rain around you
  u.rainT -= dt;
  if (u.rainT <= 0) {
    u.rainT = u.rage ? 5 : 7; toast('☄️ Meteors incoming! Keep moving!', 'bad');
    for (let k = 0; k < (u.rage ? 12 : 8); k++) { const a = Math.random() * 6.28, rr = Math.random() * 7; ultraOrb(new V3(PL.pos.x + Math.cos(a) * rr, PL.pos.y + 22 + Math.random() * 8, PL.pos.z + Math.sin(a) * rr), new V3(0, -13, 0), true, 30); }
  }
  // ring blast when you get too close
  u.beamT -= dt;
  if (u.beamT <= 0 && d < 14) {
    u.beamT = u.rage ? 4 : 6;
    for (let k = 0; k < 16; k++) { const a2 = k / 16 * Math.PI * 2, dir = new V3(Math.cos(a2), -0.15, Math.sin(a2)); ultraOrb(u.g.position.clone().addScaledVector(dir, 4), dir.multiplyScalar(12), true, 35); }
  }
  // summon minions
  u.sumT -= dt;
  if (u.sumT <= 0) { u.sumT = u.rage ? 12 : 18; for (let k = 0; k < 3; k++) spawnMob(false); toast(`${u.name} summoned minions!`, 'bad'); }
}
function defeatUltra() {
  const u = P.ultra, p = P.p; u.dead = true; u.hp = 0;
  SFX.win(); setMusicIntensity(1); $('bossBar').hidden = true;
  const at = u.g.position.clone();
  for (let k = 0; k < 8; k++) setTimeout(() => P && P.parts.burst(at.x + (Math.random() - 0.5) * 6, at.y + (Math.random() - 0.5) * 6, at.z + (Math.random() - 0.5) * 6, k % 2 ? u.c[1] : u.c[2], 50, 12), k * 180);
  P.scene.remove(u.g);
  for (let k = 0; k < 15; k++) spawnDrop('orb', 0, at);
  for (let k = 0; k < 4; k++) spawnDrop('mineral', p.minerals[3], at);
  spawnDrop('mineral', MINERAL_COUNT - 1, at); spawnDrop('mineral', MINERAL_COUNT - 2, at);
  (save.ultra = save.ultra || []).push(ultraKey(p)); save.ultraKills = (save.ultraKills || 0) + 1; writeSave();
  banner('ULTRA BOSS DEFEATED!', `You beat ${u.name}! Grab the 15 enchant orbs and the rarest minerals in the galaxy.`, 4200);
}
