/* ================= 1.7: MOBILE / TOUCH CONTROLS =================
   On phones and tablets: a joystick on the left, drag anywhere on the right to look around, and big buttons
   for jump, mine/attack, laser, build and the other keys. The buttons just press the same keys the keyboard does. */
const TOUCH = /(^|#|&)touch\b/.test(location.hash) || (matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window);
const TC = { stick: null, look: null, held: new Set() };
function fakeKey(code, down) {
  if (down) { if (keys[code]) return; dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); keys[code] = true; }
  else { keys[code] = false; dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); }
}
function tapKey(code) { fakeKey(code, true); setTimeout(() => fakeKey(code, false), 80); }
function initTouch() {
  if (!TOUCH) return;
  document.body.classList.add('touch');
  lockFailed = true; // no mouse lock on touch screens: drag to look instead
  const ui = document.createElement('div'); ui.id = 'touchUI';
  ui.innerHTML = `
    <div id="tStick"><div id="tKnob"></div></div>
    <div id="tPlanet" class="tgrid">
      <button data-hold="mouseL" class="big fire">⛏️<small>Use</small></button>
      <button data-hold="Space" class="big jump">⤒<small>Jump</small></button>
      <button data-hold="KeyF" class="mid">🔫<small>Laser</small></button>
      <button data-tap="mouseR" class="mid">🧱<small>Build</small></button>
      <button data-act="tool" class="mid">🔁<small>Tool</small></button>
      <button data-hold="KeyQ" class="mid" id="tDown" hidden>⤓<small>Dive</small></button>
    </div>
    <div id="tSpace" class="tgrid">
      <button data-hold="KeyW" class="big fire">🚀<small>Go</small></button>
      <button data-hold="KeyN" class="big jump">⚡<small>Nitro</small></button>
      <button data-hold="KeyS" class="mid">🛑<small>Brake</small></button>
      <button data-tap="KeyL" class="mid">🛬<small>Land</small></button>
    </div>
    <div id="tTop">
      <button data-tap="KeyE" data-p="1">E<small>Talk / Feed</small></button>
      <button data-tap="KeyL" data-p="1">L<small>Launch</small></button>
      <button data-tap="KeyR" data-p="1">R<small>Radio</small></button>
      <button data-tap="KeyC">C<small>Workshop</small></button>
      <button data-tap="KeyH" data-p="1">H<small>Builders</small></button>
      <button data-tap="KeyB" data-p="1">B<small>Build</small></button>
      <button data-tap="KeyM">M<small>Map</small></button>
      <button data-tap="KeyV">V<small>View</small></button>
      <button data-tap="KeyU" data-p="1">U<small>Climb</small></button>
      <button data-tap="KeyT" id="tChat" hidden>💬<small>Chat</small></button>
    </div>
    <div id="tRotate" hidden>📱↻ Turn your device sideways to play</div>`;
  document.body.appendChild(ui);
  const press = (b, down) => {
    const h = b.dataset.hold, t = b.dataset.tap, a = b.dataset.act;
    b.classList.toggle('on', down);
    if (h === 'mouseL') { mouse.L = down; return; }
    if (h) { fakeKey(h, down); return; }
    if (!down) return;
    if (t === 'mouseR') { mouse.R = true; return; }
    if (t) { tapKey(t); return; }
    if (a === 'tool') selectSlot((PL.slot + 1) % 3);
  };
  ui.querySelectorAll('button').forEach(b => {
    b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); press(b, true); }, { passive: false });
    const up = e => { e.preventDefault(); press(b, false); };
    b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    b.addEventListener('click', e => e.preventDefault());
  });
  // joystick
  const stick = $('tStick'), knob = $('tKnob');
  const setStick = (dx, dy) => {
    const R = 52, l = Math.hypot(dx, dy), k = l > R ? R / l : 1; dx *= k; dy *= k; knob.style.transform = `translate(${dx}px,${dy}px)`;
    const x = dx / R, y = dy / R, dead = 0.28;
    if (mode === 'space') { fakeKey('KeyA', x < -dead); fakeKey('KeyD', x > dead); fakeKey('ArrowUp', y < -dead); fakeKey('ArrowDown', y > dead); }
    else { fakeKey('KeyW', y < -dead); fakeKey('KeyS', y > dead); fakeKey('KeyA', x < -dead); fakeKey('KeyD', x > dead); fakeKey('ShiftLeft', Math.hypot(x, y) > 0.95); }
  };
  const stickEnd = () => { TC.stick = null; knob.style.transform = ''; for (const c of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ShiftLeft']) if (keys[c]) fakeKey(c, false); };
  stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0], r = stick.getBoundingClientRect(); TC.stick = { id: t.identifier, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; setStick(t.clientX - TC.stick.cx, t.clientY - TC.stick.cy); }, { passive: false });
  // drag anywhere else on the game to look around (tap the canvas to skip the cutscene)
  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    if (mode === 'cutscene') { tapKey('Enter'); return; }
    const t = e.changedTouches[0]; if (!TC.look) TC.look = { id: t.identifier, x: t.clientX, y: t.clientY };
  }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (TC.stick && t.identifier === TC.stick.id) setStick(t.clientX - TC.stick.cx, t.clientY - TC.stick.cy);
      else if (TC.look && t.identifier === TC.look.id) {
        const dx = t.clientX - TC.look.x, dy = t.clientY - TC.look.y; TC.look.x = t.clientX; TC.look.y = t.clientY;
        if (mode === 'planet' && !uiOpen()) { PL.yaw -= dx * 0.0062; PL.pitch = clamp(PL.pitch - dy * 0.0062, -1.5, 1.5); }
      }
    }
    if (TC.stick || TC.look) e.preventDefault();
  }, { passive: false });
  const tEnd = e => { for (const t of e.changedTouches) { if (TC.stick && t.identifier === TC.stick.id) stickEnd(); if (TC.look && t.identifier === TC.look.id) TC.look = null; } };
  addEventListener('touchend', tEnd); addEventListener('touchcancel', tEnd);
  // tap a hotbar slot to pick it
  $('hotbar').addEventListener('touchstart', e => { const s = e.target.closest('.slot'); if (!s) return; e.preventDefault(); selectSlot([...$('hotbar').querySelectorAll('.slot')].indexOf(s)); }, { passive: false });
  setInterval(touchTick, 150);
}
function touchTick() {
  const ui = $('touchUI'); if (!ui) return;
  const playing = (mode === 'planet' || mode === 'space') && !uiOpen() && !CHAT.open;
  ui.hidden = !playing;
  $('tPlanet').hidden = mode !== 'planet'; $('tSpace').hidden = mode !== 'space';
  ui.querySelectorAll('#tTop [data-p]').forEach(b => b.hidden = mode !== 'planet');
  $('tChat').hidden = !NET.mode;
  $('tDown').hidden = !(mode === 'planet' && PL.swimming);
  $('tRotate').hidden = !(playing && innerHeight > innerWidth * 1.1);
  if (!playing) { if (TC.stick) { TC.stick = null; $('tKnob').style.transform = ''; } mouse.L = false; }
}
