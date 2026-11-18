// Protocol. Everything shown comes from data/syllabus.json and data/quotes.json.
(async function(){
const CFG = window.PROTOCOL || {}, $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let S, Q;
try { [S, Q] = await Promise.all(['data/syllabus.json','data/quotes.json'].map(u => fetch(u).then(r => { if(!r.ok) throw 0; return r.json(); }))); }
catch (e) { $('answer').innerHTML = '<p>The syllabus file did not load. If you opened this page straight from a folder, run it from a local server (see README).</p>'; document.body.classList.remove('intro'); return; }
S.passages = S.passages || []; S.sessions = S.sessions || []; S.due = S.due || {}; S.starters = S.starters || []; S.ladder = S.ladder || []; S.calendar = S.calendar || { notes:[] };
try {
Q = Q.quotes; const quoteBy = Object.fromEntries(Q.map(q => [q.id, q]));

// ---------- dates ----------
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const parts = iso => iso.split('-').map(Number);
const short = iso => { const [, m, d] = parts(iso); return m + '/' + d; };
const long = iso => { const [y, m, d] = parts(iso); return DAYS[new Date(y, m-1, d).getDay()] + ', ' + MONTHS[m-1] + ' ' + d; };
const tok = {}; S.sessions.forEach(s => tok['S'+s.n] = short(s.date));
for (const k in S.due) tok[k] = short(S.sessions[S.due[k]-1].date);
const fill = s => s.replace(/\{\{(\w+)\}\}/g, (m, k) => tok[k] ?? m);
S.passages.forEach(p => { p.text = p.text.map(fill); p.means = fill(p.means); });
const byId = Object.fromEntries(S.passages.map(p => [p.id, p]));
const lectures = (byId.lectures ? byId.lectures.text : []).filter(l => /^\d+\./.test(l));
const param = new URLSearchParams(location.search).get('today');            // ?today=2027-02-03 previews another day
const now = param && /^\d{4}-\d\d-\d\d$/.test(param) ? param : (d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date());
const nextSession = S.sessions.find(s => s.date >= now);
const MA_NAME = { MA1:'MA One', MA2:'MA Two', MA3:'MA Three' }, MA_PASS = { MA1:'ma1-task', MA2:'ma2-task', MA3:'ma3-task' };
const nextDue = Object.keys(S.due).map(k => ({ k, s:S.sessions[S.due[k]-1] })).find(x => x.s.date >= now);

// ---------- search (works with the AI off) ----------
const STOP = new Set('a an the is are was be to of in on at for and or do does did i my me we you your it this that what when where which who how can could should would will if with about there have has get got need much many any as by from not no so im whats hows wheres whens whos tell please hi hello hey thanks'.split(' '));
const stem = w => w.length > 4 ? w.replace(/(ies)$/,'y').replace(/(es|s|ed|ing)$/,'') : w;
const GENERIC = new Set('class classes course grade grades use used using rule rules day days work working need bring last time start room hard pass thing things stuff make take go one two three assignment assignments major minor student students rick people know want like good bad help'.split(' ').map(stem));   // too common to point at one passage
const words = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w)).map(stem);
const near = (a, b) => {                                   // true when a and b differ by one letter (typos)
  if (a === b) return true; if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length){ if (a[i] === b[j]){ i++; j++; continue; } if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return d + (a.length - i) + (b.length - j) <= 1;
};
const hit = (set, w) => { if (set.has(w)) return true; if (w.length < 5) return false; for (const k of set) if (near(w, k)) return true; return false; };
S.passages.forEach(p => { p._k = new Set((p.keywords || []).filter(k => !STOP.has(k)).map(stem)); p._t = new Set(words(p.title)); p._x = new Set(words(p.text.join(' '))); });
function search(q){
  const ws = [...new Set(words(q))]; if (!ws.length) return [];
  const scored = S.passages.map(p => {
    let s = 0, strong = 0;
    for (const w of ws){ const g = GENERIC.has(w);
      if (hit(p._k, w)){ s += g ? 1 : 3; if (!g) strong++; } if (hit(p._t, w)){ s += g ? 1 : 2; if (!g) strong++; } if (p._x.has(w)) s += 1; }
    if (p.id.startsWith('overview')) s -= 1.5;
    return { p, s: s / Math.sqrt(ws.length), strong };
  }).filter(x => x.strong > 0 && x.s >= 1.5).sort((a,b) => b.s - a.s);
  if (!scored.length) return [];
  const out = [scored[0].p];
  if (scored[1] && scored[1].s >= scored[0].s*0.8) out.push(scored[1].p);
  return out;
}
function localAnswer(q){
  for (const it of (S.intents || [])){
    let re; try { re = new RegExp(it.match, 'i'); } catch (e) { continue; }
    if (!re.test(q)) continue;
    if (it.dynamic === 'none') return { covered:false, passages:[] };
    if (it.dynamic === 'ma' && S.due[it.key]){
      const p = byId[MA_PASS[it.key]], s = S.sessions[S.due[it.key]-1];
      if (p) return { covered:true, passages:[p], lead: MA_NAME[it.key] + ' is due ' + long(s.date) + '.' };
    }
    if (it.dynamic === 'next-due'){
      if (!nextDue) return { covered:true, passages:[byId.schedule], lead:'All three Major Assignments are past their due dates.' };
      return { covered:true, passages:[byId[MA_PASS[nextDue.k]], byId.schedule], lead:'The next Major Assignment due is ' + MA_NAME[nextDue.k] + ', on ' + long(nextDue.s.date) + '.' };
    }
    if (it.dynamic === 'span'){ const a = S.sessions[0], z = S.sessions[S.sessions.length-1];
      return { covered:true, passages:[byId.schedule], lead:'There are ' + S.sessions.length + ' sessions. The first is ' + long(a.date) + ' and the last is ' + long(z.date) + '.' }; }
    const ps = (it.passages || []).map(id => byId[id]).filter(Boolean);
    if (ps.length) return { covered:true, passages:ps, lead:it.means || '' };
  }
  const ps = search(q);
  return ps.length ? { covered:true, passages:ps } : { covered:false, passages:[] };
}

// ---------- the AI, when a Worker is set ----------
let pass = ''; try { pass = sessionStorage.getItem('protocol-pass') || ''; } catch (e) {}
const aiOn = () => !!CFG.WORKER_URL && !!pass;
async function aiAnswer(q){
  const r = await fetch(CFG.WORKER_URL.replace(/\/$/,'') + '/ask', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ question:q, password:pass }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401){ pass = ''; try { sessionStorage.removeItem('protocol-pass'); } catch (e) {} drawLock('That password did not work.'); throw new Error('locked'); }
  if (!r.ok) throw new Error(j.error || 'unavailable');
  const ps = (j.passages || []).map(id => byId[id]).filter(Boolean).slice(0, 2);    // only ids that exist in the file are shown
  return { covered: !!j.covered && ps.length > 0, passages: ps, interpretation: typeof j.explanation === 'string' ? j.explanation.slice(0, 500) : '', ai:true };
}
function drawLock(msg){
  const el = $('lock'); if (!CFG.WORKER_URL){ el.hidden = true; return; }
  el.hidden = false;
  if (pass){ el.innerHTML = 'The AI is unlocked for this visit. It finds the section and gives its own interpretation. The section is always shown word for word, so check one against the other.'; return; }
  el.innerHTML = (msg ? '<b>' + esc(msg) + '</b> ' : '') + 'Answers come from search right now. Your LA gives the AI password at the first recitation.' +
    '<form id="unlock"><label class="sr" for="pw">Password</label><input id="pw" type="password" placeholder="Password" autocomplete="off"><button type="submit">Unlock</button></form>';
  $('unlock').onsubmit = e => { e.preventDefault(); pass = $('pw').value.trim(); try { sessionStorage.setItem('protocol-pass', pass); } catch (er) {} drawLock(); };
}

