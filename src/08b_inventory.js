/* ================= INVENTORY (I) =================
   Every laser, sword and armor you craft is kept in a 24-slot gear bag.
   Drag gear onto an equip slot (or click it) to use it; drag between bag slots
   to organize; Sort tidies everything. Blocks and minerals show as stacks. */
const BAG_SIZE = 24, KIND_ORDER = ['tool', 'weapon', 'armor'];
const KIND_ICON = { tool: '⚡', weapon: '⚔', armor: '🛡' };
const KIND_SLOT = { tool: 'Mining laser', weapon: 'Sword', armor: 'Armor' };
function bag() {
  if (!Array.isArray(save.bag)) save.bag = [];
  while (save.bag.length < BAG_SIZE) save.bag.push(null);
  return save.bag;
}
function bagPut(it) { const b = bag(), i = b.indexOf(null); if (i < 0) return false; b[i] = it; return true; }
function gearName(it) { return `${MINERALS[it.mineral].name} ${GEAR_NAMES[it.k]}${it.ench ? ' +' + it.ench : ''}`; }
function gearChanged() { updateGearLine(); writeSave(); if (!$('invBox').hidden) renderInv(); }
function equipFromBag(i) {
  const b = bag(), it = b[i]; if (!it) return;
  const old = save.gear[it.k]; save.gear[it.k] = it; b[i] = old ? Object.assign(old, { k: it.k }) : null;
  SFX.place(); toast(`Equipped ${gearName(it)}`, 'good'); gearChanged();
}
function unequip(k, toSlot) {
  const it = save.gear[k]; if (!it) return;
  const b = bag(); let i = toSlot != null && !b[toSlot] ? toSlot : b.indexOf(null);
  if (i < 0) { toast('Your gear bag is full!', 'bad'); return; }
  it.k = k; b[i] = it; save.gear[k] = null; SFX.place(); gearChanged();
}
function sortBag() {
  const b = bag(), items = b.filter(Boolean);
  items.sort((x, y) => KIND_ORDER.indexOf(x.k) - KIND_ORDER.indexOf(y.k) || y.tier - x.tier || y.ench - x.ench || y.dur - x.dur);
  for (let i = 0; i < BAG_SIZE; i++) b[i] = items[i] || null;
  SFX.place(); gearChanged();
}
function gearTile(it, k, src) {
  if (!it) return `<div class="islot empty" data-src="${src}" data-k="${k || ''}">${k ? `<span class="ik">${KIND_ICON[k]}</span><small>${KIND_SLOT[k]}</small>` : ''}</div>`;
  const kind = it.k || k, hex = MINERALS[it.mineral].hex;
  return `<div class="islot item" draggable="true" data-src="${src}" data-k="${k || ''}" title="${escapeHtml(gearName(Object.assign({ k: kind }, it)))} · durability ${Math.round(it.dur)}%">
    <div class="ig" style="background:${drawIcon('gem', hex)}"><span>${KIND_ICON[kind]}</span></div>
    <small>${escapeHtml(MINERALS[it.mineral].name)}</small><b class="it">T${it.tier}${it.ench ? ' +' + it.ench : ''}</b>
    <i class="dur" style="width:${Math.max(4, it.dur)}%"></i></div>`;
}
function renderInv() {
  const b = bag();
  $('invEquip').innerHTML = KIND_ORDER.map(k => `<div class="eqrow"><div class="eqlbl">${KIND_SLOT[k]}</div>${gearTile(save.gear[k] && Object.assign(save.gear[k], { k }), k, 'eq:' + k)}</div>`).join('');
  $('invBag').innerHTML = b.map((it, i) => gearTile(it, null, 'bag:' + i)).join('');
  const mats = [];
  for (const t of HOTBAR) if (save.blocks[t]) mats.push(`<div class="islot stack" title="${escapeHtml(BLOCK_INFO[t].name)}"><div class="ig" style="background:${blockIcon(t)}"></div><small>${escapeHtml(BLOCK_INFO[t].name)}</small><b class="n">${save.blocks[t]}</b></div>`);
  ownedMinerals().forEach(id => mats.push(`<div class="islot stack" title="${escapeHtml(MINERALS[id].name)} (tier ${MINERALS[id].tier})"><div class="ig" style="background:${drawIcon('gem', MINERALS[id].hex)}"></div><small>${escapeHtml(MINERALS[id].name)}</small><b class="n">${save.minerals[id]}</b></div>`));
  if (save.orbs) mats.push(`<div class="islot stack" title="Enchantment orbs"><div class="ig" style="background:${drawIcon('orb', '#c08aff')}"></div><small>Enchant orbs</small><b class="n">${save.orbs}</b></div>`);
  $('invMats').innerHTML = mats.join('') || '<div class="sub">Nothing yet. Mine blocks and minerals with your laser!</div>';
  $('invCount').textContent = `${b.filter(Boolean).length}/${BAG_SIZE}`;
}
function openInv() { renderInv(); showSheet('invBox'); }
function invDrop(src, dst) {
  if (!src || !dst || src === dst) return;
  const b = bag(), [st, sv] = src.split(':'), [dt, dv] = dst.split(':');
  if (st === 'bag' && dt === 'bag') { const i = +sv, j = +dv; [b[i], b[j]] = [b[j], b[i]]; SFX.place(); gearChanged(); return; }
  if (st === 'bag' && dt === 'eq') { const it = b[+sv]; if (!it) return; if (it.k !== dv) { toast(`That goes in the ${KIND_SLOT[it.k]} slot.`, 'bad'); return; } equipFromBag(+sv); return; }
  if (st === 'eq' && dt === 'bag') { const j = +dv, there = b[j]; if (there && there.k === sv) equipFromBag(j); else if (!there) unequip(sv, j); else unequip(sv); return; }
}
(function invInit() {
  const box = $('invBox'); let dragSrc = null;
  box.addEventListener('dragstart', e => { const s = e.target.closest('.islot.item'); if (!s) return; dragSrc = s.dataset.src; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragSrc); } catch (er) { } s.classList.add('dragging'); });
  box.addEventListener('dragend', e => { const s = e.target.closest('.islot'); if (s) s.classList.remove('dragging'); box.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
  box.addEventListener('dragover', e => { const s = e.target.closest('.islot[data-src]'); if (!s || !dragSrc) return; e.preventDefault(); box.querySelectorAll('.over').forEach(x => x !== s && x.classList.remove('over')); s.classList.add('over'); });
  box.addEventListener('drop', e => { const s = e.target.closest('.islot[data-src]'); if (!s) return; e.preventDefault(); invDrop(dragSrc, s.dataset.src); dragSrc = null; });
  box.addEventListener('click', e => {
    const s = e.target.closest('.islot.item'); if (!s) return;
    const [t, v] = s.dataset.src.split(':');
    if (t === 'bag') equipFromBag(+v); else unequip(v);
  });
  $('invSort').addEventListener('click', sortBag);
  $('invClose').addEventListener('click', () => { hideSheet('invBox'); if (mode === 'planet') requestLock(); });
})();

