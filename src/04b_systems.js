/* ---------- 1.9: SOLAR SYSTEMS (David Jr: "you have to explore all planets in one system to unlock another") ----------
   The 120 planets are split into 8 solar systems of 15, in the order you fly them (planet ids are already in
   spiral/difficulty order). Each system has its own sun. A warp gate sits between one system and the next.
   A planet is "done" when you have landed on it, and for boss planets when you have beaten the boss too.
   Finish every planet in a system and the warp gate to the next one opens. You can't land in a locked system
   (but planets you already explored in an old save stay open). The Edge Gate needs all 8 systems done. */
const SYS_SIZE = 15;
const SYSTEM_NAMES = ['Sol Nova', 'Emerald Reach', 'Ember Belt', 'Frostlight', 'Thunderhead', 'Neon Drift', 'Starbloom', 'Final Frontier'];
const SYSTEMS = (() => {
  const n = Math.ceil(PLANETS.length / SYS_SIZE), out = [];
  for (let s = 0; s < n; s++) {
    const list = PLANETS.slice(s * SYS_SIZE, (s + 1) * SYS_SIZE);
    list.forEach(p => p.sys = s);
    const c = new V3(); list.forEach(p => c.add(p.pos)); c.divideScalar(list.length);
    out.push({ id: s, name: SYSTEM_NAMES[s] || `System ${s + 1}`, planets: list, center: c });
  }
  return out;
})();
function planetDone(p) { return save.visited.includes(p.id) && (!p.boss || save.saved.includes(p.id)); }
function sysCount(s) { return SYSTEMS[s].planets.filter(planetDone).length; }
function sysDone(s) { return SYSTEMS[s].planets.every(planetDone); }
function sysOpen(s) { return s <= 0 || sysDone(s - 1); }
function canLandOn(p) { return p.earth || sysOpen(p.sys) || save.visited.includes(p.id); }
function allSystemsDone() { return SYSTEMS.every((x, s) => sysDone(s)); }
function openSystems() { let n = 0; for (let s = 0; s < SYSTEMS.length; s++) if (sysOpen(s)) n = s + 1; else break; return n; }
// what is still left to do in a system, for the kid-friendly "almost there" messages
function sysTodo(s) {
  const left = SYSTEMS[s].planets.filter(p => !planetDone(p));
  const bosses = left.filter(p => save.visited.includes(p.id) && p.boss).length;
  return { left: left.length, bosses, unexplored: left.length - bosses };
}
function sysTodoText(s) {
  const t = sysTodo(s), bits = [];
  if (t.unexplored) bits.push(`${t.unexplored} planet${t.unexplored > 1 ? 's' : ''} to explore`);
  if (t.bosses) bits.push(`${t.bosses} boss${t.bosses > 1 ? 'es' : ''} to beat`);
  return bits.join(' and ');
}

/* suns and warp gates */
const SUN_COLORS = ['#ffd34d', '#7dffb0', '#ff8a3d', '#9fe8ff', '#c9a4ff', '#ff5ad1', '#ffa8c8', '#ffffff'];
SYSTEMS.forEach((sy, s) => {
  const col = SUN_COLORS[s % SUN_COLORS.length];
  const g = new THREE.Group(); g.position.copy(sy.center); g.position.y = 1500; // high above the planets, so it never gets in the way
  const sun = new THREE.Mesh(new THREE.SphereGeometry(260, 40, 24), new THREE.MeshBasicMaterial({ color: col }));
  g.add(sun); g.add(glowSprite(col, 2400, 0.7)); g.add(glowSprite('#ffffff', 900, 0.6));
  space.add(g); sy.sun = g;
});
const warpGates = [];
for (let s = 0; s < SYSTEMS.length - 1; s++) {
  const a = SYSTEMS[s].planets[SYSTEMS[s].planets.length - 1].pos, b = SYSTEMS[s + 1].planets[0].pos;
  const pos = a.clone().lerp(b, 0.5);
  const g = new THREE.Group(); g.position.copy(pos); g.lookAt(b);
  const mat = new THREE.MeshBasicMaterial({ color: '#ff4060' });
  g.add(new THREE.Mesh(new THREE.TorusGeometry(130, 10, 12, 72), mat));
  const inner = new THREE.MeshBasicMaterial({ color: '#ff4060', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  g.add(new THREE.Mesh(new THREE.CircleGeometry(122, 48), inner));
  const glow = glowSprite('#ff4060', 900, 0.45); g.add(glow);
  space.add(g);
  warpGates.push({ to: s + 1, pos, g, mat, inner, glow, near: false });
}
const SYS = { opened: -1, gateT: 0 };
function systemsTick(dt, time) {
  for (const gt of warpGates) {
    const open = sysOpen(gt.to), c = open ? '#5affc8' : '#ff4060';
    if (gt.open !== open) { gt.open = open; gt.mat.color.set(c); gt.inner.color.set(c); gt.glow.material.color.set(c); }
    gt.g.rotateZ(dt * (open ? 0.6 : 0.1)); gt.inner.opacity = 0.14 + 0.08 * Math.sin(time * 3);
    if (mode !== 'space') { gt.near = false; continue; }
    const near = ship.g.position.distanceTo(gt.pos) < 170;
    if (near && !gt.near) {
      if (open) { SFX.orb(); banner(`${SYSTEMS[gt.to].name} System`, `Solar system ${gt.to + 1} of ${SYSTEMS.length}. ${sysCount(gt.to)}/${SYS_SIZE} planets done here.`, 3200); }
      else toast(`🔒 This warp gate is locked. Finish the ${SYSTEMS[gt.to - 1].name} System first: ${sysTodoText(gt.to - 1)}.`, 'bad');
    }
    gt.near = near;
  }
  // keep the rocket from flying into a sun
  if (mode === 'space') for (const sy of SYSTEMS) {
    const d = ship.g.position.distanceTo(sy.sun.position);
    if (d < 330) { tmpA.subVectors(ship.g.position, sy.sun.position); if (tmpA.lengthSq() < 1) tmpA.set(0, -1, 0); tmpA.normalize(); ship.g.position.copy(sy.sun.position).addScaledVector(tmpA, 330); ship.vel *= 0.5; if (time > SYS.gateT) { SYS.gateT = time + 3; toast('Too hot! That sun would melt your rocket.', 'bad'); } }
  }
}
// call whenever exploring might have changed: celebrates a newly opened system
function systemsCheck() {
  const n = openSystems();
  if (SYS.opened >= 0 && n > SYS.opened && n <= SYSTEMS.length) {
    const s = n - 1;
    setTimeout(() => { SFX.win(); banner('Warp gate open!', `You finished the ${SYSTEMS[s - 1].name} System. Fly through the green warp gate to the ${SYSTEMS[s].name} System!`, 5000); }, 1200);
  }
  if (SYS.allWas === false && allSystemsDone()) setTimeout(() => toast('You finished every solar system! The Edge Gate is now OPEN.', 'gold'), 6500);
  SYS.allWas = allSystemsDone(); SYS.opened = n;
}
// the warp gate you should head to next (only while you haven't landed in that system yet)
function nextGate() {
  const n = openSystems(); if (n < 2) return null;
  const to = n - 1; if (SYSTEMS[to].planets.some(p => save.visited.includes(p.id))) return null;
  return warpGates[to - 1];
}
