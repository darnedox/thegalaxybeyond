/* ================= AUDIO: sound effects + procedural action music ================= */
const AU = { ctx: null, sfxOn: true, musicOn: true, intensity: 0, targetIntensity: 0 };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; AU.ctx = new C();
    AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(AU.ctx.destination);
    AU.music = AU.ctx.createGain(); AU.music.gain.value = 0.32; AU.music.connect(AU.master);
    const len = AU.ctx.sampleRate; const buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = buf;
    const o = AU.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 45; const f = AU.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; const g = AU.ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(AU.master); o.start(); AU.eng = { o, f, g };
    musicStart();
  } catch (e) { AU.ctx = null; }
}
function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, dest, when) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime;
  const o = AU.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(dest || AU.master); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, vol = 0.2, freq = 1200, dest, when, q = 1) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime;
  const s = AU.ctx.createBufferSource(); s.buffer = AU.noise; const f = AU.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}
const SFX = {
  mine: () => { if (!AU.sfxOn) return; tone(1500 + Math.random() * 300, 0.11, 'sawtooth', 0.025, 0.7); noise(0.08, 0.06, 4200, null, null, 4); },
  brk: () => { if (!AU.sfxOn) return; noise(0.14, 0.25, 900); tone(220, 0.1, 'triangle', 0.08, 0.5); },
  place: () => AU.sfxOn && tone(330, 0.06, 'triangle', 0.14),
  zap: () => AU.sfxOn && tone(900, 0.14, 'square', 0.06, 0.3),
  swing: () => AU.sfxOn && noise(0.08, 0.12, 3000, null, null, 3),
  hit: () => { if (!AU.sfxOn) return; noise(0.1, 0.3, 500); tone(150, 0.14, 'sawtooth', 0.12, 0.5); },
  hurt: () => AU.sfxOn && tone(210, 0.25, 'sawtooth', 0.14, 0.4),
  nitro: () => AU.sfxOn && noise(0.7, 0.28, 500),
  crash: () => { if (!AU.sfxOn) return; noise(0.4, 0.4, 200); tone(80, 0.3, 'sawtooth', 0.2, 0.5); },
  pickup: () => { if (!AU.sfxOn) return; tone(880, 0.07, 'triangle', 0.12); setTimeout(() => tone(1320, 0.1, 'triangle', 0.12), 60); },
  craft: () => { if (!AU.sfxOn) return; tone(660, 0.08, 'triangle', 0.15); setTimeout(() => tone(990, 0.12, 'triangle', 0.15), 80); },
  rune: () => { if (!AU.sfxOn) return; [523, 784, 1047, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.1), i * 70)); },
  win: () => { if (!AU.sfxOn) return; [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 120)); },
  land: () => AU.sfxOn && noise(0.9, 0.2, 260),
  boss: () => { if (!AU.sfxOn) return; tone(70, 1.0, 'sawtooth', 0.22, 0.6); noise(0.8, 0.2, 150); },
  orb: () => AU.sfxOn && tone(320, 0.22, 'sine', 0.08, 2),
  die: () => { if (!AU.sfxOn) return; tone(400, 0.6, 'sawtooth', 0.15, 0.2); },
};

/* Music: a looping A-minor action theme. Intensity 0 = space cruise, 1 = planet action, 2 = boss, 3 = boss angry. */
const MUS = { step: 0, next: 0, timer: null };
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const BASS = [45, 45, 57, 45, 43, 43, 55, 43];
const LEAD = [69, 72, 76, 72, 74, 72, 69, 67, 69, 72, 76, 79, 77, 76, 74, 72];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function musicStart() {
  if (MUS.timer) return; MUS.next = AU.ctx.currentTime + 0.1;
  MUS.timer = setInterval(musicTick, 25);
}
/* "Shine" by Creo is the soundtrack. Outside boss fights only the calm parts play (they loop, so no drop ever hits).
   When a boss wakes up, it jumps straight to the big beat drop and loops the drop until the fight ends. */
const TRACK = { el: null, ok: true, vol: 0, boss: false, DROP: 145.07, DROP_END: 177.07, CALM: [[43.07, 59.07], [113.07, 145.07]], seg: 0 };
/* "Sphere" by Creo plays only while flying the spaceship; it crossfades with Shine on landing and takeoff. */
const SPACE_TRACK = { el: null, ok: true, vol: 0 };
function spaceTrackTick(on) {
  if (!SPACE_TRACK.el && SPACE_TRACK.ok) {
    try { const e = SPACE_TRACK.el = new Audio('music/sphere.mp3'); e.loop = true; e.volume = 0; e.preload = 'auto'; e.addEventListener('error', () => { SPACE_TRACK.ok = false; }); } catch (e) { SPACE_TRACK.ok = false; }
  }
  const e = SPACE_TRACK.el; if (!SPACE_TRACK.ok || !e) return;
  const target = AU.musicOn && on ? 0.5 : 0;
  SPACE_TRACK.vol += (target - SPACE_TRACK.vol) * 0.06; if (Math.abs(target - SPACE_TRACK.vol) < 0.003) SPACE_TRACK.vol = target;
  e.volume = Math.max(0, Math.min(1, SPACE_TRACK.vol));
  if (target > 0 && e.paused) e.play().catch(() => {});
  if (SPACE_TRACK.vol === 0 && !e.paused) e.pause();
}
/* Planet theme songs (all from artists who allow game use), except during boss fights:
   "High Tide" by Creo on Ocean and Tropical planets, "Malediction" by Creo on Toxic planets,
   "Epilogue" by Creo on Candy planets, "No Way Back" by Exyl on Lava planets. */
