// ================================================================
//  TurboStrike — game.js
//  حركة حرة | تيربو مؤقت | قدرة إبطاء الخصم | مضمار عريض
// ================================================================

const LAPS       = 3;
const TW         = 100;   // نصف عرض المضمار (200px إجمالي)
const TURBO_MAX  = 100;
const SLOW_MAX   = 100;
const SLOW_DUR   = 3000;  // مدة البطء بالمللي ثانية

const COLORS = ['#ff2244','#00aaff','#ffcc00','#00ff88'];
const ICONS  = ['🔴','🔵','🟡','🟢'];
const BOTS   = ['خالد 🤖','سارة 🤖','علي 🤖'];

// مسار المضمار — نسب
const PATH = [
  {x:.50,y:.08},{x:.78,y:.11},{x:.88,y:.22},
  {x:.90,y:.38},{x:.82,y:.52},{x:.68,y:.58},
  {x:.60,y:.52},{x:.55,y:.63},{x:.64,y:.75},
  {x:.68,y:.88},{x:.50,y:.93},{x:.32,y:.88},
  {x:.36,y:.75},{x:.45,y:.63},{x:.40,y:.52},
  {x:.22,y:.52},{x:.12,y:.42},{x:.14,y:.26},
  {x:.24,y:.14},
];

// ===== STATE =====
let myName = 'أنت', oppCount = 1;
let W, H, canvas, ctx;
let track = [], segD = [], tLen = 0;
let cars = [];
let running = false, raf = null, lastT = 0, t0 = 0;

// مفاتيح اللاعب
const K = { up:false, down:false, left:false, right:false, turbo:false, slow:false };

// جويستيك
const joystick = {
  active:false, id:null,
  baseX:0, baseY:0,
  curX:0, curY:0,
  nx:0, ny:0,   // normalized -1..1
  radius:55,
};

// ===== LOBBY =====
document.querySelectorAll('.opp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    oppCount = +btn.dataset.n;
  });
});

document.getElementById('startBtn').addEventListener('click', () => {
  myName = document.getElementById('playerName').value.trim() || 'أنت';
  doCountdown(3, initRace);
});

function goLobby(){
  running = false;
  if(raf) cancelAnimationFrame(raf);
  show('sLobby');
}

// ===== COUNTDOWN =====
function doCountdown(n, cb){
  show('sCountdown');
  const el = document.getElementById('cdNum');
  el.style.color = '#ffcc00';
  if(n > 0){
    el.textContent = n;
    // إعادة animation
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
    setTimeout(() => doCountdown(n-1, cb), 900);
  } else {
    el.textContent = 'GO!';
    el.style.color = '#00ff88';
    setTimeout(cb, 700);
  }
}

// ===== INIT =====
function initRace(){
  show('sGame');
  setTimeout(() => {
    canvas = document.getElementById('c');
    ctx    = canvas.getContext('2d');
    onResize();
    window.addEventListener('resize', onResize);
    buildTrack();
    spawnCars();
    bindControls();
    setupJoystickTouch();
    running = true;
    t0 = lastT = performance.now();
    raf = requestAnimationFrame(gameLoop);
  }, 60);
}

function onResize(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildTrack();
}

// ===== TRACK =====
function buildTrack(){
  track = PATH.map(p => ({ x: p.x*W, y: p.y*H }));
  segD  = [0];
  for(let i=1; i<track.length; i++)
    segD.push(segD[i-1] + dist2(track[i-1], track[i]));
  tLen = segD[segD.length-1] + dist2(track[track.length-1], track[0]);
}

function dist2(a, b){ return Math.hypot(b.x-a.x, b.y-a.y); }

function ptAt(prog){
  const d = ((prog%1)+1)%1 * tLen;
  const n = track.length;
  let s = n-1;
  for(let i=0; i<n-1; i++) if(d <= segD[i+1]){ s=i; break; }
  const p1=track[s], p2=s===n-1?track[0]:track[s+1];
  const e = s===n-1?tLen:segD[s+1];
  const t = e>segD[s] ? (d-segD[s])/(e-segD[s]) : 0;
  return { x:p1.x+(p2.x-p1.x)*t, y:p1.y+(p2.y-p1.y)*t, a:Math.atan2(p2.y-p1.y,p2.x-p1.x) };
}