// ---------- drawing an answer ----------
const quoteHTML = q => '<blockquote>“' + esc(q.text) + '”</blockquote><figcaption><b>Rick Griffith</b>, ' + esc(q.context) + '. <a href="' + esc(q.url) + '" target="_blank" rel="noopener">' + esc(q.source) + (q.year ? ', ' + q.year : '') + '</a></figcaption>';
function ladder(next){
  const at = next === 'rick' ? 2 : next === 'none' ? 0 : 1;
  return '<ol class="ladder" aria-label="Who to ask, in order">' + S.ladder.map((l, i) => '<li' + (i === at ? ' class="now"' : '') + '>' + esc(l) + '</li>').join('') + '</ol>';
}
const box = $('box');
let qi = Math.floor(Math.random() * Q.length);
function nextQuote(){ qi = (qi + 1) % Q.length; $('standing').innerHTML = quoteHTML(Q[qi]); }      // the next one in the bank, whatever was asked
const SAYS = 'Here\u2019s the section I\u2019m referencing, verbatim', MEANS = 'My interpretation (AI models can hallucinate)';
function draw(q, a){
  let h = '<article class="answer">';
  if (!a.covered){
    h += '<p class="tag">' + SAYS + '</p><div class="says"><blockquote><p>Nothing found. The syllabus may not answer this.</p></blockquote>' +
         '<p class="goto"><button class="link" data-read="1">Look through the whole document \u2192</button></p></div>' +
         '<div class="means"><p class="tag">' + MEANS + '</p><p>If it is not in the document, it is a question for a person. Bring it to your LA at recitation first. If your LA cannot answer it, it is a good one for Rick.</p></div>' + ladder('la');
  } else {
    const first = a.passages[0];
    h += '<p class="tag">' + SAYS + '</p>' + a.passages.map(p =>
           '<div class="says"><p class="where">' + esc(p.section) + ' \u00B7 ' + esc(p.title) + '</p><blockquote>' + p.text.map(t => '<p>' + esc(t) + '</p>').join('') +
           '</blockquote><p class="goto"><button class="link" data-goto="' + esc(p.id) + '">Show it in the document \u2192</button></p></div>').join('') +
         '<div class="means"><p class="tag">' + MEANS + '</p>' + (a.lead ? '<p><b>' + esc(a.lead) + '</b></p>' : '') +
         (a.interpretation ? '<p>' + esc(a.interpretation) + '</p>' : a.passages.map(p => '<p>' + esc(p.means) + '</p>').join('')) + '</div>' + ladder(first.next);
  }
  $('answer').innerHTML = h + '</article>'; $('answer').scrollTop = 0;
  box.classList.add('open'); $('clear').hidden = false; nextQuote();
  $('answer').querySelectorAll('[data-goto]').forEach(b => b.onclick = () => goTo(b.dataset.goto));
  $('answer').querySelectorAll('[data-read]').forEach(b => b.onclick = () => setMode('read'));
}
function reset(){ box.classList.remove('open'); $('clear').hidden = true; $('q').value = '';
  setTimeout(() => { if (!box.classList.contains('open')) $('answer').innerHTML = ''; }, 600); $('q').focus({ preventScroll:true }); sync(); }