const THEME_TRACKS = [
  { file: 'music/high_tide.mp3', themes: ['ocean', 'tropic'] },
  { file: 'music/malediction.mp3', themes: ['toxic'] },
  { file: 'music/epilogue.mp3', themes: ['candy'] },
  { file: 'music/no_way_back.mp3', themes: ['lava'] },
].map(t => Object.assign(t, { el: null, ok: true, vol: 0 }));
const TIDE_TRACK = THEME_TRACKS[0], WATER_THEMES = TIDE_TRACK.themes;
function planetThemeKey() { return typeof mode !== 'undefined' && mode === 'planet' && P && P.p && P.p.theme ? P.p.theme.key : null; }
function onWaterPlanet() { return WATER_THEMES.includes(planetThemeKey()); }
function themeTrackTick(T, on) {
  if (!T.el && T.ok && on) {
    try { const e = T.el = new Audio(T.file); e.loop = true; e.volume = 0; e.preload = 'auto'; e.addEventListener('error', () => { T.ok = false; }); } catch (e) { T.ok = false; }
  }
  const e = T.el; if (!T.ok || !e) return;
  const target = AU.musicOn && on ? 0.5 : 0;
  T.vol += (target - T.vol) * 0.06; if (Math.abs(target - T.vol) < 0.003) T.vol = target;
  e.volume = Math.max(0, Math.min(1, T.vol));
  if (target > 0 && e.paused) e.play().catch(() => {});
  if (T.vol === 0 && !e.paused) e.pause();
}
// returns true when a theme song is playing for this planet
function themeTracksTick(fight) {
  const key = fight ? null : planetThemeKey(); let any = false;
  for (const T of THEME_TRACKS) { const on = !!key && T.themes.includes(key) && T.ok; themeTrackTick(T, on); any = any || on; }
  return any;
}
/* "Cosmic War" by Exyl & Creo (120 BPM). Its calm parts play on Aurora planets; its second beat drop
   is saved for boss fights once the boss reaches phase 2 (music level 3). */
