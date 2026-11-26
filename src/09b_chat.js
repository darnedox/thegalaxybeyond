/* ================= LOBBY CHAT (kid-safe) =================
   Chat only exists inside a private lobby. Messages ride along in each player's
   shared state for a few seconds (field "c"), so both lobby adapters carry them.
   Every message is filtered when sent AND when received. */
const CHAT_MAX = 60, CHAT_SHOW = 12;
const QUICK_CHAT = ['Follow me!', 'Boss here!', 'Need help!', 'Over here!', "Let's go!", 'Wait for me!', 'Nice job!', 'Thanks!'];
// word lists are ROT13 so the source stays clean to read
const rot13 = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
const BAD_SUB = 'shpx fuvg ovgpu phag avtre avtn sntbg cbea juber fyhg chfl nfubyr qhzonf wnpxnf onfgneq ergneq gjng jnax'.split(' ').map(rot13);
const BAD_WORD = new Set('nff qvpx pbpx snt uryy qnza penc cvff frk gvgf gvg obbo obbof cravf intvan ahqr anxrq xlf jgs fgsh qbhpur cevpx ohttre obybpxf'.split(' ').map(rot13));
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };
function chatNorm(tok) { return tok.toLowerCase().replace(/[0-9!|@$+]/g, c => LEET[c] || c).replace(/[^a-z]/g, ''); }
function badToken(tok) {
  const n = chatNorm(tok); if (!n) return false;
  const two = n.replace(/(.)\1{2,}/g, '$1$1'), one = n.replace(/(.)\1+/g, '$1');
  return BAD_WORD.has(two) || BAD_WORD.has(n) || BAD_SUB.some(w => one.includes(w));
}
function chatFilter(raw) {
  let s = String(raw || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!s) return '';
  // no links, emails or phone numbers
  s = s.replace(/\S*(https?:|www\.|:\/\/|@\w+\.|\.(com|net|org|gg|io|co|tv|me|ly|xyz)\b)\S*/gi, '***');
  s = s.replace(/(\d[\s\-().]*){7,}/g, '***');
  // spelled-out words like "b a d" get checked joined together
  let toks = s.split(' ');
  for (let i = 0; i < toks.length;) {
    if (chatNorm(toks[i]).length === 1) {
      let j = i; while (j < toks.length && chatNorm(toks[j]).length === 1) j++;
      if (j - i >= 3 && badToken(toks.slice(i, j).join(''))) for (let k = i; k < j; k++) toks[k] = '*';
      i = j;
    } else i++;
  }
  toks = toks.map(t => badToken(t) ? '*'.repeat(Math.max(3, Math.min(t.length, 8))) : t);
  s = toks.join(' ');
  const joined = chatNorm(s.replace(/\s+/g, ''));
  if (/kil+(yo)?u?r?self|kil+urself|kil+yoself/.test(joined)) return 'Be kind! 💛';
  // no shouting
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length > 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) s = s.toLowerCase();
  return s;
}

const CHAT = { open: false, last: -9, times: [], log: [] };
function chatAdd(name, text, me) {
  const log = $('chatLog'), row = document.createElement('div');
  row.className = 'cm' + (me ? ' me' : '');
  const b = document.createElement('b'); b.textContent = name + ': ';
  row.appendChild(b); row.appendChild(document.createTextNode(text));
  log.appendChild(row); row._t = nowT;
  while (log.children.length > 8) log.removeChild(log.firstChild);
  chatShowBox();
}
function chatShowBox() { $('chatBox').hidden = !NET.mode || mode === 'title' || mode === 'loading' || mode === 'cutscene'; }
function chatOpen() {
  if (!NET.mode) { toast('Chat works when you are in a lobby with friends.'); return; }
  CHAT.open = true; chatShowBox(); $('chatEntry').hidden = false; $('chatBox').classList.add('open');
  if (document.pointerLockElement) document.exitPointerLock();
  for (const k in keys) keys[k] = false; mouse.L = mouse.R = false;
  const inp = $('chatIn'); inp.value = ''; inp.focus();
}
function chatClose(relock = true) {
  if (!CHAT.open) return;
  CHAT.open = false; $('chatEntry').hidden = true; $('chatBox').classList.remove('open');
  $('chatIn').blur(); if (relock && mode === 'planet') requestLock();
}
function chatSend(raw) {
  if (!NET.mode) return false;
  const msg = chatFilter(raw); if (!msg) return false;
  CHAT.times = CHAT.times.filter(t => nowT - t < 10);
  if (nowT - CHAT.last < 1.2 || CHAT.times.length >= 5) { toast('Slow down a little! Try again in a moment.'); return false; }
  CHAT.last = nowT; CHAT.times.push(nowT);
  NET.chat = (NET.chat || []).filter(c => nowT - c.t < 6);
  NET.chat.push({ s: (Math.random() * 1e9) | 0, m: msg, t: nowT });
  if (NET.chat.length > 4) NET.chat.shift();
  chatAdd('You', msg, true); NET.sendT = 0;
  return true;
}
function chatOutgoing() { return (NET.chat || []).filter(c => nowT - c.t < 6).map(c => ({ s: c.s, m: c.m })); }
function chatIncoming(id, st) {
  if (!st.c.length) return;
  const seen = NET.cseen[id] || (NET.cseen[id] = new Set());
  for (const c of st.c) {
    if (seen.has(c.s)) continue; seen.add(c.s);
    const m = chatFilter(c.m); if (m) chatAdd(st.n, m, false);
  }
  if (seen.size > 100) NET.cseen[id] = new Set([...seen].slice(-50));
}
function chatTick() {
  const box = $('chatBox'); if (box.hidden && !NET.mode) return;
  chatShowBox();
  for (const row of $('chatLog').children) row.classList.toggle('old', nowT - row._t > CHAT_SHOW);
}
(function chatInit() {
  const q = $('chatQuick');
  for (const p of QUICK_CHAT) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost small'; b.textContent = p;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { chatSend(p); chatClose(); });
    q.appendChild(b);
  }
  $('chatIn').addEventListener('blur', () => setTimeout(() => { if (CHAT.open && document.activeElement !== $('chatIn')) chatClose(false); }, 150));
  $('chatIn').addEventListener('keydown', e => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); chatSend(e.target.value); chatClose(); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); chatClose(); }
  });
})();
