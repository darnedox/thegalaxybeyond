'use strict';
/* ================= UTILITIES ================= */
const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, -1640531535);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = hash3(xi, yi, zi, s), c100 = hash3(xi + 1, yi, zi, s), c010 = hash3(xi, yi + 1, zi, s), c110 = hash3(xi + 1, yi + 1, zi, s);
  const c001 = hash3(xi, yi, zi + 1, s), c101 = hash3(xi + 1, yi, zi + 1, s), c011 = hash3(xi, yi + 1, zi + 1, s), c111 = hash3(xi + 1, yi + 1, zi + 1, s);
  return lerp(lerp(lerp(c000, c100, u), lerp(c010, c110, u), v), lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
}
function fbm3(x, y, z, s, oct = 4) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { sum += a * vnoise3(x * f, y * f, z * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; } return sum / n; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = n => Math.round(n).toLocaleString('en-US');
function shade(hex, k) { const c = new THREE.Color(hex); c.r = clamp(c.r * k, 0, 1); c.g = clamp(c.g * k, 0, 1); c.b = clamp(c.b * k, 0, 1); return '#' + c.getHexString(); }
function linCol(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= THEMES ================= */
const THEMES = [
  { key: 'jungle', label: 'Jungle', names: ['Verdania', 'Mossara', 'Fernwick', 'Jungalor', 'Leafhaven'], ramp: ['#1b3d8f', '#2e7d32', '#4caf50', '#9ccc65', '#e8ffd0'],
    top: '#4fbf5a', soil: '#6b4a2b', rock: '#6f7480', wood: '#7a4e2d', cap: '#ff6fb5', skyTop: '#2f74e0', skyBot: '#c4ecff', atmo: '#6fc3ff', grav: 22,
    mob: { name: 'Vine Crawler', color: '#3fae4a', eye: '#ffe14d', fly: false, spikes: true },
    boss: { name: 'Thornmaw the Overgrown', color: '#2f8a3a', accent: '#ff6fb5' } },
  { key: 'desert', label: 'Desert', names: ['Dustara', 'Sandrix', 'Duneholm', 'Scorchia', 'Mirago'], ramp: ['#6b3d1a', '#b5793a', '#e0b062', '#f3d79a', '#fff1c9'],
    top: '#e8c27a', soil: '#c08a4a', rock: '#8a6a4f', wood: '#6a4a2a', cap: '#7fd36b', skyTop: '#e98a4a', skyBot: '#ffe3b0', atmo: '#ffc27a', grav: 20,
    mob: { name: 'Sand Scuttler', color: '#d9a55a', eye: '#2a1a0a', fly: false, legs: true },
    boss: { name: 'Dunewyrm the Dry', color: '#c98a3a', accent: '#ffe08a' } },
  { key: 'ocean', label: 'Ocean', names: ['Aquos', 'Tidara', 'Coralis', 'Wavehold', 'Marinox'], ramp: ['#06204a', '#0b4f9a', '#1e88e5', '#4fc3f7', '#e0f7ff'],
    top: '#3ad1c0', soil: '#d9c99a', rock: '#4a5f73', wood: '#6a5a3a', cap: '#ffd84a', skyTop: '#1a6fd0', skyBot: '#b0ecff', atmo: '#4fc3ff', grav: 21,
    mob: { name: 'Bubble Crab', color: '#ff8a5a', eye: '#ffffff', fly: false, legs: true },
    boss: { name: 'Krakelord of the Deep', color: '#1b6fb0', accent: '#5affc8' } },
  { key: 'candy', label: 'Candy', names: ['Sugarion', 'Lollipa', 'Gumdrop', 'Frostingdale', 'Toffeeton'], ramp: ['#ff8ac8', '#ffb3e0', '#fff0a8', '#a8e8ff', '#ffffff'],
    top: '#ff9ad5', soil: '#ffd27a', rock: '#c98af0', wood: '#fff4f8', cap: '#7af0c8', skyTop: '#9ad0ff', skyBot: '#ffe0f4', atmo: '#ffb8e8', grav: 15,
    mob: { name: 'Gummy Blob', color: '#ff7ad0', eye: '#ffffff', fly: false, jelly: true },
    boss: { name: 'Sir Sourpuss', color: '#9aff5a', accent: '#ff5ab4' } },
  { key: 'ice', label: 'Ice', names: ['Glacius', 'Frostara', 'Snowmere', 'Chillbourne', 'Iciclea'], ramp: ['#123a6b', '#5aa0d8', '#bfe6ff', '#ffffff', '#e8f6ff'],
    top: '#eef8ff', soil: '#a8cfe8', rock: '#6f8aa6', wood: '#4b6a8a', cap: '#7ff3ff', skyTop: '#4a80d0', skyBot: '#e2f5ff', atmo: '#bfe9ff', grav: 18,
    mob: { name: 'Frost Bat', color: '#9fe6ff', eye: '#2a5cff', fly: true, wings: true },
    boss: { name: 'Frostfang the Frozen', color: '#bfeaff', accent: '#2a7cff' } },
  { key: 'toxic', label: 'Toxic', names: ['Toxara', 'Sludgemoor', 'Gloopix', 'Venomire', 'Fumeria'], ramp: ['#0f2a10', '#2f6a1a', '#8fd12a', '#d8ff4a', '#f4ffb0'],
    top: '#9fe03a', soil: '#4a5a1a', rock: '#3a4a3a', wood: '#3a2a4a', cap: '#ff4af0', skyTop: '#3f6a1a', skyBot: '#e2ffa8', atmo: '#b8ff3a', grav: 24,
    mob: { name: 'Gloop', color: '#a8ff3a', eye: '#ff3af0', fly: false, jelly: true },
    boss: { name: 'Sludgelord the Stinky', color: '#7acc1a', accent: '#ff4af0' } },
  { key: 'lava', label: 'Lava', names: ['Infernia', 'Magmora', 'Cinderock', 'Blazeholm', 'Emberos'], ramp: ['#2a0a05', '#5c1a0b', '#a8320f', '#ff7a1a', '#ffd36b'],
    top: '#3a2a2a', soil: '#5a2a1a', rock: '#3b3036', wood: '#2b1b17', cap: '#ff5a1f', skyTop: '#3a0a1a', skyBot: '#ff9a5a', atmo: '#ff6a3a', grav: 26,
    mob: { name: 'Magma Slime', color: '#ff5a1f', eye: '#ffe14d', fly: false, jelly: true, glow: true },
    boss: { name: 'Magmaw the Molten', color: '#ff3a0a', accent: '#ffd34d' } },
  { key: 'crystal', label: 'Crystal', names: ['Prismora', 'Shardia', 'Gemhollow', 'Lumina', 'Facetia'], ramp: ['#1a0b3d', '#4a1f8f', '#8a4fff', '#d08aff', '#ffffff'],
    top: '#a77bff', soil: '#4b2f7a', rock: '#2f2a4a', wood: '#5a3a8a', cap: '#5ff7ff', skyTop: '#2a1a6a', skyBot: '#d9c2ff', atmo: '#b48cff', grav: 16,
    mob: { name: 'Shard Sprite', color: '#b48cff', eye: '#ffffff', fly: true, crystal: true },
    boss: { name: 'Prismax the Shining', color: '#c9a8ff', accent: '#5ff7ff' } },
];

/* ================= HEROES ================= */
const HEROES = [
  { name: 'Nova', suit: '#f4f6fb', accent: '#ff5a7a', visor: '#5affc8', style: 'dome' },
  { name: 'Blaze', suit: '#ff7a2a', accent: '#3a1a0a', visor: '#ffd34d', style: 'horns' },
  { name: 'Frost', suit: '#8fd8ff', accent: '#ffffff', visor: '#2a5cff', style: 'crest' },
  { name: 'Rex-9', suit: '#9aa4b8', accent: '#ffd34d', visor: '#ff3b3b', style: 'robot' },
  { name: 'Pixel', suit: '#a77bff', accent: '#5affc8', visor: '#ffffff', style: 'antenna' },
  { name: 'Luna', suit: '#2c3060', accent: '#c9b8ff', visor: '#ffe7a8', style: 'ears' },
  { name: 'Bolt', suit: '#ffd34d', accent: '#2a2a2a', visor: '#3ad1ff', style: 'mohawk' },
  { name: 'Jet', suit: '#2fbf8a', accent: '#0a3a2a', visor: '#ff9ad5', style: 'jetpack' },
];

/* ================= MINERALS (200, procedural) ================= */
const SYL = ['zor', 'ax', 'qu', 'lin', 'vex', 'tor', 'na', 'ri', 'kel', 'mo', 'dra', 'zy', 'phi', 'lu', 'gor', 'th', 'ul', 'ex', 'bri', 'sol', 'ka', 'ven', 'or', 'ix', 'pra', 'nu', 'tal', 'sy', 'ob', 'ree'];
const SUF = ['ite', 'ium', 'ore', 'on', 'ine', 'ar', 'yx', 'ade', 'ite', 'ium'];
const SPECIAL = { 0: 'Starrite', 1: 'Glowium', 2: 'Zorlite', 3: 'Bubblite', 20: 'Plasmyx', 21: 'Frostine', 40: 'Magmore', 41: 'Sunstone', 60: 'Nebulon', 80: 'Quarkium', 100: 'Cometite', 120: 'Solarium', 140: 'Darkonyx', 160: 'Gravitite', 180: 'Galaxium', 199: 'Beyondium' };
const MINERAL_COUNT = 200;
const MINERALS = (() => {
  const r = mulberry32(29640), used = new Set(), out = [];
  for (let i = 0; i < MINERAL_COUNT; i++) {
    const tier = 1 + Math.floor(i / 20);
    let name = SPECIAL[i];
    if (!name) { do { name = cap(pick(r, SYL) + pick(r, SYL)) + pick(r, SUF); } while (used.has(name)); }
    used.add(name);
    const col = new THREE.Color().setHSL(r(), 0.7 + r() * 0.3, 0.5 + r() * 0.15);
    out.push({ id: i, name, tier, hex: '#' + col.getHexString() });
  }
  return out;
})();
const MAX_TIER = 10;

/* ================= GALAXY: 5 planets per element (40), spiral path out from Earth ================= */
const GALAXY = { perTheme: 5, bossThemesFirst: ['ice', 'lava'], start: new V3(0, 40, 0) };
// every world of an element gets its own boss and its own kind of small enemy
const VARIANTS = {
  jungle: { bosses: ['Thornmaw the Overgrown', 'Queen Vinespine', 'Mossbeard the Ancient', 'Chompflower Rex', 'Canopy King Grrlok'], mobs: ['Vine Crawler', 'Leaf Lurker', 'Moss Muncher', 'Snap Sprout', 'Jungle Jumper'] },
  desert: { bosses: ['Dunewyrm the Dry', 'Scorpex the Stinger', 'Pharaoh Sandfang', 'Cactoid Colossus', 'Mirage Djinn Zahar'], mobs: ['Sand Scuttler', 'Dune Hopper', 'Cactus Critter', 'Dust Devilkin', 'Sun Beetle'] },
  ocean: { bosses: ['Krakelord of the Deep', 'Admiral Clawbeard', 'Tidal Titan Wavor', 'Jellyqueen Shimmer', 'Leviathorn'], mobs: ['Bubble Crab', 'Reef Nipper', 'Puffer Pest', 'Coral Creeper', 'Tide Snapper'] },
  candy: { bosses: ['Sir Sourpuss', 'Gumzilla', 'Baron von Bonbon', 'The Jawbreaker', 'Licorice Lasher'], mobs: ['Gummy Blob', 'Jelly Jiggler', 'Sprinkle Sprite', 'Marshmallow Mite', 'Taffy Twister'] },
  ice: { bosses: ['Frostfang the Frozen', 'Yeti Lord Brrrnard', 'Glacier Golem', 'Snow Queen Crysta', 'Blizzard Beak'], mobs: ['Frost Bat', 'Snow Puff', 'Icicle Imp', 'Chill Flapper', 'Sleet Sprite'] },
  toxic: { bosses: ['Sludgelord the Stinky', 'Mutant Moldmother', 'Barrel Brute Glunk', 'Fume King Foulbreath', 'Ooze Hydra'], mobs: ['Gloop', 'Sludge Slug', 'Spore Puff', 'Goo Grub', 'Toxic Toad'] },
  lava: { bosses: ['Magmaw the Molten', 'Cinder Dragon Pyrex', 'Obsidian Giant', 'Volcanoid Rumbleheart', 'Phoenix Queen Blaze'], mobs: ['Magma Slime', 'Ember Imp', 'Ash Crawler', 'Lava Pup', 'Fire Flick'] },
  crystal: { bosses: ['Prismax the Shining', 'Geode Guardian', 'Shardwing Prime', 'Lady Lumina', 'The Refractor'], mobs: ['Shard Sprite', 'Gem Glimmer', 'Prism Pixie', 'Quartz Quill', 'Facet Fly'] },
};
function hueShift(hex, dh) { const c = new THREE.Color(hex), h = {}; c.getHSL(h); c.setHSL((h.h + dh + 1) % 1, h.s, h.l); return '#' + c.getHexString(); }
function themeVariant(th, k) {
  if (k === 0) return th;
  const v = VARIANTS[th.key], dh = [0, 0.06, -0.06, 0.12, -0.1][k];
  return Object.assign({}, th, {
    top: hueShift(th.top, dh * 0.5), cap: hueShift(th.cap, dh * 2),
    mob: Object.assign({}, th.mob, { name: v.mobs[k], color: hueShift(th.mob.color, dh * 3), eye: hueShift(th.mob.eye, dh * 4) }),
    boss: { name: v.bosses[k], color: hueShift(th.boss.color, dh * 3), accent: hueShift(th.boss.accent, -dh * 3) },
  });
}
const PLANETS = (() => {
  const r = mulberry32(2964);
  // v1 order of difficulty; planets 0-7 keep their ids so old saves still match
  const order = ['jungle', 'desert', 'ocean', 'candy', 'ice', 'toxic', 'lava', 'crystal'];
  const list = [];
  let i = 0, ang = 0.6, rad = 1500;
  for (let k = 0; k < GALAXY.perTheme; k++) {
    for (let oi = 0; oi < order.length; oi++) {
      const key = order[oi], ti = THEMES.findIndex(t => t.key === key), th = THEMES[ti];
      const tier = clamp(1 + Math.floor(oi * 5 / order.length) + k, 1, MAX_TIER);
      const pos = new V3(Math.cos(ang) * rad, (r() - 0.5) * 500, -Math.sin(ang) * rad);
      rad += 190; ang += 900 / rad;
      const name = th.names[k % th.names.length] + (k >= th.names.length ? ' ' + (k + 1) : '');
      const minerals = [];
      const base = (tier - 1) * 20, rr = mulberry32(9000 + i * 31);
      while (minerals.length < 3) { const m = base + Math.floor(rr() * 20); if (!minerals.includes(m)) minerals.push(m); }
      minerals.push(Math.min(MINERAL_COUNT - 1, tier * 20 + Math.floor(rr() * 20)));
      if (i === 0) { minerals[0] = 0; minerals[1] = 1; minerals[2] = 2; minerals[3] = 20; }
      const boss = (k === 0 && GALAXY.bossThemesFirst.includes(key)) || (k >= 1 && (oi + k) % 4 === 0);
      list.push({ id: i, name, ti, theme: themeVariant(th, k), tier, pos, radius: 120 + r() * 90, seed: 1000 + i * 7919, boss, minerals, ring: r() < 0.45 });
      i++;
    }
  }
  GALAXY.endAng = ang; GALAXY.endRad = rad;
  return list;
})();
const EDGE_GATE = new V3(Math.cos(GALAXY.endAng) * (GALAXY.endRad + 2200), 300, -Math.sin(GALAXY.endAng) * (GALAXY.endRad + 2200));

/* ================= SAVE ================= */
const SAVE_KEY = 'galaxy-beyond-save-v1';
function defaultSave() {
  return { hero: 0, name: '', introDone: false, minerals: {}, blocks: {}, orbs: 0,
    gear: { tool: null, weapon: null, armor: null }, ship: { engine: 0, nitro: 0, hull: 0 },
    saved: [], helpers: [], visited: [], leftGalaxy: false };
}
let save = defaultSave();
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.minerals) return Object.assign(defaultSave(), s); } catch (e) { } return null; }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
function addMineral(id, n = 1) { const first = !(id in save.minerals); save.minerals[id] = (save.minerals[id] || 0) + n; return first; }
function addBlock(t, n = 1) { save.blocks[t] = (save.blocks[t] || 0) + n; }
function mineralsFound() { return Object.keys(save.minerals).length; }
