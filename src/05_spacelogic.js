/* ================= SPACE GAMEPLAY ================= */
const tmpQ = new THREE.Quaternion(), AXY = new V3(0, 1, 0), AXX = new V3(1, 0, 0), AXZ = new V3(0, 0, 1);
const fwd = new V3(), tmpA = new V3(), tmpB = new V3(), tmpC = new V3();
let nearest = null, nearestDist = Infinity, cockpit = false, gateWarnT = 0, hudT = 0;
const cut = { t: 0, launchCam: null };
function allVisited() { return PLANETS.every(p => save.visited.includes(p.id)); }

function shipControls(dt) {
  const st = shipStats(), s = ship;
  const yawIn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), pitchIn = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0), rollIn = (keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0);
  s.yawV = damp(s.yawV, yawIn * 1.5, 6, dt); s.pitchV = damp(s.pitchV, pitchIn * 1.25, 6, dt); s.rollV = damp(s.rollV, rollIn * 1.8, 6, dt);
  tmpQ.setFromAxisAngle(AXY, s.yawV * dt); s.g.quaternion.multiply(tmpQ);
  tmpQ.setFromAxisAngle(AXX, s.pitchV * dt); s.g.quaternion.multiply(tmpQ);
  tmpQ.setFromAxisAngle(AXZ, s.rollV * dt); s.g.quaternion.multiply(tmpQ);
  s.g.quaternion.normalize();
  const thr = keys.KeyW, brk = keys.KeyS || keys.Space;
  const wasN = s.nitroOn; s.nitroOn = !!keys.KeyN && s.nitro > 1;
  if (s.nitroOn) { s.vel = Math.min(st.maxV * 4.2, s.vel + 1000 * dt); s.nitro -= 30 * dt; if (!wasN) SFX.nitro(); }
  else { s.nitro = Math.min(st.nitroMax, s.nitro + 9 * dt); if (s.vel > st.maxV) s.vel = Math.max(st.maxV, s.vel - 600 * dt); }
  if (thr && !s.nitroOn && s.vel <= st.maxV) s.vel = Math.min(st.maxV, s.vel + st.accel * dt);
  if (brk) s.vel = Math.max(-60, s.vel - 300 * dt);
  if (!thr && !brk && !s.nitroOn) { s.vel *= Math.exp(-0.3 * dt); if (Math.abs(s.vel) < 0.5) s.vel = 0; }
  s.bank.rotation.z = damp(s.bank.rotation.z, yawIn * 0.5, 4, dt);
}

