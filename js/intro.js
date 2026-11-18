// The opening. The whole syllabus is set as one block of type; letter weight follows two photographs,
// so the head appears in the text, turns to face the reader, says one line, and falls away.
(function(){
const L1 = "Protocol: ask the syllabus first.", L2 = "Save Rick the good ones.", TAG = L1 + " " + L2;
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif', LEVELS = 14, PAPER = '#f3f0e8';
const T = { page:0.5, emerge:1.5, turn0:2.0, turn1:3.5, red:3.8, grow0:5.0, grow1:5.9, fall:6.25, land:7.35, rise0:8.5, rise1:9.3, end:9.9 };
let cv, ctx, TEXT = "", W, H, dpr, fs, lh, G = [], ZONE = [], still, atlas, cell, tex = {}, head, tagIdx = [], heads, raf = 0, t0 = 0, onDone = null, running = false;

const clamp = (x,a=0,b=1) => Math.max(a, Math.min(b, x));
const lerp = (a,b,t) => a + (b-a)*t;
const ease = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const seg = (t,a,b) => clamp((t-a)/(b-a));
const sst = (a,b,x) => { const t = clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const rnd = i => { const x = Math.sin(i*127.1+311.7)*43758.5453; return x - Math.floor(x); };

function loadTex(src){
  return new Promise((res, rej) => { const im = new Image(); im.onerror = rej; im.onload = () => {
    const o = document.createElement('canvas'); o.width = im.width; o.height = im.height;
    const x = o.getContext('2d'); x.drawImage(im,0,0);
    const d = x.getImageData(0,0,o.width,o.height).data, a = new Float32Array(o.width*o.height);
    for (let i=0;i<a.length;i++) a[i] = 1 - d[i*4]/255;
    const t = { w:o.width, h:o.height, a }; extents(t); res(t);
  }; im.src = src; });
}
function extents(t){                      // per row: where the head starts and ends, smoothed
  const l = new Float32Array(t.h), r = new Float32Array(t.h), ok = new Uint8Array(t.h);
  for (let y=0;y<t.h;y++){ let a=-1,b=-1;
    for (let x=0;x<t.w;x++) if (t.a[y*t.w+x]>0.14){ if(a<0)a=x; b=x; }
    if (a>=0){ ok[y]=1; l[y]=a/(t.w-1)*2-1; r[y]=b/(t.w-1)*2-1; } }
  let first=0; while(first<t.h&&!ok[first]) first++; let last=t.h-1; while(last>0&&!ok[last]) last--;
  for (let y=0;y<t.h;y++) if(!ok[y]){ const n = y<first?first:(y>last?last:y); let m=n; while(!ok[m]) m--; const c=(l[m]+r[m])/2; l[y]=r[y]=c; }
  const sm = a => { const o=new Float32Array(a.length), k=5; for(let y=0;y<a.length;y++){ let s=0,n=0; for(let d=-k;d<=k;d++){ const q=y+d; if(q>=0&&q<a.length){s+=a[q];n++;} } o[y]=s/n; } return o; };
  t.l = sm(l); t.r = sm(r);
}
const rowAt = (arr, v) => { const y = clamp(v)*(arr.length-1), y0 = y|0, f = y-y0; return arr[y0]*(1-f) + arr[Math.min(arr.length-1,y0+1)]*f; };
function sample(t, u, v){
  if (u<=-1||u>=1||v<=0||v>=1) return 0;
  const x = (u*.5+.5)*(t.w-1), y = v*(t.h-1), x0 = x|0, y0 = y|0, fx = x-x0, fy = y-y0, i = y0*t.w+x0, a = t.a;
  const x1 = x0+1<t.w?1:0, y1 = y0+1<t.h?t.w:0;
  return (a[i]*(1-fx)+a[i+x1]*fx)*(1-fy) + (a[i+y1]*(1-fx)+a[i+y1+x1]*fx)*fy;
}

function setup(){
  dpr = Math.min(window.devicePixelRatio||1, 2); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  const hh = Math.min(H*0.9, W*1.05);
  head = { cx:W/2, top:(H-hh)/2, h:hh, rP:hh*0.943/2, rF:hh*0.738/2 };
  fs = clamp(hh/104, 6.5, 11); lh = fs*1.06;
  const chars = Array.from(new Set((TEXT+TAG).split('')));
  cell = { w:Math.ceil(fs*1.25*dpr)+4, h:Math.ceil(fs*1.5*dpr)+4, base:Math.ceil(fs*1.08*dpr)+2 };
  atlas = document.createElement('canvas'); atlas.width = cell.w*chars.length; atlas.height = cell.h*(LEVELS+1);
  const ax = atlas.getContext('2d'); ax.font = `${fs*dpr}px ${FONT}`; ax.textBaseline = 'alphabetic'; ax.lineJoin = 'round';
  const col = {}; chars.forEach((c,i)=>col[c]=i);
  for (let L=0; L<=LEVELS; L++){
    const k = L/LEVELS, g = Math.round(L===0 ? 224 : lerp(186, 10, Math.pow(Math.min(1,k/0.72),1.15)));
    ax.fillStyle = ax.strokeStyle = `rgb(${g},${g-2},${g-8})`; ax.lineWidth = Math.pow(Math.max(0,(k-.42)/.58),1.1)*fs*dpr*0.5;
    chars.forEach((c,i)=>{ const x=i*cell.w+2, y=L*cell.h+cell.base; if(ax.lineWidth>0.05) ax.strokeText(c,x,y); ax.fillText(c,x,y); });
  }
  ctx.font = `${fs}px ${FONT}`;
  const wc = {}, cw = c => wc[c] ?? (wc[c] = ctx.measureText(c).width);
  const tagW = ctx.measureText(TAG).width, tagRow = Math.round((head.top + head.h*0.715)/lh);
  G = []; tagIdx = []; let n = 0, x = 10, row = 1, placed = false;
  while (row*lh < H + lh){
    if (row===tagRow && !placed && x >= head.cx - tagW/2 - 2){
      for (const c of TAG){ tagIdx.push(G.length); G.push({ c, x, y:row*lh, w:cw(c), col:col[c], tag:tagIdx.length-1 }); x += cw(c); }
      placed = true; continue;
    }
    const c = TEXT[n % TEXT.length]; n++;
    if (x<=10 && c===' ') continue;
    const w = cw(c);
    if (x + w > W - 10){ x = 10; row++; n--; continue; }
    G.push({ c, x, y:row*lh, w, col:col[c], tag:-1 }); x += w;
  }
  G.forEach((g,i)=>{ g.d = rnd(i)*0.55; g.dx = (rnd(i+9e3)-.5)*90; g.ink = 0;
    g.zone = Math.abs(g.x - head.cx) < head.rP*1.14 && g.y > head.top - lh && g.y < head.top + head.h + lh; });
  ZONE = G.filter(g => g.zone);
  still = document.createElement('canvas'); still.width = cv.width; still.height = cv.height;
  const sx = still.getContext('2d');
  for (const g of G) if (!g.zone) sx.drawImage(atlas, g.col*cell.w, 0, cell.w, cell.h, Math.round(g.x*dpr)-2, Math.round(g.y*dpr)-cell.base, cell.w, cell.h);
  // where the line lands: centre stage, then exactly on the page's real heading
  const place = (size, rows) => { ctx.font = `600 ${size}px ${FONT}`; const out = [];
    rows.forEach(([s,y]) => { const x0 = W/2 - ctx.measureText(s).width/2; for (let i=0;i<s.length;i++) out.push({ x:x0+ctx.measureText(s.slice(0,i)).width, y }); });
    return out; };
  const big = Math.min(W*0.05, 64);
  const a = place(big, [[L1, H*0.47 - big*0.35],[L2, H*0.47 + big*0.9]]);
  const e1 = document.getElementById('l1'), e2 = document.getElementById('l2');
  let small = clamp(W*0.021, 15, 24), y1 = 50, y2 = 80;
  if (e1 && e2){ small = parseFloat(getComputedStyle(e1).fontSize); const r1 = e1.getBoundingClientRect(), r2 = e2.getBoundingClientRect();
    y1 = r1.top + r1.height/2 + small*0.36; y2 = r2.top + r2.height/2 + small*0.36; }
  heads = { big, small, a, b: place(small, [[L1,y1],[L2,y2]]) };
}

function inkAt(g, s, cx, emerge){
  const v = (g.y - fs*.35 - head.top)/head.h; if (v<=0||v>=1) return 0;
  const P = tex.profile, F = tex.front, pl = rowAt(P.l,v), pr = rowAt(P.r,v), fl = rowAt(F.l,v), fr = rowAt(F.r,v);
  const Lp = lerp(pl*head.rP, fl*head.rF, s), Rp = lerp(pr*head.rP, fr*head.rF, s), dx = g.x + g.w*.5 - cx;
  if (dx<=Lp || dx>=Rp || Rp-Lp<2) return 0;
  const xh = 2*(dx-Lp)/(Rp-Lp)-1, a = Math.asin(xh), q = Math.PI/2;
  const ap = a + q*s, af = a - q*(1-s);                  // where this spot sat in each photograph
  const mix = sst(.28,.72,s), wp = (1-mix)*(ap<q?1:0), wf = mix*(af>-q?1:0), sum = wp+wf; if (sum<=0) return 0;
  const up = pl + (Math.sin(ap)+1)/2*(pr-pl), uf = fl + (Math.sin(af)+1)/2*(fr-fl);
  let k = (wp*sample(P, up, v) + wf*sample(F, uf, v))/sum;
  k *= Math.min(1, (dx-Lp)/5, (Rp-dx)/5);
  k = clamp((k-0.10)/0.74); k = k*k*(3-2*k)*0.35 + k*0.65;
  return k*emerge;
}

function render(t){
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle = PAPER; ctx.fillRect(0,0,cv.width,cv.height);
  const page = seg(t,0,T.page), emerge = ease(seg(t,T.page,T.emerge)), s = ease(seg(t,T.turn0,T.turn1));
  const R = lerp(head.rP, head.rF, s), cx = head.cx - (1-s)*head.h*0.035;
  const spin = Math.sin(Math.PI*seg(t,T.turn0,T.turn1)), red = seg(t,T.red,T.red+.5), falling = t>=T.fall;
  ctx.globalAlpha = page;
  if (!falling) ctx.drawImage(still, 0, 0);
  const LIST = falling ? G : ZONE;
  if (t < T.land + 1.2) for (let i=0;i<LIST.length;i++){
    const g = LIST[i]; if (g.tag>=0 && t>=T.red) continue;
    let x = g.x, y = g.y;
    if (!falling){
      g.ink = inkAt(g, s, cx, emerge);
      if (spin>0){ const hx=(g.x+g.w*.5-cx)/R; if (hx>-1&&hx<1) x -= spin*Math.sqrt(1-hx*hx)*R*0.10*(g.ink>0.02?1:0.35); }
    } else { const tau = t - T.fall - g.d; if (tau>0){ y += 1900*tau*tau; x += g.dx*tau; if (y>H+30) continue; } }
    const L = Math.round(g.ink*LEVELS);
    ctx.drawImage(atlas, g.col*cell.w, L*cell.h, cell.w, cell.h, Math.round(x*dpr)-2, Math.round(y*dpr)-cell.base, cell.w, cell.h);
  }
  ctx.globalAlpha = 1;
  if (t >= T.red){                                         // the one line: reddens on the mouth, holds, grows, leaves
    const grow = ease(seg(t,T.grow0,T.grow1)), fly = seg(t,T.fall,T.land), rise = ease(seg(t,T.rise0,T.rise1));
    const first = G[tagIdx[0]], lastg = G[tagIdx[tagIdx.length-1]], tw = lastg.x + lastg.w - first.x, mid = first.x + tw/2;
    const gmax = Math.min(4.8, W*0.84/tw), gs = lerp(1, gmax, grow), gy = first.y + (gs-1)*fs*0.36;
    if (grow>0 && fly<1){ ctx.globalAlpha = grow*(1-ease(fly)); ctx.fillStyle = PAPER;
      const bh = fs*gs*1.9, bw = tw*gs + fs*gs*2.4;
      ctx.fillRect((mid-bw/2)*dpr, (gy - fs*gs*0.36 - bh/2)*dpr, bw*dpr, bh*dpr); ctx.globalAlpha = 1; }
    for (let j=0;j<tagIdx.length;j++){
      const g = G[tagIdx[j]]; if (g.c===' ' && j===L1.length) continue;
      const k = j>L1.length ? j-1 : j, f = ease(clamp(fly*1.25 - j*0.0045));
      const A = heads.a[k], B = heads.b[k];
      const tx = lerp(A.x,B.x,rise), ty = lerp(A.y,B.y,rise), ts = lerp(heads.big,heads.small,rise);
      const sx0 = mid + (g.x-mid)*gs, size = lerp(fs*gs, ts, f), x = lerp(sx0, tx, f), y = lerp(gy, ty, f) - Math.sin(Math.PI*f)*H*0.04;
      const rr = j < 9 ? red : red*(1-f);
      ctx.fillStyle = `rgb(${Math.round(lerp(20,194,rr))},${Math.round(lerp(19,48,rr))},${Math.round(lerp(18,15,rr))})`;
      ctx.font = `${Math.round(lerp(700,600,f))} ${size*dpr}px ${FONT}`;
      ctx.fillText(g.c, x*dpr, y*dpr);
    }
  }
}

function frame(now){ const t = (now - t0)/1000; render(Math.min(t, T.end)); if (t < T.end) raf = requestAnimationFrame(frame); else finish(); }
function finish(){
  if (!running) return; running = false; cancelAnimationFrame(raf);
  cv.classList.add('gone'); document.body.classList.remove('intro');
  const sk = document.getElementById('skip'); if (sk) sk.hidden = true;
  setTimeout(() => { cv.style.display = 'none'; }, 600);
  if (onDone) onDone();
}
async function play(text, done){
  cv = document.getElementById('intro'); ctx = cv.getContext('2d'); TEXT = text; onDone = done;
  try { if (!tex.front){ [tex.profile, tex.front] = await Promise.all([loadTex('assets/profile.png'), loadTex('assets/front.png')]); } }
  catch (e) { running = true; return finish(); }              // no pictures, no opening: go straight to the page
  cv.style.display = 'block'; cv.classList.remove('gone'); document.body.classList.add('intro');
  const sk = document.getElementById('skip'); sk.hidden = false; sk.onclick = finish;
  setup(); running = true; t0 = performance.now(); raf = requestAnimationFrame(frame);
  window.__seek = t => { cancelAnimationFrame(raf); render(t); };
}
addEventListener('keydown', e => { if (running){ e.preventDefault(); finish(); } });                         // any key or any click skips
addEventListener('pointerdown', () => { if (running) finish(); });
window.ProtocolIntro = { play, skip: finish, length: T.end };
})();