function nearestPt(x, y){
  const n = track.length;
  let bD=Infinity, bT=0, bS=0;
  for(let i=0; i<n; i++){
    const p1=track[i], p2=i===n-1?track[0]:track[i+1];
    const dx=p2.x-p1.x, dy=p2.y-p1.y, lq=dx*dx+dy*dy;
    let t = lq>0 ? ((x-p1.x)*dx+(y-p1.y)*dy)/lq : 0;
    t = Math.max(0, Math.min(1,t));
    const d = Math.hypot(x-(p1.x+t*dx), y-(p1.y+t*dy));
    if(d < bD){ bD=d; bT=t; bS=i; }
  }
  const p1=track[bS], p2=bS===n-1?track[0]:track[bS+1];
  const cx=p1.x+bT*(p2.x-p1.x), cy=p1.y+bT*(p2.y-p1.y);
  const e=bS===n-1?tLen:segD[bS+1];
  const prog=(segD[bS]+bT*(e-segD[bS]))/tLen;
  return { cx, cy, dist:bD, prog };
}

// ===== CARS =====
function spawnCars(){
  cars = [];
  const total = 1 + oppCount;
  for(let i=0; i<total; i++){
    const p0 = 0.005 + i*0.022;
    const tp  = ptAt(p0);
    const off = (i-(total-1)/2)*24;
    const nx  = -Math.sin(tp.a), ny=Math.cos(tp.a);
    cars.push({
      id:i, name:i===0?myName:BOTS[i-1],
      x: tp.x+nx*off, y: tp.y+ny*off,
      vx:0, vy:0, spd:0,
      angle: tp.a + Math.PI/2,
      rawProg:p0, prevRaw:p0, lap:1, progress:p0,
      finished:false, ft:null,
      isMe:i===0,
      // turbo & slow
      turboFuel: TURBO_MAX,
      slowCharge: SLOW_MAX,
      slowedUntil: 0,
      // AI
      sk: 0.78+Math.random()*0.3, noise:0,
    });
  }
}

// ===== GAME LOOP =====
function gameLoop(ts){
  const dt = Math.min((ts-lastT)/1000, .05);
  lastT = ts;
  update(dt, ts);
  render(ts);
  if(running) raf = requestAnimationFrame(gameLoop);
}

