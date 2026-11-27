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
  // ---- 1.5: eight new elements ----
  { key: 'storm', label: 'Storm', names: ['Voltara', 'Thunderhold', 'Zappix', 'Stormwake', 'Galeon'], ramp: ['#1a1a3a', '#3a3a7a', '#6a6ab8', '#a8b8ff', '#fff6a8'],
    top: '#6a7ab0', soil: '#3a3f5a', rock: '#2a2e40', wood: '#4a4a6a', cap: '#fff35a', skyTop: '#1f2350', skyBot: '#8a90c8', atmo: '#a8b8ff', grav: 19,
    mob: { name: 'Spark Wisp', color: '#fff35a', eye: '#2a2aff', fly: true, glow: true },
    boss: { name: 'Thunderclaw the Loud', color: '#5a6aff', accent: '#fff35a' } },
  { key: 'fungus', label: 'Mushroom', names: ['Sporia', 'Shroomholm', 'Mycelos', 'Capwood', 'Puffbloom'], ramp: ['#2a1030', '#6a2a5a', '#c05a8a', '#ffb0c8', '#fff0f4'],
    top: '#c87ab8', soil: '#5a3a3a', rock: '#4a3a4a', wood: '#efe2cf', cap: '#ff4a5a', skyTop: '#6a3a8a', skyBot: '#ffd0e8', atmo: '#ff9ad0', grav: 17,
    mob: { name: 'Sporeling', color: '#ff7a9a', eye: '#ffffff', fly: false, jelly: true },
    boss: { name: 'Mushmaw the Mighty', color: '#ff4a5a', accent: '#ffffff' } },
  { key: 'robot', label: 'Robot', names: ['Gearon', 'Cogworth', 'Mechara', 'Boltburg', 'Circuitia'], ramp: ['#1a2028', '#3a4a5a', '#7a8a9a', '#b8c8d8', '#5affc8'],
    top: '#8a9aaa', soil: '#5a6070', rock: '#3a4048', wood: '#c08a3a', cap: '#5affc8', skyTop: '#2a3a4a', skyBot: '#c8d8e8', atmo: '#8adfff', grav: 23,
    mob: { name: 'Bolt Bot', color: '#9aa8b8', eye: '#ff3b3b', fly: false, legs: true },
    boss: { name: 'Megatron-9000', color: '#7a8a9a', accent: '#ff3b3b' } },
  { key: 'cloud', label: 'Sky', names: ['Nimbara', 'Puffton', 'Skyhaven', 'Cumulos', 'Aerolis'], ramp: ['#5a9ae8', '#8ac0ff', '#c8e4ff', '#ffffff', '#fff6d8'],
    top: '#f4f8ff', soil: '#d8e4f4', rock: '#a8b8d0', wood: '#e8c88a', cap: '#ffd84a', skyTop: '#4a9aff', skyBot: '#e8f4ff', atmo: '#dff0ff', grav: 13,
    mob: { name: 'Puff Flapper', color: '#ffffff', eye: '#4a9aff', fly: true, wings: true },
    boss: { name: 'Cumulord the Fluffy', color: '#e8f0ff', accent: '#4a9aff' } },
  { key: 'shadow', label: 'Shadow', names: ['Umbrax', 'Nightfall', 'Duskara', 'Gloomhold', 'Voidara'], ramp: ['#05040f', '#1a1030', '#3a2a5a', '#6a4a9a', '#c8a8ff'],
    top: '#3a2a5a', soil: '#1f1830', rock: '#141020', wood: '#2a2040', cap: '#a85aff', skyTop: '#0a0618', skyBot: '#3a2a5a', atmo: '#7a4aff', grav: 21,
    mob: { name: 'Shade Bat', color: '#6a3aaa', eye: '#ff5aff', fly: true, wings: true, glow: true },
    boss: { name: 'Gloomreaper', color: '#3a1a6a', accent: '#ff5aff' } },
  { key: 'swamp', label: 'Swamp', names: ['Bogmire', 'Murkwater', 'Fenlow', 'Mudholm', 'Marshara'], ramp: ['#1a2a1a', '#3a4a2a', '#5a6a3a', '#8a9a5a', '#c8d89a'],
    top: '#5a7a3a', soil: '#4a3a2a', rock: '#3a3a30', wood: '#4a3a2a', cap: '#c8ff5a', skyTop: '#4a6a4a', skyBot: '#c8d8b0', atmo: '#9ac87a', grav: 22,
    mob: { name: 'Bog Hopper', color: '#6aa83a', eye: '#ffe14d', fly: false, legs: true },
    boss: { name: 'Croakzilla', color: '#4a8a2a', accent: '#ffe14d' } },
  { key: 'autumn', label: 'Autumn', names: ['Maplewood', 'Harvesta', 'Acornia', 'Rustleaf', 'Emberfall'], ramp: ['#4a1a0a', '#8a3a1a', '#d86a2a', '#ffb04a', '#ffe8b0'],
    top: '#d8742a', soil: '#6a4228', rock: '#6a5a50', wood: '#5a3a22', cap: '#ff4a2a', skyTop: '#e88a4a', skyBot: '#ffe0b0', atmo: '#ffa85a', grav: 20,
    mob: { name: 'Acorn Critter', color: '#a86a3a', eye: '#ffffff', fly: false, spikes: true },
    boss: { name: 'King Oakenroot', color: '#8a5a2a', accent: '#ff7a2a' } },
  { key: 'neon', label: 'Neon', names: ['Glowtopia', 'Lumenix', 'Pixelon', 'Synthara', 'Brightburg'], ramp: ['#0a0a2a', '#ff2ab0', '#2affe0', '#ffe82a', '#ffffff'],
    top: '#2a1a4a', soil: '#1a1030', rock: '#100a20', wood: '#2affe0', cap: '#ff2ab0', skyTop: '#0a0420', skyBot: '#5a1a6a', atmo: '#ff2ab0', grav: 18,
    mob: { name: 'Glow Bug', color: '#2affe0', eye: '#ff2ab0', fly: true, crystal: true, glow: true },
    boss: { name: 'DJ Laserbeam', color: '#ff2ab0', accent: '#2affe0' } },
  // ---- 1.6.4: eight more elements ----
  { key: 'tropic', label: 'Tropical', names: ['Palmora', 'Cocobay', 'Lagoonia', 'Sunnyreef', 'Tikiholm'], ramp: ['#0a4a6a', '#1aa0b0', '#5ae0d0', '#ffe8a0', '#ffffff'],
    top: '#7ad84a', soil: '#f0d890', rock: '#9a8a70', wood: '#8a5a30', cap: '#ff7a3a', skyTop: '#2aa0ff', skyBot: '#c8fff4', atmo: '#5ae8ff', grav: 20,
    mob: { name: 'Coconut Crab', color: '#c87a3a', eye: '#ffffff', fly: false, legs: true },
    boss: { name: 'Tiki Titan', color: '#a8642a', accent: '#5affc8' } },
  { key: 'blossom', label: 'Blossom', names: ['Sakurae', 'Petalia', 'Bloomhaven', 'Pinkwood', 'Hanami'], ramp: ['#5a2a4a', '#c86a9a', '#ffb0d0', '#ffe0ee', '#ffffff'],
    top: '#9ad870', soil: '#7a5040', rock: '#a89aa8', wood: '#5a3a3a', cap: '#ffb0d8', skyTop: '#8ac0ff', skyBot: '#ffe4f0', atmo: '#ffc0e0', grav: 17,
    mob: { name: 'Petal Moth', color: '#ffb0d8', eye: '#5a2a4a', fly: true, wings: true },
    boss: { name: 'Empress Petalstorm', color: '#ff8ac0', accent: '#ffffff' } },
  { key: 'ruins', label: 'Ancient', names: ['Templara', 'Ruinhold', 'Goldspire', 'Pyramus', 'Relicon'], ramp: ['#3a2a1a', '#7a6040', '#c8a868', '#f0d898', '#fff8e0'],
    top: '#a8b868', soil: '#b89a68', rock: '#c8b890', wood: '#6a5030', cap: '#ffd23a', skyTop: '#e8a85a', skyBot: '#fff0c8', atmo: '#ffd890', grav: 21,
    mob: { name: 'Stone Guardian', color: '#c8b890', eye: '#3affd8', fly: false, legs: true },
    boss: { name: 'The Golden Colossus', color: '#d8b040', accent: '#3affd8' } },
  { key: 'aurora', label: 'Aurora', names: ['Borealis', 'Glimmerfrost', 'Polaria', 'Lightveil', 'Northara'], ramp: ['#04101a', '#0a3a4a', '#2affa0', '#a05aff', '#e8fff8'],
    top: '#d8f0f0', soil: '#5a7a8a', rock: '#3a4a5a', wood: '#2a3a4a', cap: '#2affa0', skyTop: '#040a20', skyBot: '#1a6a6a', atmo: '#2affa0', grav: 18,
    mob: { name: 'Glow Fox', color: '#a8fff0', eye: '#a05aff', fly: false, spikes: true, glow: true },
    boss: { name: 'Aurorax the Radiant', color: '#2affa0', accent: '#a05aff' } },
  { key: 'honey', label: 'Honey', names: ['Hivetopia', 'Nectara', 'Buzzholm', 'Combwood', 'Goldendrip'], ramp: ['#4a2a00', '#a86a00', '#ffb000', '#ffe060', '#fff8d0'],
    top: '#ffc83a', soil: '#c88a2a', rock: '#8a6a3a', wood: '#5a3a1a', cap: '#ff8a2a', skyTop: '#ffb84a', skyBot: '#fff4c0', atmo: '#ffd04a', grav: 19,
    mob: { name: 'Buzzy Bee', color: '#ffd23a', eye: '#1a1a1a', fly: true, wings: true },
    boss: { name: 'Queen Buzzworth', color: '#ffc000', accent: '#2a2a2a' } },
  { key: 'junk', label: 'Junkyard', names: ['Scrapheap', 'Rustopia', 'Junkara', 'Gizmoville', 'Clunkton'], ramp: ['#2a1a10', '#6a4a2a', '#a8784a', '#c8b8a0', '#ff8a3a'],
    top: '#8a7a5a', soil: '#6a5040', rock: '#5a5050', wood: '#a85a2a', cap: '#3ad1ff', skyTop: '#a8784a', skyBot: '#f0d8b0', atmo: '#d8a870', grav: 23,
    mob: { name: 'Tin Can Critter', color: '#a8a8b0', eye: '#ffd23a', fly: false, legs: true },
    boss: { name: 'Scrapzilla', color: '#8a6a4a', accent: '#3ad1ff' } },
  { key: 'dino', label: 'Dino', names: ['Rexoria', 'Fernvale', 'Raptora', 'Tricera', 'Jurassa'], ramp: ['#1a3a10', '#3a6a1a', '#7aa83a', '#c8d87a', '#f0f8d0'],
    top: '#6aa83a', soil: '#7a5a3a', rock: '#7a7068', wood: '#5a4020', cap: '#ff8a2a', skyTop: '#e8b05a', skyBot: '#fff0c0', atmo: '#c8e87a', grav: 24,
    mob: { name: 'Mini Raptor', color: '#5a9a3a', eye: '#ffe14d', fly: false, spikes: true },
    boss: { name: 'Tyranno-Rex the Huge', color: '#4a8a2a', accent: '#ff8a2a' } },
  { key: 'rainbow', label: 'Rainbow', names: ['Prismia', 'Spectra', 'Colorburst', 'Hueville', 'Rainbowa'], ramp: ['#ff4a5a', '#ffb03a', '#ffe84a', '#4ae88a', '#4aa8ff'],
    top: '#ff8ad8', soil: '#8a6aff', rock: '#4ac8ff', wood: '#ffe84a', cap: '#4ae88a', skyTop: '#6ab0ff', skyBot: '#ffe8f8', atmo: '#ff9ae8', grav: 15,
    mob: { name: 'Rainbow Blob', color: '#ff6ac8', eye: '#ffffff', fly: false, jelly: true },
    boss: { name: 'Chromazilla', color: '#ff4a8a', accent: '#4ae8ff' } },
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
  // 1.5.1 skins
  { name: 'Ruby', suit: '#e8203f', accent: '#ffd34d', visor: '#ffffff', style: 'crest' },
  { name: 'Shadow', suit: '#1c1c28', accent: '#a85aff', visor: '#ff5aff', style: 'horns' },
  { name: 'Coral', suit: '#ff8a7a', accent: '#3ad1c0', visor: '#ffe14d', style: 'ears' },
  { name: 'Gold', suit: '#ffcf3a', accent: '#fff6d8', visor: '#ff5a10', style: 'dome' },
  { name: 'Mint', suit: '#b8ffe0', accent: '#2a8a6a', visor: '#2a5cff', style: 'antenna' },
  { name: 'Volt', suit: '#3a3f5a', accent: '#fff35a', visor: '#fff35a', style: 'mohawk' },
  { name: 'Glitch', suit: '#2a1a4a', accent: '#2affe0', visor: '#ff2ab0', style: 'robot' },
  { name: 'Comet', suit: '#ffffff', accent: '#4a9aff', visor: '#ff9ad5', style: 'jetpack' },
  // 1.6.4 skins
  { name: 'Sakura', suit: '#ffc0dc', accent: '#ffffff', visor: '#ff4a8a', style: 'ears' },
  { name: 'Dino', suit: '#5a9a3a', accent: '#ffe14d', visor: '#ff8a2a', style: 'horns' },
  { name: 'Aurora', suit: '#0a2a3a', accent: '#2affa0', visor: '#a05aff', style: 'crest' },
  { name: 'Honey', suit: '#ffc83a', accent: '#2a2a2a', visor: '#ffffff', style: 'antenna' },
  { name: 'Titan', suit: '#c8b890', accent: '#d8b040', visor: '#3affd8', style: 'robot' },
  { name: 'Nebula', suit: '#5a2a9a', accent: '#ff6ad8', visor: '#5affff', style: 'dome' },
  { name: 'Sky', suit: '#8ad0ff', accent: '#ffffff', visor: '#ffd23a', style: 'jetpack' },
  { name: 'Ember', suit: '#3a1a1a', accent: '#ff6a2a', visor: '#ffd23a', style: 'mohawk' },
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

