// ============================================================
//  🏎️ RaceFire — index.js  (Free Movement + Fixed Controls)
// ============================================================

const TOTAL_LAPS  = 3;
const TRACK_HALF  = 75;   // نصف عرض المضمار بالبكسل
const CAR_COLORS  = ['#ff2244','#00aaff','#ffcc00','#00ff88'];
const CAR_EMOJIS  = ['🔴','🔵','🟡','🟢'];
const AI_NAMES    = ['خالد 🤖','سارة 🤖','علي 🤖'];

const TRACK_PTS = [
  {x:.50,y:.10},{x:.80,y:.13},{x:.88,y:.28},
  {x:.84,y:.46},{x:.70,y:.56},{x:.58,y:.50},
  {x:.54,y:.62},{x:.64,y:.76},{x:.68,y:.89},
  {x:.50,y:.93},{x:.32,y:.89},{x:.22,y:.76},
  {x:.30,y:.62},{x:.36,y:.50},{x:.24,y:.46},
  {x:.12,y:.40},{x:.14,y:.24},{x:.30,y:.13},
];

let myName='أنت', oppCount=1;
let running=false, raf=null, lastT=0, raceT0=0;
let canvas, ctx, W, H;
let track=[], segD=[], trackLen=0;
let cars=[];

// حالة المفاتيح
const K = { L:false, R:false, G:false };

