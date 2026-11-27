/* ---------- 1.8: TUTORIAL (David Jr: "learning the controls is the boring part, so we need a tutorial") ----------
   New players start on Earth after the 2964 cutscene. Captain Vega walks them through walking, mining, crafting,
   a practice fight, launching, flying with nitro and landing on the first planet. It can be skipped any time.
   save.tut: step number while running, -1 when done or skipped. Old saves (intro already watched) count as done. */
const TUT = { el: null, mined: 0, walk: 0, turn: 0, lastYaw: null, lastPos: null, nitroT: 0, mob: null, shown: -2 };
const TUT_STEPS = [
  { title: 'Walk and look around',
    key: 'Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> and look around with the mouse (or the arrow keys). <kbd>Space</kbd> jumps.',
    touch: 'Walk with the joystick on the left. Drag on the right side of the screen to look around.' },
  { title: 'Mine 3 blocks',
    key: 'Point at the ground and <b>hold the left mouse button</b> to mine with your laser. Mine 3 blocks.',
    touch: 'Point at the ground and <b>hold ⛏️ Use</b> to mine with your laser. Mine 3 blocks.' },
  { title: 'Craft a mining laser',
    key: 'Captain Vega gave you 3 Starrite! Press <kbd>C</kbd> to open the workshop, then click <b>Laser</b> next to Starrite.',
    touch: 'Captain Vega gave you 3 Starrite! Tap <b>C Workshop</b>, then tap <b>Laser</b> next to Starrite.' },
  { title: 'Beat the practice monster',
    key: 'A practice monster appeared! Look at it and <b>click</b> to hit it, or hold <kbd>F</kbd> to fire your laser.',
    touch: 'A practice monster appeared! Look at it and tap <b>⛏️ Use</b> to hit it, or hold <b>🔫 Laser</b>.' },
  { title: 'Blast off',
    key: 'Walk back to the launch pad (the green sign) and press <kbd>L</kbd> to launch your rocket.',
    touch: 'Walk back to the launch pad (the green sign) and tap <b>L Launch</b>.' },
  { title: 'Fly with NITRO',
    key: 'Hold <kbd>W</kbd> to fly. Steer with <kbd>A</kbd><kbd>D</kbd> and the arrow keys. Now hold <kbd>N</kbd> for NITRO!',
    touch: 'Hold <b>🚀 Go</b> to fly and steer with the joystick. Now hold <b>⚡ Nitro</b>!' },
  { title: 'Land on your first planet',
    key: 'Follow the green marker to {p}. When you get close, press <kbd>L</kbd> to land.',
    touch: 'Follow the green marker to {p}. When you get close, tap <b>🛬 Land</b>.' },
];
function tutActive() { return typeof save.tut === 'number' && save.tut >= 0; }
function tutInit() {
  if (typeof save.tut !== 'number') save.tut = save.introDone ? -1 : 0;
  const el = document.createElement('div'); el.id = 'tutBox'; el.hidden = true;
  el.innerHTML = '<div class="tutHead"><span id="tutStep"></span><button type="button" id="tutSkip">Skip tutorial</button></div><b id="tutTitle"></b><div id="tutText"></div>';
  document.body.appendChild(el); TUT.el = el;
  const skip = e => { e.preventDefault(); e.stopPropagation(); tutSkip(); };
  $('tutSkip').addEventListener('click', skip); $('tutSkip').addEventListener('touchstart', skip, { passive: false });
  $('bSkipTut').addEventListener('click', () => { tutSkip(); hideSheet('pauseBox'); requestLock(); });
}
function tutSkip() {
  if (!tutActive()) return;
  tutClearMob(); save.tut = -1; writeSave(); tutRender();
  toast('Tutorial skipped. Captain Vega on Earth can always give you tips!', '');
}
// after the cutscene, or when continuing a save mid-tutorial: the first steps happen on Earth
function tutWantsEarth() { return tutActive() && save.tut <= 4; }
function tutEvent(kind) { if (kind === 'mine' && tutActive() && save.tut === 1) TUT.mined++; }
function tutGo(step) {
  save.tut = step; writeSave(); SFX.orb();
  if (step === 2) {
    const have = save.minerals[0] || 0;
    if (have < GEAR_COST.tool) addMineral(0, GEAR_COST.tool - have);
    renderHotbar();
  }
}
function tutClearMob() { if (TUT.mob && P && P.mobs.includes(TUT.mob)) { P.scene.remove(TUT.mob.g); P.mobs.splice(P.mobs.indexOf(TUT.mob), 1); } TUT.mob = null; }
function tutSpawnMob() {
  // a weak practice monster a few steps in front of you, on open ground
  const th = Object.assign({}, P.p.theme, { mob: Object.assign({}, THEMES[0].mob, { name: 'Practice Bot', color: '#ffb84d', eye: '#2a5cff' }) });
  let best = null;
  for (let k = 0; k < 24; k++) {
    const off = (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.35, r = 6 + (k % 3);
    const x = PL.pos.x - Math.sin(PL.yaw + off) * r, z = PL.pos.z - Math.cos(PL.yaw + off) * r;
    if (x < 2 || z < 2 || x > W - 2 || z > D - 2) continue;
    const gy = groundY(x, z); if (Math.abs(gy - PL.pos.y) > 2) continue;
    best = { x, z, gy }; break;
  }
  if (!best) best = { x: PL.pos.x + 3, z: PL.pos.z + 3, gy: groundY(PL.pos.x + 3, PL.pos.z + 3) };
  const g = buildMob(th); g.position.set(best.x, best.gy, best.z); P.scene.add(g);
  TUT.mob = { g, hp: 24, maxHp: 24, dmg: 3, fly: false, vel: new V3(), atkCD: 2, hitT: 0, wander: 2, dir: 0, hop: 0, tut: true };
  P.mobs.push(TUT.mob);
}
function tutTick(dt) {
  if (!TUT.el) return;
  if (!tutActive()) { tutRender(); return; }
  const s = save.tut;
  // launched early? skip ahead to the flying part
  if (s <= 4 && mode === 'space') { tutClearMob(); tutGo(5); }
  else if (mode === 'planet' && P && P.p.earth && PL.deadT <= 0) {
    if (s === 0) {
      if (TUT.lastPos) TUT.walk += Math.hypot(PL.pos.x - TUT.lastPos.x, PL.pos.z - TUT.lastPos.z);
      if (TUT.lastYaw !== null) TUT.turn += Math.abs(PL.yaw - TUT.lastYaw) + Math.abs(PL.pitch - (TUT.lastPitch || 0));
      TUT.lastPos = { x: PL.pos.x, z: PL.pos.z }; TUT.lastYaw = PL.yaw; TUT.lastPitch = PL.pitch;
      if (TUT.walk > 6 && TUT.turn > 1) tutGo(1);
    } else if (s === 1) { if (TUT.mined >= 3) tutGo(save.gear.tool ? 3 : 2); }
    else if (s === 2) { if (save.gear.tool) { hideSheet('craft'); requestLock(); tutGo(3); } }
    else if (s === 3) {
      if (!TUT.mob || !P.mobs.includes(TUT.mob)) { if (TUT.mob && TUT.mob.dead) { TUT.mob = null; tutGo(4); } else tutSpawnMob(); }
      else if (TUT.mob.dead) { TUT.mob = null; tutGo(4); }
    }
  } else if (s === 5 && mode === 'space') {
    if (ship.nitroOn) TUT.nitroT += dt;
    if (TUT.nitroT > 1.2) tutGo(6);
  } else if (s === 6 && mode === 'planet' && P && !P.p.earth) {
    save.tut = -1; save.orbs += 5; writeSave(); SFX.win();
    banner('Tutorial complete!', 'You are a real space pilot now. Space Inc. gives you 5 enchant orbs!', 4200);
  }
  tutRender();
}
function tutRender() {
  const on = tutActive() && (mode === 'planet' || mode === 'space');
  const key = on ? save.tut + (TOUCH ? 't' : '') : -2;
  if (TUT.el.hidden !== !on) TUT.el.hidden = !on;
  $('bSkipTut').hidden = !tutActive();
  if (!on || TUT.shown === key) return;
  TUT.shown = key;
  const st = TUT_STEPS[save.tut], text = (TOUCH ? st.touch : st.key).replace('{p}', escapeHtml(PLANETS[0].name));
  $('tutStep').textContent = `Tutorial · step ${save.tut + 1} of ${TUT_STEPS.length}`;
  $('tutTitle').textContent = st.title;
  $('tutText').innerHTML = text + (TOUCH ? '' : '<div class="tutSub">Press <kbd>Esc</kbd> to pause or skip.</div>');
  TUT.el.classList.remove('pop'); void TUT.el.offsetWidth; TUT.el.classList.add('pop');
}