// ===== UPDATE =====
function update(dt, ts){
  const me = cars[0];

  for(const c of cars){
    if(c.finished) continue;

    const slowed = ts < c.slowedUntil;
    const spdMul = slowed ? 0.38 : 1;
    const maxSpd = (c.isMe ? 360 : (180+c.id*16)*c.sk) * spdMul;

    let ax=0, ay=0;

    if(c.isMe){
      // ── حركة اللاعب ──
      const isTurbo = K.turbo && c.turboFuel > 0;
      const thrust  = isTurbo ? 1100 : 720;

      if(joystick.active){
        const jLen = Math.hypot(joystick.nx, joystick.ny);
        if(jLen > 0.12){
          // السيارة تتوجه وتتحرك بنفس اتجاه الجويستيك تماماً
          const targetAngle = Math.atan2(joystick.ny, joystick.nx) + Math.PI/2;
          let da = targetAngle - c.angle;
          while(da >  Math.PI) da -= Math.PI*2;
          while(da < -Math.PI) da += Math.PI*2;
          // دوران سريع نحو الاتجاه
          c.angle += da * Math.min(1, dt*10);
          // دفع للأمام بقوة الجويستيك
          const dir = c.angle - Math.PI/2;
          ax = Math.cos(dir) * thrust * Math.min(jLen, 1);
          ay = Math.sin(dir) * thrust * Math.min(jLen, 1);
        }
      } else {
        // كيبورد
        const sr = Math.min(c.spd/maxSpd,.99);
        if(K.left)  c.angle -= 3.2*dt*(.25+sr*.75);
        if(K.right) c.angle += 3.2*dt*(.25+sr*.75);
        if(K.up){
          const dir = c.angle - Math.PI/2;
          ax = Math.cos(dir)*thrust;
          ay = Math.sin(dir)*thrust;
        }
        if(K.down){
          const dir = c.angle - Math.PI/2;
          ax = -Math.cos(dir)*250;
          ay = -Math.sin(dir)*250;
        }
      }

      // turbo fuel
      if(isTurbo){
        c.turboFuel = Math.max(0, c.turboFuel - dt*55);
      } else {
        c.turboFuel = Math.min(TURBO_MAX, c.turboFuel + dt*18);
      }

      // slow ability
      if(K.slow && c.slowCharge >= SLOW_MAX){
        c.slowCharge = 0;
        // أبطئ أقرب خصم
        let closest=null, cd=Infinity;
        for(const o of cars){
          if(o.isMe) continue;
          const d=Math.hypot(o.x-c.x, o.y-c.y);
          if(d<cd){ cd=d; closest=o; }
        }
        if(closest){
          closest.slowedUntil = ts + SLOW_DUR;
          showToast('❄️ أبطأت ' + closest.name.replace(' 🤖',''));
          addSlowFX();
        }
        K.slow = false;
        document.getElementById('btnSlow').classList.remove('pressed');
      }
      c.slowCharge = Math.min(SLOW_MAX, c.slowCharge + dt*12);

      // HUD تيربو
      const tb = document.getElementById('turboBar');
      tb.style.width = c.turboFuel+'%';
      tb.classList.toggle('low', c.turboFuel < 25);

      // تفعيل/تعطيل زر slow
      const sb = document.getElementById('btnSlow');
      sb.classList.toggle('empty', c.slowCharge < SLOW_MAX);

      // تفعيل/تعطيل زر turbo
      const tkb = document.getElementById('btnTurbo');
      tkb.classList.toggle('empty', c.turboFuel < 5);

    } else {
      // ── AI ──
      const la = ptAt(c.rawProg + 0.015*c.sk);
      let da = Math.atan2(la.y-c.y, la.x-c.x) - c.angle + Math.PI/2;
      while(da >  Math.PI) da -= Math.PI*2;
      while(da < -Math.PI) da += Math.PI*2;
      c.noise = c.noise*.87+(Math.random()-.5)*.28;
      const steer = Math.max(-1, Math.min(1, da*3+c.noise));
      const sr = Math.min(c.spd/maxSpd,.99);
      c.angle += steer*2.8*dt*(.2+sr*.8);

      const dir = c.angle-Math.PI/2;
      ax = Math.cos(dir)*480;
      ay = Math.sin(dir)*480;

      // AI يستخدم slow أحياناً على اللاعب
      if(!slowed && c.slowCharge >= SLOW_MAX && Math.random() < dt*0.15){
        const d=Math.hypot(me.x-c.x, me.y-c.y);
        if(d < W*0.4){
          me.slowedUntil = ts + SLOW_DUR;
          c.slowCharge = 0;
          showToast('❄️ ' + c.name.replace(' 🤖','') + ' أبطأك!');
          addSlowFX();
        }
      }
      c.slowCharge = Math.min(SLOW_MAX, c.slowCharge + dt*10);
    }

    // فيزياء
    c.vx = (c.vx + ax*dt) * Math.pow(.84, dt*60);
    c.vy = (c.vy + ay*dt) * Math.pow(.84, dt*60);

    c.spd = Math.hypot(c.vx, c.vy);
    if(c.spd > maxSpd){ const f=maxSpd/c.spd; c.vx*=f; c.vy*=f; c.spd=maxSpd; }

    c.x += c.vx*dt;
    c.y += c.vy*dt;

    // حدود المضمار
    const np = nearestPt(c.x, c.y);
    if(np.dist > TW){
      const ex=(np.dist-TW)/np.dist;
      c.x += (np.cx-c.x)*ex*1.15;
      c.y += (np.cy-c.y)*ex*1.15;
      c.vx *= .35; c.vy *= .35; c.spd *= .35;
    }

    // لفات
    c.prevRaw = c.rawProg;
    c.rawProg  = nearestPt(c.x,c.y).prog;

    if(c.prevRaw > .92 && c.rawProg < .08){
      if(c.lap < LAPS){
        c.lap++;
        if(c.isMe) showToast(`✅ لفّة ${c.lap} / ${LAPS}`);
      } else if(!c.finished){
        c.finished=true; c.ft=performance.now()-t0;
        if(c.isMe){ showToast('🏁 أكملت السباق!'); setTimeout(showResults,1600); }
        else { checkAllDone(); }
      }
    }
    c.progress = (c.lap-1)+c.rawProg;
  }

  updateHUD();
  updateLB();
}