/* ================= GALAXY: 5 planets per element (80), spiral path out from Earth ================= */
const GALAXY = { perTheme: 5, bossThemesFirst: ['ice', 'lava', 'cloud', 'storm'], start: new V3(0, 40, 0) };
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
  storm: { bosses: ['Thunderclaw the Loud', 'Cyclone Serpent', 'Static Sultan Zzzap', 'Hailstone Hulk', 'Tempest Twins'], mobs: ['Spark Wisp', 'Zap Zipper', 'Thunder Tot', 'Gust Gremlin', 'Rain Rascal'] },
  fungus: { bosses: ['Mushmaw the Mighty', 'Toadstool Tyrant', 'Queen Sporella', 'Puffball Prime', 'The Mold King'], mobs: ['Sporeling', 'Cap Hopper', 'Truffle Tot', 'Fungus Fiend', 'Puff Pod'] },
  robot: { bosses: ['Megatron-9000', 'Gearjaw Crusher', 'Professor Sprocket', 'Tank Titan T-7', 'The Overclocker'], mobs: ['Bolt Bot', 'Gear Spider', 'Drone Dot', 'Scrap Scuttler', 'Wrench Wrecker'] },
  cloud: { bosses: ['Cumulord the Fluffy', 'Sky Whale Skyla', 'Captain Hailstorm', 'The Rainbow Roc', 'Mist Mage Nimbo'], mobs: ['Puff Flapper', 'Fluff Puff', 'Breeze Bird', 'Drizzle Drop', 'Sky Sprite'] },
  shadow: { bosses: ['Gloomreaper', 'Lord Eclipse', 'The Night Stalker', 'Shadowhorn', 'Void Queen Umbra'], mobs: ['Shade Bat', 'Gloom Ghost', 'Dark Drifter', 'Night Nibbler', 'Shadow Skitter'] },
  swamp: { bosses: ['Croakzilla', 'Bog Witch Murkella', 'Mudslinger Moe', 'The Swamp Thing', 'Gatorgeddon'], mobs: ['Bog Hopper', 'Muck Mite', 'Leech Lurker', 'Mud Puppy', 'Gator Grub'] },
  autumn: { bosses: ['King Oakenroot', 'Scarecrow Scraggs', 'Pumpkin Pharaoh', 'Harvest Hound', 'Lady Leafstorm'], mobs: ['Acorn Critter', 'Leaf Lurker', 'Pumpkin Pip', 'Squirrel Scamp', 'Twig Twitch'] },
  neon: { bosses: ['DJ Laserbeam', 'Glitch Goliath', 'Pixel Phantom', 'Synthwave Serpent', 'Arcade Overlord'], mobs: ['Glow Bug', 'Neon Nibbler', 'Pixel Pest', 'Disco Drone', 'Bit Blob'] },
  tropic: { bosses: ['Tiki Titan', 'Captain Coconut', 'Volcano Chief Kahuna', 'Sharkfin Sally', 'The Palm Kraken'], mobs: ['Coconut Crab', 'Parrot Pest', 'Beach Bopper', 'Lagoon Lurker', 'Tiki Torcher'] },
  blossom: { bosses: ['Empress Petalstorm', 'Bonsai Brute', 'Lantern Dragon', 'The Cherry Ninja', 'Koi King'], mobs: ['Petal Moth', 'Blossom Bunny', 'Lantern Bug', 'Pink Puff', 'Twig Sprite'] },
  ruins: { bosses: ['The Golden Colossus', 'Mummy King Wrapz', 'Sphinx Riddler', 'Temple Serpent', 'Idol Guardian'], mobs: ['Stone Guardian', 'Dusty Mummy', 'Scarab Scuttler', 'Relic Rat', 'Totem Tot'] },
  aurora: { bosses: ['Aurorax the Radiant', 'Polar Bear Prime', 'The Northern Wyrm', 'Starlight Stag', 'Frostflare Phoenix'], mobs: ['Glow Fox', 'Light Wisp', 'Snow Hare', 'Shimmer Seal', 'Polar Puff'] },
  honey: { bosses: ['Queen Buzzworth', 'Sir Stingalot', 'The Honey Golem', 'Waxwing Warlord', 'Bumble Baron'], mobs: ['Buzzy Bee', 'Honey Blob', 'Wax Worm', 'Pollen Puff', 'Drone Buzzer'] },
  junk: { bosses: ['Scrapzilla', 'Captain Clank', 'The Trash Compactor', 'Magnet Max', 'Rusty Robo-Rex'], mobs: ['Tin Can Critter', 'Bolt Beetle', 'Rust Rat', 'Spring Sprong', 'Junk Jumper'] },
  dino: { bosses: ['Tyranno-Rex the Huge', 'Triceratopz', 'Pterror Queen', 'Stego the Spiky', 'Raptor Boss Rocco'], mobs: ['Mini Raptor', 'Baby Stego', 'Ptero Pup', 'Dino Egg Hatcher', 'Compy Chomper'] },
  rainbow: { bosses: ['Chromazilla', 'Unicorn Overlord', 'Prism Paladin', 'The Color Thief', 'Lady Spectrum'], mobs: ['Rainbow Blob', 'Color Sprite', 'Hue Hopper', 'Sparkle Pony', 'Paint Puff'] },
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
/* Galaxy seed: every seed makes a different galaxy. 2964 is the classic galaxy (all saves from before seeds use it).
   The seed is read before anything is built, so changing it reloads the page. Each galaxy keeps its own
   explored planets and saved villages (save.worlds); gear, minerals and helpers come with you. */