function updateSpace(dt, time) {
  const s = ship, st = shipStats();
  if (mode === 'space' && !uiOpen()) shipControls(dt);
  fwd.set(0, 0, -1).applyQuaternion(s.g.quaternion);
  s.g.position.addScaledVector(fwd, s.vel * dt);

  // planets: collision, nearest, distant glow dots
  nearest = null; nearestDist = Infinity;
  for (const p of PLANETS) {
    const d = s.g.position.distanceTo(p.pos);
    if (d - p.radius < nearestDist) { nearestDist = d - p.radius; nearest = p; }
    if (d < p.radius * 1.05 + 6) { tmpA.subVectors(s.g.position, p.pos).normalize(); s.g.position.copy(p.pos).addScaledVector(tmpA, p.radius * 1.05 + 6); s.vel *= 0.2; }
    const camD = spaceCam.position.distanceTo(p.pos);
    p.dot.scale.setScalar(Math.max(p.radius * 2.6, camD * 0.02)); p.dot.material.opacity = smooth(p.radius * 4, p.radius * 12, camD) * 0.95;
    p.mesh.rotation.y += dt * 0.02;
    const unsaved = p.boss && !save.saved.includes(p.id);
    p.beacon.visible = p.boss; p.beacon.material.color.set(unsaved ? '#ff4060' : '#5affc8'); p.beacon.material.opacity = 0.6 + 0.4 * Math.sin(time * 4);
  }
  // asteroids
  asteroids.update(dt);
  if (mode === 'space') for (const a of asteroids.list) {
    if (!a.alive) continue; const rr = a.size + 3.2;
    if (Math.abs(a.pos.x - s.g.position.x) > rr || Math.abs(a.pos.z - s.g.position.z) > rr || Math.abs(a.pos.y - s.g.position.y) > rr) continue;
    if (a.pos.distanceToSquared(s.g.position) < rr * rr) {
      a.alive = false; const dmg = 6 + Math.abs(s.vel) * 0.05 + a.size * 0.6; s.hull -= dmg; s.vel *= 0.35; s.shake = 0.7; SFX.crash();
      for (let i = 0; i < 40; i++) trail.emit(a.pos, tmpB.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(60), '#c9b8a8');
      toast(s.hull > 0 ? `Asteroid hit! Hull ${Math.max(0, Math.round(s.hull))}/${st.hullMax}` : 'Hull broken!', 'bad');
      setTimeout(() => { a.alive = true; }, 45000);
      if (s.hull <= 0) emergencyWarp();
      break;
    }
  }
  // edge gate
  edgeGate.userData.portalMat.uniforms.t.value = time; edgeGate.userData.portalMat.uniforms.open.value = 1;
  edgeGate.rotation.z += dt * 0.05;
  if (mode === 'space') {
    const gd = s.g.position.distanceTo(EDGE_GATE);
    if (gd < 240) {
      if (allVisited() && !save.leftGalaxy) beginEnding();
      else goToEarth('The Edge Gate warps you home to Earth!');
    }
  }
  // station + earth animation
  station.userData.ring.rotation.z += dt * 0.1;
  station.userData.lights.forEach((l, i) => l.material.opacity = 0.5 + 0.5 * Math.sin(time * 3 + i));
  earth.userData.clouds.rotation.y += dt * 0.01;

  // engine flame and trail
  const u = s.model.userData, thrust = clamp(Math.abs(s.vel) / st.maxV, 0, 1);
  const pw = s.nitroOn ? 1.6 : 0.25 + thrust * 0.9;
  u.flameMat.uniforms.power.value = damp(u.flameMat.uniforms.power.value, pw, 8, dt); u.innerMat.uniforms.power.value = u.flameMat.uniforms.power.value;
  u.flameMat.uniforms.nitro.value = u.innerMat.uniforms.nitro.value = damp(u.flameMat.uniforms.nitro.value, s.nitroOn ? 1 : 0, 6, dt);
  const fl = 0.55 + u.flameMat.uniforms.power.value * 0.7, flick = 0.94 + Math.random() * 0.12;
  u.flame.scale.set(s.nitroOn ? 1.15 : 1, fl * flick, s.nitroOn ? 1.15 : 1); u.inner.scale.set(1, fl * 0.95, 1);
  u.eg.material.color.set(s.nitroOn ? '#7ad0ff' : '#ff9a4a'); u.eg.scale.setScalar((3 + fl * 2.5) * flick); u.eg.material.opacity = 0.7 + Math.random() * 0.3;
  tmpB.set(0, 0, 4.2).applyQuaternion(s.g.quaternion).add(s.g.position);
  const nEmit = mode === 'title' ? 1 : Math.ceil(1 + thrust * 3 + (s.nitroOn ? 5 : 0));
  for (let i = 0; i < nEmit; i++) { tmpC.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 30 + Math.random() * 30).applyQuaternion(s.g.quaternion); tmpC.addScaledVector(fwd, s.vel * 0.85); trail.emit(tmpB, tmpC, s.nitroOn ? '#6ab8ff' : (Math.random() < 0.35 ? '#ffd9a0' : '#ff7a22')); }
  trail.update(dt);

  // helpers ride along as glowing pods
  updatePods(dt, time);

  // camera
  if (mode === 'space' || mode === 'ending') {
    if (cockpit) {
      tmpA.set(0, 0.6, -1.5).applyQuaternion(s.g.quaternion).add(s.g.position); spaceCam.position.copy(tmpA); spaceCam.quaternion.copy(s.g.quaternion); s.model.visible = false;
    } else {
      s.model.visible = true;
      tmpA.set(0, 3.6, 15 + Math.max(0, s.vel) * 0.006).applyQuaternion(s.g.quaternion).add(s.g.position);
      spaceCam.position.lerp(tmpA, 1 - Math.exp(-dt * 7));
      tmpB.set(0, 1, 0).applyQuaternion(s.g.quaternion); spaceCam.up.lerp(tmpB, 1 - Math.exp(-dt * 5)).normalize();
      tmpC.copy(s.g.position).addScaledVector(fwd, 30); spaceCam.lookAt(tmpC);
    }
    if (s.shake > 0 || s.nitroOn) { const k = (s.shake + (s.nitroOn ? 0.12 : 0)) * (REDUCED ? 0.2 : 1); spaceCam.position.x += (Math.random() - 0.5) * k; spaceCam.position.y += (Math.random() - 0.5) * k; s.shake = Math.max(0, s.shake - dt); }
    const fov = s.nitroOn ? 88 : 70 + thrust * 4; if (Math.abs(spaceCam.fov - fov) > 0.05) { spaceCam.fov = damp(spaceCam.fov, fov, 4, dt); spaceCam.updateProjectionMatrix(); }
  } else if (mode === 'title') {
    const a = time * 0.06; spaceCam.position.set(START.x + Math.sin(a) * 170, START.y + 45 + Math.sin(time * 0.2) * 10, START.z + Math.cos(a) * 170 + 20); spaceCam.up.set(0, 1, 0); spaceCam.lookAt(START.x - 20, START.y - 6, START.z);
  } else if (mode === 'cutscene') updateCutscene(dt);
  speedLines.update(dt, s.nitroOn ? 1 : 0, Math.abs(s.vel));
  skyGroup.position.copy(spaceCam.position);

  if (mode === 'space') spaceHud(time);
}