const askInner = $('ask').querySelector('.inner');
askInner.addEventListener('scroll', () => { if (innerWidth > 900 && askInner.scrollTop) askInner.scrollTop = 0; });   // the quote never moves on a desktop
const sync = () => $('starters').classList.toggle('ready', !$('q').value.trim() && !box.classList.contains('open'));
async function ask(q){
  q = q.trim().slice(0, 300); if (!q) return;
  $('q').value = q;
  let a = null;
  if (aiOn()){ $('answer').innerHTML = '<p class="tag" style="margin-top:40px">Reading the syllabus…</p>'; try { a = await aiAnswer(q); } catch (e) { a = null; }
    if (a && !a.covered){ const l = localAnswer(q); if (l.covered) a = l; } }      // second opinion from plain search before saying the syllabus is silent
  draw(q, a || localAnswer(q)); sync();
}
$('f').onsubmit = e => { e.preventDefault(); ask($('q').value).then(sync); };
$('starters').innerHTML = S.starters.map(s => '<li><button type="button">' + esc(s) + '</button></li>').join('');
$('starters').querySelectorAll('button').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { ask(b.textContent); sync(); }; });
$('q').addEventListener('input', sync); $('clear').onclick = reset; sync();
$('standing').innerHTML = quoteHTML(Q[qi]);
drawLock();

