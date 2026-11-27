/* ================= COMBAT, MONSTERS, BOSS, VILLAGE, HELPERS ================= */
let nowT = 0;
const _v = new V3(), _w = new V3();
const HELPER_NAMES = ['Zib', 'Pom', 'Krill', 'Nubs', 'Vee', 'Tork', 'Lumo', 'Biff', 'Quinn', 'Moxy', 'Dax', 'Ploo', 'Wren', 'Juno', 'Fizz', 'Ozzy'];
const CLS = ['miner', 'fighter', 'builder', 'farmer'];

/* ---------- monsters ---------- */
function mobStats() { const t = P.p.tier; return { hp: 18 + t * 14, dmg: 5 + t * 3 }; }
function spawnMob(initial) {
  const th = P.p.theme, st = mobStats();
  for (let tries = 0; tries < 30; tries++) {
    const x = 2 + Math.random() * (W - 4), z = 2 + Math.random() * (D - 4);
    if (Math.hypot(x - P.spawn.x, z - P.spawn.z) < 14) continue;
    if (P.vc && P.p.boss && Math.hypot(x - P.vc.x, z - P.vc.z) < 12) continue;
    if (!initial && Math.hypot(x - PL.pos.x, z - PL.pos.z) < 12) continue;
    const gy = groundY(x, z); if (P.liq && gy < P.liq.y) continue;
    const g = buildMob(th), fly = !!th.mob.fly;
    g.position.set(x, gy + (fly ? 2.5 : 0), z); P.scene.add(g);
    P.mobs.push({ g, hp: st.hp, maxHp: st.hp, dmg: st.dmg, fly, vel: new V3(), atkCD: 1, hitT: 0, wander: Math.random() * 6, dir: Math.random() * 6.28, hop: Math.random() * 3 });
    return;
  }
}
function mobCenter(m, out) { return out.copy(m.g.position).add(_w.set(0, m.fly ? 0 : 0.4, 0)); }
function updateMobs(dt, time) {
  const sp = 2.4 + P.p.tier * 0.15;
  for (let i = P.mobs.length - 1; i >= 0; i--) {
    const m = P.mobs[i], g = m.g, u = g.userData;
    if (m.dead) { m.deadT -= dt; g.scale.multiplyScalar(Math.pow(0.02, dt)); g.position.y += dt; if (m.deadT <= 0) { P.scene.remove(g); P.mobs.splice(i, 1); } continue; }
    const dx = PL.pos.x - g.position.x, dz = PL.pos.z - g.position.z, d = Math.hypot(dx, dz);
    const chase = PL.deadT <= 0 && d < 14 && !(P.boss && !P.boss.dead && Math.hypot(PL.pos.x - P.vc.x, PL.pos.z - P.vc.z) < 10.6);
    let tx = 0, tz = 0;
    if (chase && d > 1.1) { tx = dx / d * sp; tz = dz / d * sp; m.dir = Math.atan2(dx, dz); }
    else if (!chase) { m.wander -= dt; if (m.wander <= 0) { m.wander = 2 + Math.random() * 4; m.dir = Math.random() * 6.28; m.idle = Math.random() < 0.4; } if (!m.idle) { tx = Math.sin(m.dir) * sp * 0.4; tz = Math.cos(m.dir) * sp * 0.4; } }
    m.vel.x = damp(m.vel.x, tx, 6, dt); m.vel.z = damp(m.vel.z, tz, 6, dt);
    const nx = g.position.x + m.vel.x * dt, nz = g.position.z + m.vel.z * dt;
    const inDome = P.boss && !P.boss.dead && Math.hypot(nx - P.vc.x, nz - P.vc.z) < 11;
    if (nx > 1 && nx < W - 1 && nz > 1 && nz < D - 1 && !inDome) {
      const gy = groundY(nx, nz), cur = m.fly ? g.position.y - 2.5 : g.position.y;
      if (m.fly || gy - cur <= 1.2) { g.position.x = nx; g.position.z = nz; } else { m.vel.x *= -0.5; m.vel.z *= -0.5; m.dir += 2; }
    }
    const gy = groundY(g.position.x, g.position.z);
    if (m.fly) g.position.y = damp(g.position.y, Math.max(gy, P.liq ? P.liq.y : 0) + 2.2 + Math.sin(time * 2 + i) * 0.5 + (chase ? (PL.pos.y + 1 - gy) * 0.3 : 0), 3, dt);
    else { m.hop += dt * (chase ? 9 : 5); const hop = Math.abs(Math.sin(m.hop)) * (Math.hypot(m.vel.x, m.vel.z) > 0.3 ? 0.25 : 0.05); g.position.y = damp(g.position.y, gy + hop, 14, dt); }
    g.rotation.y = damp(g.rotation.y, m.dir, 8, dt);
    if (u.wings) u.wings.forEach((w, k) => w.rotation.z = Math.sin(time * 18 + k * 3) * 0.6 * (k ? 1 : -1));
    if (u.legs) u.legs.forEach((l, k) => l.rotation.x = Math.sin(m.hop * 2 + k) * 0.4);
    // hit flash
    if (m.hitT > 0) { m.hitT -= dt; u.mat.emissive.set(m.hitT > 0 ? '#ffffff' : (P.p.theme.mob.glow ? P.p.theme.mob.color : '#000000')); u.mat.emissiveIntensity = m.hitT > 0 ? 0.8 : (P.p.theme.mob.glow ? 0.6 : 0); }
    // attack
    m.atkCD -= dt;
    const dy = (PL.pos.y + 0.9) - mobCenter(m, _v).y;
    if (chase && d < 1.4 && Math.abs(dy) < 1.8 && m.atkCD <= 0) { m.atkCD = 1.1; hurtPlayer(m.dmg, `A ${P.p.theme.mob.name} bit you!`); _v.set(dx, 0, dz).normalize(); PL.vel.addScaledVector(_v, 6); PL.vel.y = 3.5; }
  }
  P.spawnT -= dt;
  if (P.spawnT <= 0 && !P.p.earth) { P.spawnT = 6; if (P.mobs.filter(m => !m.dead).length < 18) spawnMob(false); }
}