function emergencyWarp() {
  fadeTo(() => { resetShipAtStart(); toast('Space Inc. towed your rocket home and fixed the hull.', 'gold'); }); ship.vel = 0;
}

function launchFromPlanet(p, normal) {
  const n = normal || new V3(0, 1, 0);
  ship.g.position.copy(p.pos).addScaledVector(n, p.radius * 1.3 + 50);
  tmpQ.setFromUnitVectors(new V3(0, 0, -1), n); ship.g.quaternion.copy(tmpQ); ship.vel = 80;
  spaceCam.position.copy(ship.g.position).addScaledVector(n, -20);
}

/* ---------- markers & HUD ---------- */
const mkV = new V3();
function placeMarker(el, wp, label) {
  mkV.copy(wp).project(spaceCam); const behind = mkV.z > 1; let x = mkV.x, y = mkV.y; if (behind) { x = -x; y = -y; }
  let edge = behind || Math.abs(x) > 0.94 || Math.abs(y) > 0.88;
  if (edge) { let m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.84); if (m < 1e-3) { y = -0.84; m = 1; } x /= m; y /= m; }
  el.style.transform = `translate(${(x * 0.5 + 0.5) * innerWidth}px,${(-y * 0.5 + 0.5) * innerHeight}px)`;
  el.classList.toggle('edge', edge); el.hidden = false;
  const sp = el.querySelector('span'); if (sp.textContent !== label) sp.textContent = label;
}
function spaceHud(time) {
  const st = shipStats();
  $('hullFill').style.width = (clamp(ship.hull / st.hullMax, 0, 1) * 100) + '%';
  $('nitroFill').style.width = (clamp(ship.nitro / st.nitroMax, 0, 1) * 100) + '%';
  if (nearest) placeMarker($('mk1'), nearest.pos, `${nearest.name} · ${fmt(Math.max(0, nearestDist))} km`);
  let boss = null, bd = Infinity; for (const p of PLANETS) if (p.boss && !save.saved.includes(p.id)) { const d = ship.g.position.distanceTo(p.pos); if (d < bd) { bd = d; boss = p; } }
  if (boss && boss !== nearest) placeMarker($('mk2'), boss.pos, `Boss: ${boss.name}`); else $('mk2').hidden = true;
  placeMarker($('mk3'), EDGE_GATE, allVisited() && !save.leftGalaxy ? 'Edge Gate: OPEN!' : 'Edge Gate · warp to Earth');
  if (time < hudT) return; hudT = time + 0.12;
  $('speedVal').textContent = fmt(Math.abs(ship.vel));
  if (nearest) {
    $('navName').textContent = nearest.name;
    const chips = `<span class="chip tier">${nearest.theme.label} · Tier ${nearest.tier}</span>` + (nearest.boss ? (save.saved.includes(nearest.id) ? '<span class="chip saved">Village saved</span>' : '<span class="chip boss">Boss</span>') : '') + (save.visited.includes(nearest.id) ? '' : '<span class="chip saved" style="opacity:.7">New</span>');
    if ($('navInfo').dataset.k !== chips + nearestDist) { $('navInfo').innerHTML = chips + `<div style="margin-top:4px">${fmt(Math.max(0, nearestDist))} km away</div>`; $('navInfo').dataset.k = chips + nearestDist; }
  }
  const canLand = nearest && nearestDist < nearest.radius * 0.9 + 90;
  setPrompt(canLand ? `Press <kbd>L</kbd> to land on ${escapeHtml(nearest.name)}` : nearEarth() ? 'Press <kbd>L</kbd> to land on <b>Earth</b> (home)' : (ship.vel < 1 && time < 30 ? 'Hold <kbd>W</kbd> to fly. <kbd>A</kbd> <kbd>D</kbd> turn, <kbd>↑</kbd> <kbd>↓</kbd> climb and dive, <kbd>N</kbd> nitro!' : ''));
}

