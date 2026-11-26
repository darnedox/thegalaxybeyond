/* ================= INPUT, MODES, MAIN LOOP ================= */
var mode = 'loading';
const keys = {}, mouse = { L: false, R: false };
let locked = false, lockFailed = false, lockAskT = 0;
const cv = renderer.domElement;

function enterSpaceMode() {
  mode = 'space'; $('hud').hidden = false; $('spaceHud').hidden = false; $('planetHud').hidden = true; $('bossBar').hidden = true;
  if (document.pointerLockElement) document.exitPointerLock();
  setMusicIntensity(0); setHelp(); setPrompt(''); updateStats(); onResize();
}
function landOn(p) {
  hideSheet('landCard');
  const n = tmpA.subVectors(ship.g.position, p.pos).normalize().clone();
  fadeTo(() => { enterPlanet(p, n); setHelp(); requestLock(); });
}
function requestLock() {
  if (mode !== 'planet' || uiOpen() || locked) return;
  try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { lockFailed = true; }); } catch (e) { lockFailed = true; }
  lockAskT = performance.now();
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === cv;
  if (locked) lockFailed = false;
  else if (mode === 'planet' && !uiOpen() && !CHAT.open && performance.now() - CHAT.closedAt > 600 && performance.now() - lockAskT > 300) showSheet('pauseBox');
});
document.addEventListener('pointerlockerror', () => { lockFailed = true; });

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  spaceCam.aspect = fpsCam.aspect = innerWidth / innerHeight; spaceCam.updateProjectionMatrix(); fpsCam.updateProjectionMatrix();
}
addEventListener('resize', onResize);

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
addEventListener('keydown', e => {
  const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (typing) { if (e.code === 'Enter' && e.target.id === 'uname') $('bStart').click(); if (e.code === 'Enter' && e.target.id === 'lobbyCode') $('bJoin').click(); return; }
  if (GAME_KEYS.has(e.code) && mode !== 'title') e.preventDefault();
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  const c = e.code;
  if (mode === 'cutscene') { if (c === 'Enter' || c === 'Escape') endCutscene(); return; }
  if (mode === 'title' || mode === 'loading') return;
  if (c === 'Escape') {
    const open = SHEETS.find(id => !$(id).hidden && id !== 'endBox');
    if (open) { hideSheet(open); if (mode === 'planet') requestLock(); }
    else if (mode !== 'ending') showSheet('pauseBox');
    return;
  }
  if (!$('landCard').hidden) { if (c === 'Enter' && landTarget) landOn(landTarget); return; }
  if (c === 'KeyC') { if (!$('craft').hidden) { hideSheet('craft'); requestLock(); } else if (!uiOpen()) openCraft(); return; }
  if (c === 'KeyM') { if (!$('mapBox').hidden) { hideSheet('mapBox'); requestLock(); } else if (!uiOpen()) { drawMap(); showSheet('mapBox'); } return; }
  if (uiOpen()) return;
  if (c === 'KeyT' || (c === 'Enter' && NET.mode)) { e.preventDefault(); chatOpen(); return; }
  if (buildKey(c)) return;
  if (c === 'KeyU' && mode === 'planet') { if (!climbOut()) toast('Press U when you are stuck underground to climb out.'); return; }
  if (c === 'KeyV') { if (mode === 'planet') PL.third = !PL.third; else if (mode === 'space') { cockpit = !cockpit; toast(cockpit ? 'Cockpit view' : 'Chase view'); } }
  if (c === 'KeyL') {
    if (mode === 'space' && nearest && nearestDist < nearest.radius * 0.9 + 90) openLandCard(nearest);
    else if (mode === 'planet' && P && PL.deadT <= 0 && Math.hypot(PL.pos.x - P.spawn.x, PL.pos.z - P.spawn.z) < 3.5) leavePlanet();
    else if (mode === 'planet') toast('Walk back to your rocket to launch.', '');
  }
  if (c === 'KeyP' && mode === 'planet') { NET.pvp = !NET.pvp; toast(NET.pvp ? 'PvP ON: you can fight other players who also turned it on.' : 'PvP off.', NET.pvp ? 'bad' : 'good'); updateGearLine(); }
  if (mode === 'planet' && /^Digit[1-9]$/.test(c)) { PL.sel = +c.slice(5) - 1; renderHotbar(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.L = mouse.R = false; });

cv.addEventListener('mousedown', e => {
  if (mode !== 'planet' || uiOpen()) return;
  if (!locked && !lockFailed) { requestLock(); return; }
  if (e.button === 0) mouse.L = true; if (e.button === 2) mouse.R = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.L = false; if (e.button === 2) mouse.R = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (mode !== 'planet' || uiOpen()) return;
  if (locked || (lockFailed && e.buttons)) { PL.yaw -= e.movementX * 0.0024; PL.pitch = clamp(PL.pitch - e.movementY * 0.0024, -1.5, 1.5); }
});
cv.addEventListener('wheel', e => { if (mode !== 'planet') return; e.preventDefault(); PL.sel = (PL.sel + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(); buildHud(); }, { passive: false });

/* ---------- buttons ---------- */
$('heroGrid').addEventListener('click', e => { const b = e.target.closest('[data-hero]'); if (!b) return; save.hero = +b.dataset.hero; document.querySelectorAll('.hero-card').forEach(x => { const on = +x.dataset.hero === save.hero; x.classList.toggle('sel', on); x.setAttribute('aria-pressed', on); }); audioInit(); SFX.place(); });
$('uname').addEventListener('input', e => { const v = cleanName(e.target.value); if (v !== e.target.value.trim()) e.target.value = v; });
$('bStart').addEventListener('click', () => {
  audioInit();
  save.name = cleanName($('uname').value) || HEROES[save.hero].name; writeSave();
  ship.model.parent.remove(ship.model); ship.model = buildRocket(HEROES[save.hero].accent); ship.model.rotation.x = -Math.PI / 2; ship.bank.add(ship.model);
  $('title').hidden = true; updateStats();
  if (!save.introDone) startCutscene(); else { resetShipAtStart(); enterSpaceMode(); toast(`Welcome back, ${save.name}!`, 'gold'); }
});
$('bFriends').addEventListener('click', () => { $('lobbyBox').hidden = !$('lobbyBox').hidden; });
$('bHost').addEventListener('click', () => { audioInit(); netHost(); });
$('bJoin').addEventListener('click', () => { audioInit(); netJoin(); });
let resetArm = 0;
$('bReset').addEventListener('click', () => {
  const b = $('bReset');
  if (Date.now() - resetArm > 4000) { resetArm = Date.now(); b.textContent = 'Click again to erase everything'; setTimeout(() => b.textContent = 'New game (erase save)', 4000); return; }
  save = defaultSave(); writeSave(); b.textContent = 'Save erased!'; resetArm = 0; showTitle();
});
$('cineSkip').addEventListener('click', () => { if (mode === 'cutscene') endCutscene(); });
$('craftClose').addEventListener('click', () => { hideSheet('craft'); requestLock(); });
document.querySelectorAll('#craft .tab').forEach(t => t.addEventListener('click', () => { craftTab = t.dataset.tab; renderCraft(); }));
$('craftRight').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) craftAction(b.dataset.act); });
$('mapClose').addEventListener('click', () => { hideSheet('mapBox'); requestLock(); });
$('landGo').addEventListener('click', () => { if (landTarget) landOn(landTarget); });
$('bResume').addEventListener('click', () => { hideSheet('pauseBox'); requestLock(); });
$('bTitle').addEventListener('click', () => { if (P) { disposePlanet(); } resetShipAtStart(); showTitle(); });
$('bReturn').addEventListener('click', () => returnFromEnding());
$('bMenu').addEventListener('click', () => { if (mode === 'space' || mode === 'planet') showSheet('pauseBox'); });
$('bMusic').addEventListener('click', e => { audioInit(); AU.musicOn = !AU.musicOn; e.target.textContent = `Music: ${AU.musicOn ? 'on' : 'off'}`; e.target.blur(); });
$('pauseKeys').innerHTML = `${HELP_SPACE}<br><br>${HELP_PLANET}<br><br>Your game saves by itself in this browser.`;

/* ---------- loop ---------- */
let lastT = performance.now(), statT = 0;
function main(now) {
  requestAnimationFrame(main);
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now; nowT += dt; FLAME_T.value = nowT;
  try {
    if (mode === 'planet' && P) { updatePlanet(dt, nowT); renderer.render(P.scene, fpsCam); }
    else { updateSpace(dt, nowT); renderer.render(space, spaceCam); }
    if (AU.eng) { const on = mode === 'space' && AU.sfxOn; AU.eng.g.gain.value = on ? 0.03 + Math.min(1, Math.abs(ship.vel) / 600) * 0.06 : 0; AU.eng.o.frequency.value = 40 + Math.abs(ship.vel) * 0.06; }
    netTick(dt); chatTick();
    statT -= dt; if (statT <= 0 && mode !== 'title') { statT = 0.5; updateStats(); }
  } catch (err) { console.error(err); }
}
function boot() {
  const s = loadSave(); if (s) save = s;
  $('loading').hidden = true; showTitle(); requestAnimationFrame(main);
}
boot();