// ---------- the reading page ----------
(function(){
  const c = S.course, secs = []; let cur = null;
  S.passages.forEach(p => { if (!cur || cur.name !== p.section){ cur = { name:p.section, ps:[] }; secs.push(cur); } cur.ps.push(p); });
  let h = '<div class="dochead"><p class="num">' + esc(c.number) + '</p><h2 id="doc-h">' + esc(c.title) + '</h2><p class="term">' + esc(c.term) + ' · ' + esc(c.meets) + '</p></div>';
  secs.forEach(s => {
    h += '<section class="sec"><h3>' + esc(s.name) + '</h3>';
    s.ps.forEach(p => { h += '<div class="pas" id="p-' + esc(p.id) + '"><h4>' + esc(p.title) + '</h4>' + p.text.map(t => '<p>' + esc(t) + '</p>').join('') + '<p class="m">' + esc(p.means) + '</p></div>';
      if (p.id === 'schedule'){
        const dueAt = {}; for (const k in S.due) dueAt[S.due[k]] = MA_NAME[k] + ' due';
        h += '<table class="weeks"><caption class="sr">Week by week</caption><thead><tr><th scope="col">Date</th><th scope="col">Lecture</th><th scope="col">Due</th></tr></thead><tbody>' +
          S.sessions.map(x => '<tr' + (nextSession && x.n === nextSession.n ? ' class="next"' : '') + '><td class="d">' + long(x.date).replace(/^\w+, /, '') + '</td><td>' + esc(lectures[x.n-1] || '') + (x.n === S.sessions.length ? ' <b>RUN BY LAs</b>' : '') + '</td><td class="due">' + (dueAt[x.n] || '') + '</td></tr>').join('') +
          '</tbody></table><ul class="cal">' + (S.calendar.pairing ? '<li>' + esc(S.calendar.pairing) + '</li>' : '') + S.calendar.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '<li>Dates from the <a href="' + esc(S.calendar.url) + '" target="_blank" rel="noopener">' + esc(S.calendar.source) + '</a>.</li></ul>';
      } });
    h += '</section>';
  });
  $('doc-body').innerHTML = h;
  $('plain').onchange = e => $('doc').classList.toggle('plain', e.target.checked);
})();

