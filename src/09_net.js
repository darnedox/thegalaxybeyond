/* ================= ONLINE LOBBY =================
   Two adapters share one tiny protocol: each player shares its own state ~10x a second.
   - claude.ai artifact: the platform "room" (signed-in viewers of this page)
   - any static host (GitHub Pages): PeerJS, host id "tgbeyond-<code>", host relays to everyone (star) */
const NET = { mode: null, code: null, id: null, peers: new Map(), hits: [], seq: 0, seen: {}, pvp: false, sendT: 0, room: null, peer: null, conns: [], hostConn: null };
const roomApi = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('room').catch(() => null) : Promise.resolve(null);
function netStatus(msg, cls = '') { const el = $('netStatus'); el.className = 'sub ' + cls; el.textContent = msg; }
function netBadge() {
  const b = $('netBadge'); if (!NET.mode) { b.hidden = true; return; }
  b.hidden = false; b.textContent = `Lobby ${NET.code} · ${NET.peers.size + 1} player${NET.peers.size ? 's' : ''} online`;
}
function myState() {
  const s = { n: save.name || 'Pilot', h: save.hero, m: mode === 'planet' ? 'p' : 's', pvp: NET.pvp ? 1 : 0 };
  if (mode === 'planet' && P) { Object.assign(s, { p: P.p.id, x: +PL.pos.x.toFixed(2), y: +PL.pos.y.toFixed(2), z: +PL.pos.z.toFixed(2), ry: +PL.yaw.toFixed(2), hp: Math.round(PL.hp), mv: +Math.hypot(PL.vel.x, PL.vel.z).toFixed(1) }); }
  else { const q = ship.g.quaternion, p = ship.g.position; Object.assign(s, { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), q: [+q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3), +q.w.toFixed(3)] }); }
  NET.hits = NET.hits.filter(h => nowT - h.t < 1.2); s.hits = NET.hits.map(h => ({ to: h.to, d: h.d, s: h.s }));
  return s;
}
function cleanState(st) {
  if (!st || typeof st !== 'object') return null;
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  const out = { n: cleanName(String(st.n || 'Pilot')) || 'Pilot', h: clamp(num(st.h) | 0, 0, 7), m: st.m === 'p' ? 'p' : 's', pvp: st.pvp ? 1 : 0, p: num(st.p) | 0, x: num(st.x), y: num(st.y), z: num(st.z), ry: num(st.ry), hp: num(st.hp), mv: clamp(num(st.mv), 0, 12) };
  if (Array.isArray(st.q) && st.q.length === 4) out.q = st.q.map(num);
  out.hits = Array.isArray(st.hits) ? st.hits.slice(0, 20).filter(h => h && typeof h === 'object').map(h => ({ to: String(h.to || ''), d: clamp(num(h.d), 0, 200), s: num(h.s) })) : [];
  return out;
}
function onPeerState(id, raw) {
  const st = cleanState(raw); if (!st || id === NET.id) return;
  const known = NET.peers.has(id);
  NET.peers.set(id, { st, t: nowT });
  if (!known) { toast(`${st.n} joined the lobby!`, 'good'); netBadge(); }
  // PvP hits aimed at me (only counts when both players turned PvP on)
  const seen = NET.seen[id] || (NET.seen[id] = new Set());
  for (const h of st.hits) {
    if (h.to !== NET.id || seen.has(h.s)) continue; seen.add(h.s);
    if (NET.pvp && st.pvp && mode === 'planet' && P && st.p === P.p.id) hurtPlayer(h.d, `${st.n} hit you!`);
  }
  if (seen.size > 200) NET.seen[id] = new Set([...seen].slice(-100));
}
function dropPeer(id) {
  const pe = NET.peers.get(id); if (!pe) return; NET.peers.delete(id);
  toast(`${pe.st.n} left the lobby.`); netBadge();
  const rs = remoteShips.get(id); if (rs) { space.remove(rs.g); remoteShips.delete(id); }
}

/* ---- adapter 1: claude.ai room ---- */
async function roomConnect(code) {
  const room = await roomApi; if (!room) return false;
  try {
    const r = await room.join('galaxy-' + code); NET.room = r; NET.mode = 'room'; NET.code = code;
    const me = r.peers().find(p => p.isMe); NET.id = me ? me.peer : 'me';
    r.onPeers(ch => {
      const mine = ch.peers.find(p => p.isMe); if (mine) NET.id = mine.peer;
      for (const p of ch.peers) if (!p.isMe && !p.sameTab && p.presence && p.presence.st) onPeerState(p.peer, p.presence.st);
      for (const p of ch.left) dropPeer(p.peer);
    });
    return true;
  } catch (e) { return false; }
}

