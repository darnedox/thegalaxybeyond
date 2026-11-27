/* ================= PLANET (block world) ================= */
const W = 128, H = 56, D = 128; // planet surface size (was 64 x 64)
const B = { AIR: 0, TOP: 1, SOIL: 2, ROCK: 3, CORE: 4, WOOD: 5, CAP: 6, PLANKS: 7, BRICKS: 8, GLASS: 9, GLOW: 10, ORE: 16 };
const BLOCK_INFO = {
  1: { name: 'Topsoil', hard: 0.5 }, 2: { name: 'Soil', hard: 0.5 }, 3: { name: 'Rock', hard: 1.2 }, 4: { name: 'Core rock', hard: Infinity },
  5: { name: 'Stalk wood', hard: 0.8 }, 6: { name: 'Glowcap', hard: 0.3 }, 7: { name: 'Wood panel', hard: 0.7 }, 8: { name: 'Space panel', hard: 1.2 },
  9: { name: 'Glass dome', hard: 0.3 }, 10: { name: 'Glow light', hard: 0.4 },
};
/* Realistic surface detail, drawn in the terrain shader from world-space noise (no texture files):
   0 grass, 1 dirt, 2 rock, 3 smooth (ore, wood, glowcaps), 4 wood panels, 5 space panels. */
const SURFACE_KIND = { [B.TOP]: 0, [B.SOIL]: 1, [B.ROCK]: 2, [B.CORE]: 2, [B.WOOD]: 4, [B.CAP]: 3, [B.PLANKS]: 4, [B.BRICKS]: 5, [B.GLOW]: 3 };
const SURFACE_GLSL = `
float sdHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sdNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sdHash(i), sdHash(i + vec3(1,0,0)), f.x), mix(sdHash(i + vec3(0,1,0)), sdHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(sdHash(i + vec3(0,0,1)), sdHash(i + vec3(1,0,1)), f.x), mix(sdHash(i + vec3(0,1,1)), sdHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float sdFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * sdNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
float surfaceDetail(vec3 p, vec3 n, float kind, float dist, out vec3 tint) {
  float fade = clamp(1.0 - dist / 60.0, 0.0, 1.0), pw = length(fwidth(p)), fine = clamp(1.0 - pw * 9.0, 0.0, 1.0), midAA = clamp(1.0 - pw * 2.5, 0.0, 1.0);
  float big = sdFbm(p * 0.9), mid = mix(0.5, sdFbm(p * 3.1 + 5.0), midAA), sm = mix(0.5, sdNoise(p * 9.0), fine);
  float wG = clamp(1.0 - abs(kind - 0.0), 0.0, 1.0), wD = clamp(1.0 - abs(kind - 1.0), 0.0, 1.0), wR = clamp(1.0 - abs(kind - 2.0), 0.0, 1.0);
  float wS = clamp(1.0 - abs(kind - 3.0), 0.0, 1.0), wW = clamp(1.0 - abs(kind - 4.0), 0.0, 1.0), wP = clamp(1.0 - abs(kind - 5.0), 0.0, 1.0);
  // grass: clumpy patches, dry tips and tiny blades
  float blade = mix(0.5, sdNoise(p * vec3(14.0, 3.0, 14.0)), fine);
  float flower = smoothstep(0.86, 0.9, sdNoise(p * 4.3 + 21.0)) * fine * clamp(n.y * 2.0 - 1.0, 0.0, 1.0);
  float gH = mid * 0.3 + sm * 0.2 + blade * 0.25 + flower * 0.4;
  vec3 gT = mix(vec3(0.82, 0.88, 0.76), vec3(1.1, 1.08, 0.88), big) * (0.92 + sm * 0.1 + blade * 0.12) * (0.95 + mid * 0.1);
  gT = mix(gT, mix(vec3(2.2, 2.1, 1.2), vec3(2.2, 1.4, 1.9), step(0.5, sdHash(floor(p * 4.3)))), flower * 0.7);
  // dirt: lumpy soil with small pebbles
  float peb = smoothstep(0.72, 0.8, sdNoise(p * 7.0 + 3.0));
  float dH = mid * 0.7 + peb * 0.5 + sm * 0.2;
  vec3 dT = mix(vec3(0.8), vec3(1.1), mid) * mix(1.0, 1.25, peb) * (0.9 + sm * 0.2);
  // rock: layered strata, cracks and grain
  float strata = sin(p.y * 2.6 + big * 4.0) * 0.5 + 0.5;
  float crack = 1.0 - smoothstep(0.0, 0.06, abs(sdNoise(p * 1.8 + 9.0) - 0.5));
  float rH = strata * 0.35 + mid * 0.5 + sm * 0.25 - crack * 0.6;
  vec3 rT = vec3(mix(0.74, 1.16, strata * 0.6 + mid * 0.4)) * (1.0 - crack * 0.5 * fade) * (0.9 + sm * 0.2);
  rT *= mix(vec3(1.0), vec3(0.85, 1.05, 0.8), smoothstep(0.6, 0.95, n.y) * smoothstep(0.45, 0.7, big) * 0.6);
  // smooth things: just a little mottling
  float sH = mid * 0.3; vec3 sT = vec3(0.94 + mid * 0.12);
  // wood: grain lines and plank seams
  float grain = sin((p.x + p.z) * 9.0 + sdNoise(p * vec3(1.0, 6.0, 1.0)) * 6.0) * 0.5 + 0.5;
  float seam = 1.0 - smoothstep(0.0, 0.05, min(fract(p.y), 1.0 - fract(p.y)));
  float wH = grain * 0.4 - seam * 0.8; vec3 wT = vec3(0.86 + grain * 0.22) * (1.0 - seam * 0.4);
  // space panels: panel lines, rivets and scuffs
  vec3 an = abs(n); vec2 uv = an.x > an.y && an.x > an.z ? p.yz : (an.y > an.z ? p.xz : p.xy);
  vec2 g = abs(fract(uv) - 0.5); float line = smoothstep(0.46, 0.49, max(g.x, g.y));
  float rivet = 1.0 - smoothstep(0.03, 0.05, length(g - vec2(0.4)));
  float bevel = smoothstep(0.36, 0.46, max(g.x, g.y));
  float tone = 0.93 + 0.1 * step(0.5, sdHash(floor(p) + 3.0));
  float strip = (1.0 - smoothstep(0.03, 0.06, abs(fract(uv.y * 0.5) - 0.5))) * step(0.5, sdHash(floor(p * 0.5) + 7.0)) * fine;
  float pH = -line * 0.8 + bevel * 0.3 + rivet * 0.5 + mid * 0.12; vec3 pT = vec3(tone + mid * 0.08) * (1.0 - line * 0.4) * (1.0 - bevel * 0.08) * (1.0 + rivet * 0.25) + vec3(0.25, 0.55, 0.6) * strip;
  tint = gT * wG + dT * wD + rT * wR + sT * wS + wT * wW + pT * wP;
  tint = mix(vec3(1.0), tint, 0.35 + 0.65 * fade);
  return (gH * wG + dH * wD + rH * wR + sH * wS + wH * wW + pH * wP) * (0.25 + 0.75 * fade);
}
`;
// dark minerals (coal, onyx…) still need to shine in a dark cave
const ORE_HEX = {};
function oreHex(id) { if (ORE_HEX[id]) return ORE_HEX[id]; const c = new THREE.Color(MINERALS[id].hex), h = {}; c.getHSL(h); c.setHSL(h.h, h.s, Math.max(h.l, 0.5)); return ORE_HEX[id] = '#' + c.getHexString(); }
const HOTBAR = [B.TOP, B.SOIL, B.ROCK, B.WOOD, B.CAP, B.PLANKS, B.BRICKS, B.GLASS, B.GLOW];
const LIQUID = { ocean: { y: 9.5, color: '#2a8cff', dmg: 0, name: 'water' }, jungle: { y: 8.5, color: '#3aa0d8', dmg: 0, name: 'water' }, lava: { y: 8.5, color: '#ff5a10', dmg: 16, name: 'lava' }, toxic: { y: 8.5, color: '#8aff2a', dmg: 6, name: 'toxic goo' }, earth: { y: 9.5, color: '#2a8cff', dmg: 0, name: 'water' }, swamp: { y: 10.5, color: '#4a7a3a', dmg: 0, name: 'swamp water' }, tropic: { y: 9.5, color: '#2ad8e0', dmg: 0, name: 'lagoon water' }, honey: { y: 8.5, color: '#ffb000', dmg: 0, name: 'honey' }, dino: { y: 8.5, color: '#3a9ad0', dmg: 0, name: 'water' } };
const fpsCam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1200);
fpsCam.rotation.order = 'YXZ';
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
let P = null; // the current planet runtime
const PL = { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, onGround: false, hp: 100, maxHp: 100, lastHit: -99, atkCD: 0, fireCD: 0, third: false, model: null, sel: 0, mining: null, liquidT: 0, deadT: 0, slot: 0, tool: 'mine' };

const idx = (x, y, z) => x + z * W + y * W * D;
function getB(x, y, z) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) return 0; return P.world[idx(x, y, z)]; }
function setB(x, y, z, t) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) return; P.world[idx(x, y, z)] = t; }
function solidAt(x, y, z) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0) return true; if (y >= H) return false; return P.world[idx(x, y, z)] !== 0; }
function groundY(x, z) { x = Math.floor(x); z = Math.floor(z); for (let y = H - 1; y >= 0; y--) if (getB(x, y, z)) return y + 1; return 0; }
const seeThrough = t => t === 0 || t === B.GLASS;