function checkAllDone(){
  if(cars.every(c=>c.finished)) setTimeout(showResults,1200);
}

// ===== HUD =====
function updateHUD(){
  const me=cars[0]; if(!me) return;
  document.getElementById('valLap').textContent   = `${Math.min(me.lap,LAPS)}/${LAPS}`;
  document.getElementById('valSpeed').textContent = Math.round(me.spd);
}

function updateLB(){
  const s=[...cars].sort((a,b)=>a.finished!==b.finished?(a.finished?-1:1):b.progress-a.progress);
  document.getElementById('lbList').innerHTML=s.map((c,i)=>`
    <div class="lb-row ${c.isMe?'me':''}">
      <span class="lb-pos">${i+1}</span>
      <span class="lb-ico">${ICONS[c.id]}</span>
      <span class="lb-name">${c.name}</span>
      <span class="lb-lap">L${Math.min(c.lap,LAPS)}</span>
    </div>`).join('');
}

// ===== RENDER =====
function render(ts){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#070710'; ctx.fillRect(0,0,W,H);
  drawTrack();
  drawCars(ts);
  drawJoystick();
}

function loopStroke(col, w, dash=[]){
  const n=track.length;
  ctx.strokeStyle=col; ctx.lineWidth=w;
  ctx.lineCap=ctx.lineJoin='round';
  ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(track[0].x,track[0].y);
  for(let i=1;i<n;i++) ctx.lineTo(track[i].x,track[i].y);
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
}

function sideLine(col, off){
  const n=track.length, pts=[];
  for(let i=0;i<n;i++){
    const p1=track[i], p2=i===n-1?track[0]:track[i+1];
    const a=Math.atan2(p2.y-p1.y,p2.x-p1.x);
    pts.push({x:p1.x-Math.sin(a)*off, y:p1.y+Math.cos(a)*off});
  }
  ctx.strokeStyle=col; ctx.lineWidth=2.5;
  ctx.lineCap=ctx.lineJoin='round'; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<n;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.closePath(); ctx.stroke();
}

function drawTrack(){
  loopStroke('rgba(8,50,8,.65)',   TW*2.8);  // عشب
  loopStroke('#111120',             TW*2);    // أسفلت
  loopStroke('rgba(255,255,255,.022)', TW*2-12);
  loopStroke('rgba(255,200,0,.45)', 2.5);     // خط وسطي
  loopStroke('rgba(255,255,255,.09)', 1.5, [20,18]); // متقطع
  sideLine('rgba(255,255,255,.28)',  TW);
  sideLine('rgba(255,255,255,.28)', -TW);

  // خط البداية
  const sp=track[0], np=track[1];
  const a=Math.atan2(np.y-sp.y,np.x-sp.x);
  const px=Math.cos(a+Math.PI/2), py=Math.sin(a+Math.PI/2);
  ctx.save();
  for(let i=-6;i<6;i++){
    ctx.fillStyle=i%2===0?'#fff':'#111';
    ctx.fillRect(sp.x+px*i*11-5.5, sp.y+py*i*11-5.5, 11,11);
  }
  ctx.fillStyle='rgba(255,255,255,.55)';
  ctx.font='bold 12px Orbitron,monospace';
  ctx.textAlign='center'; ctx.shadowColor='#000'; ctx.shadowBlur=5;
  ctx.fillText('START/FINISH', sp.x, sp.y-TW-14);
  ctx.restore();
}