// ===== LOBBY =====
function selectOpponents(n){
  oppCount = n;
  document.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.opp-btn[data-count="${n}"]`).classList.add('active');
}

function goToGame(){
  myName = document.getElementById('playerName').value.trim() || 'أنت';
  countdown(3, startRace);
}

function goLobby(){
  running = false;
  if(raf) cancelAnimationFrame(raf);
  showScreen('lobby');
}

// ===== COUNTDOWN =====
function countdown(n, cb){
  showScreen('countdown');
  const el = document.getElementById('countNum');
  el.style.color = 'var(--neon-yellow)';
  if(n > 0){
    el.textContent = n;
    setTimeout(() => countdown(n-1, cb), 900);
  } else {
    el.textContent = 'GO!';
    el.style.color = '#00ff88';
    setTimeout(cb, 700);
  }
}

// ===== START =====
function startRace(){
  showScreen('game');
  setTimeout(() => {
    canvas = document.getElementById('gameCanvas');
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    buildTrack();
    spawnCars();
    setupControls();
    running = true;
    raceT0  = lastT = performance.now();
    raf     = requestAnimationFrame(loop);
  }, 80);
}

function resize(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;';
  buildTrack();
}

// ===== TRACK =====
function buildTrack(){
  track = TRACK_PTS.map(p => ({ x: p.x*W, y: p.y*H }));
  segD  = [0];
  for(let i=1; i<track.length; i++)
    segD.push(segD[i-1] + Math.hypot(track[i].x-track[i-1].x, track[i].y-track[i-1].y));
  trackLen = segD[segD.length-1] +
    Math.hypot(track[0].x-track[track.length-1].x, track[0].y-track[track.length-1].y);
}

function trackAt(prog){
  const dist = ((prog%1)+1)%1 * trackLen;
  const n = track.length;
  let seg = n-1;
  for(let i=0; i<n-1; i++){ if(dist <= segD[i+1]){ seg=i; break; } }
  const p1=track[seg], p2=seg===n-1?track[0]:track[seg+1];
  const s=segD[seg], e=seg===n-1?trackLen:segD[seg+1];
  const t = e>s ? (dist-s)/(e-s) : 0;
  return { x:p1.x+(p2.x-p1.x)*t, y:p1.y+(p2.y-p1.y)*t, a:Math.atan2(p2.y-p1.y,p2.x-p1.x) };
}

function closest(x, y){
  const n = track.length;
  let bD=Infinity, bT=0, bS=0;
  for(let i=0; i<n; i++){
    const p1=track[i], p2=i===n-1?track[0]:track[i+1];
    const dx=p2.x-p1.x, dy=p2.y-p1.y, lq=dx*dx+dy*dy;
    let t = lq>0 ? ((x-p1.x)*dx+(y-p1.y)*dy)/lq : 0;
    t = Math.max(0, Math.min(1,t));
    const cx=p1.x+t*dx, cy=p1.y+t*dy;
    const d = Math.hypot(x-cx, y-cy);
    if(d < bD){ bD=d; bT=t; bS=i; }
  }
  const p1=track[bS], p2=bS===n-1?track[0]:track[bS+1];
  const cx=p1.x+bT*(p2.x-p1.x), cy=p1.y+bT*(p2.y-p1.y);
  const s=segD[bS], e=bS===n-1?trackLen:segD[bS+1];
  const prog = (s + bT*(e-s)) / trackLen;
  return { cx, cy, a:Math.atan2(p2.y-p1.y,p2.x-p1.x), dist:bD, prog };
}

// ===== CARS =====
function spawnCars(){
  cars = [];
  const total = 1 + oppCount;
  for(let i=0; i<total; i++){
    const p0 = 0.01 + i*0.025;
    const tp  = trackAt(p0);
    const off = (i - (total-1)/2) * 22;
    const nx  = -Math.sin(tp.a), ny = Math.cos(tp.a);
    cars.push({
      id:i, name: i===0 ? myName : AI_NAMES[i-1],
      x: tp.x+nx*off, y: tp.y+ny*off,
      vx:0, vy:0,
      angle: tp.a + Math.PI/2,
      speed: 0,
      rawProg: p0, prevRaw: p0, lap: 1,
      progress: p0,
      finished: false, ft: null,
      isMe: i===0,
      sk: 0.80+Math.random()*0.28, noise: 0
    });
  }
}

// ===== LOOP =====
function loop(ts){
  const dt = Math.min((ts-lastT)/1000, .05);
  lastT = ts;
  update(dt);
  draw();
  if(running) raf = requestAnimationFrame(loop);
}

// ===== UPDATE =====
function update(dt){
  for(const c of cars){
    if(c.finished) continue;

    const maxSpd = c.isMe ? 240 : (145+c.id*15)*c.sk;
    let steer=0, gas=false;

    if(c.isMe){
      steer = K.L ? -1 : K.R ? 1 : 0;
      gas   = K.G;
    } else {
      const la = trackAt(c.rawProg + 0.014*c.sk);
      let da = Math.atan2(la.y-c.y, la.x-c.x) - c.angle + Math.PI/2;
      while(da >  Math.PI) da -= Math.PI*2;
      while(da < -Math.PI) da += Math.PI*2;
      c.noise = c.noise*.88 + (Math.random()-.5)*.3;
      steer   = Math.max(-1, Math.min(1, da*3+c.noise));
      gas     = true;
    }

    // دوران
    const sr = Math.min(c.speed/maxSpd, 1);
    c.angle += steer * 3.2 * dt * (.2+sr*.8);

    // تسريع
    if(gas){
      const dir = c.angle - Math.PI/2;
      c.vx += Math.cos(dir) * 520 * dt;
      c.vy += Math.sin(dir) * 520 * dt;
    }

    // احتكاك
    const fric = Math.pow(.86, dt*60);
    c.vx *= fric; c.vy *= fric;

    // حد السرعة
    c.speed = Math.hypot(c.vx, c.vy);
    if(c.speed > maxSpd){
      const f = maxSpd/c.speed; c.vx*=f; c.vy*=f; c.speed=maxSpd;
    }

    // حركة
    c.x += c.vx*dt;
    c.y += c.vy*dt;

    // حدود المضمار
    const cl = closest(c.x, c.y);
    if(cl.dist > TRACK_HALF){
      const excess = (cl.dist-TRACK_HALF)/cl.dist;
      c.x += (cl.cx-c.x)*excess*1.1;
      c.y += (cl.cy-c.y)*excess*1.1;
      c.vx *= .4; c.vy *= .4; c.speed *= .4;
    }

    // تتبع لفات
    c.prevRaw = c.rawProg;
    c.rawProg  = closest(c.x, c.y).prog;

    if(c.prevRaw > .9 && c.rawProg < .1){
      if(c.lap < TOTAL_LAPS){
        c.lap++;
        if(c.isMe) showToast(`✅ لفّة ${c.lap} / ${TOTAL_LAPS}`);
      } else if(!c.finished){
        c.finished = true; c.ft = performance.now()-raceT0;
        if(c.isMe){ showToast('🏁 أكملت السباق!'); setTimeout(showResults,1800); }
      }
    }
    c.progress = (c.lap-1) + c.rawProg;
  }
  updateHUD();
  updateLB();
}

// ===== DRAW =====
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#060609'; ctx.fillRect(0,0,W,H);
  drawTrack();
  drawCars();
}

function strokeLoop(col, w, dash=[]){
  const n=track.length;
  ctx.strokeStyle=col; ctx.lineWidth=w;
  ctx.lineCap=ctx.lineJoin='round';
  ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(track[0].x,track[0].y);
  for(let i=1;i<n;i++) ctx.lineTo(track[i].x,track[i].y);
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
}

function strokeSide(col, off){
  const n=track.length, pts=[];
  for(let i=0;i<n;i++){
    const p1=track[i], p2=i===n-1?track[0]:track[i+1];
    const a=Math.atan2(p2.y-p1.y,p2.x-p1.x);
    pts.push({ x:p1.x-Math.sin(a)*off, y:p1.y+Math.cos(a)*off });
  }
  ctx.strokeStyle=col; ctx.lineWidth=3;
  ctx.lineCap=ctx.lineJoin='round'; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<n;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.closePath(); ctx.stroke();
}

function drawTrack(){
  strokeLoop('rgba(10,55,10,.6)',        TRACK_HALF*2.7);
  strokeLoop('#13131d',                   TRACK_HALF*2);
  strokeLoop('rgba(255,255,255,.025)',    TRACK_HALF*2-10);
  strokeLoop('rgba(255,200,0,.5)',        2.5);
  strokeLoop('rgba(255,255,255,.1)',      1.5, [18,16]);
  strokeSide('rgba(255,255,255,.3)',      TRACK_HALF);
  strokeSide('rgba(255,255,255,.3)',     -TRACK_HALF);

  const sp=track[0], np=track[1];
  const a=Math.atan2(np.y-sp.y,np.x-sp.x);
  const px=Math.cos(a+Math.PI/2), py=Math.sin(a+Math.PI/2);
  ctx.save();
  for(let i=-5;i<5;i++){
    ctx.fillStyle = i%2===0?'#fff':'#111';
    ctx.fillRect(sp.x+px*i*11-5, sp.y+py*i*11-5, 11,11);
  }
  ctx.fillStyle='rgba(255,255,255,.55)';
  ctx.font='bold 12px Orbitron,monospace';
  ctx.textAlign='center';
  ctx.shadowColor='#000'; ctx.shadowBlur=5;
  ctx.fillText('START', sp.x, sp.y-TRACK_HALF-12);
  ctx.restore();
}

function drawCars(){
  for(const c of cars){
    const cw=c.isMe?16:13, ch=c.isMe?26:20;
    ctx.save();
    ctx.translate(c.x,c.y);
    ctx.rotate(c.angle);
    ctx.shadowColor=CAR_COLORS[c.id]; ctx.shadowBlur=c.isMe?24:14;

    ctx.fillStyle=CAR_COLORS[c.id];
    ctx.beginPath(); ctx.roundRect(-cw/2,-ch/2,cw,ch,4); ctx.fill();

    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.fillRect(-cw/2+1,-ch/2+1,cw-2,ch/2.5);

    ctx.fillStyle='rgba(120,220,255,.55)';
    ctx.fillRect(-cw/2+2,-ch/2+3,cw-4,ch/3.2);

    ctx.shadowBlur=0; ctx.fillStyle='#0a0a0a';
    [[-cw/2-3,-ch/4],[cw/2-1,-ch/4],[-cw/2-3,ch/6],[cw/2-1,ch/6]]
      .forEach(([wx,wy]) => ctx.fillRect(wx,wy,4,ch/3.5));

    if(c.isMe && K.G && c.speed>50){
      const fs=8+Math.random()*12;
      const g=ctx.createLinearGradient(0,ch/2,0,ch/2+fs);
      g.addColorStop(0,'rgba(255,120,0,1)'); g.addColorStop(1,'rgba(255,0,0,0)');
      ctx.fillStyle=g;
      [-3,3].forEach(xo=>{
        ctx.beginPath();
        ctx.ellipse(xo,ch/2+fs*.4,2.5,fs*.5,0,0,Math.PI*2); ctx.fill();
      });
    }
    ctx.restore();

    if(c.isMe){
      ctx.save();
      ctx.fillStyle='rgba(255,210,0,.95)';
      ctx.font='bold 12px Cairo,sans-serif';
      ctx.textAlign='center';
      ctx.shadowColor='#000'; ctx.shadowBlur=5;
      ctx.fillText('▲ '+myName, c.x, c.y-24);
      ctx.restore();
    }
  }
}

// ===== HUD =====
function updateHUD(){
  const me=cars[0]; if(!me) return;
  document.getElementById('lapDisplay').textContent  = `${Math.min(me.lap,TOTAL_LAPS)} / ${TOTAL_LAPS}`;
  document.getElementById('speedDisplay').textContent = Math.round(me.speed);
}

function updateLB(){
  const s=[...cars].sort((a,b)=>a.finished!==b.finished?(a.finished?-1:1):b.progress-a.progress);
  document.getElementById('lbRows').innerHTML=s.map((c,i)=>`
    <div class="lb-row ${c.isMe?'me':''}">
      <span class="lb-pos">${i+1}</span>
      <span class="lb-car">${CAR_EMOJIS[c.id]}</span>
      <span class="lb-name">${c.name}</span>
      <span class="lb-lap">L${Math.min(c.lap,TOTAL_LAPS)}</span>
    </div>`).join('');
}

// ===== RESULTS =====
function showResults(){
  running=false;
  if(raf) cancelAnimationFrame(raf);
  const s=[...cars].sort((a,b)=>{
    if(a.finished!==b.finished) return a.finished?-1:1;
    if(a.ft!=null&&b.ft!=null) return a.ft-b.ft;
    return b.progress-a.progress;
  });
  const win=s[0];
  document.getElementById('winnerTitle').textContent = win.isMe?'🏆 أنت الفائز!':`🏆 فاز ${win.name}`;
  const me=s.find(c=>c.isMe);
  document.getElementById('resultTime').textContent = me?.ft ? `⏱️ وقتك: ${(me.ft/1000).toFixed(2)} ثانية` : '';
  const disp = s.length>=3?[s[1],s[0],s[2]]:s.length===2?[null,s[0],s[1]]:[null,s[0],null];
  document.getElementById('podium').innerHTML=disp.map((c,i)=>c?`
    <div class="podium-place ${['p2','p1','p3'][i]}">
      <div class="podium-car">${CAR_EMOJIS[c.id]}</div>
      <div class="podium-name">${c.name}</div>
      <div class="podium-block">${['2','1','3'][i]}</div>
    </div>`:'<div class="podium-place"></div>').join('');
  showScreen('results');
  if(win.isMe) launchConfetti();
}

// ===== CONTROLS =====
function setupControls(){
  function bind(id, key){
    const el = document.getElementById(id);
    el.addEventListener('touchstart',  e=>{ e.preventDefault(); K[key]=true;  el.classList.add('pressed');    }, {passive:false});
    el.addEventListener('touchend',    e=>{ e.preventDefault(); K[key]=false; el.classList.remove('pressed'); }, {passive:false});
    el.addEventListener('touchcancel', e=>{ K[key]=false; el.classList.remove('pressed'); });
    el.addEventListener('mousedown',   e=>{ K[key]=true;  el.classList.add('pressed'); });
    el.addEventListener('mouseup',     e=>{ K[key]=false; el.classList.remove('pressed'); });
    el.addEventListener('mouseleave',  e=>{ K[key]=false; el.classList.remove('pressed'); });
  }
  bind('btnLeft',  'L');
  bind('btnRight', 'R');
  bind('btnGas',   'G');
}

document.addEventListener('keydown', e=>{
  if(['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); K.L=true; }
  if(['ArrowRight','d','D'].includes(e.key)){ e.preventDefault(); K.R=true; }
  if(['ArrowUp','w','W',' '].includes(e.key)){ e.preventDefault(); K.G=true; }
});
document.addEventListener('keyup', e=>{
  if(['ArrowLeft','a','A'].includes(e.key))  K.L=false;
  if(['ArrowRight','d','D'].includes(e.key)) K.R=false;
  if(['ArrowUp','w','W',' '].includes(e.key)) K.G=false;
});
document.addEventListener('contextmenu', e=>e.preventDefault());

// ===== SCREENS =====
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ===== TOAST =====
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

// ===== CONFETTI =====
function launchConfetti(){
  const c=document.getElementById('confettiContainer'); c.innerHTML='';
  const cols=['#ff2244','#ffcc00','#00aaff','#00ff88','#ff6600','#fff'];
  for(let i=0;i<100;i++){
    const p=document.createElement('div'); p.className='confetti-piece';
    p.style.cssText=`left:${Math.random()*100}%;background:${cols[Math.floor(Math.random()*cols.length)]};animation-duration:${1.4+Math.random()*2}s;animation-delay:${Math.random()*.6}s;width:${5+Math.random()*8}px;height:${5+Math.random()*8}px;`;
    c.appendChild(p);
  }
  setTimeout(()=>c.innerHTML='', 5000);
}