/* ---------- aiming and damage ---------- */
function raySphere(o, d, c, r) { _v.subVectors(c, o); const t = _v.dot(d); if (t < 0) return Infinity; const d2 = _v.lengthSq() - t * t; return d2 <= r * r ? t - Math.sqrt(r * r - d2) : Infinity; }
const _c = new V3();
function aimedEnemy(o, d, range) {
  const wall = raycastVoxel(o, d, range), maxT = wall ? wall.t : range;
  let best = null, bt = maxT;
  for (const m of P.mobs) { if (m.dead) continue; const t = raySphere(o, d, mobCenter(m, _c), 0.95); if (t < bt) { bt = t; best = { kind: 'mob', o: m }; } }
  if (P.boss && !P.boss.dead) { const t = raySphere(o, d, P.boss.g.position, 3.2); if (t < bt + 2) { bt = t; best = { kind: 'boss', o: P.boss }; } }
  if (P.ultra && !P.ultra.dead) { const t = raySphere(o, d, P.ultra.g.position, 4.6); if (t < bt + 3) { bt = t; best = { kind: 'boss', o: P.ultra }; } }
  { const fa = aimFarm(o, d, bt); if (fa) { best = fa; bt = fa.t; } }
  if (NET.pvp) for (const [id, r] of P.remote) { if (!r.st.pvp || r.st.hp <= 0) continue; const t = raySphere(o, d, _c.copy(r.g.position).add(_w.set(0, 0.9, 0)), 0.7); if (t < bt) { bt = t; best = { kind: 'player', o: r, id }; } }
  return best;
}
function damageEnemy(target, dmg, dir) {
  if (target.kind === 'mob') {
    const m = target.o; m.hp -= dmg; m.hitT = 0.12; SFX.hit();
    m.vel.addScaledVector(_v.set(dir.x, 0, dir.z).normalize(), 7);
    P.parts.burst(m.g.position.x, m.g.position.y + 0.5, m.g.position.z, P.p.theme.mob.color, 10);
    if (m.hp <= 0) killMob(m);
  } else if (target.kind === 'boss') {
    if (target.o === P.ultra) { hitUltra(dmg); return; }
    const b = target.o; if (!b.awake) wakeBoss(); b.hp -= dmg; b.hitT = 0.12; SFX.hit();
    P.parts.burst(b.g.position.x, b.g.position.y, b.g.position.z, P.p.theme.boss.accent, 16, 7);
    if (b.hp <= 0) defeatBoss();
  } else if (target.kind === 'animal') { hitAnimal(target.o, dmg, dir);
  } else if (target.kind === 'player') {
    NET.hits.push({ to: target.id, d: Math.round(dmg), s: ++NET.seq, t: nowT }); SFX.hit();
    P.parts.burst(target.o.g.position.x, target.o.g.position.y + 1, target.o.g.position.z, '#ff5a7a', 10);
  }
}
function killMob(m) {
  m.dead = true; m.deadT = 0.4; SFX.brk();
  P.parts.burst(m.g.position.x, m.g.position.y + 0.5, m.g.position.z, P.p.theme.mob.color, 26, 6);
  if (Math.random() < 0.4) spawnDrop('orb', 0, m.g.position);
  if (Math.random() < 0.3) spawnDrop('mineral', P.p.minerals[Math.floor(Math.random() * 3)], m.g.position);
}

/* ---------- drops ---------- */
function spawnDrop(kind, id, at) {
  const color = kind === 'orb' ? '#b48cff' : kind === 'meat' ? '#d0503a' : MINERALS[id].hex;
  const g = new THREE.Group();
  const core = kind === 'meat' ? meatModel() : new THREE.Mesh(kind === 'orb' ? new THREE.IcosahedronGeometry(0.22, 1) : new THREE.OctahedronGeometry(0.24, 0), itemSurface(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.3 }), 'gem'));
  g.add(core, glowSprite(color, 1.4, 0.7)); g.position.copy(at); g.position.y += 0.6; P.scene.add(g);
  P.drops.push({ g, kind, id, vel: new V3((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3), t: 0 });
}
function updateDrops(dt, time) {
  for (let i = P.drops.length - 1; i >= 0; i--) {
    const dr = P.drops[i], g = dr.g; dr.t += dt;
    _v.set(PL.pos.x, PL.pos.y + 0.8, PL.pos.z); const d = g.position.distanceTo(_v);
    if (dr.t > 0.5 && d < 4 && PL.deadT <= 0) { _w.subVectors(_v, g.position).normalize(); dr.vel.lerp(_w.multiplyScalar(12), 1 - Math.exp(-dt * 6)); }
    else { dr.vel.y -= 14 * dt; dr.vel.x *= Math.exp(-dt * 2); dr.vel.z *= Math.exp(-dt * 2); }
    g.position.addScaledVector(dr.vel, dt);
    const gy = groundY(g.position.x, g.position.z) + 0.35; if (g.position.y < gy && !(dr.t > 0.5 && d < 4)) { g.position.y = gy; dr.vel.y = 0; }
    g.children[0].rotation.y = time * 2.5; g.children[0].position.y = Math.sin(time * 3 + i) * 0.08;
    if (dr.t > 0.4 && d < 1.0) {
      if (dr.kind === 'orb') { save.orbs++; SFX.orb(); pickupToast('+1 Enchant orb'); }
      else if (dr.kind === 'meat') { save.meat = (save.meat | 0) + 1; SFX.pickup(); pickupToast(`+1 Meat (${save.meat}) · feed it to a wolf with E`); }
      else { const m = MINERALS[dr.id], first = addMineral(dr.id, 1); SFX.pickup(); if (first) toast(`NEW MINERAL: ${m.name}! (${mineralsFound()}/200 found)`, 'gold'); else pickupToast(`+1 ${m.name}`); }
      P.scene.remove(g); P.drops.splice(i, 1); queueSave();
    } else if (dr.t > 90) { P.scene.remove(g); P.drops.splice(i, 1); }
  }
}