const CLASSIC_SEED = 2964;
const GALAXY_SEED = (() => {
  // joining or hosting a lobby: the lobby code IS the galaxy seed, so everyone shares one galaxy
  try { const l = JSON.parse(localStorage.getItem('galaxy-beyond-lobby')); if (l && +l.code > 0) return +l.code; } catch (e) { }
  try { const n = parseInt(localStorage.getItem('galaxy-beyond-next-seed'), 10); localStorage.removeItem('galaxy-beyond-next-seed'); if (n > 0) return n; } catch (e) { }
  try { const s = JSON.parse(localStorage.getItem('galaxy-beyond-save-v1')); if (s && s.minerals) return (s.seed | 0) || CLASSIC_SEED; } catch (e) { }
  return 1 + Math.floor(Math.random() * 999999);
})();
const PLANETS = (() => {
  const classic = GALAXY_SEED === CLASSIC_SEED;
  const r = mulberry32(classic ? 2964 : GALAXY_SEED), g = mulberry32(GALAXY_SEED * 7 + 13);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // v1 order of difficulty; planets 0-39 keep their ids so old saves still match. 1.5 adds 8 more elements (ids 40-79) further out.
  const rings = [{ order: ['jungle', 'desert', 'ocean', 'candy', 'ice', 'toxic', 'lava', 'crystal'], tier0: 1 },
    { order: ['cloud', 'fungus', 'autumn', 'swamp', 'storm', 'robot', 'neon', 'shadow'], tier0: 4 },
    { order: ['tropic', 'blossom', 'honey', 'rainbow', 'ruins', 'dino', 'junk', 'aurora'], tier0: 6, extra: true }]; // 1.6.4: ids 80-119
  if (!classic) {
    // a new seed mixes everything up: which elements come first, names, where planets sit, who has a boss
    const all = shuffle(rings[0].order.concat(rings[1].order));
    rings[0].order = all.slice(0, 8); rings[1].order = all.slice(8);
  }
  const g2 = mulberry32(GALAXY_SEED * 11 + 29), shuffle2 = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g2() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  if (!classic) rings[2].order = shuffle2(rings[2].order);
  const SYL1 = ['Zo', 'Ka', 'Vel', 'Mi', 'Tor', 'Ny', 'Ar', 'Quo', 'Lu', 'Bra', 'Xen', 'Fi', 'Ro', 'Sa', 'Dri', 'Ul', 'Pex', 'Ori', 'Ga', 'Hel'];
  const SYL2 = ['ra', 'lon', 'mia', 'tis', 'vex', 'nar', 'dos', 'pa', 'lix', 'thor', 'qua', 'rel', 'vin', 'zar', 'ko', 'bel', 'nox', 'ria', 'tun', 'sol'];
  const namePools = {}, variantPerm = {};
  const list = [];
  let i = 0, ang = classic ? 0.6 : g() * 6.283, rad = 1500;
  const bossSet = new Set();
  if (!classic) for (const ri of [0, 1]) { const ids = shuffle([...Array(40).keys()].filter(n => ri === 1 || n >= 3)); ids.slice(0, 10).forEach(n => bossSet.add(ri * 40 + n)); }
  if (!classic) shuffle2([...Array(40).keys()]).slice(0, 10).forEach(n => bossSet.add(80 + n));
  for (const ring of rings) for (let k = 0; k < GALAXY.perTheme; k++) {
    const order = ring.order, gg = ring.extra ? g2 : g, sh = ring.extra ? shuffle2 : shuffle;
    for (let oi = 0; oi < order.length; oi++) {
      const key = order[oi], ti = THEMES.findIndex(t => t.key === key), th = THEMES[ti];
      const tier = clamp(ring.tier0 + Math.floor(oi * 5 / order.length) + k, 1, MAX_TIER);
      const pos = new V3(Math.cos(ang) * rad, (r() - 0.5) * 500, -Math.sin(ang) * rad);
      if (classic) { rad += 190; ang += 900 / rad; } else { rad += 160 + gg() * 60; ang += (780 + gg() * 260) / rad; }
      let name;
      if (classic) name = th.names[k % th.names.length] + (k >= th.names.length ? ' ' + (k + 1) : '');
      else {
        if (!namePools[key]) namePools[key] = sh(th.names);
        name = gg() < 0.5 ? namePools[key][k % 5] : SYL1[Math.floor(gg() * SYL1.length)] + SYL2[Math.floor(gg() * SYL2.length)];
        if (list.some(p => p.name === name)) name += ' ' + ['Prime', 'Minor', 'II', 'III', 'Major', 'Nova'][Math.floor(gg() * 6)];
      }
      const minerals = [];
      const base = (tier - 1) * 20, rr = mulberry32(classic ? 9000 + i * 31 : GALAXY_SEED * 31 + i * 977);
      while (minerals.length < 3) { const m = base + Math.floor(rr() * 20); if (!minerals.includes(m)) minerals.push(m); }
      minerals.push(Math.min(MINERAL_COUNT - 1, tier * 20 + Math.floor(rr() * 20)));
      if (i === 0) { minerals[0] = 0; minerals[1] = 1; minerals[2] = 2; minerals[3] = 20; }
      const boss = classic ? (k === 0 && GALAXY.bossThemesFirst.includes(key)) || (k >= 1 && (oi + k) % 4 === 0) : bossSet.has(i);
      if (!variantPerm[key]) variantPerm[key] = classic ? [0, 1, 2, 3, 4] : sh([0, 1, 2, 3, 4]);
      const seed = classic ? 1000 + i * 7919 : (GALAXY_SEED * 7919 + i * 104729) % 9999991;
      list.push({ id: i, name, ti, theme: themeVariant(th, variantPerm[key][k]), tier, pos, radius: 120 + r() * 90, seed, boss, minerals, ring: r() < 0.45 });
      i++;
    }
  }
  GALAXY.endAng = ang; GALAXY.endRad = rad;
  return list;
})();
const EDGE_GATE = new V3(Math.cos(GALAXY.endAng) * (GALAXY.endRad + 2200), 300, -Math.sin(GALAXY.endAng) * (GALAXY.endRad + 2200));