function drawCars(ts){
  for(const c of cars){
    const cw=c.isMe?17:13, ch=c.isMe?27:21;
    const slowed = ts < c.slowedUntil;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);

    // بريق التجميد
    if(slowed){
      ctx.shadowColor='#00aaff'; ctx.shadowBlur=30;
    } else {
      ctx.shadowColor=COLORS[c.id]; ctx.shadowBlur=c.isMe?22:12;
    }

    // جسم
    ctx.fillStyle = slowed ? '#88ccff' : COLORS[c.id];
    ctx.beginPath(); ctx.roundRect(-cw/2,-ch/2,cw,ch,4); ctx.fill();

    // ظل
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.fillRect(-cw/2+1,-ch/2+1,cw-2,ch/2.3);

    // زجاج
    ctx.fillStyle= slowed ? 'rgba(180,230,255,.7)' : 'rgba(120,220,255,.55)';
    ctx.fillRect(-cw/2+2,-ch/2+3,cw-4,ch/3.2);

    // إطارات
    ctx.shadowBlur=0; ctx.fillStyle='#080808';
    [[-cw/2-3,-ch/4],[cw/2-1,-ch/4],[-cw/2-3,ch/6],[cw/2-1,ch/6]]
      .forEach(([wx,wy])=>ctx.fillRect(wx,wy,4,ch/3.4));

    // لهب تيربو
    if(c.isMe && K.turbo && c.turboFuel>2 && c.spd>40){
      const fs=10+Math.random()*14;
      const g=ctx.createLinearGradient(0,ch/2,0,ch/2+fs);
      g.addColorStop(0,'rgba(255,140,0,1)'); g.addColorStop(1,'rgba(255,0,0,0)');
      ctx.fillStyle=g;
      [-3.5,3.5].forEach(xo=>{
        ctx.beginPath();
        ctx.ellipse(xo,ch/2+fs*.4,3,fs*.55,0,0,Math.PI*2); ctx.fill();
      });
    }

    // جليد على السيارة المبطأة
    if(slowed){
      ctx.strokeStyle='rgba(150,220,255,.6)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(-cw/2,-ch/2,cw,ch,4); ctx.stroke();
    }

    ctx.restore();

    // اسم اللاعب
    if(c.isMe){
      ctx.save();
      ctx.fillStyle='rgba(255,210,0,.95)';
      ctx.font='bold 12px Cairo,sans-serif';
      ctx.textAlign='center';
      ctx.shadowColor='#000'; ctx.shadowBlur=5;
      ctx.fillText('▲ '+myName, c.x, c.y-26);
      ctx.restore();
    }
  }
}

// ===== RESULTS =====
function showResults(){
  running=false; if(raf) cancelAnimationFrame(raf);
  const s=[...cars].sort((a,b)=>{
    if(a.finished!==b.finished) return a.finished?-1:1;
    if(a.ft!=null&&b.ft!=null) return a.ft-b.ft;
    return b.progress-a.progress;
  });
  const win=s[0];
  document.getElementById('resTitle').textContent = win.isMe?'🏆 أنت الفائز!':`🏆 فاز ${win.name}`;
  const me=s.find(c=>c.isMe);
  document.getElementById('resTime').textContent  = me?.ft?`⏱️ وقتك: ${(me.ft/1000).toFixed(2)}s`:'';
  const dp = s.length>=3?[s[1],s[0],s[2]]:s.length===2?[null,s[0],s[1]]:[null,s[0],null];
  document.getElementById('podium').innerHTML=dp.map((c,i)=>c?`
    <div class="pod-place ${['p2','p1','p3'][i]}">
      <div class="pod-ico">${ICONS[c.id]}</div>
      <div class="pod-name">${c.name}</div>
      <div class="pod-block">${['2','1','3'][i]}</div>
    </div>`:'<div class="pod-place"></div>').join('');
  show('sResults');
  if(win.isMe) confetti();
}