/* ---- adapter 2: PeerJS (for GitHub Pages or any static host) ---- */
function peerAvailable() { return typeof window.Peer === 'function'; }
function peerHost(code) {
  return new Promise(res => {
    const pr = new Peer('tgbeyond-' + code); let done = false;
    pr.on('open', id => { done = true; NET.peer = pr; NET.mode = 'peer'; NET.code = code; NET.id = id; res(true); });
    pr.on('error', () => { if (!done) { done = true; try { pr.destroy(); } catch (e) { } res(false); } });
    pr.on('connection', c => {
      c.on('data', d => {
        if (!d || typeof d !== 'object') return;
        c._pid = c.peer; onPeerState(c.peer, d.st);
        for (const o of NET.conns) if (o !== c && o.open) o.send({ id: c.peer, st: d.st }); // relay
      });
      c.on('close', () => { NET.conns = NET.conns.filter(x => x !== c); dropPeer(c.peer); for (const o of NET.conns) if (o.open) o.send({ id: c.peer, gone: 1 }); });
      NET.conns.push(c);
    });
    setTimeout(() => { if (!done) { done = true; res(false); } }, 8000);
  });
}
function peerJoin(code) {
  return new Promise(res => {
    const pr = new Peer(); let done = false;
    pr.on('open', id => {
      const c = pr.connect('tgbeyond-' + code, { reliable: false });
      c.on('open', () => { done = true; NET.peer = pr; NET.hostConn = c; NET.mode = 'peer'; NET.code = code; NET.id = id; res(true); });
      c.on('data', d => { if (!d || typeof d !== 'object') return; if (d.gone) dropPeer(String(d.id)); else onPeerState(String(d.id || 'host'), d.st); });
      c.on('close', () => { toast('The host left. Lobby closed.', 'bad'); NET.peers.forEach((_, id) => dropPeer(id)); NET.mode = null; netBadge(); });
    });
    pr.on('error', () => { if (!done) { done = true; try { pr.destroy(); } catch (e) { } res(false); } });
    setTimeout(() => { if (!done) { done = true; res(false); } }, 9000);
  });
}

/* ---- buttons ---- */
async function netHost() {
  if (NET.mode) { netStatus(`You're already in lobby ${NET.code}.`, 'good'); return; }
  const code = String(1000 + Math.floor(Math.random() * 9000));
  netStatus('Opening a lobby…');
  const ok = (await roomConnect(code)) || (peerAvailable() && await peerHost(code));
  if (ok) { netStatus(`Lobby code: ${code}. Tell your friends to type it and press Join.`, 'good'); $('lobbyCode').value = code; netBadge(); }
  else netStatus('Online play could not connect here. When the game is on its own website, lobbies will work for everyone. You can still play solo!', 'warn');
}
async function netJoin() {
  if (NET.mode) { netStatus(`You're already in lobby ${NET.code}.`, 'good'); return; }
  const code = $('lobbyCode').value.replace(/\D/g, '').slice(0, 4);
  if (code.length !== 4) { netStatus('Type the 4-digit lobby code first.', 'warn'); return; }
  netStatus('Joining…');
  const ok = (await roomConnect(code)) || (peerAvailable() && await peerJoin(code));
  if (ok) { netStatus(`Joined lobby ${code}! Press Start to play together.`, 'good'); netBadge(); }
  else netStatus(`Could not find lobby ${code}. Check the code with your friend.`, 'warn');
}
function netTick(dt) {
  if (!NET.mode) return;
  NET.sendT -= dt;
  if (NET.sendT <= 0 && mode !== 'title' && mode !== 'loading') {
    NET.sendT = 0.1; const st = myState();
    if (NET.mode === 'room' && NET.room) NET.room.presence({ st }).catch(() => { });
    else if (NET.mode === 'peer') {
      if (NET.hostConn && NET.hostConn.open) NET.hostConn.send({ st });
      for (const c of NET.conns) if (c.open) c.send({ id: NET.id, st });
    }
  }
  // remote ships in space
  for (const [id, pe] of NET.peers) {
    const st = pe.st, rs = remoteShips.get(id);
    if (st.m !== 's' || nowT - pe.t > 10) { if (rs) rs.g.visible = false; continue; }
    const o = remoteShip(id, st); o.g.visible = mode === 'space' || mode === 'ending';
    const k = 1 - Math.exp(-dt * 8); o.g.position.x += (st.x - o.g.position.x) * k; o.g.position.y += (st.y - o.g.position.y) * k; o.g.position.z += (st.z - o.g.position.z) * k;
    if (o.g.position.distanceTo(tmpA.set(st.x, st.y, st.z)) > 2000) o.g.position.set(st.x, st.y, st.z);
    if (st.q) { tmpQ.set(st.q[0], st.q[1], st.q[2], st.q[3]).normalize(); o.g.quaternion.slerp(tmpQ, k); }
  }
  // time out silent peers (PeerJS has no presence)
  for (const [id, pe] of NET.peers) if (nowT - pe.t > 20) dropPeer(id);
}