/* Home sweet home: Earth in the year 2964. Not one of the galaxy planets (id -1),
   so it never counts toward exploring. Safe: no monsters, no boss. */
const EARTH = { id: -1, earth: true, name: 'Earth', tier: 1, boss: false, seed: 2964, radius: 380, pos: new V3(), minerals: [0, 1, 2, 20],
  theme: Object.assign({}, THEMES[0], { key: 'earth', label: 'Home world', top: '#5cc24f', soil: '#7a5530', rock: '#7d828c', wood: '#7a4e2d', cap: '#3f9a3a',
    skyTop: '#3d86e8', skyBot: '#cdeeff', grav: 22 }) };
const EARTH_RELICS = ['Old smartphone from 2024', 'Moon rock', 'Golden space record', 'Dinosaur fossil', 'Robot dog toy', 'First Mars rover wheel',
  'Ancient game cartridge', 'Space Inc. founder badge', 'Fossilized pizza slice', 'Time capsule from 2100'];

/* ================= SAVE ================= */
const SAVE_KEY = 'galaxy-beyond-save-v1';
function defaultSave() {
  return { hero: 0, name: '', introDone: false, minerals: {}, blocks: {}, orbs: 0,
    gear: { tool: null, weapon: null, armor: null }, ship: { engine: 0, nitro: 0, hull: 0 },
    saved: [], helpers: [], visited: [], leftGalaxy: false, relics: [], seed: GALAXY_SEED };
}
let save = defaultSave();
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.minerals) return Object.assign(defaultSave(), { seed: CLASSIC_SEED }, s); } catch (e) { } return null; }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
function addMineral(id, n = 1) { const first = !(id in save.minerals); save.minerals[id] = (save.minerals[id] || 0) + n; return first; }
function addBlock(t, n = 1) { save.blocks[t] = (save.blocks[t] || 0) + n; }
function mineralsFound() { return Object.keys(save.minerals).length; }