function genWorld() {
  const p = P.p, s = p.seed, th = p.theme, world = new Uint8Array(W * H * D), liq = LIQUID[th.key];
  // rolling ground + big smooth hills and mountains
  const baseH = (x, z) => 12 + (fbm3(x * 0.045, 1.7, z * 0.045, s, 4) - 0.5) * 18 + (fbm3(x * 0.014, 5.3, z * 0.014, s + 50, 2) - 0.5) * 16
    + smooth(0.45, 0.78, fbm3(x * 0.018, 9.1, z * 0.018, s + 200, 3)) * 24;
  const spawn = { x: 50, z: 50 }, vc = { x: 86, z: 82 };
  const floor = liq ? Math.ceil(liq.y) + 2 : 6;
  const hs = Math.max(Math.round(baseH(spawn.x, spawn.z)), floor), hv = Math.max(Math.round(baseH(vc.x, vc.z)), floor);
  const hm = new Int16Array(W * D); P.hm = hm;
  // 1.6.7: Ocean and Tropical worlds are mostly sea with islands
  const sink = { ocean: 8, tropic: 6 }[th.key] || 0;
  const isle = (x, z) => sink ? (smooth(0.55, 0.8, fbm3(x * 0.03, 3.3, z * 0.03, s + 321, 3)) * sink * 0.9) : 0;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    let h = baseH(x, z) - sink + isle(x, z);
    h = lerp(h, hs, p.earth ? smooth(46, 38, Math.hypot(x - 63, z - 63)) : smooth(8, 4, Math.hypot(x - spawn.x, z - spawn.z)));
    if (p.boss) h = lerp(h, hv, smooth(17, 12, Math.hypot(x - vc.x, z - vc.z)));
    h = clamp(Math.round(h), 3, H - 12); hm[x + z * W] = h;
    for (let y = 0; y <= h; y++) world[idx(x, y, z)] = y === 0 ? B.CORE : y < h - 3 ? B.ROCK : y < h ? B.SOIL : B.TOP;
  }
  // caves: winding tunnels that start at the surface and dive underground, plus some open caverns
  const rr = mulberry32(s + 9);
  const carve = (cx, cy, cz, r) => {
    for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(H - 2, Math.ceil(cy + r)); y++) for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(D - 1, Math.ceil(cz + r)); z++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r) world[idx(x, y, z)] = B.AIR;
  };
  const keepOut = (x, z) => (p.earth ? Math.hypot(x - 63, z - 63) < 40 : Math.hypot(x - spawn.x, z - spawn.z) < 5) || (p.boss && Math.hypot(x - vc.x, z - vc.z) < 14);
  const starts = [[spawn.x + 9, spawn.z + 3]];
  for (let n = 0; n < 20; n++) starts.push([6 + rr() * (W - 12), 6 + rr() * (D - 12)]);
  for (const [sx, sz] of starts) {
    if (keepOut(sx, sz)) continue;
    let x = sx, z = sz, y = hm[Math.floor(x) + Math.floor(z) * W] + 1, yaw = rr() * 6.28, pitch = -0.7;
    for (let st = 0; st < 70; st++) {
      const r = st < 6 ? 1.7 : 1.8 + rr() * 1.1;
      if (!keepOut(x, z)) carve(x, y, z, r);
      yaw += (rr() - 0.5) * 0.7; pitch = st < 8 ? -0.42 : clamp(pitch + (rr() - 0.5) * 0.4, -0.35, 0.25);
      if (y < 4) pitch = Math.abs(pitch) * 0.5;
      x += Math.cos(yaw) * Math.cos(pitch); z += Math.sin(yaw) * Math.cos(pitch); y += Math.sin(pitch);
      if (x < 3 || z < 3 || x > W - 4 || z > D - 4) yaw += Math.PI * 0.6;
      x = clamp(x, 3, W - 4); z = clamp(z, 3, D - 4);
      if (st % 18 === 17) carve(x, y, z, 3.4); // little cavern
    }
  }
  for (let y = 2; y < H - 12; y++) for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
    const h = hm[x + z * W]; if (y >= h - 4 || keepOut(x, z)) continue;
    if (vnoise3(x * 0.08, y * 0.12, z * 0.08, s + 3) > 0.76) world[idx(x, y, z)] = B.AIR;
  }
  // ores grow on cave walls underground (rarer ones deeper down)
  const isAir = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y < H && world[idx(x, y, z)] === B.AIR;
  for (let y = 1; y < H - 12; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = idx(x, y, z), t = world[i]; if (t !== B.ROCK && t !== B.SOIL) continue;
    const depth = hm[x + z * W] - y; if (depth < 2) continue;
    const wall = isAir(x + 1, y, z) || isAir(x - 1, y, z) || isAir(x, y + 1, z) || isAir(x, y - 1, z) || isAir(x, y, z + 1) || isAir(x, y, z - 1);
    for (let k = 3; k >= 0; k--) {
      if (depth < [2, 4, 7, 10][k]) continue;
      const v = vnoise3(x * 0.3, y * 0.3, z * 0.3, s + 100 + k * 37);
      if (v > (wall ? [0.76, 0.79, 0.82, 0.84][k] : [0.86, 0.89, 0.91, 0.93][k])) { world[i] = B.ORE + k; break; }
    }
  }
  // glowing mushrooms light up the cave floors
  for (let n = 0; n < 880; n++) {
    const x = 1 + Math.floor(rr() * (W - 2)), z = 1 + Math.floor(rr() * (D - 2)), y = 2 + Math.floor(rr() * (H - 14));
    if (y < hm[x + z * W] - 2 && world[idx(x, y, z)] === B.AIR && world[idx(x, y - 1, z)] === B.ROCK) world[idx(x, y, z)] = B.CAP;
  }
  // alien mushroom trees
  for (let n = 0; n < 240; n++) {
    const x = 3 + Math.floor(rr() * (W - 6)), z = 3 + Math.floor(rr() * (D - 6)), h = hm[x + z * W];
    if ((p.earth ? Math.hypot(x - 63, z - 63) < 42 : Math.hypot(x - spawn.x, z - spawn.z) < 7) || (p.boss && Math.hypot(x - vc.x, z - vc.z) < 15)) continue;
    if (liq && h < liq.y + 0.5) continue;
    const ht = 3 + Math.floor(rr() * 4);
    for (let j = 1; j <= ht; j++) world[idx(x, h + j, z)] = B.WOOD;
    const cy = h + ht + 1, rad = 1 + Math.floor(rr() * 2);
    for (let dz = -rad - 1; dz <= rad + 1; dz++) for (let dx = -rad - 1; dx <= rad + 1; dx++) {
      if (Math.abs(dx) + Math.abs(dz) <= rad + 1 && !world[idx(x + dx, cy, z + dz)]) world[idx(x + dx, cy, z + dz)] = B.CAP;
      if (Math.abs(dx) + Math.abs(dz) <= rad - 1 + 1 && Math.abs(dx) <= rad && Math.abs(dz) <= rad && cy + 1 < H && !world[idx(x + dx, cy + 1, z + dz)]) world[idx(x + dx, cy + 1, z + dz)] = B.CAP;
    }
  }
  // landing pad of bricks
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { world[idx(spawn.x + dx, hs, spawn.z + dz)] = B.BRICKS; for (let y = hs + 1; y < hs + 9; y++) world[idx(spawn.x + dx, y, spawn.z + dz)] = B.AIR; }
  // village with 4 huts
  if (p.boss) {
    for (const [ox, oz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      const cx = vc.x + ox, cz = vc.z + oz;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (let y = hv + 1; y <= hv + 5; y++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2, door = (dz === Math.sign(-oz) * 2 && dx === 0 && y <= hv + 2);
        let t = 0; if (y <= hv + 3 && edge && !door) t = B.PLANKS; if (y === hv + 4 && Math.abs(dx) <= 2 && Math.abs(dz) <= 2) t = B.CAP; if (y === hv + 5 && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) t = B.CAP;
        if (y <= hv + 3 && edge && !door && dx === 0 && Math.abs(dz) !== 2 && y === hv + 2) t = B.GLASS;
        world[idx(cx + dx, y, cz + dz)] = t;
      }
      world[idx(cx, hv, cz)] = B.GLOW;
    }
    world[idx(vc.x, hv, vc.z)] = B.GLOW;
  }
  if (p.earth) buildEarthCity(world, hm, spawn, hs, rr);
  P.world = world; P.spawn = { x: spawn.x + 0.5, y: hs + 1, z: spawn.z + 0.5 }; P.vc = { x: vc.x + 0.5, y: hv + 1, z: vc.z + 0.5 }; P.liq = liq;
}

/* ---------- Earth, year 2964: Space Inc. HQ, a little future city, hidden relics ---------- */
function buildEarthCity(world, hm, spawn, hs, rr) {
  const put = (x, y, z, t) => { if (x >= 0 && z >= 0 && x < W && z < D && y > 0 && y < H) world[idx(x, y, z)] = t; };
  // a grid city on the big flat plaza: roads every 12 blocks, buildings in between
  const ROADS = [39, 51, 63, 75, 87], CELLS = [45, 57, 69, 81], lo = 37, hi = 89;
  for (let z = lo; z <= hi; z++) for (let x = lo; x <= hi; x++) {
    const onX = ROADS.some(r => Math.abs(x - r) <= 1), onZ = ROADS.some(r => Math.abs(z - r) <= 1);
    if (!onX && !onZ) continue;
    const mid = (onX && ROADS.includes(x)) || (onZ && ROADS.includes(z));
    put(x, hs, z, mid && (x + z) % 3 === 0 ? B.GLOW : B.BRICKS);
    for (let y = hs + 1; y < hs + 6; y++) put(x, y, z, 0);
  }
  const tower = (cx, cz, r, ht) => {
    const top = Math.min(H - 3, hs + ht);
    for (let y = hs + 1; y <= top; y++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const edge = Math.abs(dx) === r || Math.abs(dz) === r, corner = Math.abs(dx) === r && Math.abs(dz) === r, floor = (y - hs) % 5 === 0;
      const door = dz === r && dx === 0 && y <= hs + 2;
      let t = 0;
      if (corner || (edge && floor)) t = (y - hs) % 10 === 0 ? B.GLOW : B.BRICKS; else if (edge && !door) t = B.GLASS; else if (floor && !(Math.abs(dx) <= 1 && Math.abs(dz) <= 1)) t = B.PLANKS;
      if (y === top) t = B.BRICKS;
      put(cx + dx, y, cz + dz, t);
    }
    return top;
  };
  // Space Inc. HQ is the tallest building, right next to the launch pad
  const hx = 57, hz = 45, top = tower(hx, hz, 4, 26);
  for (let y = top + 1; y <= Math.min(H - 1, top + 2); y++) put(hx, y, hz, B.GLOW);
  P.hq = { x: hx + 0.5, z: hz + 0.5, top };
  P.city = { roads: ROADS, lo, hi, cells: CELLS };
  P.shop = null; P.park = null;
  for (const cz of CELLS) for (const cx of CELLS) {
    if ((cx === 45 && cz === 45) || (cx === hx && cz === hz)) continue; // launch plaza + HQ
    if (cx === 69 && cz === 69) { // park with trees and a glowing fountain
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) put(cx + dx, hs, cz + dz, B.TOP);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(cx + dx, hs + 1, cz + dz, Math.abs(dx) + Math.abs(dz) === 0 ? B.GLOW : B.BRICKS);
      for (const [tx, tz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { for (let j = 1; j <= 4; j++) put(cx + tx, hs + j, cz + tz, B.WOOD); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let dy = 5; dy <= 6; dy++) if (dy === 5 || !dx || !dz) put(cx + tx + dx, hs + dy, cz + tz + dz, B.CAP); }
      P.park = { x: cx + 0.5, z: cz + 0.5 }; continue;
    }
    if (cx === 57 && cz === 69) { // Bo's shop: a low building with a big window
      tower(cx, cz, 3, 5); P.shop = { x: cx + 0.5, z: cz + 0.5 }; continue;
    }
    tower(cx, cz, 2 + Math.floor(rr() * 2), 9 + Math.floor(rr() * 16));
  }
  // relic spots: outside the city, half on the surface, half deep in caves
  const relics = [];
  for (let tries = 0; tries < 6000 && relics.length < EARTH_RELICS.length; tries++) {
    const x = 3 + Math.floor(rr() * (W - 6)), z = 3 + Math.floor(rr() * (D - 6));
    const inCity = x >= lo - 3 && x <= hi + 3 && z >= lo - 3 && z <= hi + 3;
    if (relics.length % 2 === 0 && inCity) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 10) continue;
    if (relics.some(r => Math.hypot(r.x - x, r.z - z) < 16)) continue;
    let y;
    if (relics.length % 2 === 0) { y = hm[x + z * W] + 1; if (world[idx(x, y, z)] || y < 11) continue; }
    else { y = 0; for (let yy = 3; yy < Math.min(hm[x + z * W], hs) - 4; yy++) if (!world[idx(x, yy, z)] && world[idx(x, yy - 1, z)]) { y = yy; break; } if (!y) continue; }
    relics.push({ x: x + 0.5, y: y + 0.4, z: z + 0.5, i: relics.length });
  }
  P.relicSpots = relics;
}
/* ---------- people of Earth ---------- */
const NPC_FOLK = [
  { name: 'Mayor Rosa', look: { suit: '#ffffff', accent: '#ffd34d', visor: '#ff5a7a', style: 'dome' }, role: 'mayor',
    lines: ['Welcome home, hero! The whole city is proud of you.', 'Space Inc. HQ is the tall tower by the launch pad.', 'Find all {relics} Earth relics and Space Inc. gives you a big prize!'] },
  { name: 'Captain Vega', look: { suit: '#2c3060', accent: '#ffd34d', visor: '#5affc8', style: 'crest' }, role: 'captain',
    lines: ['Your rocket is on the launch pad. Press L there to blast off!', 'Fly through the Edge Gate any time to warp straight home.', 'The outer planets are tougher. Craft strong gear first!'] },
  { name: 'Bo the Shopkeeper', look: { suit: '#ff7a2a', accent: '#ffffff', visor: '#ffe14d', style: 'ears' }, role: 'shop',
    lines: ['Welcome to Bo\'s Space Snacks! Here, have a Star Smoothie on the house. (Full health!)', 'Come back any time for another smoothie!'] },
  { name: 'Professor Pip', look: { suit: '#a77bff', accent: '#ffffff', visor: '#ffffff', style: 'antenna' }, role: 'quest',
    lines: ['I study ancient Earth relics. Some are in caves, some are out in the hills.'] },
  { name: 'Beep-O', look: { suit: '#9aa4b8', accent: '#5affc8', visor: '#ff3b3b', style: 'robot' }, role: 'robot',
    lines: ['BEEP BOOP. Why did the robot go to space? To find its MOTHER-BOARD!', 'BEEP. What do planets like to read? COMET books!', 'BOOP. I tried to catch fog once. I MIST.'] },
  { name: 'Scout Zoe', look: { suit: '#2fbf8a', accent: '#ffffff', visor: '#ff9ad5', style: 'jetpack' }, role: 'hint',
    lines: ['{boss}'] },
  { name: 'Max', look: { suit: '#ffd34d', accent: '#2a2a2a', visor: '#3ad1ff', style: 'mohawk' }, role: 'kid',
    lines: ['When I grow up I want to be a space pilot just like you!', 'Did you know there are 80 planets out there? 80!', 'Can you bring me a Moon rock? Just kidding, I have three.'] },
  { name: 'Grandpa Jet', look: { suit: '#c8d8e8', accent: '#7a4e2d', visor: '#ffe7a8', style: 'horns' }, role: 'old',
    lines: ['Back in 2900 our rockets were SO slow. Took a whole hour to reach Mars!', 'Helpers from saved villages are the best friends you can have.', 'Remember: the enchant table makes your gear stronger.'] },
];
function npcLine(n) {
  const L = n.d.lines, i = n.say++ % L.length; let s = L[i];
  if (n.d.role === 'quest') {
    const f = save.relics.length, all = EARTH_RELICS.length;
    s = f >= all ? 'You found every relic! You are the greatest explorer in history!' : f ? `You found ${f} of ${all} relics! Only ${all - f} more to go. Keep searching the hills and caves!` : L[0] + ` Can you find all ${all}?`;
  }
  if (n.d.role === 'shop') { PL.hp = PL.maxHp; SFX.orb(); }
  if (n.d.role === 'hint') {
    const b = PLANETS.find(p => p.boss && !save.saved.includes(p.id));
    s = b ? `Psst! I heard ${b.theme.boss.name} is trapping a village on ${b.name}. Can you save them?` : 'You saved every village! You are a legend!';
  }
  return s.replace('{relics}', EARTH_RELICS.length);
}
function setupEarthPeople() {
  P.npcs = []; const r = mulberry32(31), C = P.city;
  const extra = ['#ff5a7a', '#3ad1ff', '#7fd36b', '#ffb04a', '#c08aff', '#f4f6fb'];
  const folk = NPC_FOLK.slice();
  for (let i = 0; i < 8; i++) folk.push({ name: 'Citizen', look: { suit: extra[i % extra.length], accent: extra[(i + 3) % extra.length], visor: '#5affc8', style: ['dome', 'ears', 'crest', 'antenna'][i % 4] }, role: 'citizen',
    lines: ['Nice day in the city!', 'Hey, you are the famous pilot!', 'Have you seen the park? It has a glowing fountain!', 'I love living in the year 2964.', 'Space Inc. rocks!', 'Watch out for monsters out there!'] });
  folk.forEach((d, i) => {
    const g = buildHero(d.look); g.scale.setScalar(0.92);
    let x, z;
    if (d.role === 'shop' && P.shop) { x = P.shop.x; z = P.shop.z + 4.6; }
    else if (d.role === 'captain') { x = P.spawn.x + 1; z = P.spawn.z - 4; }
    else if (d.role === 'mayor') { x = P.spawn.x - 4; z = P.spawn.z + 1; }
    else { const onX = r() < 0.5, road = C.roads[Math.floor(r() * C.roads.length)], along = C.lo + 2 + r() * (C.hi - C.lo - 4); x = (onX ? road : along) + 0.5; z = (onX ? along : road) + 0.5; }
    g.position.set(x, groundY(x, z), z); P.scene.add(g);
    const tag = textSprite(d.role === 'citizen' ? 'Citizen' : d.name, d.role === 'citizen' ? '#cfe0ff' : '#ffd34d', 0.55); tag.position.y = 2.35; g.add(tag);
    P.npcs.push({ g, d, say: i % 3, dir: [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(r() * 4)], t: r() * 3, walk: d.role !== 'shop' && d.role !== 'captain' && d.role !== 'mayor', talkT: 0 });
  });
}
function onRoad(x, z) { const C = P.city; if (x < C.lo || z < C.lo || x > C.hi + 1 || z > C.hi + 1) return false; return C.roads.some(r => Math.abs(x - (r + 0.5)) < 1.4) || C.roads.some(r => Math.abs(z - (r + 0.5)) < 1.4); }
function nearestNpc() { let best = null, bd = 2.8; for (const n of P.npcs || []) { const d = Math.hypot(n.g.position.x - PL.pos.x, n.g.position.z - PL.pos.z); if (d < bd && Math.abs(n.g.position.y - PL.pos.y) < 2) { bd = d; best = n; } } return best; }
function talkToNpc() {
  const n = nearestNpc(); if (!n) return false;
  n.talkT = 6; n.g.rotation.y = Math.atan2(PL.pos.x - n.g.position.x, PL.pos.z - n.g.position.z);
  const box = $('npcTalk'); box.hidden = false; $('npcName').textContent = n.d.role === 'citizen' ? 'Citizen' : n.d.name; $('npcText').textContent = npcLine(n);
  clearTimeout(box._t); box._t = setTimeout(() => box.hidden = true, 6000); SFX.place();
  return true;
}
function updateEarthPeople(dt) {
  for (const n of P.npcs || []) {
    const g = n.g; let speed = 0;
    if (n.talkT > 0) n.talkT -= dt;
    else if (n.walk) {
      n.t -= dt; if (n.t <= 0) { n.t = 2 + Math.random() * 4; n.dir = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(Math.random() * 4)]; n.stop = Math.random() < 0.25; }
      if (!n.stop) {
        const nx = g.position.x + Math.sin(n.dir) * dt * 1.4, nz = g.position.z + Math.cos(n.dir) * dt * 1.4;
        if (onRoad(nx, nz) && !(Math.hypot(nx - PL.pos.x, nz - PL.pos.z) < 0.9)) { g.position.x = nx; g.position.z = nz; speed = 1.4; } else n.t = 0;
        g.rotation.y = n.dir;
      }
    }
    g.position.y = damp(g.position.y, groundY(g.position.x, g.position.z), 10, dt);
    animateHero(g, speed, dt);
  }
  if (!$('npcTalk').hidden) { const n = nearestNpc(); if (!n) { $('npcTalk').hidden = true; } }
}
function setupEarth() {
  const scene = P.scene; P.relics = [];
  const sign = textSprite('SPACE INC. HQ', '#ffd34d', 2.2); sign.position.set(P.hq.x, P.hq.top + 4, P.hq.z); scene.add(sign);
  const pad = textSprite('Launch pad: press L', '#5affc8', 0.9); pad.position.set(P.spawn.x, P.spawn.y + 7.4, P.spawn.z); scene.add(pad);
  const yr = textSprite('Earth City · 2964', '#ffffff', 0.9); yr.position.set(P.spawn.x - 3, P.spawn.y + 6, P.spawn.z - 3); scene.add(yr);
  if (P.shop) { const sh = textSprite("Bo's Space Snacks", '#ff9a5a', 1.1); sh.position.set(P.shop.x, P.spawn.y + 7.5, P.shop.z + 3.6); scene.add(sh); }
  if (P.park) { const pk = textSprite('City Park', '#7fd36b', 0.9); pk.position.set(P.park.x, P.spawn.y + 4, P.park.z); scene.add(pk); }
  setupEarthPeople();
  const cols = ['#ffd34d', '#5affc8', '#ff8ac8', '#8ab4ff', '#ffa84d'];
  for (const r of P.relicSpots) {
    if (save.relics.includes(r.i)) continue;
    const g = new THREE.Group(), c = cols[r.i % cols.length];
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), stdMat(c, { emissive: c, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: c }));
    g.add(core, ring, glowSprite(c, 3, 0.7)); g.position.set(r.x, r.y + 0.4, r.z); scene.add(g);
    P.relics.push({ r, g, core, ring });
  }
}
function updateEarth(dt, time) {
  if (!P.relics) return;
  for (let k = P.relics.length - 1; k >= 0; k--) {
    const o = P.relics[k]; o.core.rotation.y += dt * 2; o.ring.rotation.x = time * 1.3; o.g.position.y = o.r.y + 0.4 + Math.sin(time * 2 + k) * 0.15;
    if (PL.deadT <= 0 && Math.hypot(PL.pos.x - o.r.x, PL.pos.y + 0.9 - o.g.position.y, PL.pos.z - o.r.z) < 1.6) {
      P.scene.remove(o.g); P.relics.splice(k, 1); save.relics.push(o.r.i);
      save.orbs += 2; addMineral(P.p.minerals[o.r.i % 4], 5); SFX.orb();
      P.parts.burst(o.r.x, o.r.y + 0.4, o.r.z, '#ffd34d', 24, 3);
      const n = save.relics.length, all = EARTH_RELICS.length;
      toast(`Found an Earth relic: ${EARTH_RELICS[o.r.i]}! (${n}/${all}) +2 Enchant orbs`, 'gold');
      if (n === all) { save.orbs += 10; setTimeout(() => toast('You found every Earth relic! Space Inc. gives you 10 bonus Enchant orbs!', 'gold'), 1800); }
      writeSave();
    }
  }
}