const WAR_TRACK = { el: null, ok: true, vol: 0, drop: false, seg: 0, DROP: 101.6, DROP_END: 133.6, CALM: [[1.6, 17.6], [49.6, 101.6]] };
function warTrackTick(calm, drop) {
  const on = calm || drop;
  if (!WAR_TRACK.el && WAR_TRACK.ok && on) {
    try { const e = WAR_TRACK.el = new Audio('music/cosmic_war.mp3'); e.loop = true; e.volume = 0; e.preload = 'auto'; e.addEventListener('error', () => { WAR_TRACK.ok = false; }); } catch (e) { WAR_TRACK.ok = false; }
  }
  const e = WAR_TRACK.el; if (!WAR_TRACK.ok || !e) return;
  if (drop && !WAR_TRACK.drop) { WAR_TRACK.drop = true; try { e.currentTime = WAR_TRACK.DROP; } catch (x) {} WAR_TRACK.vol = 0.62; }
  if (!drop && WAR_TRACK.drop) { WAR_TRACK.drop = false; WAR_TRACK.seg = 0; try { e.currentTime = WAR_TRACK.CALM[0][0]; } catch (x) {} if (!calm) WAR_TRACK.vol = 0; }
  if (on) {
    if (WAR_TRACK.drop) { if (e.currentTime >= WAR_TRACK.DROP_END || e.currentTime < WAR_TRACK.DROP - 1) e.currentTime = WAR_TRACK.DROP + Math.max(0, Math.min(0.1, e.currentTime - WAR_TRACK.DROP_END)); }
    else {
      const [a, b] = WAR_TRACK.CALM[WAR_TRACK.seg], t = e.currentTime;
      if (t >= b) { WAR_TRACK.seg = (WAR_TRACK.seg + 1) % WAR_TRACK.CALM.length; e.currentTime = WAR_TRACK.CALM[WAR_TRACK.seg][0] + Math.min(t - b, 0.1); }
      else if (t < a - 0.5) { try { e.currentTime = a; } catch (x) {} }
    }
  }
  const target = AU.musicOn && on ? (drop ? 0.62 : 0.5) : 0;
  WAR_TRACK.vol += (target - WAR_TRACK.vol) * 0.06; if (Math.abs(target - WAR_TRACK.vol) < 0.003) WAR_TRACK.vol = target;
  e.volume = Math.max(0, Math.min(1, WAR_TRACK.vol));
  if (target > 0 && e.paused) e.play().catch(() => {});
  if (WAR_TRACK.vol === 0 && !e.paused) e.pause();
}
function onAuroraPlanet() { return typeof mode !== 'undefined' && mode === 'planet' && P && P.p && P.p.theme && P.p.theme.key === 'aurora'; }
function trackTick(lvl) {
  if (!TRACK.el && TRACK.ok) {
    try { TRACK.el = new Audio('music/shine.mp3'); TRACK.el.loop = true; TRACK.el.volume = 0; TRACK.el.preload = 'auto'; TRACK.el.addEventListener('error', () => { TRACK.ok = false; }); } catch (e) { TRACK.ok = false; }
  }
  if (!TRACK.ok || !TRACK.el) return false;
  const el = TRACK.el, fight = lvl >= 2;
  if (fight && !TRACK.boss) { TRACK.boss = true; try { el.currentTime = TRACK.DROP; } catch (e) {} TRACK.vol = 0.62; }
  if (!fight && TRACK.boss) { TRACK.boss = false; TRACK.seg = 0; try { el.currentTime = TRACK.CALM[0][0]; } catch (e) {} }
  if (TRACK.boss) { if (el.currentTime >= TRACK.DROP_END) el.currentTime = TRACK.DROP + (el.currentTime - TRACK.DROP_END); }
  else {
    const [a, b] = TRACK.CALM[TRACK.seg], t = el.currentTime;
    if (t >= b) { TRACK.seg = (TRACK.seg + 1) % TRACK.CALM.length; el.currentTime = TRACK.CALM[TRACK.seg][0] + Math.min(t - b, 0.1); }
    else if (t < a - 0.5) { try { el.currentTime = a; } catch (e) {} }
  }
  const inShip = typeof mode !== 'undefined' && mode === 'space' && !fight;
  spaceTrackTick(inShip);
  const tide = themeTracksTick(fight);
  const warDrop = lvl >= 3 && WAR_TRACK.ok, warCalm = !fight && onAuroraPlanet() && WAR_TRACK.ok;
  warTrackTick(warCalm, warDrop);
  const target = AU.musicOn && !inShip && !tide && !warDrop && !warCalm ? (fight ? 0.62 : 0.5) : 0;
  TRACK.vol += (target - TRACK.vol) * 0.06; if (Math.abs(target - TRACK.vol) < 0.003) TRACK.vol = target;
  el.volume = Math.max(0, Math.min(1, TRACK.vol));
  if (target > 0 && el.paused) el.play().catch(() => {});
  if (TRACK.vol === 0 && !el.paused) el.pause();
  return true;
}
function musicTick() {
  if (!AU.ctx) return;
  AU.intensity = AU.targetIntensity;
  const useTrack = trackTick(AU.intensity);
  const lvl = AU.intensity, bpm = [96, 118, 136, 152][lvl], sixteenth = 60 / bpm / 4;
  while (MUS.next < AU.ctx.currentTime + 0.12) {
    const t = MUS.next, s = MUS.step, bar = Math.floor(s / 16) % 4, beat = s % 16, ch = CHORDS[bar];
    if (AU.musicOn && !useTrack) {
      const out = AU.music;
      // pad on the downbeat of each bar
      if (beat === 0) ch.forEach(n => tone(mtof(n), sixteenth * 15, 'triangle', lvl === 0 ? 0.06 : 0.035, 0, out, t));
      // arpeggio
      if (lvl === 0 ? beat % 4 === 0 : beat % 2 === 0) tone(mtof(ch[(beat >> 1) % 3] + 12), sixteenth * 1.6, lvl >= 2 ? 'square' : 'triangle', lvl >= 2 ? 0.05 : 0.06, 0, out, t);
      if (lvl >= 1) {
        // bass
        if (beat % 2 === 0) tone(mtof(BASS[(beat >> 1) % 8] - (bar === 1 ? 4 : bar === 2 ? -3 : bar === 3 ? 2 : 0)), sixteenth * 1.8, 'sawtooth', 0.09, 0, out, t);
        // drums
        if (beat % 8 === 0 || (lvl >= 2 && beat % 8 === 6)) { tone(110, 0.18, 'sine', 0.5, 0.35, out, t); }
        if (beat % 8 === 4) noise(0.14, 0.32, 1800, out, t);
        if (beat % 2 === 1 || lvl >= 3) noise(0.03, lvl >= 2 ? 0.1 : 0.07, 8000, out, t, 2);
      }
      if (lvl >= 2) { const n = LEAD[beat] + (lvl >= 3 ? 12 : 0); if (beat % (lvl >= 3 ? 1 : 2) === 0) tone(mtof(n), sixteenth * 0.9, 'sawtooth', 0.04, 0, out, t); }
      if (lvl >= 3 && beat % 4 === 2) tone(mtof(ch[0] - 12), sixteenth * 2, 'square', 0.06, 0.5, out, t);
    }
    MUS.next += sixteenth; MUS.step = (s + 1) % 64;
  }
}
function setMusicIntensity(l) { AU.targetIntensity = l; }