/* ---------- player laser gun (F): an instant beam that hits right where the crosshair points ---------- */
const LASER_GEO = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); g.translate(0, 0.5, 0); return g; })();
function fireLaser(o, d) {
  const range = 48, tgt = aimedEnemy(o, d, range), wall = raycastVoxel(o, d, range);
  const end = new V3();
  if (tgt) { const c = tgt.kind === 'mob' ? mobCenter(tgt.o, new V3()) : tgt.o.g.position.clone(), t = raySphere(o, d, c, tgt.kind === 'boss' ? 3.2 : 0.95); if (isFinite(t)) end.copy(o).addScaledVector(d, t); else end.copy(c); }
  else end.copy(o).addScaledVector(d, wall ? wall.t : range);
  const start = laserMuzzle(new V3()), len = start.distanceTo(end), dir = _w.subVectors(end, start).normalize();
  const g = new THREE.Group();
  const outer = new THREE.Mesh(LASER_GEO, new THREE.MeshBasicMaterial({ color: '#ff3b6b', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = new THREE.Mesh(LASER_GEO, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  outer.scale.set(0.07, len, 0.07); core.scale.set(0.022, len, 0.022); g.add(outer, core);
  g.position.copy(start); g.quaternion.setFromUnitVectors(AXY, dir); P.scene.add(g);
  const hitGlow = glowSprite('#ff3b6b', 1.4, 0.9); hitGlow.position.copy(end); P.scene.add(hitGlow);
  P.shots = P.shots || []; P.shots.push({ g, hitGlow, life: 0.12, outer, core });
  SFX.zap(); toolModel.recoil = 0.05;
  if (tgt) damageEnemy(tgt, 7 + 2.5 * gearStats().weaponTier, d);
  else if (wall) P.parts.burst(end.x, end.y, end.z, '#ff3b6b', 6, 2);
}
function updateShots(dt) {
  if (!P.shots) return;
  for (let i = P.shots.length - 1; i >= 0; i--) {
    const s = P.shots[i]; s.life -= dt; const a = Math.max(0, s.life / 0.12);
    s.outer.material.opacity = 0.6 * a; s.core.material.opacity = 0.95 * a; s.hitGlow.material.opacity = 0.9 * a;
    if (s.life <= 0) { P.scene.remove(s.g, s.hitGlow); s.outer.material.dispose(); s.core.material.dispose(); P.shots.splice(i, 1); }
  }
}
function fireBolt(o, d) {
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#cfffff' })), glowSprite('#5affc8', 0.9, 0.9));
  g.position.copy(o).addScaledVector(d, 0.6).y -= 0.15; P.scene.add(g); SFX.zap();
  P.bolts.push({ g, vel: d.clone().multiplyScalar(50), life: 1.2, dmg: 6 + 2 * gearStats().weaponTier });
}
function updateBolts(dt) {
  updateShots(dt);
  for (let i = P.bolts.length - 1; i >= 0; i--) {
    const b = P.bolts[i]; b.life -= dt; const step = b.vel.length() * dt, dir = _v.copy(b.vel).normalize();
    const wall = raycastVoxel(b.g.position, dir, step), tgt = aimedEnemy(b.g.position, dir, step + 0.3);
    let done = b.life <= 0;
    if (tgt) { damageEnemy(tgt, b.dmg, dir); done = true; }
    else if (wall) { P.parts.burst(b.g.position.x, b.g.position.y, b.g.position.z, '#5affc8', 6, 2); done = true; }
    else b.g.position.addScaledVector(b.vel, dt);
    if (done) { P.scene.remove(b.g); P.bolts.splice(i, 1); }
  }
}

/* ---------- player health ---------- */
let hurtMsgT = 0;
function hurtPlayer(dmg, msg) {
  if (PL.deadT > 0 || mode !== 'planet') return;
  const red = gearStats().armorRed, real = dmg * (1 - red);
  PL.hp -= real; PL.lastHit = nowT; SFX.hurt();
  const h = $('hurt'); h.style.opacity = 1; clearTimeout(h._t); h._t = setTimeout(() => h.style.opacity = 0, 160);
  if (msg && nowT > hurtMsgT) { hurtMsgT = nowT + 4; toast(msg, 'bad'); }
  if (PL.hp <= 0) {
    PL.hp = 0; PL.deadT = 2.6; SFX.die(); mouse.L = false;
    banner('Knocked out!', 'Your suit beams you back to your rocket…', 2400);
  }
}
function respawnPlayer() {
  PL.pos.set(P.spawn.x + 2.2, P.spawn.y, P.spawn.z + 2.2); PL.vel.set(0, 0, 0); PL.hp = PL.maxHp; PL.lastHit = -99; PL.air = 20;
  const broke = [];
  for (const k of ['tool', 'weapon', 'armor']) { const it = save.gear[k]; if (!it) continue; it.dur -= 20; if (it.dur <= 0) { broke.push(`${MINERALS[it.mineral].name} ${GEAR_NAMES[k]}`); save.gear[k] = null; } }
  if (broke.length) toast(`Oh no! Your ${broke.join(' and ')} broke. Craft a new one at the workshop (C).`, 'bad');
  else if (save.gear.tool || save.gear.weapon || save.gear.armor) toast('Your gear lost some durability. Repair it in the workshop (C).', 'bad');
  if (P.boss && !P.boss.dead) { P.boss.hp = P.boss.maxHp; P.boss.awake = false; P.boss.enraged = false; P.boss.phase = 1; P.boss.dash = null; P.boss.slamT = 7; P.boss.dashT = 9; P.boss.sig = null; P.boss.sigT = 5; P.boss.g.visible = true; if (P.boss.g.userData.ghost) P.boss.g.userData.coreMat.opacity = 0.8; if (P.boss.wave) { P.scene.remove(P.boss.wave.ring); P.boss.wave = null; } $('bossBar').hidden = true; setMusicIntensity(1); }
  writeSave(); updateGearLine();
}

/* ---------- village + boss ---------- */
function setupVillage() {
  const p = P.p, saved = save.saved.includes(p.id), vc = P.vc;
  // villagers
  const r = mulberry32(p.seed + 77), body = [p.theme.cap, p.theme.top, shade(p.theme.atmo, 1.1), '#ffd6a8'];
  for (let i = 0; i < 8; i++) {
    const cls = i < 4 ? CLS[i] : null, g = buildVillager(body[i % 4], cls);
    const a = r() * 6.28, rad = 2 + r() * 6; g.position.set(vc.x + Math.cos(a) * rad, groundY(vc.x + Math.cos(a) * rad, vc.z + Math.sin(a) * rad), vc.z + Math.sin(a) * rad);
    P.scene.add(g); P.villagers.push({ g, home: g.position.clone(), dir: r() * 6.28, t: r() * 3, cls });
  }
  if (saved) { const tag = textSprite('Village saved!', '#5affc8', 1.2); tag.position.set(vc.x, vc.y + 6, vc.z); P.scene.add(tag); return; }
  // force field dome
  const dm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, c: { value: linCol(p.theme.boss.accent) }, a: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float t; uniform vec3 c; uniform float a; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0-abs(dot(vN,vV)),2.0); float hex = 0.5+0.5*sin(vP.x*3.0+t*2.0)*sin(vP.y*3.0-t)*sin(vP.z*3.0+t*1.3); gl_FragColor = vec4(c*(0.15+f*0.9+hex*0.12), (0.12+f*0.7)*a); }' });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10.6, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), dm); dome.position.set(vc.x, vc.y - 1.2, vc.z); P.scene.add(dome); P.dome = dome;
  // boss guards the village, between it and your rocket
  const th = p.theme, g = buildBoss(th), hp = 520 + p.tier * 260;
  _v.set(P.spawn.x - vc.x, 0, P.spawn.z - vc.z).normalize();
  const gx = vc.x + _v.x * 15, gz = vc.z + _v.z * 15;
  g.position.set(gx, groundY(gx, gz) + (g.userData.hover || 4.5), gz); P.scene.add(g);
  const tag = textSprite(th.boss.name, '#ff9fb2', 2); tag.position.y = 5; g.add(tag);
  P.boss = { g, hp, maxHp: hp, awake: false, dead: false, enraged: false, phase: 1, atkT: 2, sumT: 8, hitT: 0, slamT: 7, dashT: 9, sigT: 5, sig: null, style: g.userData.style || 'blob', dash: null, wave: null, home: new V3(gx, g.position.y, gz), ang: Math.atan2(_v.z, _v.x) };
}
function wakeBoss() {
  const b = P.boss; if (b.awake) return; b.awake = true; SFX.boss(); setMusicIntensity(2);
  $('bossBar').hidden = false; $('bossName').textContent = P.p.theme.boss.name;
  banner(P.p.theme.boss.name, `${BOSS_STYLES[b.style].label} boss! Swing with your sword and blast with F.`, 2600);
}
function updateBoss(dt, time) {
  if (P.dome) { P.dome.material.uniforms.t.value = time; if (P.boss && P.boss.dead) { P.dome.material.uniforms.a.value -= dt * 0.5; if (P.dome.material.uniforms.a.value <= 0) { P.scene.remove(P.dome); P.dome = null; } } }
  const b = P.boss; if (!b || b.dead) return;
  const u = b.g.userData, toP = _v.set(PL.pos.x - b.g.position.x, PL.pos.y + 1 - b.g.position.y, PL.pos.z - b.g.position.z), d = toP.length();
  if (!b.awake && d < 18 && PL.deadT <= 0) wakeBoss();
  // movement: drift around its guard post, lean toward the player
  b.ang += dt * (b.enraged ? 0.5 : 0.25);
  const ox = b.home.x + Math.cos(b.ang) * 4, oz = b.home.z + Math.sin(b.ang) * 4;
  const tx = b.awake ? lerp(ox, PL.pos.x, 0.25) : ox, tz = b.awake ? lerp(oz, PL.pos.z, 0.25) : oz;
  b.g.position.x = damp(b.g.position.x, tx, 1.2, dt); b.g.position.z = damp(b.g.position.z, tz, 1.2, dt);
  b.g.position.y = damp(b.g.position.y, groundY(b.g.position.x, b.g.position.z) + (u.hover || 4.5) + (b.sig && b.sig.lift || 0) + Math.sin(time * 1.4) * 0.6, b.sig && b.sig.kind === 'pounce' ? 30 : 2, dt);
  b.g.rotation.y = Math.atan2(toP.x, toP.z);
  bossAnim(b, u, time);
  u.crown.rotation.z = time * (b.enraged ? 3 : 1); u.aura.material.opacity = 0.3 + 0.15 * Math.sin(time * 4) + (b.enraged ? 0.25 : 0);
  if (b.hitT > 0) { b.hitT -= dt; u.coreMat.emissiveIntensity = 0.9; } else u.coreMat.emissiveIntensity = b.enraged ? 0.5 + 0.3 * Math.sin(time * 10) : 0.18;
  if (!b.awake) return;
  if (d > 60) { b.awake = false; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.5); $('bossBar').hidden = true; setMusicIntensity(1); toast(`${P.p.theme.boss.name} went back to guarding the village.`); return; }
  // three phases: 1 = fireballs, 2 = spread shots + ground slams, 3 = RAGE: fireball rings, dashes, backup
  const ph = b.hp < b.maxHp * 0.33 ? 3 : b.hp < b.maxHp * 0.66 ? 2 : 1;
  if (ph > b.phase) {
    b.phase = ph; SFX.boss();
    if (ph === 2) { setMusicIntensity(3); banner('Phase 2!', `${P.p.theme.boss.name} can SLAM the ground, and has a new move: ${BOSS_STYLES[b.style].tip}`, 2600); }
    if (ph === 3) { b.enraged = true; banner('RAGE MODE!', `${P.p.theme.boss.name} is furious! Watch out for dashes!`, 2400); u.coreMat.color.set(shade(P.p.theme.boss.color, 1.3)); }
  }
  b.atkT -= dt;
  if (b.atkT <= 0 && PL.deadT <= 0 && !b.dash && !b.sig) {
    b.atkT = ph === 3 ? 0.9 : ph === 2 ? 1.3 : 1.6;
    const spd = ph === 3 ? 14 : ph === 2 ? 12 : 10;
    if (ph === 3 && Math.random() < 0.35) { // ring of fireballs all around
      for (let k = 0; k < 10; k++) { const a2 = k / 10 * Math.PI * 2, dir = new V3(Math.cos(a2), -0.08, Math.sin(a2)); spawnBossOrb(b.g.position.clone().addScaledVector(dir, 3), dir.multiplyScalar(spd * 0.8), true); }
    } else {
      const n = ph === 1 ? 1 : ph === 2 ? 3 : 5;
      for (let k = 0; k < n; k++) {
        const dir = toP.clone().normalize(); dir.applyAxisAngle(AXY, (k - (n - 1) / 2) * 0.22);
        spawnBossOrb(b.g.position.clone().addScaledVector(dir, 3), dir.multiplyScalar(spd));
      }
    }
  }
  // ground slam: a shockwave ring rolls outward along the ground; jump over it
  if (ph >= 2 && !b.dash) {
    b.slamT -= dt;
    if (b.slamT <= 0 && !b.wave) {
      b.slamT = ph === 3 ? 5 : 7;
      const gy = groundY(b.g.position.x, b.g.position.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: P.p.theme.boss.accent, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(b.g.position.x, gy + 0.25, b.g.position.z); P.scene.add(ring);
      b.wave = { ring, r: 1, hit: false, cx: b.g.position.x, cz: b.g.position.z };
      P.parts.burst(b.g.position.x, gy + 0.5, b.g.position.z, P.p.theme.boss.accent, 40, 8); SFX.brk();
      toast('SLAM! Jump over the shockwave!', 'bad');
    }
  }
  if (b.wave) {
    const w = b.wave; w.r += dt * 9; w.ring.scale.setScalar(w.r); w.ring.material.opacity = Math.max(0, 0.9 - w.r / 22);
    const pd = Math.hypot(PL.pos.x - w.cx, PL.pos.z - w.cz);
    if (!w.hit && PL.deadT <= 0 && Math.abs(pd - w.r) < 0.9 && PL.onGround) { w.hit = true; hurtPlayer(14 + P.p.tier * 5, 'The shockwave got you! Press Space to jump over it.'); PL.vel.y = 6; }
    if (w.r > 22) { P.scene.remove(w.ring); w.ring.geometry.dispose(); b.wave = null; }
  }
  // dash: in rage mode the boss lunges at you
  if (ph === 3) {
    b.dashT -= dt;
    if (b.dashT <= 0 && !b.dash && !b.sig && d < 26) { b.dashT = 4.5; b.dash = { t: 0.55, from: b.g.position.clone(), to: new V3(PL.pos.x, PL.pos.y + 2, PL.pos.z), hit: false }; toast('DASH! Get out of the way!', 'bad'); }
  }
  if (b.dash) {
    const ds = b.dash; ds.t -= dt;
    if (ds.t <= 0) { // windup done: zoom toward where you were
      const k = Math.min(1, -ds.t / 0.45); b.g.position.lerpVectors(ds.from, ds.to, k * k);
      if (!ds.hit && PL.deadT <= 0 && b.g.position.distanceTo(_v.set(PL.pos.x, PL.pos.y + 1, PL.pos.z)) < 3) { ds.hit = true; hurtPlayer(18 + P.p.tier * 6, `${P.p.theme.boss.name} rammed you!`); PL.vel.addScaledVector(toP.clone().normalize(), 9); PL.vel.y = 6; }
      if (k >= 1) { b.home.set(b.g.position.x, b.home.y, b.g.position.z); b.dash = null; }
    } else { b.g.position.x += Math.sin(time * 60) * 0.06; } // shake while winding up
  }
  bossSignature(b, u, dt, time, ph, toP, d);
  if (ph === 3) { b.sumT -= dt; if (b.sumT <= 0) { b.sumT = 10; if (P.mobs.filter(m => !m.dead).length < 20) { spawnMob(true); spawnMob(true); toast(`${P.p.theme.boss.name} called for backup!`, 'bad'); } } }
  $('bossFill').style.width = (Math.max(0, b.hp) / b.maxHp * 100) + '%';
}
function spawnBossOrb(pos, vel, noHome, o = {}) {
  const c = o.color || P.p.theme.boss.accent, g = new THREE.Group(), sz = o.size || 1;
  const core = o.rock ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * sz, 0), stdMat(o.rock, { flatShading: true, roughness: 0.9 })) : new THREE.Mesh(new THREE.SphereGeometry(0.4 * sz, 14, 10), new THREE.MeshBasicMaterial({ color: c }));
  g.add(core, glowSprite(c, 2.6 * sz, o.rock ? 0.5 : 0.9));
  g.position.copy(pos); P.scene.add(g); P.orbs.push({ g, vel, life: o.life || 5, dmg: Math.round((12 + P.p.tier * 5) * (o.dmg || 1)), noHome, home: o.home || 0, hitR: o.hitR || 1.0, color: c });
}
// 1.6.8: limb animation per boss style
function bossAnim(b, u, time) {
  const sw = u.swing || 0.5, fast = b.enraged ? 1.6 : 1;
  u.tentacles.forEach((c, k) => {
    if (u.flap && k < 2) { c.rotation.z = (k ? -1 : 1) * Math.sin(time * 5 * fast) * sw; return; }
    c.rotation.x = Math.sin(time * 2 * fast + k) * sw; c.rotation.z = (c.userData.rz0 ?? (c.userData.rz0 = c.rotation.z)) + Math.cos(time * 1.7 * fast + k) * sw * 0.8;
  });
  if (u.pulse) { const k = 1 + Math.sin(time * 3) * 0.06; u.core.scale.set(k, 2 - k, k); u.inner.material.color.set(P.p.theme.boss.accent).multiplyScalar(0.8 + 0.4 * Math.sin(time * 6)); }
  if (u.ghost && !(b.sig && b.sig.kind === 'vanish')) u.coreMat.opacity = 0.7 + 0.15 * Math.sin(time * 3);
  if (u.head) u.head.rotation.x = Math.sin(time * 1.3) * 0.15 - (b.sig && b.sig.kind === 'breath' ? 0.35 : 0);
}
// 1.6.8: every boss style has its own signature move from phase 2
function bossSignature(b, u, dt, time, ph, toP, d) {
  if (b.style === 'blob' || PL.deadT > 0) { b.sig = null; return; }
  const bp = b.g.position;
  if (!b.sig) {
    if (ph < 2 || b.dash) return;
    b.sigT -= dt; if (b.sigT > 0) return;
    b.sigT = ph === 3 ? 5 : 7;
    toast(BOSS_STYLES[b.style].tip, 'bad'); SFX.boss();
    b.sig = { kind: { golem: 'rocks', dragon: 'breath', spider: 'pounce', robot: 'missiles', jelly: 'bubbles', ghost: 'vanish', crystal: 'spiral' }[b.style], t: 0, n: 0 };
  }
  const s = b.sig; s.t += dt;
  switch (s.kind) {
    case 'rocks': // boulders fall out of the sky around you
      if (s.t > s.n * 0.22 && s.n < (ph === 3 ? 10 : 7)) {
        s.n++; const a = Math.random() * 6.28, r = s.n === 1 ? 0 : 1.5 + Math.random() * 4.5;
        spawnBossOrb(new V3(PL.pos.x + Math.cos(a) * r, PL.pos.y + 16, PL.pos.z + Math.sin(a) * r), new V3(0, -13, 0), true, { rock: P.p.theme.boss.color, size: 1.5, hitR: 1.4, dmg: 1.1, life: 3 });
      }
      if (s.t > 2.6) b.sig = null; break;
    case 'breath': // a stream of fire from the dragon's mouth
      if (s.t > 0.5 && s.t > 0.5 + s.n * 0.07 && s.n < 16) {
        s.n++; const from = u.head ? u.head.getWorldPosition(new V3()) : bp.clone(), dir = new V3(PL.pos.x - from.x, PL.pos.y + 1 - from.y, PL.pos.z - from.z).normalize();
        dir.x += (Math.random() - 0.5) * 0.12; dir.y += (Math.random() - 0.5) * 0.08; dir.z += (Math.random() - 0.5) * 0.12; dir.normalize();
        spawnBossOrb(from.addScaledVector(dir, 1.6), dir.multiplyScalar(17), true, { color: '#ff7a1a', size: 0.8, dmg: 0.45, life: 2.5 });
      }
      if (s.t > 2) b.sig = null; break;
    case 'pounce': // crouch, then leap high and crash down where you were standing
      if (!s.from) { s.from = bp.clone(); s.to = new V3(PL.pos.x, 0, PL.pos.z); }
      if (s.t < 0.6) { s.lift = -1.2; bp.x += Math.sin(time * 50) * 0.05; break; }
      { const k = Math.min(1, (s.t - 0.6) / 0.9); bp.x = lerp(s.from.x, s.to.x, k); bp.z = lerp(s.from.z, s.to.z, k); s.lift = Math.sin(k * Math.PI) * 9;
        if (k >= 1) {
          const gy = groundY(bp.x, bp.z); P.parts.burst(bp.x, gy + 0.5, bp.z, P.p.theme.boss.accent, 50, 9); SFX.brk();
          if (Math.hypot(PL.pos.x - bp.x, PL.pos.z - bp.z) < 4.5) { hurtPlayer(16 + P.p.tier * 6, `${P.p.theme.boss.name} pounced on you!`); PL.vel.y = 7; }
          if (!b.wave) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: P.p.theme.boss.accent, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(bp.x, gy + 0.25, bp.z); P.scene.add(ring); b.wave = { ring, r: 1, hit: false, cx: bp.x, cz: bp.z }; }
          b.home.set(bp.x, b.home.y, bp.z); b.sig = null;
        } }
      break;
    case 'missiles': // homing rockets pop out of its shoulders
      if (s.t > s.n * 0.25 && s.n < (ph === 3 ? 6 : 4)) {
        s.n++; const side = s.n % 2 ? 1 : -1, from = bp.clone().add(new V3(Math.cos(b.g.rotation.y) * side * 2.3, 2, -Math.sin(b.g.rotation.y) * side * 2.3));
        spawnBossOrb(from, new V3(side * 3 * Math.cos(b.g.rotation.y), 9, -side * 3 * Math.sin(b.g.rotation.y)), true, { color: '#ff3b3b', size: 0.8, home: 2.2, life: 5, dmg: 0.8 });
      }
      if (s.t > 1.8) b.sig = null; break;
    case 'bubbles': // slow, wobbly bubbles that drift after you
      if (s.n < (ph === 3 ? 8 : 6)) { for (; s.n < (ph === 3 ? 8 : 6); s.n++) { const a = s.n / 6 * Math.PI * 2, dir = new V3(Math.cos(a), 0.3, Math.sin(a)); spawnBossOrb(bp.clone().addScaledVector(dir, 3), dir.multiplyScalar(4), true, { size: 1.6, home: 1.1, life: 8, dmg: 0.7, hitR: 1.3}); } }
      if (s.t > 1) b.sig = null; break;
    case 'vanish': // fade away, reappear next to you and fire a ring
      if (s.t < 0.6) { u.coreMat.opacity = 0.8 * (1 - s.t / 0.6); b.g.visible = s.t < 0.55; break; }
      if (!s.moved) { s.moved = true; const a = Math.random() * 6.28; bp.x = PL.pos.x + Math.cos(a) * 8; bp.z = PL.pos.z + Math.sin(a) * 8; bp.y = groundY(bp.x, bp.z) + (u.hover || 4.5); b.home.set(bp.x, b.home.y, bp.z); }
      if (s.t > 1.2) { b.g.visible = true; u.coreMat.opacity = 0.8 * Math.min(1, (s.t - 1.2) / 0.3); }
      if (s.t > 1.5) { for (let k = 0; k < 10; k++) { const a2 = k / 10 * Math.PI * 2, dir = new V3(Math.cos(a2), -0.05, Math.sin(a2)); spawnBossOrb(bp.clone().addScaledVector(dir, 3), dir.multiplyScalar(10), true); } P.parts.burst(bp.x, bp.y, bp.z, P.p.theme.boss.accent, 30, 7); b.sig = null; }
      break;
    case 'spiral': // spinning spiral of crystal shards
      while (s.t > s.n * 0.06 && s.n < 30) { s.n++; const a = s.n * 0.55 + time, dir = new V3(Math.cos(a), -0.06, Math.sin(a)); spawnBossOrb(bp.clone().addScaledVector(dir, 3), dir.multiplyScalar(11), true, { size: 0.75, dmg: 0.6, life: 3.5 }); }
      if (s.t > 2) b.sig = null; break;
    default: b.sig = null;
  }
}
function updateOrbs(dt) {
  for (let i = P.orbs.length - 1; i >= 0; i--) {
    const o = P.orbs[i]; o.life -= dt;
    _v.set(PL.pos.x - o.g.position.x, PL.pos.y + 1 - o.g.position.y, PL.pos.z - o.g.position.z);
    if (!o.noHome && _v.length() < 8 && o.life > 3.5) o.vel.lerp(_v.normalize().multiplyScalar(o.vel.length()), dt * 0.8); // slight homing early on
    else if (o.home && o.life > 1) o.vel.lerp(_v.normalize().multiplyScalar(Math.max(6, o.vel.length())), Math.min(1, dt * o.home)); // missiles and bubbles chase you
    o.g.position.addScaledVector(o.vel, dt);
    const p = o.g.position, hitP = Math.hypot(PL.pos.x - p.x, PL.pos.y + 0.9 - p.y, PL.pos.z - p.z) < (o.hitR || 1.0);
    if (hitP) hurtPlayer(o.dmg, 'Ouch! Dodge the boss\'s fireballs (move sideways)!');
    if (hitP || o.life <= 0 || solidAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { P.parts.burst(p.x, p.y, p.z, o.color || P.p.theme.boss.accent, 12, 5); P.scene.remove(o.g); P.orbs.splice(i, 1); }
  }
}
function defeatBoss() {
  const b = P.boss, p = P.p; b.dead = true; b.hp = 0;
  SFX.win(); setMusicIntensity(1); $('bossBar').hidden = true;
  const at = b.g.position.clone();
  for (let k = 0; k < 4; k++) setTimeout(() => P && P.parts.burst(at.x + (Math.random() - 0.5) * 3, at.y + (Math.random() - 0.5) * 3, at.z + (Math.random() - 0.5) * 3, p.theme.boss.accent, 40, 9), k * 180);
  P.scene.remove(b.g);
  for (let k = 0; k < 5; k++) spawnDrop('orb', 0, at);
  spawnDrop('mineral', p.minerals[3], at); spawnDrop('mineral', p.minerals[3], at); spawnDrop('mineral', p.minerals[2], at);
  if (!save.saved.includes(p.id)) {
    save.saved.push(p.id);
    const used = new Set(save.helpers.map(h => h.name));
    for (const cls of CLS) { let nm = pick(Math.random, HELPER_NAMES); let n = 2; while (used.has(nm)) nm = pick(Math.random, HELPER_NAMES) + ' ' + (n++); used.add(nm); save.helpers.push({ cls, name: nm, from: p.id }); }
    writeSave();
    banner('Village saved!', `4 helpers joined your crew: a miner, a fighter, a builder and a farmer.`, 4200);
    setTimeout(() => { if (P && P.p === p) spawnHelperFollowers(); }, 2500);
  }
  P.villagers.forEach(v => v.cheer = 4);
}
function updateVillagers(dt, time) {
  const free = !P.boss || P.boss.dead;
  for (const v of P.villagers) {
    const g = v.g, u = g.userData; v.t -= dt;
    if (v.t <= 0) { v.t = 2 + Math.random() * 3; v.dir = Math.random() * 6.28; v.walk = Math.random() < 0.6; }
    if (v.walk) {
      const nx = g.position.x + Math.sin(v.dir) * dt * 1.2, nz = g.position.z + Math.cos(v.dir) * dt * 1.2;
      if (Math.hypot(nx - P.vc.x, nz - P.vc.z) < (free ? 14 : 9) && Math.abs(groundY(nx, nz) - g.position.y) <= 1) { g.position.x = nx; g.position.z = nz; } else v.dir += 2.5;
      g.rotation.y = v.dir;
    }
    g.position.y = damp(g.position.y, groundY(g.position.x, g.position.z), 10, dt);
    u.hop += dt * 8;
    if (v.cheer > 0) { v.cheer -= dt; g.position.y += Math.abs(Math.sin(u.hop * 1.5)) * 0.6; }
    else if (!free) u.head.rotation.z = Math.sin(time * 3 + u.hop) * 0.15; // nervous wobble
  }
}

/* ---------- helpers (your crew) ---------- */
function helperCount(cls) { return save.helpers.filter(h => h.cls === cls).length; }
function spawnHelperFollowers() {
  if (!P) return;
  P.helpers.forEach(h => P.scene.remove(h.g)); P.helpers = [];
  const list = save.helpers.slice(-8);
  list.forEach((h, i) => {
    const g = buildVillager(['#9fe6ff', '#ffd6a8', '#c9b8ff', '#a8ffcf'][i % 4], h.cls);
    g.scale.setScalar(0.85); g.position.set(PL.pos.x + (i % 4) - 1.5, PL.pos.y, PL.pos.z + 2 + Math.floor(i / 4));
    const tag = textSprite(`${h.name} · ${HELPER_CLASSES[h.cls].label}`, HELPER_CLASSES[h.cls].hat, 0.36); tag.position.y = 1.95; g.add(tag);
    P.scene.add(g); P.helpers.push({ g, h, i, zapT: Math.random() });
  });
}
function updateHelpers(dt, time) {
  for (const hp of P.helpers) {
    const g = hp.g, a = hp.i / Math.max(1, P.helpers.length) * Math.PI * 2;
    let tx = PL.pos.x + Math.cos(a + time * 0.1) * 2.6, tz = PL.pos.z + Math.sin(a + time * 0.1) * 2.6;
    { const spot = crewSpot(hp, a, time); if (spot) { tx = spot.x; tz = spot.z; } }
    // fighters charge at nearby enemies (and the boss, once it is awake)
    if (hp.h.cls === 'fighter') {
      let foe = null, fd = 20;
      for (const m of P.mobs) { if (m.dead) continue; const md = Math.hypot(m.g.position.x - PL.pos.x, m.g.position.z - PL.pos.z); if (md < fd) { fd = md; foe = m.g.position; } }
      if (!foe && P.boss && !P.boss.dead && P.boss.awake && P.boss.g.position.distanceTo(PL.pos) < 30) foe = P.boss.g.position;
      if (!foe && P.ultra && !P.ultra.dead && P.ultra.awake && P.ultra.g.position.distanceTo(PL.pos) < 34) foe = P.ultra.g.position;
      hp.foe = foe;
      if (foe) { const ox = Math.cos(a + time * 1.5) * 1.6, oz = Math.sin(a + time * 1.5) * 1.6; tx = foe.x + ox; tz = foe.z + oz; }
    }
    const dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz);
    if (d > 25) { g.position.set(tx, groundY(tx, tz), tz); }
    else if (d > 0.4) { const s = Math.min(d * 2, hp.foe ? 11 : 7) * dt; g.position.x += dx / d * s; g.position.z += dz / d * s; g.rotation.y = Math.atan2(dx, dz); }
    const gy = groundY(g.position.x, g.position.z); g.position.y = damp(g.position.y, gy, 12, dt);
    if (d > 0.4) g.position.y += Math.abs(Math.sin(time * 10 + hp.i)) * 0.15;
    if (hp.h.cls === 'fighter') {
      hp.zapT -= dt;
      if (hp.zapT <= 0) {
        hp.zapT = 0.55; let best = null, bd = 9;
        for (const m of P.mobs) { if (m.dead) continue; const md = m.g.position.distanceTo(g.position); if (md < bd) { bd = md; best = m; } }
        const dmg = 12 + P.p.tier * 3;
        if (best) { zapLine(g.position, best.g.position); best.hp -= dmg; best.hitT = 0.1; SFX.zap(); P.parts.burst(best.g.position.x, best.g.position.y + 0.5, best.g.position.z, '#ff8aa0', 6); if (best.hp <= 0) killMob(best); }
        else if (P.boss && !P.boss.dead && P.boss.awake && P.boss.g.position.distanceTo(g.position) < 12) { const b = P.boss; zapLine(g.position, b.g.position); b.hp -= dmg * 0.6; b.hitT = 0.1; SFX.zap(); if (b.hp <= 0) defeatBoss(); }
        else if (P.ultra && !P.ultra.dead && P.ultra.awake && P.ultra.g.position.distanceTo(g.position) < 16) { zapLine(g.position, P.ultra.g.position); hitUltra(dmg * 0.5); }
      }
    }
  }
  // gifts from miners and builders
  for (const cls of ['miner', 'builder']) {
    const n = helperCount(cls); if (!n) continue;
    P.giftT[cls] = (P.giftT[cls] ?? 25) - dt;
    if (P.giftT[cls] <= 0) {
      P.giftT[cls] = 25;
      if (cls === 'miner') { const k = Math.random() < 0.25 ? 1 : 0, id = P.p.minerals[k], c = Math.min(6, n + Math.floor(Math.random() * 2)); addMineral(id, c); pickupToast(`Your miners dug up ${c} ${MINERALS[id].name}`); }
      else { const t = pick(Math.random, [B.PLANKS, B.BRICKS, B.ROCK, B.GLASS, B.GLOW]), c = 6 * n; addBlock(t, c); pickupToast(`Your builders brought ${c} ${BLOCK_INFO[t].name}`); renderHotbar(); }
      queueSave();
    }
  }
}
function zapLine(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a.clone().add(_w.set(0, 1.2, 0)), b.clone().add(_w.set(0, 0.5, 0))]);
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ff8aa0' })); P.scene.add(l);
  const sc = P.scene; setTimeout(() => { sc.remove(l); geo.dispose(); }, 120);
}