/* ---------- see your gear on your character ---------- */
function dressHero(g) {
  if (!g) return;
  const u = g.userData; if (u.gearVis) { u.gearVis.forEach(m => m.parent && m.parent.remove(m)); }
  u.gearVis = [];
  const add = (parent, m) => { parent.add(m); u.gearVis.push(m); m.castShadow = true; };
  const a = save.gear.armor, w = save.gear.weapon, t = save.gear.tool;
  if (a) {
    const mat = itemSurface(stdMat(MINERALS[a.mineral].hex, { metalness: 0.75, roughness: 0.3 }), 'metal');
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), mat); chest.scale.set(0.33, 0.3, 0.25); chest.position.set(0, 1.02, 0.02); chest.rotation.x = -0.15; add(g, chest);
    for (const arm of [u.armL, u.armR]) { const pad = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); pad.position.y = 0.04; add(arm, pad); }
  }
  if (w) { // sword on the back
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.75, 4, 1), itemSurface(stdMat(MINERALS[w.mineral].hex, { metalness: 0.9, roughness: 0.15 }), 'metal'));
    blade.scale.set(1, 1, 0.35); blade.position.set(0.12, 1.2, -0.3); blade.rotation.set(0, 0, -0.5 + Math.PI); add(g, blade);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 10), itemSurface(stdMat('#7a4e2d'), 'leather')); hilt.position.set(-0.07, 1.55, -0.3); hilt.rotation.z = -0.5; add(g, hilt);
  }
  { // mining laser in the right hand
    const lc = t ? MINERALS[t.mineral].hex : '#5affc8';
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 14), itemSurface(stdMat('#f2f5fa', { metalness: 0.55, roughness: 0.25 }), 'metal'));
    gun.rotation.x = Math.PI / 2; gun.position.set(0, -0.56, 0.12); add(u.armR, gun);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), stdMat(lc, { emissive: lc, emissiveIntensity: 1.4 })); glow.position.set(0, -0.56, 0.28); add(u.armR, glow);
  }
}
