/* ================= UI: toasts, HUD, crafting, runic table, ship parts, map, title ================= */
const GEAR_NAMES = { tool: 'mining laser', weapon: 'sword', armor: 'armor' };
const GEAR_COST = { tool: 3, weapon: 4, armor: 6 };
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, cls = '') {
  const box = $('toasts'), el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg; box.appendChild(el);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(() => el.remove(), cls === 'gold' ? 4500 : 3200);
}
let lastPick = null;
function pickupToast(msg) {
  if (lastPick && lastPick.msg === msg && lastPick.el.isConnected && nowT - lastPick.t < 2) { lastPick.n++; lastPick.t = nowT; lastPick.el.textContent = msg.replace(/^\+1 /, `+${lastPick.n} `); return; }
  const box = $('toasts'), el = document.createElement('div'); el.className = 'toast'; el.style.fontSize = '13px'; el.textContent = msg; box.appendChild(el);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  lastPick = { msg, el, n: 1, t: nowT }; setTimeout(() => el.remove(), 2200);
}
let promptHtml = null;
function setPrompt(html) { if (html === promptHtml) return; promptHtml = html; $('prompt').innerHTML = html; $('prompt').hidden = !html; }
let bannerT = null;
function banner(h, p, ms = 2500) { $('bannerH').textContent = h; $('bannerP').textContent = p || ''; $('banner').hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => $('banner').hidden = true, ms); }
function fadeTo(fn) { const f = $('fade'); f.classList.add('on'); setTimeout(() => { try { fn(); } finally { setTimeout(() => f.classList.remove('on'), 60); } }, 380); }
const SHEETS = ['craft', 'mapBox', 'landCard', 'pauseBox', 'endBox'];
function showSheet(id) { $(id).hidden = false; if (document.pointerLockElement) document.exitPointerLock(); keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = keys.KeyN = keys.Space = false; mouse.L = mouse.R = false; }
function hideSheet(id) { $(id).hidden = true; }
function uiOpen() { return SHEETS.some(id => !$(id).hidden); }

/* ---------- gear ---------- */
function gearStats() {
  const g = save.gear, t = g.tool, w = g.weapon, a = g.armor;
  return {
    toolTier: t ? t.tier : 0, weaponTier: w ? w.tier : 0, armorTier: a ? a.tier : 0,
    toolPower: t ? 1 + t.tier * (1 + 0.2 * t.ench) : 1,
    weaponDmg: w ? Math.round((8 + 10 * w.tier) * (1 + 0.25 * w.ench)) : 8,
    armorRed: a ? Math.min(0.8, 0.12 * a.tier + 0.04 * a.ench) : 0,
  };
}
function gearLabel(k) { const it = save.gear[k]; return it ? `${MINERALS[it.mineral].name} ${GEAR_NAMES[k]}${it.ench ? ' +' + it.ench : ''}` : (k === 'tool' ? 'Starter laser' : k === 'weapon' ? 'Fists' : 'No armor'); }
function updateGearLine() {
  const g = save.gear, s = gearStats();
  const part = k => { const it = g[k]; return `<span style="color:${it ? MINERALS[it.mineral].hex : 'var(--dim)'}">■</span> ${escapeHtml(gearLabel(k))}${it ? ` <span class="sub">${Math.round(it.dur)}%</span>` : ''}`; };
  $('gearLine').innerHTML = `<div class="sub" style="margin-top:6px;line-height:1.6">${part('tool')}<br>${part('weapon')} · ${s.weaponDmg} dmg<br>${part('armor')}${s.armorRed ? ` · blocks ${Math.round(s.armorRed * 100)}%` : ''}${NET.pvp ? '<br><span class="warn">PvP on (P)</span>' : ''}</div>`;
}
function renderHotbar() { setTimeout(buildHud, 0);
  $('hotbar').innerHTML = HOTBAR.map((t, i) => `<div class="slot${i === PL.sel ? ' sel' : ''}" title="${escapeHtml(BLOCK_INFO[t].name)}"><span class="k">${i + 1}</span><div class="sw" style="border-radius:${BUILT.has(t) ? '7px' : '50%'};background:${blockIcon(t)};opacity:${save.blocks[t] ? 1 : 0.3}"></div><span class="n">${save.blocks[t] || 0}</span></div>`).join('');
}