// ---------- one sheet, two sides ----------
const body = document.body, calmly = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DRAW = calmly ? 0 : 500, TURN = calmly ? 0 : 850, MELT = calmly ? 0 : 500;
let mode = 'ask', timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
function setMode(m, focus){
  timers.forEach(clearTimeout); timers = [];
  const from = body.classList.contains('turning') ? (body.classList.contains('flipped') ? 'read' : 'ask') : (body.classList.contains('read') ? 'read' : 'ask');   // which side faces us now
  mode = m;
  $('tab-ask').setAttribute('aria-pressed', m === 'ask'); $('tab-read').setAttribute('aria-pressed', m === 'read');
  $('ask').querySelector('.inner').inert = m !== 'ask'; $('doc').querySelector('.inner').inert = m !== 'read';
  body.classList.remove('melting', 'resetting');
  const rest = () => { body.classList.add('snap'); body.classList.toggle('read', m === 'read'); body.classList.remove('turning', 'flipped'); void $('card').offsetWidth; body.classList.remove('snap'); };
  const turn = () => {                                                 // switch the 3D on with the current side facing us, then turn
    body.classList.add('snap', 'turning'); body.classList.toggle('flipped', from === 'read'); body.classList.remove('read');
    void $('card').offsetWidth; body.classList.remove('snap'); body.classList.toggle('flipped', m === 'read');
  };
  if (m === 'read'){
    const drawn = body.classList.contains('outlined');
    body.classList.add('outlined');                                    // 1. the outline draws itself out of the page
    if (from === 'read' && !body.classList.contains('turning')) return;
    later(turn, drawn ? 0 : DRAW);                                     // 2. that piece turns over
    later(rest, (drawn ? 0 : DRAW) + TURN + 40);                       // 3. and lies flat as the document
    if (focus !== false) later(() => $('plain').focus({ preventScroll:true }), (drawn ? 0 : DRAW) + TURN + 60);
  } else {
    if (from === 'ask' && !body.classList.contains('turning')){ body.classList.remove('outlined'); return; }
    turn();                                                            // 1. it turns back
    later(rest, TURN + 40);                                            // 2. settles
    later(() => body.classList.add('melting'), TURN + 160);            // 3. and the outline melts into the page
    later(() => { body.classList.add('resetting'); body.classList.remove('outlined', 'melting'); void $('outline').offsetWidth; body.classList.remove('resetting'); }, TURN + 160 + MELT);
    if (focus !== false) later(() => $('q').focus({ preventScroll:true }), TURN + 60);
  }
}
function goTo(id){
  document.querySelectorAll('.pas.hit').forEach(e => e.classList.remove('hit'));
  const el = $('p-' + id), pane = $('doc').querySelector('.inner');
  const place = () => { if (!el) return; el.classList.add('hit'); el.setAttribute('tabindex', '-1');
    pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientHeight/2 + Math.min(el.offsetHeight, pane.clientHeight*0.8)/2; };
  const already = mode === 'read';
  setMode('read', false);
  if (already) place(); else later(() => { pane.scrollTop = 0; const r = el && el.offsetTop; if (el){ el.classList.add('hit'); el.setAttribute('tabindex', '-1'); pane.scrollTop = Math.max(0, r - pane.clientHeight/2 + Math.min(el.offsetHeight, pane.clientHeight*0.8)/2); } }, DRAW + 30);   // find the place while the sheet is edge-on
  if (el) later(() => el.focus({ preventScroll:true }), DRAW + TURN + 80);
}
$('tab-ask').onclick = () => setMode('ask'); $('tab-read').onclick = () => setMode('read');
addEventListener('keydown', e => { if (e.key === 'Escape' && mode === 'read' && !body.classList.contains('intro')) setMode('ask'); });
const stage = $('stage'); stage.addEventListener('scroll', () => { if (stage.scrollTop || stage.scrollLeft){ stage.scrollTop = 0; stage.scrollLeft = 0; } });
$('ask').querySelector('.inner').inert = false; $('doc').querySelector('.inner').inert = true;

// ---------- the opening ----------
const everything = S.passages.map(p => p.text.join(' ')).join(' ').replace(/\s+/g, ' ') + ' ';
function opening(){ try { localStorage.setItem('protocol-seen', '1'); } catch (e) {}                 // marked as seen the moment it starts
  if (window.ProtocolIntro) ProtocolIntro.play(everything, () => { $('q').focus({ preventScroll:true }); }); }
$('replay').onclick = opening;
let seen = false; try { seen = !!localStorage.getItem('protocol-seen'); } catch (e) {}
const introMode = CFG.INTRO || 'first-visit';
if (!calmly && introMode !== 'never' && (introMode === 'always' || !seen) && innerWidth >= 700) opening(); else body.classList.remove('intro');
window.__protocol = { ask, setMode, search, localAnswer };
} catch (e) {
  document.body.classList.remove('intro');
  $('answer').innerHTML = '<p style="padding:20px 0">The syllabus file has a mistake in it and the page could not be built. Check data/syllabus.json. (' + esc(e.message) + ')</p>'; $('box') && $('box').classList.add('open');
}
})();