/* ---------- landing card ---------- */
let landTarget = null;
function openLandCard(p) {
  landTarget = p; ship.vel = 0;
  const g = gearStats(), rec = Math.max(1, p.tier);
  const line = (label, have, need) => `<div>${label}: tier ${have} ${have >= need ? '<span class="good">✓ ready</span>' : `<span class="warn">(recommended tier ${need})</span>`}</div>`;
  $('landName').textContent = p.name;
  $('landBody').innerHTML = `<div><span class="chip tier">${p.theme.label} world · Tier ${p.tier}</span>${p.boss ? (save.saved.includes(p.id) ? '<span class="chip saved">Village saved</span>' : '<span class="chip boss">Boss lives here</span>') : ''}</div>
    ${ultraHere(p) && !(save.ultra || []).includes(ultraKey(p)) ? '<div><span class="chip boss">⚡ ULTRA BOSS roams here</span></div>' : ''}<div>Watch out for <b>${escapeHtml(p.theme.mob.name)}s</b>.${p.boss && !save.saved.includes(p.id) ? ` The boss <b>${escapeHtml(p.theme.boss.name)}</b> has trapped a village under a force field.` : ''}</div>
    <div><b>Recommended gear: tier ${rec}</b>${line('<br>Your mining laser', g.toolTier, Math.max(1, rec - 1))}${line('Your sword', g.weaponTier, rec)}${line('Your armor', g.armorTier, rec)}</div>
    <div class="sub">Minerals here: ${p.minerals.map(id => `<span style="color:${MINERALS[id].hex}">■</span> ${MINERALS[id].name} (T${MINERALS[id].tier})`).join(', ')}</div>`;
  showSheet('landCard');
}