// ===== JOYSTICK DRAW =====
function drawJoystick(){
  if(!running) return;
  const bx = joystick.active ? joystick.baseX : W*0.18;
  const by = joystick.active ? joystick.baseY : H*0.82;
  const r  = joystick.radius;

  // قاعدة
  ctx.save();
  ctx.globalAlpha = joystick.active ? 0.55 : 0.22;
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = joystick.active ? 0.12 : 0.06;
  ctx.fillStyle   = '#fff';
  ctx.fill();

  // ذراع
  const kx = joystick.active ? joystick.curX : bx;
  const ky = joystick.active ? joystick.curY : by;
  ctx.globalAlpha = joystick.active ? 0.85 : 0.3;
  ctx.shadowColor = '#ff6600'; ctx.shadowBlur = joystick.active ? 18 : 0;
  ctx.fillStyle   = joystick.active ? 'rgba(255,150,0,.9)' : 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.arc(kx, ky, r*0.38, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ===== JOYSTICK TOUCH =====
function setupJoystickTouch(){
  const gameEl = document.getElementById('sGame');

  gameEl.addEventListener('touchstart', e=>{
    for(const t of e.changedTouches){
      // فقط اللمسات على النصف الأيسر من الشاشة
      if(t.clientX < W*0.55 && !joystick.active){
        joystick.active = true;
        joystick.id     = t.identifier;
        joystick.baseX  = t.clientX;
        joystick.baseY  = t.clientY;
        joystick.curX   = t.clientX;
        joystick.curY   = t.clientY;
        joystick.nx=0; joystick.ny=0;
      }
    }
  },{passive:false});

  gameEl.addEventListener('touchmove', e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier === joystick.id){
        const dx = t.clientX - joystick.baseX;
        const dy = t.clientY - joystick.baseY;
        const len= Math.hypot(dx,dy);
        const clamped = Math.min(len, joystick.radius);
        const angle   = Math.atan2(dy, dx);
        joystick.curX = joystick.baseX + Math.cos(angle)*clamped;
        joystick.curY = joystick.baseY + Math.sin(angle)*clamped;
        joystick.nx   = (joystick.curX - joystick.baseX) / joystick.radius;
        joystick.ny   = (joystick.curY - joystick.baseY) / joystick.radius;
      }
    }
  },{passive:false});

  const endJoy = e=>{
    for(const t of e.changedTouches){
      if(t.identifier === joystick.id){
        joystick.active=false; joystick.id=null;
        joystick.nx=0; joystick.ny=0;
      }
    }
  };
  gameEl.addEventListener('touchend',    endJoy, {passive:false});
  gameEl.addEventListener('touchcancel', endJoy, {passive:false});
}

// ===== CONTROLS =====
function bindControls(){
  const map = {
    btnUp:'up', btnDown:'down', btnLeft:'left', btnRight:'right',
    btnTurbo:'turbo', btnSlow:'slow'
  };
  Object.entries(map).forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(!el) return;
    const on  = e=>{ e.preventDefault(); K[key]=true;  el.classList.add('pressed');    };
    const off = e=>{ e.preventDefault(); K[key]=false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart',  on,  {passive:false});
    el.addEventListener('touchend',    off, {passive:false});
    el.addEventListener('touchcancel', off);
    el.addEventListener('mousedown',   on);
    el.addEventListener('mouseup',     off);
    el.addEventListener('mouseleave',  off);
  });
}

document.addEventListener('keydown',e=>{
  if(e.key==='ArrowUp'   ||e.key==='w'||e.key==='W'){e.preventDefault();K.up=true;}
  if(e.key==='ArrowDown' ||e.key==='s'||e.key==='S'){e.preventDefault();K.down=true;}
  if(e.key==='ArrowLeft' ||e.key==='a'||e.key==='A'){e.preventDefault();K.left=true;}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();K.right=true;}
  if(e.key===' ')    { e.preventDefault(); K.turbo=true; }
  if(e.key==='Shift'){ e.preventDefault(); K.slow=true; }
});
document.addEventListener('keyup',e=>{
  if(e.key==='ArrowUp'   ||e.key==='w'||e.key==='W') K.up=false;
  if(e.key==='ArrowDown' ||e.key==='s'||e.key==='S') K.down=false;
  if(e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') K.left=false;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') K.right=false;
  if(e.key===' ')    K.turbo=false;
  if(e.key==='Shift') K.slow=false;
});
document.addEventListener('contextmenu',e=>e.preventDefault());

// ===== EFFECTS =====
function addSlowFX(){
  const div=document.createElement('div');
  div.className='slow-flash';
  document.getElementById('fxLayer').appendChild(div);
  setTimeout(()=>div.remove(), 700);
}

function confetti(){
  const layer=document.getElementById('fxLayer');
  const cols=['#ff2244','#ffcc00','#00aaff','#00ff88','#ff6600','#fff'];
  for(let i=0;i<110;i++){
    const p=document.createElement('div');
    p.className='cf';
    p.style.cssText=`left:${Math.random()*100}%;background:${cols[~~(Math.random()*cols.length)]};width:${5+Math.random()*8}px;height:${5+Math.random()*8}px;animation-duration:${1.4+Math.random()*2}s;animation-delay:${Math.random()*.7}s;`;
    layer.appendChild(p);
  }
  setTimeout(()=>{ layer.innerHTML=''; },5500);
}

// ===== TOAST =====
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove('show'),2400);
}

// ===== SCREENS =====
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