const ICON_KIND = { [B.TOP]: 'grass', [B.SOIL]: 'dirt', [B.ROCK]: 'rock', [B.WOOD]: 'wood', [B.CAP]: 'cap', [B.PLANKS]: 'wood', [B.BRICKS]: 'panel', [B.GLASS]: 'glass', [B.GLOW]: 'glow' };
function blockIcon(t) { return drawIcon(ICON_KIND[t] || 'rock', blockSwatch(t)); }
function blockSwatch(t) {
  const th = P ? P.p.theme : THEMES[0];
  return { [B.TOP]: th.top, [B.SOIL]: th.soil, [B.ROCK]: th.rock, [B.WOOD]: th.wood, [B.CAP]: th.cap, [B.PLANKS]: shade(th.wood === '#fff4f8' ? '#e8b48a' : th.wood, 1.5), [B.BRICKS]: shade(th.rock, 1.4), [B.GLASS]: '#bfe9ff', [B.GLOW]: '#ffe680' }[t] || '#888';
}

const _m4 = new THREE.Matrix4(), _col = new THREE.Color();
/* ---------- smooth terrain (surface nets over the dig grid) + rounded building pieces ---------- */
const BUILT = new Set([B.PLANKS, B.BRICKS, B.GLASS, B.GLOW]);
const isTerrain = t => t !== 0 && !BUILT.has(t);
const CH = 16, NCH = W / CH;
function terrainColor(t, th) {
  if (t >= B.ORE) return { c: oreHex(P.p.minerals[t - B.ORE]), glow: 0.75 };
  return { [B.TOP]: { c: th.top, glow: 0 }, [B.SOIL]: { c: th.soil, glow: 0 }, [B.ROCK]: { c: th.rock, glow: 0 }, [B.CORE]: { c: '#1a1820', glow: 0 }, [B.WOOD]: { c: th.wood, glow: 0 }, [B.CAP]: { c: th.cap, glow: 0.35 } }[t] || { c: '#888', glow: 0 };
}
const PRIORITY = t => t >= B.ORE ? 9 : t === B.CAP ? 8 : t === B.WOOD ? 7 : t === B.TOP ? 6 : t === B.SOIL ? 4 : t === B.ROCK ? 3 : 1;
function buildMaterials() {
  const th = P.p.theme, mats = {};
  const terrain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
  terrain.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float glow;\nattribute float kind;\nvarying float vGlow;\nvarying float vKind;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow; vKind = kind; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'varying float vGlow;\nvarying float vKind;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + SURFACE_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 sdTint; float sdH = surfaceDetail(vWP, vWN, vKind, length(vViewPosition), sdTint); diffuseColor.rgb *= sdTint;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (sdH - 0.5) * 0.25, 0.05, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float hx = dFdx(sdH), hy = dFdy(sdH); vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); vec3 gr = sign(det) * (hx * r1 + hy * r2); normal = normalize(abs(det) * normal - gr * 0.9); }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow;');
  };
  terrain.extensions = { derivatives: true };
  mats.terrain = terrain;
  mats.build = terrain.clone(); mats.build.onBeforeCompile = terrain.onBeforeCompile; mats.build.extensions = { derivatives: true }; mats.build.roughness = 0.42; mats.build.metalness = 0.25;
  mats.glass = new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.45, roughness: 0.04, metalness: 0.3, depthWrite: false, envMap: ITEM_ENV, envMapIntensity: 1.2 });
  mats.glass.onBeforeCompile = sh => { // window frames and a sky-coloured sheen
    sh.uniforms.skyC = { value: new THREE.Color(th.skyTop) };
    sh.vertexShader = 'varying vec3 vWP2;\nvarying vec3 vWN2;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN2 = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform vec3 skyC;\nvarying vec3 vWP2;\nvarying vec3 vWN2;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 an2 = abs(vWN2); vec2 wuv = an2.x > an2.y && an2.x > an2.z ? vWP2.zy : (an2.y > an2.z ? vWP2.xz : vWP2.xy);
      vec2 wg = abs(fract(wuv * vec2(1.0, 0.5)) - 0.5); float frame = smoothstep(0.43, 0.47, max(wg.x, wg.y));
      float sheen = smoothstep(0.2, 0.0, abs(fract((wuv.x + wuv.y) * 0.35) - 0.5) - 0.3);
      diffuseColor.rgb = mix(mix(diffuseColor.rgb, skyC * 1.3, 0.35) + sheen * 0.25, vec3(0.92, 0.95, 1.0), frame);
      diffuseColor.a = mix(diffuseColor.a, 0.95, frame);`);
  };
  P.texs = []; return mats;
}
// smoothed density: solid terrain = 1, air or building piece = 0, blurred a little so hills roll
const LAYERS = {
  terrain: { test: t => isTerrain(t), floor: 1 },
  build: { test: t => t === B.PLANKS || t === B.BRICKS || t === B.GLOW, floor: 0 },
  glass: { test: t => t === B.GLASS, floor: 0 },
};
let LAYER = LAYERS.terrain;
function densityAt(x, y, z) {
  if (y < 0) return LAYER.floor; if (y >= H || x < 0 || z < 0 || x >= W || z >= D) return 0;
  return LAYER.test(P.world[idx(x, y, z)]) ? 1 : 0;
}
function pieceColor(t) {
  const th = P.p.theme;
  if (t === B.PLANKS) return { c: th.wood === '#fff4f8' ? '#e8b48a' : shade(th.wood, 1.6), glow: 0 };
  if (t === B.BRICKS) return { c: shade(th.rock, 1.8), glow: 0.05 };
  if (t === B.GLOW) return { c: '#ffe680', glow: 1.0 };
  return { c: '#bfe9ff', glow: 0.1 };
}
function meshChunk(ci, cj, layerName = 'terrain') {
  LAYER = LAYERS[layerName];
  const th = P.p.theme, x0 = ci * CH, z0 = cj * CH;
  // smoothed density over voxels [x0-2, x0+CH+1] x [-2, H] x [z0-2, z0+CH+1]
  const SX = CH + 4, SY = H + 3, SZ = CH + 4, ox = x0 - 2, oy = -2, oz = z0 - 2;
  const raw = new Float32Array(SX * SY * SZ), sd = new Float32Array(SX * SY * SZ), I = (x, y, z) => (x - ox) + (z - oz) * SX + (y - oy) * SX * SZ;
  for (let y = oy; y < oy + SY; y++) for (let z = oz; z < oz + SZ; z++) for (let x = ox; x < ox + SX; x++) raw[I(x, y, z)] = densityAt(x, y, z);
  const R = (x, y, z) => (x < ox || z < oz || y < oy || x >= ox + SX || z >= oz + SZ || y >= oy + SY) ? densityAt(x, y, z) : raw[I(x, y, z)];
  for (let y = oy + 1; y < oy + SY - 1; y++) for (let z = oz + 1; z < oz + SZ - 1; z++) for (let x = ox + 1; x < ox + SX - 1; x++) {
    let s = R(x, y, z) * 12, n = 12;
    s += R(x + 1, y, z) + R(x - 1, y, z) + R(x, y + 1, z) + R(x, y - 1, z) + R(x, y, z + 1) + R(x, y, z - 1); n += 6;
    sd[I(x, y, z)] = 0.5 * R(x, y, z) + 0.5 * s / n;
  }
  const S = (x, y, z) => (x <= ox || z <= oz || y <= oy || x >= ox + SX - 1 || z >= oz + SZ - 1 || y >= oy + SY - 1) ? densityAt(x, y, z) : sd[I(x, y, z)];
  const solid = (x, y, z) => densityAt(x, y, z) > 0.5;
  // cell vertices: cell (cx,cy,cz) spans voxel centers cx..cx+1
  const CX = CH + 1, CY = H + 1, cx0 = x0 - 1, cy0 = -1, cz0 = z0 - 1;
  const vid = new Int32Array(CX * CY * CX).fill(-1), CI = (x, y, z) => (x - cx0) + (z - cz0) * CX + (y - cy0) * CX * CX;
  const pos = [], nor = [], col = [], glow = [], kind = [], tc = new THREE.Color();
  const cornerVal = new Float32Array(8);
  function cellVertex(cx, cy, cz) {
    const k = CI(cx, cy, cz); if (vid[k] !== -1) return vid[k];
    let inside = 0;
    for (let i = 0; i < 8; i++) { const v = S(cx + (i & 1), cy + ((i >> 1) & 1), cz + ((i >> 2) & 1)); cornerVal[i] = v; if (solid(cx + (i & 1), cy + ((i >> 1) & 1), cz + ((i >> 2) & 1))) inside++; }
    if (inside === 0 || inside === 8) return -1;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      const va = cornerVal[a], vb = cornerVal[b]; if ((va > 0.5) === (vb > 0.5)) continue;
      const t = clamp((0.5 - va) / (vb - va), 0.1, 0.9);
      px += (a & 1) + (((b & 1) - (a & 1)) * t); py += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); pz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); n++;
    }
    if (!n) { px = py = pz = 0.5; n = 1; }
    const wx = cx + 0.5 + px / n, wy = cy + 0.5 + py / n, wz = cz + 0.5 + pz / n;
    // normal from density gradient
    const gx = (cornerVal[1] + cornerVal[3] + cornerVal[5] + cornerVal[7]) - (cornerVal[0] + cornerVal[2] + cornerVal[4] + cornerVal[6]);
    const gy = (cornerVal[2] + cornerVal[3] + cornerVal[6] + cornerVal[7]) - (cornerVal[0] + cornerVal[1] + cornerVal[4] + cornerVal[5]);
    const gz = (cornerVal[4] + cornerVal[5] + cornerVal[6] + cornerVal[7]) - (cornerVal[0] + cornerVal[1] + cornerVal[2] + cornerVal[3]);
    const gl = Math.hypot(gx, gy, gz) || 1;
    // colour: most important solid material touching this cell
    let best = 0, bp = -1;
    for (let i = 0; i < 8; i++) { const x = cx + (i & 1), y = cy + ((i >> 1) & 1), z = cz + ((i >> 2) & 1); const t = y < 0 ? B.CORE : getB(x, y, z); if (!LAYER.test(t)) continue; const pr = PRIORITY(t); if (pr > bp) { bp = pr; best = t; } }
    const tcInfo = layerName === 'terrain' ? terrainColor(best || B.ROCK, th) : pieceColor(best);
    tc.set(tcInfo.c); let kk = layerName === 'terrain' ? 0.86 + 0.26 * vnoise3(wx * 0.35, wy * 0.35, wz * 0.35, P.p.seed + 5) : 1;
    if (best === B.TOP && -gy / gl < 0.35) kk *= 0.86; // steep grass slopes a bit darker
    if (layerName === 'terrain' && tcInfo.glow < 0.3) { const top = colTop(Math.floor(wx), Math.floor(wz)); if (wy < top - 1.5) kk *= clamp(1 - (top - 1.5 - wy) * 0.14, 0.22, 1); } // caves get darker deeper in
    tc.convertSRGBToLinear(); tc.multiplyScalar(kk);
    const id = pos.length / 3; pos.push(wx, wy, wz); nor.push(-gx / gl, -gy / gl, -gz / gl); col.push(tc.r, tc.g, tc.b); glow.push(tcInfo.glow); kind.push(SURFACE_KIND[best] ?? (best >= B.ORE ? 3 : 2));
    vid[k] = id; return id;
  }
  const idxs = [];
  const quad = (a, b, c, d, nx, ny, nz) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // wind so the face points from solid to air
    const ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2];
    const bx = pos[c * 3] - pos[a * 3], by = pos[c * 3 + 1] - pos[a * 3 + 1], bz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
    if (fx * nx + fy * ny + fz * nz >= 0) idxs.push(a, b, c, a, c, d); else idxs.push(a, c, b, a, d, c);
  };
  const xs = ci === 0 ? x0 - 1 : x0, zs = cj === 0 ? z0 - 1 : z0;
  for (let y = -1; y < H; y++) for (let z = zs; z < z0 + CH; z++) for (let x = xs; x < x0 + CH; x++) {
    const s0 = solid(x, y, z);
    if (z >= z0 && y >= 0 && solid(x + 1, y, z) !== s0) { const sg = s0 ? 1 : -1; quad(cellVertex(x, y - 1, z - 1), cellVertex(x, y, z - 1), cellVertex(x, y, z), cellVertex(x, y - 1, z), sg, 0, 0); }
    if (x >= x0 && z >= z0 && solid(x, y + 1, z) !== s0) { const sg = s0 ? 1 : -1; quad(cellVertex(x - 1, y, z - 1), cellVertex(x, y, z - 1), cellVertex(x, y, z), cellVertex(x - 1, y, z), 0, sg, 0); }
    if (x >= x0 && y >= 0 && solid(x, y, z + 1) !== s0) { const sg = s0 ? 1 : -1; quad(cellVertex(x - 1, y - 1, z), cellVertex(x, y - 1, z), cellVertex(x, y, z), cellVertex(x - 1, y, z), 0, 0, sg); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1)); g.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1)); g.setIndex(idxs);
  g.computeBoundingSphere();
  const key = layerName + ci + ',' + cj, old = P.chunks[key];
  if (old) { P.scene.remove(old); old.geometry.dispose(); delete P.chunks[key]; }
  if (!idxs.length) return;
  const m = new THREE.Mesh(g, P.mats[layerName]); m.castShadow = layerName !== 'glass'; m.receiveShadow = true; if (layerName === 'glass') m.renderOrder = 2; P.scene.add(m); P.chunks[key] = m;
}
function colTop(x, z) {
  if (!P.colTop) P.colTop = new Int16Array(W * D).fill(-999);
  x = clamp(x, 0, W - 1); z = clamp(z, 0, D - 1); const k = x + z * W;
  if (P.colTop[k] === -999) { let y = H - 1; while (y > 0 && !isTerrain(getB(x, y, z))) y--; P.colTop[k] = y + 1; }
  return P.colTop[k];
}
function rebuildMeshes(x, z) {
  if (!P.chunks) P.chunks = {};
  P.colTop = null;
  const layers = ['terrain', 'build', 'glass'];
  if (x === undefined) { for (let cj = 0; cj < NCH; cj++) for (let ci = 0; ci < NCH; ci++) layers.forEach(l => meshChunk(ci, cj, l)); }
  else {
    const set = new Set();
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const cx = Math.floor((x + dx) / CH), cz = Math.floor((z + dz) / CH); if (cx >= 0 && cz >= 0 && cx < NCH && cz < NCH) set.add(cx + ',' + cz); }
    set.forEach(k => { const [a, b] = k.split(','); layers.forEach(l => meshChunk(+a, +b, l)); });
  }
  buildCrystals();
}

/* Ore crystals: every ore spot that touches open air grows a little cluster of glowing crystals in the mineral's color. */
const CRYSTAL_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function crystalGeometry() {
  const g = new THREE.CylinderGeometry(0.07, 0.11, 0.5, 6, 1); g.translate(0, 0.25, 0);
  const tip = new THREE.ConeGeometry(0.07, 0.18, 6, 1); tip.translate(0, 0.59, 0);
  const merged = new THREE.BufferGeometry(), parts = [g.toNonIndexed(), tip.toNonIndexed()];
  const pos = [], nor = [];
  for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return merged;
}
function buildCrystals() {
  if (!P || !P.world) return;
  if (!P.crystalGeo) {
    P.crystalGeo = crystalGeometry();
    P.crystalMat = itemSurface(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0, flatShading: true }), 'gem');
    P.crystalMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance += vColor * 0.55;\n#endif'); };
  }
  const spots = [];
  for (let y = 1; y < H - 1; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const t = P.world[idx(x, y, z)]; if (t < B.ORE) continue;
    for (let d = 0; d < 6; d++) { const [dx, dy, dz] = CRYSTAL_DIRS[d], nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D || ny < 0 || ny >= H || P.world[idx(nx, ny, nz)] !== B.AIR) continue;
      spots.push(x, y, z, d, t); }
  }
  const n = spots.length / 5 * 2;
  if (P.crystals) { P.scene.remove(P.crystals); P.crystals.dispose && P.crystals.dispose(); }
  if (!n) { P.crystals = null; return; }
  const im = new THREE.InstancedMesh(P.crystalGeo, P.crystalMat, n); im.castShadow = false; im.receiveShadow = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), up = new V3(0, 1, 0), nrm = new V3(), pos = new V3(), sc = new V3(), axis = new V3(), col = new THREE.Color();
  let k = 0;
  for (let i = 0; i < spots.length; i += 5) {
    const x = spots[i], y = spots[i + 1], z = spots[i + 2], d = spots[i + 3], t = spots[i + 4], [dx, dy, dz] = CRYSTAL_DIRS[d];
    nrm.set(dx, dy, dz); col.set(oreHex(P.p.minerals[t - B.ORE]));
    let h = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (d * 2654435761)) >>> 0;
    const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    for (let c = 0; c < 2; c++) {
      // spread the crystals over the face, tilt them a bit, sizes vary
      const u = (rnd() - 0.5) * 0.6, v = (rnd() - 0.5) * 0.6;
      pos.set(x + 0.5 + dx * 0.32, y + 0.5 + dy * 0.32, z + 0.5 + dz * 0.32);
      if (dx) pos.add(axis.set(0, u, v)); else if (dy) pos.add(axis.set(u, 0, v)); else pos.add(axis.set(u, v, 0));
      q.setFromUnitVectors(up, nrm);
      axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); q2.setFromAxisAngle(axis, 0.25 + rnd() * 0.35); q.premultiply(q2);
      const s = c === 0 ? 1.15 + rnd() * 0.35 : 0.65 + rnd() * 0.4; sc.set(s, s, s);
      m.compose(pos, q, sc); im.setMatrixAt(k, m); im.setColorAt(k, col); k++;
    }
  }
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  P.scene.add(im); P.crystals = im;
}

function skyMaterial(top, bot) {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { a: { value: linCol(top) }, b: { value: linCol(bot) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 a; uniform vec3 b; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(b,a,h),1.0); }' });
}

function enterPlanet(p, landNormal) {
  if (P) disposePlanet();
  const th = p.theme, scene = new THREE.Scene();
  P = { p, scene, meshes: {}, mats: null, world: null, mobs: [], drops: [], orbs: [], bolts: [], helpers: [], villagers: [], remote: new Map(), boss: null, landNormal: landNormal || new V3(0, 1, 0), t: 0, giftT: {}, spawnT: 5, dome: null };
  genWorld(); P.mats = buildMaterials(); rebuildMeshes();
  // sky, light, fog
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMaterial(th.skyTop, th.skyBot)); scene.add(sky); P.sky = sky;
  scene.fog = ['ocean', 'tropic'].includes(th.key) ? new THREE.Fog(th.skyBot, 45, 170) : new THREE.Fog(th.skyBot, 32, 110);
  scene.add(new THREE.HemisphereLight(th.skyTop, th.soil, 0.62));
  scene.add(new THREE.AmbientLight(th.skyBot, 0.14));
  const sun = new THREE.DirectionalLight(0xffeccc, 1.25); sun.position.set(W / 2 + 40, 80, D / 2 + 25); sun.target.position.set(W / 2, 0, D / 2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 220 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target); P.sun = sun;
  const sunS = glowSprite('#fff3c0', 90, 0.9); sunS.position.set(W / 2 + 300, 260, D / 2 + 190); sunS.material.fog = false; scene.add(sunS);
  const moonCol = PLANETS[(p.id + 3) % PLANETS.length].theme.ramp[2];
  const moon = new THREE.Mesh(new THREE.SphereGeometry(55, 32, 20), new THREE.MeshBasicMaterial({ color: moonCol, fog: false })); moon.position.set(W / 2 - 260, 170, D / 2 - 330); scene.add(moon);
  if (['lava', 'crystal', 'toxic', 'storm', 'shadow', 'neon', 'aurora'].includes(th.key)) { // stars in dark skies
    const N = 600, pos = new Float32Array(N * 3), r = mulberry32(p.seed); for (let i = 0; i < N; i++) { const u = r() * 0.9 + 0.1, a = r() * 6.283, s2 = Math.sqrt(1 - u * u); pos.set([s2 * Math.cos(a) * 500 + W / 2, u * 500, s2 * Math.sin(a) * 500 + D / 2], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xffffff, fog: false })));
  }
  P.clouds = [];
  for (let i = 0; i < 14; i++) { const c = glowSprite('#ffffff', 1, 0.5); c.material.blending = THREE.NormalBlending; c.scale.set(30 + Math.random() * 30, 8 + Math.random() * 5, 1); c.position.set(Math.random() * (W + 96) - 48, 48 + Math.random() * 10, Math.random() * 160 - 48); scene.add(c); P.clouds.push(c); }
  if (P.liq && !P.liq.dmg) { const lm = makeWater(P.liq, th); scene.add(lm); P.liqMesh = lm; }
  else if (P.liq) { const lm = new THREE.Mesh(new THREE.PlaneGeometry(W + 120, D + 120), new THREE.MeshLambertMaterial({ color: P.liq.color, transparent: true, opacity: P.liq.dmg ? 0.92 : 0.7, emissive: P.liq.dmg ? new THREE.Color(P.liq.color) : new THREE.Color('#000'), emissiveIntensity: P.liq.dmg ? 0.8 : 0, side: THREE.DoubleSide })); lm.rotation.x = -Math.PI / 2; lm.position.set(W / 2, P.liq.y, D / 2); scene.add(lm); P.liqMesh = lm; }
  spawnFish(); spawnCritters();
  // rocket on the pad + workshop table
  const rocket = buildRocket(); rocket.scale.setScalar(0.85); rocket.position.set(P.spawn.x, P.spawn.y + 3.2 * 0.85 + 0.1, P.spawn.z); rocket.userData.flame.visible = rocket.userData.inner.visible = rocket.userData.eg.visible = false; scene.add(rocket); P.rocket = rocket;
  const table = new THREE.Group(); const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.16, 40), stdMat('#4a3a6a', { metalness: 0.5, roughness: 0.3 })); tt.position.y = 0.9; const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 0.82, 28), stdMat('#2a2040', { metalness: 0.4 })); tl.position.y = 0.41; const rune = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 10, 32), new THREE.MeshBasicMaterial({ color: '#b48cff' })); rune.rotation.x = Math.PI / 2; rune.position.y = 1.03; table.add(tt, tl, rune, glowSprite('#b48cff', 2.5, 0.8)); table.children[3].position.y = 1.3; table.position.set(P.spawn.x + 3.2, P.spawn.y, P.spawn.z - 0.5); table.traverse(o => o.castShadow = true); scene.add(table); P.table = table;
  const ttag = textSprite('Workshop: press C', '#d9c2ff', 0.5); ttag.position.set(table.position.x, table.position.y + 2.2, table.position.z); scene.add(ttag);
  // player
  PL.pos.set(P.spawn.x + 2.2, P.spawn.y, P.spawn.z + 2.2); PL.vel.set(0, 0, 0); PL.yaw = Math.PI * 0.75; PL.pitch = -0.1; PL.hp = PL.maxHp; PL.deadT = 0;
  PL.model = buildHero(HEROES[save.hero]); scene.add(PL.model);
  scene.add(fpsCam); fpsCam.add(toolModel.g);
  P.highlight = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide })); P.highlight.renderOrder = 20; P.highlight.visible = false; scene.add(P.highlight);
  P.crack = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ color: '#5affc8', transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide })); P.crack.renderOrder = 21; scene.add(P.crack);
  P.parts = makeParticles(scene); P.beam = makeBeam(scene);
  // monsters, boss, village, helpers
  if (!p.earth) for (let i = 0; i < 16; i++) spawnMob(true);
  if (p.boss) setupVillage();
  spawnUltra();
  if (p.earth) setupEarth();
  spawnHelperFollowers();
  // bookkeeping
  if (!p.earth && !save.visited.includes(p.id)) { save.visited.push(p.id); toast(`New planet explored! (${save.visited.length}/${PLANETS.length})`, 'good'); if (allVisited()) setTimeout(() => toast('You explored every planet! The Edge Gate is now OPEN.', 'gold'), 1500); }
  writeSave();
  mode = 'planet'; $('spaceHud').hidden = true; $('planetHud').hidden = false; $('planetLbl').textContent = p.earth ? `Earth · Year 2964 · Relics ${save.relics.length}/${EARTH_RELICS.length}` : `${p.name} · ${p.theme.label} · Tier ${p.tier}`;
  ['mk1', 'mk2', 'mk3'].forEach(id => $(id).hidden = true);
  renderHotbar(); updateGearLine(); setMusicIntensity(1); SFX.land(); onResize(); setHelp();
  if (p.earth) toast(`Welcome home to Earth! Explore the city, visit Space Inc. HQ and hunt for ${EARTH_RELICS.length} hidden relics. Your rocket on the launch pad takes you back to space.`, 'gold'); else
  toast(`Welcome to ${p.name}! Look for caves to find glowing ore. Hold left click to fire your mining laser, right click builds.`, 'gold');
}
function disposePlanet() {
  crewEnd(); BUILD.on = false; buildHud(); $("npcTalk").hidden = true;
  $("underTint").hidden = true;
  if (!P) return;
  fpsCam.remove(toolModel.g); P.scene.remove(fpsCam);
  P.scene.traverse(o => { if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map !== GLOW && !P.texs.includes(m.map) && m.map.isCanvasTexture && o.isSprite) m.map.dispose(); m.dispose(); }); } });
  for (const k in P.mats) P.mats[k].dispose();
  P.texs.forEach(t => t.dispose());
  P = null;
}
// R: radio your rocket, it flies over to you and you blast off
function radioShip() {
  if (!P || P.radio || PL.deadT > 0) return;
  const r = P.rocket; if (!r) { leavePlanet(); return; }
  const to = new V3(PL.pos.x + Math.sin(PL.yaw) * 2.5, 0, PL.pos.z + Math.cos(PL.yaw) * 2.5); to.y = groundY(to.x, to.z) + 3.2 * 0.85 + 0.1;
  P.radio = { t: 0, from: r.position.clone(), to, dur: r.position.distanceTo(to) < 4 ? 0.6 : 2.4 };
  r.userData.flame.visible = r.userData.inner.visible = r.userData.eg.visible = true;
  toast('📻 Radioing your rocket… here it comes!', 'gold'); SFX.zap();
}
function updateRadio(dt) {
  const R = P.radio; if (!R) return; R.t += dt; const k = Math.min(1, R.t / R.dur), e = k * k * (3 - 2 * k);
  const r = P.rocket; r.position.lerpVectors(R.from, R.to, e); r.position.y += Math.sin(k * Math.PI) * 14; r.rotation.y += dt * 2;
  if (k >= 1 && !R.done) { R.done = true; leavePlanet(); }
}
/* ---------- 1.6.7 realistic water: moving waves, sky reflections, sun sparkles, clear shallows and shore foam ---------- */
function makeWater(liq, th) {
  // terrain height map so the water knows how deep it is everywhere
  const data = new Uint8Array(W * D); for (let i = 0; i < W * D; i++) data[i] = Math.max(0, Math.min(255, P.hm[i] * 4));
  const hmTex = new THREE.DataTexture(data, W, D, THREE.LuminanceFormat, THREE.UnsignedByteType); hmTex.magFilter = hmTex.minFilter = THREE.LinearFilter; hmTex.needsUpdate = true;
  const base = new THREE.Color(liq.color), deep = base.clone().multiplyScalar(0.22), shallow = base.clone().lerp(new THREE.Color('#8ff0e8'), 0.3);
  const sunDir = new THREE.Vector3(300, 260, 190).normalize();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      t: { value: 0 }, hm: { value: hmTex }, wl: { value: liq.y }, size: { value: new THREE.Vector2(W, D) },
      deep: { value: deep.convertSRGBToLinear() }, shallow: { value: shallow.convertSRGBToLinear() },
      skyTop: { value: linCol(th.skyTop) }, skyBot: { value: linCol(th.skyBot) }, sunDir: { value: sunDir }, honey: { value: th.key === 'honey' ? 1 : 0 },
    }]),
    vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float t, wl, honey; uniform sampler2D hm; uniform vec2 size; uniform vec3 deep, shallow, skyTop, skyBot, sunDir; varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      float wh(vec2 p){ float h = 0.0;
        h += sin(dot(p, vec2(0.8, 0.6)) * 0.9 + t * 1.6) * 0.5; h += sin(dot(p, vec2(-0.5, 0.9)) * 1.7 + t * 2.1) * 0.25;
        h += sin(dot(p, vec2(0.3, -1.0)) * 3.1 + t * 2.9) * 0.12; h += sin(dot(p, vec2(-0.9, -0.4)) * 5.3 + t * 3.7) * 0.06;
        return h * mix(1.0, 0.25, honey); }
      void main(){
        vec2 p = vW.xz; float e = 0.08;
        float dist = length(cameraPosition - vW), amp = 0.35 * clamp(1.0 - dist / 90.0, 0.08, 1.0);
        vec3 n = normalize(vec3(-(wh(p + vec2(e, 0.0)) - wh(p - vec2(e, 0.0))) / (2.0 * e) * amp, 1.0, -(wh(p + vec2(0.0, e)) - wh(p - vec2(0.0, e))) / (2.0 * e) * amp));
        vec3 v = normalize(cameraPosition - vW); if (v.y < 0.0) n.y = -n.y;
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n); vec3 sky = mix(skyBot, skyTop, clamp(r.y * 2.5 + 0.25, 0.0, 1.0)) * 0.9;
        vec2 uv = p / size; float ground = texture2D(hm, uv).r * 255.0 / 4.0 + 1.0;
        vec2 ed = min(p, size - p); float inside = clamp(min(ed.x, ed.y) / 10.0, 0.0, 1.0);
        float depth = mix(8.0, wl - ground, inside);
        float dk = clamp(depth / 4.0, 0.0, 1.0);
        vec3 body = mix(shallow, deep, dk);
        float spec = (pow(max(dot(r, sunDir), 0.0), 300.0) * 2.2 + pow(max(dot(r, sunDir), 0.0), 40.0) * 0.12) * clamp(1.0 - dist / 120.0, 0.2, 1.0);
        float foamN = sin(p.x * 3.1 + t * 1.7) * sin(p.y * 2.7 - t * 1.3) * 0.5 + 0.5;
        float foam = smoothstep(0.7, 0.1, depth + sin(t * 1.5 + p.x * 0.4 + p.y * 0.3) * 0.25) * (0.55 + 0.45 * foamN) * inside * (1.0 - honey);
        vec3 col = mix(body, sky, fres * 0.6) + vec3(1.0, 0.95, 0.85) * spec;
        col = mix(col, vec3(0.95), foam);
        float a = clamp(mix(0.35, 0.93, dk) + fres * 0.4 + foam, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W + 400, D + 400, 1, 1), mat); m.rotation.x = -Math.PI / 2; m.position.set(W / 2, liq.y, D / 2); m.renderOrder = 2;
  return m;
}
function leavePlanet() {
  const p = P.p, n = P.landNormal; fadeTo(() => { disposePlanet(); if (p.earth) launchFromEarth(); else launchFromPlanet(p, n); enterSpaceMode(); toast(p.earth ? 'Liftoff from Space Inc.! Fly through the Edge Gate anytime to come home.' : 'Liftoff! Back to space.'); });
}

/* ---------- held tool ---------- */
const toolModel = (() => {
  const g = new THREE.Group(); g.position.set(0.36, -0.34, -0.62); g.rotation.set(0.04, -0.06, 0);
  // mining laser gun
  const gun = new THREE.Group();
  const shell = itemSurface(stdMat('#f2f5fa', { metalness: 0.55, roughness: 0.25 }), 'metal'), dark = itemSurface(stdMat('#4a5060', { metalness: 0.7, roughness: 0.35 }), 'grip');
  const emit = stdMat('#5affc8', { emissive: '#5affc8', emissiveIntensity: 1.4, roughness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 20), shell); body.rotation.x = Math.PI / 2; body.position.z = -0.05;
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), shell); back.position.z = 0.16;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 16), dark); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.36;
  const rings = []; for (const z of [-0.06, -0.16]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24), emit); r.position.z = z; rings.push(r); gun.add(r); }
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), emit); tip.position.z = -0.48;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 12), dark); grip.position.set(0, -0.12, 0.06); grip.rotation.x = -0.35;
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), emit); cell.rotation.z = Math.PI / 2; cell.position.set(0, 0.07, 0.02);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.18), shell); fin.position.set(0, 0.09, -0.12);
  gun.add(body, back, barrel, tip, grip, cell, fin);
  // sword blade (shown when attacking)
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.8, 4, 1), itemSurface(stdMat('#e6f2ff', { metalness: 0.9, roughness: 0.15, emissive: '#5ab4ff', emissiveIntensity: 0.15 }), 'metal')); blade.scale.set(1, 1, 0.35); blade.rotation.x = -Math.PI / 2; blade.position.z = -0.6; blade.visible = false;
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 12), itemSurface(stdMat('#7a4e2d'), 'leather')); hilt.rotation.x = Math.PI / 2; hilt.position.z = -0.05; blade.add(hilt); hilt.rotation.x = 0; hilt.position.set(0, -0.5, 0);
  g.add(gun, blade);
  return { g, gun, head: emit, tip, rings, blade, swing: 0, recoil: 0 };
})();
const _mz = new V3();
function laserMuzzle(out) {
  if (!PL.third) return toolModel.tip.getWorldPosition(out);
  return out.set(PL.pos.x + Math.cos(PL.yaw) * 0.4, PL.pos.y + 1.15, PL.pos.z - Math.sin(PL.yaw) * 0.4).addScaledVector(look, 0.5);
}
function makeBeam(scene) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); geo.translate(0, 0.5, 0);
  const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#5affc8', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const g = new THREE.Group(); g.add(outer, core); g.visible = false; scene.add(g);
  const spot = glowSprite('#5affc8', 1.2, 0.9); spot.visible = false; scene.add(spot);
  const flash = glowSprite('#5affc8', 0.35, 0.9); flash.visible = false; scene.add(flash);
  return { g, outer, core, spot, flash };
}
function updateBeam(on, end, color) {
  const bm = P.beam; bm.g.visible = bm.spot.visible = bm.flash.visible = on; if (!on) return;
  const start = laserMuzzle(_mz), dir = tmpB.subVectors(end, start), len = dir.length(); dir.normalize();
  bm.g.position.copy(start); bm.g.quaternion.setFromUnitVectors(AXY, dir);
  const w = 0.03 + Math.random() * 0.015; bm.outer.scale.set(w * 2.2, len, w * 2.2); bm.core.scale.set(w * 0.6, len, w * 0.6);
  bm.outer.material.color.set(color); bm.spot.material.color.set(color); bm.flash.material.color.set(color);
  bm.spot.position.copy(end); bm.spot.scale.setScalar(0.9 + Math.random() * 0.6);
  bm.flash.position.copy(start); bm.flash.scale.setScalar(0.25 + Math.random() * 0.2);
}
function updateToolModel(dt, attacking) {
  const lc = save.gear.tool ? MINERALS[save.gear.tool.mineral].hex : '#5affc8';
  toolModel.head.color.set(lc); toolModel.head.emissive.set(lc);
  toolModel.blade.material.color.set(save.gear.weapon ? MINERALS[save.gear.weapon.mineral].hex : '#cfe9ff');
  toolModel.gun.visible = !attacking; toolModel.blade.visible = attacking;
  if (toolModel.swing > 0) toolModel.swing = Math.max(0, toolModel.swing - dt * 4);
  const firing = !!PL.mining;
  toolModel.recoil = firing ? 0.012 + Math.random() * 0.01 : damp(toolModel.recoil, 0, 12, dt);
  toolModel.head.emissiveIntensity = firing ? 2.2 + Math.random() : 1.2;
  toolModel.rings.forEach((r, i) => r.rotation.z += dt * (firing ? 14 : 2) * (i ? -1 : 1));
  toolModel.g.rotation.x = 0.04 - Math.sin(toolModel.swing * Math.PI) * 1.1;
  toolModel.g.position.z = -0.62 + toolModel.recoil;
  toolModel.g.visible = !PL.third;
}

/* ---------- particles ---------- */
function makeParticles(scene) {
  const N = 600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true })); pts.frustumCulled = false; scene.add(pts);
  let head = 0; const c = new THREE.Color();
  return {
    burst(x, y, z, color, n = 14, spd = 4) { c.set(color).convertSRGBToLinear(); for (let k = 0; k < n; k++) { const i = head; head = (head + 1) % N; pos.set([x + Math.random() - 0.5, y + Math.random() - 0.5, z + Math.random() - 0.5], i * 3); vel.set([(Math.random() - 0.5) * spd, Math.random() * spd, (Math.random() - 0.5) * spd], i * 3); col.set([c.r, c.g, c.b], i * 3); life[i] = 0.8 + Math.random() * 0.5; } },
    update(dt) { for (let i = 0; i < N; i++) { if (life[i] <= 0) continue; life[i] -= dt; vel[i * 3 + 1] -= 14 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (life[i] <= 0) pos[i * 3 + 1] = -999; } geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; },
  };
}

/* ---------- voxel raycast (DDA) ---------- */
function raycastVoxel(o, d, maxD) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
  let tmx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity;
  let tmy = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity;
  let tmz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < 64 && t <= maxD; i++) {
    const b = getB(x, y, z); if (b) return { x, y, z, nx, ny, nz, b, t };
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}

/* ---------- player movement ---------- */
function collides(px, py, pz) {
  const r = 0.3, h = 1.75;
  for (let y = Math.floor(py); y <= Math.floor(py + h); y++) for (let z = Math.floor(pz - r); z <= Math.floor(pz + r); z++) for (let x = Math.floor(px - r); x <= Math.floor(px + r); x++) if (solidAt(x, y, z)) return true;
  if (P.boss && !P.boss.dead && Math.hypot(px - P.vc.x, pz - P.vc.z) < 10.6 && Math.hypot(PL.pos.x - P.vc.x, PL.pos.z - P.vc.z) >= 10.6) return true;
  return false;
}
function underground() { const top = groundY(PL.pos.x, PL.pos.z); return PL.pos.y + 1.7 < top - 2; }
function climbOut() {
  if (mode !== 'planet' || !P || PL.deadT > 0 || !underground()) return false;
  P.parts.burst(PL.pos.x, PL.pos.y + 1, PL.pos.z, '#5affc8', 20, 4);
  PL.pos.y = groundY(PL.pos.x, PL.pos.z) + 0.05; PL.vel.set(0, 0, 0);
  P.parts.burst(PL.pos.x, PL.pos.y + 1, PL.pos.z, '#5affc8', 30, 5); SFX.place(); toast('Whoosh! Back on the surface.', 'good');
  return true;
}
function movePlayer(dt) {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 7.6 : 5.2) * (PL.swimming ? 0.75 : 1);
  const sinY = Math.sin(PL.yaw), cosY = Math.cos(PL.yaw);
  let tx = (-sinY * f + cosY * s), tz = (-cosY * f - sinY * s); const l = Math.hypot(tx, tz) || 1; tx = tx / l * sp * (f || s ? 1 : 0); tz = tz / l * sp * (f || s ? 1 : 0);
  const k = PL.onGround ? 14 : 4; PL.vel.x = damp(PL.vel.x, tx, k, dt); PL.vel.z = damp(PL.vel.z, tz, k, dt);
  const g = P.p.theme.grav;
  // swimming: in a liquid you float, Space swims up, Ctrl / Q swims down, and W swims the way you look
  PL.swimming = !!(P.liq && PL.pos.y < P.liq.y - 0.35);
  if (PL.swimming) {
    if (f && Math.abs(PL.pitch) > 0.35) { const v = Math.sin(PL.pitch) * sp * f; PL.vel.y = damp(PL.vel.y, v, 4, dt); }
    let up = keys.Space ? 4.2 : 0; if (keys.ControlLeft || keys.ControlRight || keys.KeyQ) up = -4.2;
    if (up) PL.vel.y = damp(PL.vel.y, up, 5, dt);
    else if (!(f && Math.abs(PL.pitch) > 0.35)) PL.vel.y = damp(PL.vel.y, PL.pos.y + 1.4 > P.liq.y ? 0 : -0.9, 2.5, dt); // gently sink, bob at the surface
    PL.vel.x = damp(PL.vel.x, tx, 4, dt); PL.vel.z = damp(PL.vel.z, tz, 4, dt);
    // climb out onto the shore: swimming at the surface into a ledge pops you up
    if (keys.Space && PL.pos.y + 1.2 > P.liq.y && (f || s) && collides(PL.pos.x + tx * 0.06, PL.pos.y + 0.2, PL.pos.z + tz * 0.06)) PL.vel.y = 7.5;
  } else {
    PL.vel.y -= g * dt; if (PL.vel.y < -40) PL.vel.y = -40;
    if (keys.Space && PL.onGround) { PL.vel.y = 8.2; PL.onGround = false; }
  }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(PL.vel.x), Math.abs(PL.vel.y), Math.abs(PL.vel.z)) * dt / 0.3));
  const h = dt / steps; PL.onGround = false;
  for (let i = 0; i < steps; i++) {
    const canStep = PL.wasGround && PL.vel.y <= 0.1;
    PL.pos.x += PL.vel.x * h; if (collides(PL.pos.x, PL.pos.y, PL.pos.z)) { if (canStep && !collides(PL.pos.x, PL.pos.y + 1.05, PL.pos.z)) { PL.pos.y += 1.05; PL.stepT = 0.12; } else { PL.pos.x -= PL.vel.x * h; PL.vel.x = 0; } }
    PL.pos.z += PL.vel.z * h; if (collides(PL.pos.x, PL.pos.y, PL.pos.z)) { if (canStep && !collides(PL.pos.x, PL.pos.y + 1.05, PL.pos.z)) { PL.pos.y += 1.05; PL.stepT = 0.12; } else { PL.pos.z -= PL.vel.z * h; PL.vel.z = 0; } }
    PL.pos.y += PL.vel.y * h; if (collides(PL.pos.x, PL.pos.y, PL.pos.z)) { PL.pos.y -= PL.vel.y * h; if (PL.vel.y < 0) PL.onGround = true; PL.vel.y = 0; }
  }
  PL.wasGround = PL.onGround;
  if (PL.pos.y < -5) { PL.pos.set(P.spawn.x + 2, P.spawn.y + 1, P.spawn.z + 2); PL.vel.set(0, 0, 0); }
  // liquids
  PL.inLiquid = P.liq && PL.pos.y < P.liq.y - 0.2;
  if (PL.inLiquid && P.liq.dmg) { PL.liquidT -= dt; if (PL.liquidT <= 0) { PL.liquidT = 0.5; hurtPlayer(P.liq.dmg * 0.5, `Hot! Get out of the ${P.liq.name}!`); } }
  // air: your suit holds 20 seconds of air underwater
  const under = P.liq && PL.pos.y + 1.62 < P.liq.y;
  if (under) {
    PL.air = Math.max(0, (PL.air ?? 20) - dt);
    if (PL.air < 6 && !PL.airWarn) { PL.airWarn = true; toast('Running out of air! Swim up!'); }
    if (PL.air <= 0) { PL.liquidT -= dt; if (PL.liquidT <= 0) { PL.liquidT = 1; hurtPlayer(8, 'Out of air! Swim up!'); } }
  } else { PL.air = Math.min(20, (PL.air ?? 20) + dt * 8); if (PL.air > 10) PL.airWarn = false; }
  const ab = $('airBar'); if (ab) { ab.hidden = !(under || PL.air < 19.9); ab.firstElementChild.style.width = (PL.air / 20 * 100) + '%'; }
}

/* ---------- mining and building ---------- */
const eye = new V3(), look = new V3();
function blockHardness(b) { if (b >= B.ORE) return 1.4 + MINERALS[P.p.minerals[b - B.ORE]].tier * 0.35; return BLOCK_INFO[b] ? BLOCK_INFO[b].hard : 1; }
function breakBlock(hit) {
  const b = hit.b; setB(hit.x, hit.y, hit.z, 0); rebuildMeshes(hit.x, hit.z); SFX.brk();
  const color = b >= B.ORE ? MINERALS[P.p.minerals[b - B.ORE]].hex : blockSwatch(b);
  P.parts.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, color, 18);
  if (b >= B.ORE) {
    const m = MINERALS[P.p.minerals[b - B.ORE]], first = addMineral(m.id, 1);
    if (first) toast(`NEW MINERAL: ${m.name}! (tier ${m.tier}, ${mineralsFound()}/200 found)`, 'gold'); else pickupToast(`+1 ${m.name}`);
  } else { addBlock(b === B.TOP ? B.SOIL : b, 1); pickupToast(`+1 ${BLOCK_INFO[b === B.TOP ? B.SOIL : b].name}`); }
  renderHotbar(); queueSave();
}
function placeBlock(hit) {
  const t = HOTBAR[PL.sel]; if (!save.blocks[t]) { toast(`You have no ${BLOCK_INFO[t].name}. Mine or craft some!`, 'bad'); return; }
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (x < 0 || z < 0 || x >= W || z >= D || y < 1 || y >= H || getB(x, y, z)) return;
  setB(x, y, z, t);
  if (collides(PL.pos.x, PL.pos.y, PL.pos.z)) { setB(x, y, z, 0); return; }
  save.blocks[t]--; rebuildMeshes(x, z); SFX.place(); renderHotbar(); queueSave();
}
let saveT = 0; function queueSave() { saveT = 1.5; }

function updatePlanet(dt, time) {
  P.t += dt; const ctrl = !uiOpen() && PL.deadT <= 0;
  if (ctrl) {
    const lr = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0), ud = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
    PL.yaw += lr * 2.2 * dt; PL.pitch = clamp(PL.pitch + ud * 1.8 * dt, -1.5, 1.5);
    movePlayer(dt);
  }
  if (PL.deadT > 0) { PL.deadT -= dt; if (PL.deadT <= 0) respawnPlayer(); }
  // camera
  eye.set(PL.pos.x, PL.pos.y + 1.62, PL.pos.z);
  look.set(-Math.sin(PL.yaw) * Math.cos(PL.pitch), Math.sin(PL.pitch), -Math.cos(PL.yaw) * Math.cos(PL.pitch));
  fpsCam.rotation.set(PL.pitch, PL.yaw, 0);
  if (PL.third) {
    const back = tmpA.copy(look).multiplyScalar(-1), hit = raycastVoxel(eye, back, 4.5), dist = hit ? Math.max(0.6, hit.t - 0.3) : 4.5;
    fpsCam.position.copy(eye).addScaledVector(back, dist).y += 0.5;
  } else fpsCam.position.copy(eye);
  const camUnder = P.liq && fpsCam.position.y < P.liq.y;
  if (camUnder !== P.camUnder) { P.camUnder = camUnder; if (camUnder) { const fg = P.scene.fog; P.fogSave = P.fogSave || [fg.color.clone(), fg.near, fg.far]; fg.color.set(shade(P.liq.color, 0.55)); fg.near = 1; fg.far = P.liq.dmg ? 8 : 22; const ut = $('underTint'); ut.style.background = P.liq.color; ut.hidden = false; } else if (P.fogSave) { const fg = P.scene.fog; fg.color.copy(P.fogSave[0]); fg.near = P.fogSave[1]; fg.far = P.fogSave[2]; $('underTint').hidden = true; } }
  PL.model.visible = PL.third; PL.model.position.copy(PL.pos); PL.model.rotation.y = PL.yaw + Math.PI;
  PL.model.userData.swim = PL.swimming; animateHero(PL.model, Math.hypot(PL.vel.x, PL.vel.z), dt);
  // targeting
  const hit = raycastVoxel(eye, look, 6);
  buildUpdate(hit, ctrl);
  if (hit && ctrl && !BUILD.on) { P.highlight.visible = true; P.highlight.position.set(hit.x + 0.5 + hit.nx * 0.52, hit.y + 0.5 + hit.ny * 0.52, hit.z + 0.5 + hit.nz * 0.52); tmpB.copy(P.highlight.position).add(tmpC.set(hit.nx, hit.ny, hit.nz)); P.highlight.lookAt(tmpB); } else P.highlight.visible = false;
  // attack or mine
  PL.atkCD -= dt; PL.fireCD -= dt;
  const target = ctrl ? aimedEnemy(eye, look, 4.2) : null;
  let attacking = !!target;
  if (ctrl && mouse.L && (locked || lockFailed) && BUILD.on && !target) { mouse.L = false; buildPlace(); PL.mining = null; }
  else if (ctrl && mouse.L && (locked || lockFailed) && PL.tool === 'gun') { PL.mining = null; if (PL.fireCD <= 0) { PL.fireCD = 0.16; fireLaser(eye, look); } }
  else if (ctrl && mouse.L && (locked || lockFailed) && PL.tool === 'sword' && !target) { PL.mining = null; if (PL.atkCD <= 0) { PL.atkCD = 0.42; toolModel.swing = 1; PL.model.userData.swing = 0.25; SFX.swing(); } }
  else if (ctrl && mouse.L && (locked || lockFailed)) {
    if (target) { if (PL.atkCD <= 0) { PL.atkCD = 0.42; toolModel.swing = 1; PL.model.userData.swing = 0.25; SFX.swing(); damageEnemy(target, gearStats().weaponDmg, look); } PL.mining = null; }
    else if (hit && hit.b !== B.CORE) {
      const key = hit.x + ',' + hit.y + ',' + hit.z;
      if (!PL.mining || PL.mining.key !== key) PL.mining = { key, prog: 0, hit, snd: 0 };
      const need = blockHardness(hit.b) / gearStats().toolPower;
      PL.mining.prog += dt / need; PL.mining.snd -= dt; if (PL.mining.snd <= 0) { PL.mining.snd = 0.12; SFX.mine(); P.parts.burst(hit.x + 0.5 + hit.nx * 0.5, hit.y + 0.5 + hit.ny * 0.5, hit.z + 0.5 + hit.nz * 0.5, hit.b >= B.ORE ? MINERALS[P.p.minerals[hit.b - B.ORE]].hex : blockSwatch(hit.b), 3, 2); }
      if (PL.mining.prog >= 1) { breakBlock(hit); PL.mining = null; }
    } else PL.mining = null;
  } else PL.mining = null;
  if (ctrl && mouse.R) { mouse.R = false; if (BUILD.on) buildRemove(hit); else if (hit) placeBlock(hit); }
  if (ctrl && keys.KeyF && PL.fireCD <= 0) { PL.fireCD = 0.16; fireLaser(eye, look); }
  const ring = $('mineRing'); if (PL.mining) { ring.hidden = false; ring.style.setProperty('--p', (PL.mining.prog * 100) + '%'); P.crack.visible = true; P.crack.position.copy(P.highlight.position); P.crack.quaternion.copy(P.highlight.quaternion); P.crack.scale.setScalar(0.2 + PL.mining.prog); P.crack.material.opacity = 0.3 + PL.mining.prog * 0.5; } else { ring.hidden = true; P.crack.visible = false; }
  updateToolModel(dt, attacking || PL.tool === 'sword');
  if (PL.mining && hit) { const lc = save.gear.tool ? MINERALS[save.gear.tool.mineral].hex : '#5affc8'; updateBeam(true, tmpC.set(hit.x + 0.5 + hit.nx * 0.5, hit.y + 0.5 + hit.ny * 0.5, hit.z + 0.5 + hit.nz * 0.5), lc); } else updateBeam(false);
  // world life
  updateMobs(dt, time); updateBoss(dt, time); updateBolts(dt); updateOrbs(dt); updateDrops(dt, time); updateVillagers(dt, time); updateHelpers(dt, time); updateRemotePlayers(dt); updateRadio(dt); updateUltra(dt, time); updateCrew(dt); updateFish(dt, time); updateCritters(dt, time); if (P.p.earth) { updateEarth(dt, time); updateEarthPeople(dt); $('planetLbl').textContent = `Earth · Year 2964 · Relics ${save.relics.length}/${EARTH_RELICS.length}`; }
  P.parts.update(dt);
  P.clouds.forEach((c, i) => { c.position.x += dt * (0.8 + i * 0.05); if (c.position.x > W + 56) c.position.x = -60; });
  if (P.liqMesh) { P.liqMesh.position.y = P.liq.y + Math.sin(time * 1.3) * 0.05; if (P.liqMesh.material.uniforms) P.liqMesh.material.uniforms.t.value = time; }
  P.sky.position.copy(fpsCam.position);
  // big worlds: the sun's shadow box follows you, and far-away land isn't drawn
  if (P.sun) { const sx = Math.round(PL.pos.x / 8) * 8, sz = Math.round(PL.pos.z / 8) * 8; P.sun.target.position.set(sx, 0, sz); P.sun.position.set(sx + 40, 80, sz + 25); }
  P.cullT = (P.cullT || 0) - dt;
  if (P.cullT <= 0 && P.chunks) { P.cullT = 0.4; for (const k in P.chunks) { const m = P.chunks[k]; if (!m) continue; const mm = /(\d+),(\d+)$/.exec(k), a = +mm[1], b = +mm[2]; m.visible = Math.hypot((a + 0.5) * CH - PL.pos.x, (b + 0.5) * CH - PL.pos.z) < 108; } }
  // regen
  const regen = (time - PL.lastHit > 4 ? 3 : 0) + helperCount('farmer') * 1.2;
  if (PL.deadT <= 0) PL.hp = Math.min(PL.maxHp, PL.hp + regen * dt);
  $('hpFill').style.width = (PL.hp / PL.maxHp * 100) + '%';
  // prompts
  const dShip = Math.hypot(PL.pos.x - P.spawn.x, PL.pos.z - P.spawn.z);
  if (PL.deadT > 0) setPrompt('');
  else if (BUILD.on && BUILD.plan && BUILD.plan.why) setPrompt(`<span style="color:#ff9fb0">${escapeHtml(BUILD.plan.why)}</span>`);
  else if (dShip < 3.5) setPrompt(P.p.earth ? 'Space Inc. launch pad: press <kbd>L</kbd> to blast off to space' : 'Press <kbd>L</kbd> to launch your rocket (or <kbd>R</kbd> anywhere to radio it)');
  else if (P.npcs && nearestNpc()) { const n = nearestNpc(); setPrompt(`Press <kbd>E</kbd> to talk to ${escapeHtml(n.d.role === 'citizen' ? 'this citizen' : n.d.name)}`); }
  else if (P.hq && Math.hypot(PL.pos.x - P.hq.x, PL.pos.z - P.hq.z) < 9) setPrompt('Space Inc. HQ, where it all began. The launch pad is right outside!');
  else if (underground()) setPrompt('Lost in a cave? Press <kbd>U</kbd> to climb up to the surface');
  else if (P.boss && !P.boss.dead && !P.boss.awake && Math.hypot(PL.pos.x - P.vc.x, PL.pos.z - P.vc.z) < 34) setPrompt('A village is trapped! Defeat the boss to free it.');
  else setPrompt('');
  $('lockHint').hidden = locked || lockFailed || uiOpen();
  if (saveT > 0) { saveT -= dt; if (saveT <= 0) writeSave(); }
}

/* ---------- 1.6.9: fish swim in the seas of Ocean and Tropical planets ---------- */
const FISH_COLORS = [['#ff8a1a', '#ffffff'], ['#ffd21a', '#2a6aff'], ['#2ad0ff', '#ffe14d'], ['#ff4a8a', '#ffd0e8'], ['#7a5aff', '#5affc8'], ['#5aff8a', '#1a6a3a'], ['#ff5a3a', '#ffe0a0'], ['#c0d8ff', '#3a5a9a']];
function fishDeep(x, z) { if (x < 1 || z < 1 || x >= W - 1 || z >= D - 1) return -1; return P.liq.y - (P.hm[Math.floor(x) + Math.floor(z) * W] + 1); }
function buildFish(r) {
  const [c1, c2] = FISH_COLORS[Math.floor(r() * FISH_COLORS.length)], g = new THREE.Group(), s = 0.35 + r() * 0.45;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), stdMat(c1, { roughness: 0.3, metalness: 0.15, emissive: c1, emissiveIntensity: 0.12 })); body.scale.set(0.45, 0.7, 1.1); g.add(body);
  const finMat = stdMat(c2, { roughness: 0.4, side: THREE.DoubleSide, emissive: c2, emissiveIntensity: 0.1 });
  const tail = new THREE.Group(); tail.position.z = -0.5; g.add(tail);
  const tf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 4), finMat); tf.rotation.x = Math.PI / 2; tf.scale.set(0.25, 1, 1); tf.position.z = -0.2; tail.add(tf);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), finMat); dorsal.scale.set(0.3, 1, 1.4); dorsal.position.set(0, 0.38, -0.05); dorsal.rotation.x = -0.5; g.add(dorsal);
  for (const sd of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16, Math.PI), finMat); st.rotation.y = Math.PI / 2; st.position.set(sd * 0.01, 0, 0.12); st.scale.set(1, 1, 1); if (r() < 0.5) g.add(st);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); e.position.set(sd * 0.19, 0.1, 0.32);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#101018' })); pu.position.set(sd * 0.04, 0, 0.04); e.add(pu); g.add(e);
  }
  g.scale.setScalar(s); g.userData.tail = tail; return g;
}
function spawnFish() {
  P.fish = [];
  if (!P.liq || P.liq.dmg || !['ocean', 'tropic'].includes(P.p.theme.key)) return;
  const r = mulberry32(P.p.seed + 4242);
  for (let tries = 0; tries < 2000 && P.fish.length < 46; tries++) {
    const x = 2 + r() * (W - 4), z = 2 + r() * (D - 4), dp = fishDeep(x, z); if (dp < 1.6) continue;
    // fish swim in little schools
    const n = 1 + Math.floor(r() * 4), head = r() * 6.28;
    for (let k = 0; k < n && P.fish.length < 46; k++) {
      const g = buildFish(r), fx = x + (r() - 0.5) * 2, fz = z + (r() - 0.5) * 2;
      const fy = P.liq.y - 0.6 - r() * Math.max(0, fishDeep(fx, fz) - 1.4);
      g.position.set(fx, fy, fz); P.scene.add(g);
      P.fish.push({ g, head, spd: 1.1 + r() * 1.2, turn: 0, depth: fy, t: r() * 10, jumpT: 6 + r() * 30, jump: null });
    }
  }
}
function updateFish(dt, time) {
  if (!P.fish || !P.fish.length) return;
  for (const f of P.fish) {
    const g = f.g, p = g.position; f.t += dt;
    if (p.distanceToSquared(PL.pos) > 70 * 70) continue; // too far to see
    if (f.jump) { // a happy splash jump out of the water
      f.jump.t += dt; const k = f.jump.t / 0.9; p.x += Math.sin(f.head) * 3 * dt; p.z += Math.cos(f.head) * 3 * dt;
      p.y = P.liq.y - 0.3 + Math.sin(Math.min(1, k) * Math.PI) * 1.8; g.rotation.x = (k - 0.5) * 1.6;
      if (k >= 1) { f.jump = null; g.rotation.x = 0; P.parts.burst(p.x, P.liq.y, p.z, '#e8fbff', 10, 3); }
      continue;
    }
    // swim away from you when you get close
    const dx = p.x - PL.pos.x, dz = p.z - PL.pos.z, near = dx * dx + dz * dz < 9 && Math.abs(p.y - PL.pos.y - 0.8) < 2.5;
    let spd = f.spd * (near ? 2.6 : 1);
    if (near) f.head = Math.atan2(dx, dz) + Math.sin(f.t * 3) * 0.3;
    else { f.turn += (Math.random() - 0.5) * dt * 2; f.turn *= 0.98; f.head += f.turn * dt; }
    const nx = p.x + Math.sin(f.head) * spd * dt * 6, nz = p.z + Math.cos(f.head) * spd * dt * 6;
    if (fishDeep(nx, nz) < 1.2) { f.head += Math.PI * (0.6 + Math.random() * 0.5); spd *= 0.3; }
    else { p.x += Math.sin(f.head) * spd * dt; p.z += Math.cos(f.head) * spd * dt; }
    const floor = P.liq.y - fishDeep(p.x, p.z) + 0.5, target = clamp(f.depth + Math.sin(f.t * 0.7) * 0.4, floor, P.liq.y - 0.45);
    p.y += (target - p.y) * Math.min(1, dt * 2);
    let dh = f.head - g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); g.rotation.y += dh * Math.min(1, dt * 6);
    g.userData.tail.rotation.y = Math.sin(f.t * (near ? 22 : 10)) * 0.5;
    f.jumpT -= dt; if (f.jumpT <= 0) { f.jumpT = 15 + Math.random() * 40; if (!near && fishDeep(p.x + Math.sin(f.head) * 3, p.z + Math.cos(f.head) * 3) > 1.5) { f.jump = { t: 0 }; P.parts.burst(p.x, P.liq.y, p.z, '#e8fbff', 8, 3); } }
  }
}

/* ---------- 1.6.9: friendly animals roam the Jungle planets (monkeys, capybaras, ocelots, toucans and frogs) ---------- */
function buildCritter(kind, r) {
  const g = new THREE.Group(), legs = [], M = (c, o) => stdMat(c, Object.assign({ roughness: 0.6 }, o)), ball = (rad, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  const eyes = (y, z, gap, rad) => { for (const sd of [-1, 1]) { const e = ball(rad, M('#ffffff', { roughness: 0.2 }), sd * gap, y, z); const p = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.55, 10, 8), new THREE.MeshBasicMaterial({ color: '#111' })); p.position.z = rad * 0.6; e.add(p); } };
  const leg = (mat, x, z, len, rad) => { const l = new THREE.Group(); l.position.set(x, len, z); const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.8, len, 8), mat); m.position.y = -len / 2; m.castShadow = true; l.add(m); g.add(l); legs.push(l); };
  if (kind === 'monkey') {
    const fur = M(['#7a4a2a', '#5a3a1a', '#9a6a3a'][Math.floor(r() * 3)]), face = M('#f0c898');
    ball(0.32, fur, 0, 0.62, 0, 1, 1.1, 0.9); ball(0.26, fur, 0, 1.05, 0.08); ball(0.18, face, 0, 1.0, 0.24, 1, 0.85, 0.6);
    for (const sd of [-1, 1]) ball(0.09, face, sd * 0.26, 1.1, 0.04, 0.5, 1, 1);
    eyes(1.1, 0.27, 0.08, 0.055);
    leg(fur, -0.15, 0.05, 0.36, 0.07); leg(fur, 0.15, 0.05, 0.36, 0.07); leg(fur, -0.3, 0.12, 0.85, 0.06); leg(fur, 0.3, 0.12, 0.85, 0.06);
    legs[2].rotation.x = legs[3].rotation.x = 0; legs[2].position.y = legs[3].position.y = 0.85;
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 20, Math.PI * 1.4), fur); tail.position.set(0, 0.6, -0.4); tail.rotation.y = Math.PI / 2; g.add(tail);
    return { g, legs, kind, spd: 1.8, hop: 0.35, h: 0 };
  }
  if (kind === 'capybara') {
    const fur = M('#a8784a'), dark = M('#5a3a20');
    ball(0.5, fur, 0, 0.6, 0, 0.9, 0.75, 1.3); ball(0.3, fur, 0, 0.75, 0.62, 0.9, 0.9, 1.2); ball(0.12, dark, 0, 0.7, 0.95, 1.3, 0.8, 0.6);
    for (const sd of [-1, 1]) ball(0.07, dark, sd * 0.18, 1.0, 0.5);
    eyes(0.88, 0.8, 0.14, 0.05);
    for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) leg(fur, x, z, 0.32, 0.08);
    return { g, legs, kind, spd: 0.9, hop: 0, h: 0 };
  }
  if (kind === 'ocelot') { // a shy spotted jungle cat
    const fur = M('#d8a24a'), spot = M('#3a2410'), wh = M('#fff4dc');
    ball(0.3, fur, 0, 0.55, 0, 0.85, 0.8, 1.6); ball(0.2, wh, 0, 0.45, 0.1, 0.8, 0.6, 1.3);
    ball(0.22, fur, 0, 0.78, 0.55, 1, 0.9, 1); ball(0.1, wh, 0, 0.72, 0.74, 1.1, 0.8, 0.8); ball(0.035, M('#ff8aa0'), 0, 0.76, 0.83);
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), fur); e.position.set(sd * 0.13, 0.98, 0.52); g.add(e); }
    for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, z = -0.35 + r() * 0.7; ball(0.045, spot, Math.cos(a) * 0.25, 0.55 + Math.sin(a) * 0.22, z, 1, 1, 1.6); }
    eyes(0.84, 0.72, 0.09, 0.05);
    for (const [x, z] of [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]]) leg(fur, x, z, 0.4, 0.06);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 8), fur); tail.position.set(0, 0.62, -0.75); tail.rotation.x = -1.0; g.add(tail);
    ball(0.07, spot, 0, 0.84, -1.09); // dark tail tip
    return { g, legs, kind, spd: 2.6, hop: 0.05, h: 0 };
  }
  if (kind === 'frog') {
    const sk = M(['#3ad13a', '#ff5a2a', '#2a9aff'][Math.floor(r() * 3)], { roughness: 0.3 }), belly = M('#fff0b0');
    ball(0.25, sk, 0, 0.2, 0, 1.1, 0.7, 1.1); ball(0.18, belly, 0, 0.14, 0.1, 1.1, 0.6, 1);
    eyes(0.36, 0.12, 0.13, 0.08);
    for (const sd of [-1, 1]) ball(0.1, sk, sd * 0.24, 0.1, -0.1, 0.9, 0.6, 1.5);
    return { g, legs, kind, spd: 2.4, hop: 0.6, h: 0 };
  }
  // toucan: flies in big lazy loops above the trees
  const blk = M('#141418'), wh = M('#fff8e0'), beak = M('#ff9a1a', { emissive: '#ff6a00', emissiveIntensity: 0.15 });
  ball(0.25, blk, 0, 0, 0, 0.9, 0.9, 1.4); ball(0.18, blk, 0, 0.1, 0.32); ball(0.13, wh, 0, 0.02, 0.36, 1, 0.9, 0.6);
  const bk = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 12), beak); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.08, 0.7); bk.scale.set(1, 1, 1.4); g.add(bk);
  eyes(0.16, 0.42, 0.1, 0.04);
  for (const sd of [-1, 1]) { const w = new THREE.Group(); w.position.set(sd * 0.18, 0.05, 0); const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), blk); m.scale.set(1.4, 0.15, 0.7); m.position.x = sd * 0.35; w.add(m); g.add(w); legs.push(w); }
  return { g, legs, kind, spd: 5, fly: true, h: 0 };
}
function critterGround(x, z) { if (x < 2 || z < 2 || x >= W - 2 || z >= D - 2) return null; const y = groundY(x, z); if (P.liq && y < P.liq.y + 0.2) return null; if (y > P.hm[Math.floor(x) + Math.floor(z) * W] + 2.5) return null; return y; } // no walking on treetops
function spawnCritters() {
  P.critters = [];
  if (P.p.theme.key !== 'jungle') return;
  const r = mulberry32(P.p.seed + 9191), kinds = ['monkey', 'monkey', 'capybara', 'ocelot', 'ocelot', 'frog', 'frog', 'toucan'];
  for (let tries = 0; tries < 800 && P.critters.length < 30; tries++) {
    const kind = kinds[Math.floor(r() * kinds.length)], x = 3 + r() * (W - 6), z = 3 + r() * (D - 6), y = critterGround(x, z);
    if (y === null || (P.vc && Math.hypot(x - P.vc.x, z - P.vc.z) < 12)) continue;
    const c = buildCritter(kind, r); c.g.position.set(x, c.fly ? y + 9 + r() * 6 : y, z); c.head = r() * 6.28; c.t = r() * 10; c.wait = r() * 3; c.cx = x; c.cz = z; c.alt = c.g.position.y;
    P.scene.add(c.g); P.critters.push(c);
  }
}
function updateCritters(dt, time) {
  if (!P.critters || !P.critters.length) return;
  for (const c of P.critters) {
    const p = c.g.position; c.t += dt;
    if (p.distanceToSquared(PL.pos) > 80 * 80) continue;
    if (c.fly) { // circle around its home spot, flapping
      c.head += dt * 0.45; p.x = c.cx + Math.sin(c.head) * 9; p.z = c.cz + Math.cos(c.head) * 9; p.y = c.alt + Math.sin(c.t * 0.8) * 1.2;
      c.g.rotation.y = c.head + Math.PI / 2; c.g.rotation.z = -0.25;
      c.legs.forEach((w, k) => w.rotation.z = (k ? -1 : 1) * Math.sin(c.t * 12) * 0.7); continue;
    }
    const dx = p.x - PL.pos.x, dz = p.z - PL.pos.z, scared = dx * dx + dz * dz < 12 && c.kind !== 'capybara'; // capybaras are too chill to run
    if (scared) { c.head = Math.atan2(dx, dz); c.wait = 0; }
    if (c.wait > 0 && !scared) { c.wait -= dt; c.h = 0; }
    else {
      const spd = c.spd * (scared ? 2.2 : 1), nx = p.x + Math.sin(c.head) * spd * dt, nz = p.z + Math.cos(c.head) * spd * dt, ny = critterGround(nx, nz);
      if (ny === null || ny - groundY(p.x, p.z) > 1.2) { c.head += Math.PI * (0.5 + Math.random()); }
      else { p.x = nx; p.z = nz; }
      c.h += dt; if (!scared && Math.random() < dt * 0.4) { c.wait = 1 + Math.random() * 3; c.head += (Math.random() - 0.5) * 2.5; }
    }
    const gy = groundY(p.x, p.z), moving = c.wait <= 0 || scared;
    const hop = c.hop && moving ? Math.abs(Math.sin(c.t * (c.kind === 'frog' ? 6 : 9))) * c.hop : 0;
    p.y += (gy + hop - p.y) * Math.min(1, dt * 12);
    let dh = c.head - c.g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.g.rotation.y += dh * Math.min(1, dt * 8);
    c.legs.forEach((l, k) => l.rotation.x = moving ? Math.sin(c.t * 10 + (k % 2) * Math.PI) * 0.6 : 0);
  }
}