/* ---------- workshop: crafting / runic / ship ---------- */
let craftTab = 'craft';
function ownedMinerals() { return Object.keys(save.minerals).map(Number).filter(id => save.minerals[id] > 0).sort((a, b) => MINERALS[b].tier - MINERALS[a].tier || a - b); }
function invHtml() {
  const ms = ownedMinerals();
  const blocks = Object.keys(BLOCK_INFO).map(Number).filter(t => save.blocks[t] > 0);
  return `<h4>Your minerals</h4><div class="inv">${ms.length ? ms.map(id => `<span class="pill"><span class="dot" style="background:${drawIcon('gem', MINERALS[id].hex)}"></span>${escapeHtml(MINERALS[id].name)} <span class="sub">T${MINERALS[id].tier}</span> <b>${save.minerals[id]}</b></span>`).join('') : '<span class="empty">None yet. Explore the caves and dig out the glowing ore!</span>'}</div>
    <h4>Your materials</h4><div class="inv">${blocks.length ? blocks.map(t => `<span class="pill"><span class="dot" style="background:${blockIcon(t)}"></span>${BLOCK_INFO[t].name} <b>${save.blocks[t]}</b></span>`).join('') : '<span class="empty">None yet.</span>'}</div>
    <h4>Enchant orbs</h4><div class="inv"><span class="pill"><span class="dot" style="background:${drawIcon('orb', '#b48cff')}"></span>Orbs <b>${save.orbs}</b></span></div>
    <div class="sub" style="margin-top:6px">${mineralsFound()}/200 minerals discovered</div>`;
}
function gearCards(extra) {
  return ['tool', 'weapon', 'armor'].map(k => {
    const it = save.gear[k];
    return `<div class="gearcard"><div class="ic" style="background:${it ? drawIcon('gem', MINERALS[it.mineral].hex) : 'rgba(255,255,255,.08)'}"></div><div style="flex:1;min-width:0"><div class="nm" style="font-weight:700">${escapeHtml(gearLabel(k))}</div>${it ? `<div class="sub">Tier ${it.tier} · Enchant ${it.ench}/5</div><div class="dur"><i style="width:${it.dur}%;background:${it.dur < 30 ? 'var(--coral)' : 'var(--mint)'}"></i></div>` : '<div class="sub">Craft one below</div>'}</div>${extra ? extra(k, it) : ''}</div>`;
  }).join('');
}
const btn = (act, label, ok, extra = '') => `<button class="btn small${ok ? '' : ' ghost'}" data-act="${act}" ${extra} type="button" ${ok ? '' : 'disabled'}>${label}</button>`;
function renderCraft() {
  document.querySelectorAll('#craft .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === craftTab));
  $('craftTitle').textContent = { craft: 'Workshop', runic: 'Runic table', ship: 'Ship parts' }[craftTab];
  $('craftLeft').innerHTML = invHtml();
  const R = $('craftRight'), have = id => save.minerals[id] || 0, hb = t => save.blocks[t] || 0;
  if (craftTab === 'craft') {
    const glassM = ownedMinerals().slice().reverse()[0];
    const recs = [
      { act: 'planks', nm: '4 Wood panels', ds: 'Warm smooth panels for building', cost: '1 Stalk wood', ok: hb(B.WOOD) >= 1 },
      { act: 'bricks', nm: '4 Space panels', ds: 'Shiny metal panels for your dream house', cost: '2 Rock', ok: hb(B.ROCK) >= 2 },
      { act: 'glass', nm: '4 Glass domes', ds: 'See-through windows', cost: `2 Soil + 1 mineral${glassM != null ? ` (${MINERALS[glassM].name})` : ''}`, ok: hb(B.SOIL) >= 2 && glassM != null },
      { act: 'glow', nm: '4 Glow lights', ds: 'Light up the night', cost: '1 Glowcap + 1 Rock', ok: hb(B.CAP) >= 1 && hb(B.ROCK) >= 1 },
    ];
    const gearRows = ownedMinerals().map(id => { const m = MINERALS[id]; return `<div class="rec"><span class="dot" style="width:16px;height:16px;border-radius:4px;background:${drawIcon('gem', m.hex)}"></span><div class="info"><div class="nm">${escapeHtml(m.name)} <span class="sub">tier ${m.tier} · you have ${have(id)}</span></div><div class="ds">Mining laser ${GEAR_COST.tool} · Sword ${GEAR_COST.weapon} · Armor ${GEAR_COST.armor}</div></div>${['tool', 'weapon', 'armor'].map(k => btn(`gear:${k}:${id}`, k === 'tool' ? 'Laser' : cap(GEAR_NAMES[k]), have(id) >= GEAR_COST[k])).join('')}</div>`; }).join('');
    R.innerHTML = `<h4>Your gear</h4>${gearCards((k, it) => it ? btn(`repair:${k}`, `Repair (1 ${escapeHtml(MINERALS[it.mineral].name)})`, it.dur < 100 && have(it.mineral) >= 1) : '')}
      <h4>Craft gear from minerals</h4>${gearRows || '<div class="empty">Mine minerals first. Higher tier minerals make stronger gear.</div>'}
      <h4>Building pieces</h4>${recs.map(r => `<div class="rec${r.ok ? '' : ' cant'}"><div class="info"><div class="nm">${r.nm}</div><div class="ds">${r.ds}</div><div class="cost">${r.cost}</div></div>${btn(r.act, 'Craft', r.ok)}</div>`).join('')}`;
  } else if (craftTab === 'runic') {
    R.innerHTML = `<h4>Enchant your gear</h4><div class="sub">Monsters and bosses drop enchant orbs. Each enchant makes gear stronger (up to +5).</div>
      ${gearCards((k, it) => { if (!it) return ''; const c = (it.ench + 1) * 2; return it.ench >= 5 ? '<span class="good">MAX</span>' : btn(`ench:${k}`, `Enchant (${c} orbs)`, save.orbs >= c); })}
      <h4>Grind minerals into orbs</h4><div class="sub">Rare minerals give more. Higher tiers need fewer per orb.</div>
      ${ownedMinerals().map(id => { const m = MINERALS[id], c = Math.max(1, 6 - m.tier); return `<div class="rec${have(id) >= c ? '' : ' cant'}"><span class="dot" style="width:16px;height:16px;border-radius:4px;background:${drawIcon('gem', m.hex)}"></span><div class="info"><div class="nm">${escapeHtml(m.name)} <span class="sub">tier ${m.tier} · you have ${have(id)}</span></div><div class="cost">${c} → 1 orb</div></div>${btn(`grind:${id}`, 'Grind', have(id) >= c)}</div>`; }).join('') || '<div class="empty">No minerals yet.</div>'}`;
  } else {
    const parts = [{ k: 'engine', nm: 'Engine', ds: lv => `Top speed ${260 + lv * 70}` }, { k: 'nitro', nm: 'Nitro tank', ds: lv => `Nitro ${100 + lv * 50}` }, { k: 'hull', nm: 'Hull plating', ds: lv => `Hull ${100 + lv * 60}` }];
    R.innerHTML = `<h4>Upgrade your rocket</h4><div class="sub">Each level needs minerals of a higher tier, plus 8 Rock.</div>` + parts.map(pt => {
      const lv = save.ship[pt.k], c = shipCost(lv), ok = lv < 5 && c.ok;
      return `<div class="rec${ok ? '' : ' cant'}"><div class="info"><div class="nm">${pt.nm} <span class="sub">level ${lv}/5</span></div><div class="ds">${pt.ds(lv)}${lv < 5 ? ` → ${pt.ds(lv + 1)}` : ''}</div>${lv < 5 ? `<div class="cost">${c.n} minerals of tier ${lv + 1}+ (you have ${c.have}) · 8 Rock (you have ${hb(B.ROCK)})</div>` : ''}</div>${lv >= 5 ? '<span class="good">MAX</span>' : btn(`ship:${pt.k}`, 'Upgrade', ok)}</div>`;
    }).join('');
  }
}
function shipCost(lv) {
  const n = 3 + 2 * lv, ids = ownedMinerals().filter(id => MINERALS[id].tier >= lv + 1).sort((a, b) => MINERALS[a].tier - MINERALS[b].tier);
  const have = ids.reduce((s, id) => s + save.minerals[id], 0);
  return { n, ids, have, ok: have >= n && (save.blocks[B.ROCK] || 0) >= 8 };
}
function spendMineral(id, n) { save.minerals[id] -= n; }
function craftAction(act) {
  const [a, b, c] = act.split(':');
  if (a === 'planks') { save.blocks[B.WOOD]--; addBlock(B.PLANKS, 4); }
  else if (a === 'bricks') { save.blocks[B.ROCK] -= 2; addBlock(B.BRICKS, 4); }
  else if (a === 'glass') { const id = ownedMinerals().slice().reverse()[0]; save.blocks[B.SOIL] -= 2; spendMineral(id, 1); addBlock(B.GLASS, 4); }
  else if (a === 'glow') { save.blocks[B.CAP]--; save.blocks[B.ROCK]--; addBlock(B.GLOW, 4); }
  else if (a === 'gear') {
    const k = b, id = +c, m = MINERALS[id]; spendMineral(id, GEAR_COST[k]);
    const old = save.gear[k]; save.gear[k] = { mineral: id, tier: m.tier, ench: 0, dur: 100 };
    toast(`Crafted a ${m.name} ${GEAR_NAMES[k]}! (tier ${m.tier})${old && old.ench ? ' Your old one was replaced.' : ''}`, 'good');
  } else if (a === 'repair') { const it = save.gear[b]; spendMineral(it.mineral, 1); it.dur = Math.min(100, it.dur + 50); toast('Repaired!', 'good'); }
  else if (a === 'ench') { const it = save.gear[b], cost = (it.ench + 1) * 2; save.orbs -= cost; it.ench++; SFX.rune(); toast(`Enchanted to +${it.ench}!`, 'gold'); renderCraft(); updateGearLine(); writeSave(); return; }
  else if (a === 'grind') { const id = +b, cost = Math.max(1, 6 - MINERALS[id].tier); spendMineral(id, cost); save.orbs++; SFX.orb(); }
  else if (a === 'ship') {
    const lv = save.ship[b], sc = shipCost(lv); let need = sc.n;
    for (const id of sc.ids) { const take = Math.min(need, save.minerals[id]); spendMineral(id, take); need -= take; if (!need) break; }
    save.blocks[B.ROCK] -= 8; save.ship[b]++; const st = shipStats(); ship.hull = st.hullMax; ship.nitro = st.nitroMax;
    SFX.rune(); toast(`Rocket ${b} upgraded to level ${save.ship[b]}!`, 'gold'); renderCraft(); writeSave(); return;
  }
  SFX.craft(); renderCraft(); updateGearLine(); if (P) renderHotbar(); writeSave();
}
function openCraft(tab) { if (tab) craftTab = tab; renderCraft(); showSheet('craft'); }

/* ---------- galaxy map ---------- */
function drawMap() {
  const cv = $('mapCv'), g = cv.getContext('2d'), Wc = cv.width, Hc = cv.height;
  const pts = PLANETS.map(p => p.pos).concat([START, EDGE_GATE]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
  const pad = 90, sc = Math.min((Wc - pad * 2) / (x1 - x0 || 1), (Hc - pad * 2) / (z1 - z0 || 1));
  const X = x => (x - (x0 + x1) / 2) * sc + Wc / 2, Y = z => (z - (z0 + z1) / 2) * sc + Hc / 2;
  g.fillStyle = '#05040f'; g.fillRect(0, 0, Wc, Hc);
  const r = mulberry32(5); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.6})`; g.fillRect(r() * Wc, r() * Hc, 1.5, 1.5); }
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([6, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(X(START.x), Y(START.z)); PLANETS.forEach(p => g.lineTo(X(p.pos.x), Y(p.pos.z))); g.lineTo(X(EDGE_GATE.x), Y(EDGE_GATE.z)); g.stroke(); g.setLineDash([]);
  g.textAlign = 'center'; g.font = '700 20px "Chakra Petch", sans-serif';
  g.fillStyle = '#4fa8ff'; g.beginPath(); g.arc(X(START.x), Y(START.z), 14, 0, 7); g.fill(); g.fillStyle = '#cfe0ff'; g.fillText('Earth · Space Inc.', X(START.x), Y(START.z) + 36);
  for (const p of PLANETS) {
    const x = X(p.pos.x), y = Y(p.pos.z), rad = 12 + p.radius * 0.06;
    const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 2, x, y, rad); gr.addColorStop(0, p.theme.ramp[3]); gr.addColorStop(1, p.theme.ramp[1]);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    if (p.boss) { g.strokeStyle = save.saved.includes(p.id) ? '#5affc8' : '#ff4060'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, rad + 8, 0, 7); g.stroke(); }
    g.fillStyle = save.visited.includes(p.id) ? '#ffffff' : 'rgba(255,255,255,.55)';
    g.fillText(`${p.name}${save.visited.includes(p.id) ? ' ✓' : ''}`, x, y + rad + 28); g.font = '500 15px "Chakra Petch", sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(`${p.theme.label} · Tier ${p.tier}`, x, y + rad + 48); g.font = '700 20px "Chakra Petch", sans-serif';
  }
  const gx = X(EDGE_GATE.x), gy = Y(EDGE_GATE.z); g.fillStyle = allVisited() ? '#ffd34d' : 'rgba(255,211,77,.5)'; g.beginPath(); g.moveTo(gx, gy - 18); g.lineTo(gx + 18, gy); g.lineTo(gx, gy + 18); g.lineTo(gx - 18, gy); g.closePath(); g.fill();
  g.fillText(allVisited() ? 'Edge Gate (OPEN)' : 'Edge Gate (sealed)', gx, gy + 42);
  // you
  const sx = X(ship.g.position.x), sy = Y(ship.g.position.z); fwd.set(0, 0, -1).applyQuaternion(ship.g.quaternion); const a = Math.atan2(fwd.z, fwd.x);
  g.save(); g.translate(sx, sy); g.rotate(a); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -10); g.lineTo(-5, 0); g.lineTo(-10, 10); g.closePath(); g.fill(); g.restore();
  NET.peers.forEach(pe => { const st = pe.st; if (!st || st.m !== 's') return; g.fillStyle = '#5affc8'; g.beginPath(); g.arc(X(st.x), Y(st.z), 7, 0, 7); g.fill(); g.fillText(st.n || 'Pilot', X(st.x), Y(st.z) - 14); });
}

/* ---------- stats + help ---------- */
function updateStats() {
  $('stName').textContent = save.name || 'Pilot'; $('stSaved').textContent = `${save.saved.length}/${PLANETS.filter(p => p.boss).length}`;
  $('stHelpers').textContent = save.helpers.length; $('stOrbs').textContent = save.orbs; $('stMinerals').textContent = `${mineralsFound()}/200`; $('stVisited').textContent = `${save.visited.length}/${PLANETS.length}`;
}
const HELP_SPACE = '<b>Flying</b><br><kbd>W</kbd> thrust · <kbd>S</kbd> brake<br><kbd>A</kbd> <kbd>D</kbd> turn · <kbd>↑</kbd> <kbd>↓</kbd> climb/dive<br><kbd>Q</kbd> <kbd>E</kbd> roll · <kbd>N</kbd> nitro<br><kbd>L</kbd> land · <kbd>V</kbd> cockpit view<br><kbd>M</kbd> map · <kbd>C</kbd> workshop<br><kbd>T</kbd> chat with your lobby';
const HELP_PLANET = '<b>On a planet</b><br><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · <kbd>Space</kbd> jump · <kbd>Shift</kbd> run<br>In water: <kbd>Space</kbd> swim up · <kbd>Q</kbd> swim down<br>Mouse looks (or arrow keys)<br>Hold left click: fire mining laser / swing sword<br>Right click: build · <kbd>1</kbd>-<kbd>9</kbd> pick material<br><kbd>F</kbd> blaster · <kbd>V</kbd> 3rd person<br><kbd>C</kbd> workshop · <kbd>L</kbd> launch (at rocket)<br><kbd>P</kbd> PvP on/off · <kbd>T</kbd> chat<br><kbd>B</kbd> <b>easy build mode</b><br><kbd>U</kbd> climb out of a cave';
function setHelp() { $('help').innerHTML = mode === 'planet' ? HELP_PLANET : HELP_SPACE; }

/* ---------- title screen ---------- */
function heroThumbs() {
  let r; try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return HEROES.map(() => ''); }
  r.setSize(176, 220); r.outputEncoding = THREE.sRGBEncoding;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 176 / 220, 0.1, 50); cam.position.set(1.4, 1.5, 4.6); cam.lookAt(0, 0.95, 0);
  sc.add(new THREE.HemisphereLight('#ffffff', '#443366', 0.9)); const dl = new THREE.DirectionalLight('#ffffff', 0.9); dl.position.set(2, 4, 3); sc.add(dl);
  const out = HEROES.map(h => { const g = buildHero(h); g.rotation.y = 0.35; sc.add(g); r.render(sc, cam); const url = r.domElement.toDataURL(); sc.remove(g); return url; });
  r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); return out;
}
let thumbs = null;
function showTitle() {
  mode = 'title'; $('title').hidden = false; $('hud').hidden = true; $('cine').hidden = true; SHEETS.forEach(hideSheet); setMusicIntensity(0);
  if (!thumbs) thumbs = heroThumbs();
  const grid = $('heroGrid');
  grid.innerHTML = HEROES.map((h, i) => `<button class="hero-card${i === save.hero ? ' sel' : ''}" data-hero="${i}" type="button" aria-pressed="${i === save.hero}">${thumbs[i] ? `<img alt="" src="${thumbs[i]}">` : `<div style="width:80px;height:100px;background:${h.suit};border-radius:8px"></div>`}${h.name}</button>`).join('');
  $('uname').value = save.name || '';
  $('bStart').textContent = save.introDone ? 'Continue mission' : 'Start mission';
}
const cleanName = s => s.replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