/* ---------- helper pods in space ---------- */
const pods = [];
function updatePods(dt, time) {
  const n = Math.min(8, save.helpers.length);
  while (pods.length < n) { const h = save.helpers[pods.length], c = HELPER_CLASSES[h.cls].hat, g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), stdMat(c, { emissive: c, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 })), glowSprite(c, 5, 0.6)); g.position.copy(ship.g.position); space.add(g); pods.push(g); }
  while (pods.length > n) space.remove(pods.pop());
  pods.forEach((g, i) => {
    g.visible = mode === 'space' || mode === 'ending';
    const a = i / n * Math.PI * 2 + time * 0.8;
    _v.set(Math.cos(a) * 7, Math.sin(a) * 4 + 1, 9 + i * 0.6).applyQuaternion(ship.g.quaternion).add(ship.g.position);
    g.position.lerp(_v, 1 - Math.exp(-dt * 6));
  });
}

/* ---------- other players on the same planet ---------- */
function updateRemotePlayers(dt) {
  const here = new Set();
  for (const [id, pe] of NET.peers) {
    const st = pe.st; if (!st || st.m !== 'p' || st.g !== GALAXY_SEED || st.p !== P.p.id) continue; here.add(id);
    let r = P.remote.get(id);
    if (!r) { const g = buildHero(HEROES[(st.h | 0) % HEROES.length]); const tag = textSprite(st.n || 'Pilot', '#5affc8', 0.9); tag.position.y = 2.6; g.add(tag); g.position.set(st.x, st.y, st.z); P.scene.add(g); r = { g, tag, st }; P.remote.set(id, r); }
    r.st = st;
    const before = _v.copy(r.g.position);
    const k = 1 - Math.exp(-dt * 10); r.g.position.x += (st.x - r.g.position.x) * k; r.g.position.y += (st.y - r.g.position.y) * k; r.g.position.z += (st.z - r.g.position.z) * k;
    r.g.rotation.y = (st.ry || 0) + Math.PI;
    animateHero(r.g, st.mv || 0, dt);
    r.tag.material.color.set(st.pvp ? '#ff9fb2' : '#ffffff');
  }
  for (const [id, r] of P.remote) if (!here.has(id)) { P.scene.remove(r.g); P.remote.delete(id); }
}