/* ---------- cutscene ---------- */
const SLIDES = [
  { d: 3.4, big: 'YEAR 2964' },
  { d: 4.6, text: 'Humans have explored every corner of the Milky Way galaxy…' },
  { d: 4.0, text: '…every corner except one: the outside.' },
  { d: 5.0, text: 'Space Inc. has built the fastest rocket ever made: the Nova Runner.' },
  { d: 4.4, text: 'They need a pilot brave enough to fly it beyond the galaxy.' },
  { d: 3.8, text: 'They chose YOU, {name}.' },
  { d: 6.2, text: 'But monsters rule some of the planets on the way. Beat them, save their villages, and the villagers will join your crew.' },
  { d: 1, big: '3' }, { d: 1, big: '2' }, { d: 1, big: '1' }, { d: 3, big: 'LAUNCH!', launch: true },
];
function startCutscene() {
  mode = 'cutscene'; resetShipAtStart(); cut.t = 0; cut.launchCam = null;
  $('title').hidden = true; $('cine').hidden = false; $('hud').hidden = true; setMusicIntensity(0);
}
function updateCutscene(dt) {
  cut.t += dt; let t = cut.t, i = 0; while (i < SLIDES.length && t > SLIDES[i].d) { t -= SLIDES[i].d; i++; }
  if (i >= SLIDES.length) { endCutscene(); return; }
  const sl = SLIDES[i];
  $('cineBig').textContent = sl.big || '';
  const txt = (sl.text || '').replace('{name}', save.name || 'Pilot');
  $('cineText').textContent = txt.slice(0, Math.floor(t * 42));
  const time = cut.t;
  if (i <= 2) { spaceCam.position.set(START.x + 200 - time * 6, START.y + 70, START.z + 320); spaceCam.up.set(0, 1, 0); spaceCam.lookAt(START.x - 300, START.y - 120, START.z + 300); }
  else if (i <= 6) { const a = time * 0.22; spaceCam.position.set(START.x + Math.sin(a) * 28, START.y + 7, START.z + Math.cos(a) * 28); spaceCam.lookAt(START); }
  else if (!sl.launch) { spaceCam.position.set(START.x + 7, START.y + 2.5, START.z + 20); spaceCam.lookAt(START.x, START.y, START.z - 30); }
  else {
    if (!cut.launchCam) { cut.launchCam = spaceCam.position.clone(); SFX.nitro(); }
    ship.nitroOn = true; ship.vel = Math.min(1100, ship.vel + 700 * dt); ship.shake = 0.3;
    spaceCam.lookAt(ship.g.position);
  }
  if (!sl.launch) { ship.nitroOn = false; ship.vel = 0; }
}
function endCutscene() {
  $('cine').hidden = true; save.introDone = true; writeSave();
  ship.nitroOn = false; if (ship.vel < 200) ship.vel = 200; enterSpaceMode();
  if (tutWantsEarth()) { goToEarth('Welcome to Earth City! Captain Vega will show you the controls.'); return; }
  toast('Fly with W A S D and the arrow keys. Hold N for NITRO!', 'gold');
  setTimeout(() => toast(`Follow the green marker to ${PLANETS[0].name}, then press L to land.`), 2500);
}

/* ---------- ending ---------- */
function beginEnding() {
  mode = 'ending'; ship.vel = 0; save.leftGalaxy = true; writeSave(); SFX.win(); setMusicIntensity(0);
  $('fade').classList.add('white', 'on');
  setTimeout(() => {
    $('endBody').innerHTML = `<div style="font-size:18px"><b>${escapeHtml(save.name || 'Pilot')}</b> is the first person ever to travel beyond the galaxy!</div>
      <div>Planets explored: ${save.visited.length}/${PLANETS.length} · Villages saved: ${save.saved.length} · Helpers: ${save.helpers.length} · Minerals found: ${mineralsFound()}/200</div>
      <div class="sub">What lies beyond is coming in a future version. Now head home to Earth! Fly through the Edge Gate anytime to warp home, and launch from Space Inc. to come back.</div>`;
    showSheet('endBox'); $('fade').classList.remove('on');
    setTimeout(() => $('fade').classList.remove('white'), 400);
  }, 900);
}
function returnFromEnding() {
  hideSheet('endBox'); goToEarth('Welcome home, explorer! Everyone on Earth is cheering for you!');
}
/* ---------- travel between Earth and space ---------- */
function nearEarth() { return ship.g.position.distanceTo(EARTH.pos) < EARTH.radius + 260; }
function goToEarth(msg) {
  if (mode !== 'space' && mode !== 'ending') return;
  mode = 'travel'; ship.vel = 0;
  fadeTo(() => { enterPlanet(EARTH, new V3(0, 1, 0)); setHelp(); requestLock(); if (msg) setTimeout(() => toast(msg, 'gold'), 600); });
}
function launchFromEarth() {
  // the Space Inc. launch pad sends you up to the Space Inc. station
  tmpA.subVectors(PLANETS[0].pos, START).normalize();
  ship.g.position.copy(START).addScaledVector(tmpA, 60); tmpQ.setFromUnitVectors(new V3(0, 0, -1), tmpA); ship.g.quaternion.copy(tmpQ); ship.vel = 120;
  spaceCam.position.copy(ship.g.position).addScaledVector(tmpA, -20);
}
