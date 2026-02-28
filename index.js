// ============================================================
//  🏎️ RaceFire — game.js  (نسخة مستقلة — بدون سيرفر)
// ============================================================

const TOTAL_LAPS  = 3;
const TRACK_WIDTH = 80;
const CAR_COLORS  = ['#ff2244', '#00aaff', '#ffcc00', '#00ff88'];
const CAR_EMOJIS  = ['🔴', '🔵', '🟡', '🟢'];
const AI_NAMES    = ['خالد 🤖', 'سارة 🤖', 'علي 🤖'];

const TRACK_POINTS = [
  { x: 0.50, y: 0.10 }, { x: 0.80, y: 0.13 }, { x: 0.88, y: 0.28 },
  { x: 0.84, y: 0.46 }, { x: 0.70, y: 0.56 }, { x: 0.58, y: 0.50 },
  { x: 0.54, y: 0.62 }, { x: 0.64, y: 0.76 }, { x: 0.68, y: 0.89 },
  { x: 0.50, y: 0.93 }, { x: 0.32, y: 0.89 }, { x: 0.22, y: 0.76 },
  { x: 0.30, y: 0.62 }, { x: 0.36, y: 0.50 }, { x: 0.24, y: 0.46 },
  { x: 0.12, y: 0.40 }, { x: 0.14, y: 0.24 }, { x: 0.30, y: 0.13 },
];

let myName = 'لاعب', opponentCount = 1;
let gameRunning = false, animFrame = null, lastTime = 0, raceStartTime = 0;
let canvas, ctx, W, H;
let trackPath = [], trackLength = 0, cars = [];
const keys = { left: false, right: false, gas: false, turbo: false };

// ===== TURBO =====
const TURBO_MAX      = 100;  // سعة التيربو الكاملة
const TURBO_DRAIN    = 45;   // معدل الاستهلاك في الثانية
const TURBO_CHARGE   = 18;   // معدل الشحن في الثانية
const TURBO_MIN_USE  = 20;   // الحد الأدنى للاستخدام
let   turboEnergy    = TURBO_MAX;
let   turboActive    = false;

// ===== LOBBY =====
function selectOpponents(n) {
  opponentCount = n;
  document.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.opp-btn[data-count="${n}"]`).classList.add('active');
}

function goToGame() {
  myName = document.getElementById('playerName').value.trim() || 'أنت';
  runCountdown(3, startRace);
}

function goLobby() {
  gameRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  showScreen('lobby');
}

// ===== COUNTDOWN =====
function runCountdown(n, cb) {
  showScreen('countdown');
  const el = document.getElementById('countNum');
  el.style.color = 'var(--neon-yellow)';
  if (n > 0) {
    el.textContent = n;
    setTimeout(() => runCountdown(n - 1, cb), 900);
  } else {
    el.textContent = 'GO!';
    el.style.color = '#00ff88';
    setTimeout(cb, 700);
  }
}

// ===== RACE START =====
function getSize() {
  return {
    w: window.screen.width,
    h: window.screen.height,
  };
}

// نحفظ الأبعاد مرة واحدة عند تحميل الصفحة
let SCREEN_W = window.innerWidth || window.screen.width;
let SCREEN_H = window.innerHeight || window.screen.height;
window.addEventListener('resize', () => {
  SCREEN_W = window.innerWidth || window.screen.width;
  SCREEN_H = window.innerHeight || window.screen.height;
});

function startRace() {
  // نقرأ الأبعاد الآن قبل أي تغيير في الشاشة
  const finalW = SCREEN_W;
  const finalH = SCREEN_H;

  showScreen('game');

  setTimeout(() => {
    canvas = document.getElementById('gameCanvas');
    ctx    = canvas.getContext('2d');

    W = canvas.width  = finalW;
    H = canvas.height = finalH;

    console.log('Canvas size:', W, H); // للتأكد — نحذفه لاحقاً

    canvas.style.width    = finalW + 'px';
    canvas.style.height   = finalH + 'px';
    canvas.style.position = 'fixed';
    canvas.style.top      = '0';
    canvas.style.left     = '0';
    canvas.style.zIndex   = '1';

    window.onresize = () => {
      SCREEN_W = W = canvas.width  = window.innerWidth;
      SCREEN_H = H = canvas.height = window.innerHeight;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      buildTrack();
    };

    buildTrack();
    initCars();
    gameRunning   = true;
    raceStartTime = lastTime = performance.now();
    animFrame     = requestAnimationFrame(gameLoop);
  }, 50);
}

// ===== TRACK =====
function buildTrack() {
  trackPath = TRACK_POINTS.map(p => ({ x: p.x * W, y: p.y * H }));
  const d = [0];
  for (let i = 1; i < trackPath.length; i++)
    d.push(d[i-1] + Math.hypot(trackPath[i].x - trackPath[i-1].x, trackPath[i].y - trackPath[i-1].y));
  trackLength = d[d.length-1] + Math.hypot(trackPath[0].x - trackPath[trackPath.length-1].x, trackPath[0].y - trackPath[trackPath.length-1].y);
  trackPath._d = d;
}

function getTrackPos(progress) {
  const dist = ((progress % 1) + 1) % 1 * trackLength;
  const n = trackPath.length;
  let seg = n - 1;
  for (let i = 0; i < n; i++) {
    if (dist <= (i === n-1 ? trackLength : trackPath._d[i+1])) { seg = i; break; }
  }
  const p1 = trackPath[seg], p2 = seg === n-1 ? trackPath[0] : trackPath[seg+1];
  const s = trackPath._d[seg], e = seg === n-1 ? trackLength : trackPath._d[seg+1];
  const t = e > s ? (dist - s) / (e - s) : 0;
  return { x: p1.x+(p2.x-p1.x)*t, y: p1.y+(p2.y-p1.y)*t, angle: Math.atan2(p2.y-p1.y, p2.x-p1.x) };
}

// ===== CARS =====
function initCars() {
  cars = [];
  for (let i = 0; i < 1 + opponentCount; i++) {
    cars.push({
      id: i, name: i === 0 ? myName : AI_NAMES[i-1],
      progress: i * 0.03, speed: 0, angle: 0, lap: 1,
      finished: false, finishTime: null, isMe: i === 0,
      aiSkill: 0.85 + Math.random() * 0.25, aiNoise: 0,
    });
  }
}

// ===== GAME LOOP =====
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  render();
  if (gameRunning) animFrame = requestAnimationFrame(gameLoop);
}

function update(dt) {
  cars.forEach(car => {
    if (car.finished) return;
    let turning = 0, accel = false;

    if (car.isMe) {
      turning = keys.left ? -1 : keys.right ? 1 : 0;
      accel = keys.gas;
    } else {
      const ahead = getTrackPos(car.progress + 0.009 * car.aiSkill);
      const pos   = getTrackPos(car.progress);
      let da = Math.atan2(ahead.y - pos.y, ahead.x - pos.x) - car.angle;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      car.aiNoise = car.aiNoise * 0.85 + (Math.random() - 0.5) * 0.4;
      turning = Math.max(-1, Math.min(1, da * 3 + car.aiNoise));
      accel = true;
    }

    // التيربو
    let isTurbo = false;
    if (car.isMe) {
      if (turboActive && turboEnergy > 0) {
        isTurbo     = true;
        turboEnergy = Math.max(0, turboEnergy - TURBO_DRAIN * dt);
        if (turboEnergy <= 0) { turboActive = false; keys.turbo = false; }
      } else {
        turboEnergy = Math.min(TURBO_MAX, turboEnergy + TURBO_CHARGE * dt);
      }
      updateTurboUI();
    }
    const maxSpd = car.isMe
      ? (isTurbo ? 340 : 200)
      : (155 + car.id * 8) * car.aiSkill;
    const accelForce = accel ? (isTurbo ? 500 : 300) : 0;
    car.speed = Math.max(0, Math.min(car.speed + (accelForce - 130) * dt, maxSpd));
    car.angle += turning * 2.8 * dt * (car.speed / maxSpd || 0);
    car.progress += (car.speed * dt) / trackLength;

    if (car.progress >= car.lap) {
      if (car.lap < TOTAL_LAPS) {
        car.lap++;
        if (car.isMe) showToast(`✅ لفّة ${car.lap} / ${TOTAL_LAPS}`);
      } else {
        car.finished = true;
        car.finishTime = performance.now() - raceStartTime;
        if (car.isMe) { showToast('🏁 أكملت السباق!'); setTimeout(showResults, 1800); }
      }
    }
  });
  updateHUD();
  updateLeaderboard();
}

// ===== RENDER =====
function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#060609';
  ctx.fillRect(0, 0, W, H);
  drawTrack();
  drawCars();
}

function drawLoop(style, width, dash = []) {
  const n = trackPath.length;
  ctx.strokeStyle = style; ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(trackPath[0].x, trackPath[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(trackPath[i].x, trackPath[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrack() {
  drawLoop('rgba(20,80,20,0.5)',      TRACK_WIDTH * 2.4);
  drawLoop('#18182a',                  TRACK_WIDTH);
  drawLoop('rgba(255,255,255,0.06)',   TRACK_WIDTH - 5);
  drawLoop('rgba(255,200,0,0.55)',     2.5);
  drawLoop('rgba(255,255,255,0.15)',   1.5, [18, 16]);

  // خط البداية
  const sp = trackPath[0], np = trackPath[1];
  const ang = Math.atan2(np.y - sp.y, np.x - sp.x);
  const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
  ctx.save();
  for (let i = -3; i < 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
    ctx.fillRect(sp.x + px*i*9 - 4, sp.y + py*i*9 - 4, 9, 9);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('START', sp.x, sp.y - TRACK_WIDTH/2 - 6);
  ctx.restore();
}

function drawCars() {
  [...cars].sort((a,b) => a.progress - b.progress).forEach(car => {
    const tp  = getTrackPos(car.progress);
    const off = (car.id - (cars.length-1)/2) * 9;
    const ox  = tp.x + off * Math.cos(tp.angle + Math.PI/2);
    const oy  = tp.y + off * Math.sin(tp.angle + Math.PI/2);
    const cw  = car.isMe ? 15 : 12, ch = car.isMe ? 24 : 19;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(tp.angle + Math.PI/2);
    ctx.shadowColor = CAR_COLORS[car.id];
    ctx.shadowBlur  = car.isMe ? 22 : 12;

    // جسم
    ctx.fillStyle = CAR_COLORS[car.id];
    ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 4); ctx.fill();
    // ظل
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-cw/2+1, -ch/2+1, cw-2, ch/2.5);
    // زجاج
    ctx.fillStyle = 'rgba(120,220,255,0.55)';
    ctx.fillRect(-cw/2+2, -ch/2+3, cw-4, ch/3.2);
    // إطارات
    ctx.shadowBlur = 0; ctx.fillStyle = '#0a0a0a';
    [[-cw/2-2.5,-ch/4],[cw/2-1.5,-ch/4],[-cw/2-2.5,ch/6],[cw/2-1.5,ch/6]]
      .forEach(([wx,wy]) => ctx.fillRect(wx, wy, 4, ch/3.5));

    // لهب العادم
    if (car.isMe && keys.gas && car.speed > 60) {
      const fs = 8 + Math.random() * 10;
      const g  = ctx.createLinearGradient(0, ch/2, 0, ch/2+fs);
      g.addColorStop(0, 'rgba(255,120,0,1)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g;
      [-3,3].forEach(x => { ctx.beginPath(); ctx.ellipse(x, ch/2+fs*0.4, 2.5, fs*0.5, 0, 0, Math.PI*2); ctx.fill(); });
    }
    ctx.restore();

    // اسم اللاعب
    if (car.isMe) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,210,0,0.95)'; ctx.font = 'bold 11px Cairo,sans-serif';
      ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText('▲ ' + myName, ox, oy - 18);
      ctx.restore();
    }
  });
}

// ===== HUD =====
function updateHUD() {
  const me = cars[0]; if (!me) return;
  document.getElementById('lapDisplay').textContent   = `${Math.min(me.lap, TOTAL_LAPS)} / ${TOTAL_LAPS}`;
  document.getElementById('speedDisplay').textContent = Math.round(me.speed);
}

function updateLeaderboard() {
  const sorted = [...cars].sort((a,b) => a.finished !== b.finished ? (a.finished ? -1 : 1) : b.progress - a.progress);
  document.getElementById('lbRows').innerHTML = sorted.map((car, i) => `
    <div class="lb-row ${car.isMe?'me':''}">
      <span class="lb-pos">${i+1}</span>
      <span class="lb-car">${CAR_EMOJIS[car.id]}</span>
      <span class="lb-name">${car.name}</span>
      <span class="lb-lap">L${Math.min(car.lap,TOTAL_LAPS)}</span>
    </div>`).join('');
}

// ===== RESULTS =====
function showResults() {
  gameRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);

  const sorted = [...cars].sort((a,b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
    return b.progress - a.progress;
  });

  const winner = sorted[0];
  document.getElementById('winnerTitle').textContent = winner.isMe ? '🏆 أنت الفائز!' : `🏆 فاز ${winner.name}`;

  const me = sorted.find(c => c.isMe);
  document.getElementById('resultTime').textContent = me?.finishTime
    ? `⏱️ وقتك: ${(me.finishTime/1000).toFixed(2)} ثانية` : '';

  const display = sorted.length >= 3 ? [sorted[1], sorted[0], sorted[2]]
    : sorted.length === 2 ? [null, sorted[0], sorted[1]] : [null, sorted[0], null];

  document.getElementById('podium').innerHTML = display.map((car, i) => car ? `
    <div class="podium-place ${['p2','p1','p3'][i]}">
      <div class="podium-car">${CAR_EMOJIS[car.id]}</div>
      <div class="podium-name">${car.name}</div>
      <div class="podium-block">${['2','1','3'][i]}</div>
    </div>` : '<div class="podium-place"></div>').join('');

  showScreen('results');
  if (winner.isMe) launchConfetti();
}

// ===== CONTROLS =====
function pressTurbo(v) {
  if (v && turboEnergy >= TURBO_MIN_USE) {
    turboActive = true;
    keys.turbo  = true;
    document.getElementById('btnTurbo').classList.add('pressed');
  } else if (!v) {
    turboActive = false;
    keys.turbo  = false;
    document.getElementById('btnTurbo').classList.remove('pressed');
  }
}

function updateTurboUI() {
  const pct = (turboEnergy / TURBO_MAX) * 100;
  const bar = document.getElementById('turboBar');
  const btn = document.getElementById('btnTurbo');
  if (bar) bar.style.width = pct + '%';
  if (btn) {
    btn.classList.toggle('empty', turboEnergy < TURBO_MIN_USE);
    // لون الشريط يتغير حسب الكمية
    if (bar) bar.style.background = pct > 50
      ? 'linear-gradient(90deg,#ff4400,#ffcc00)'
      : 'linear-gradient(90deg,#ff2200,#ff6600)';
  }
}

function pressLeft(v)  { keys.left  = v; document.getElementById('btnLeft').classList.toggle('pressed',v); }
function pressRight(v) { keys.right = v; document.getElementById('btnRight').classList.toggle('pressed',v); }
function pressGas(v)   { keys.gas   = v; document.getElementById('btnGas').classList.toggle('pressed',v); }

document.addEventListener('keydown', e => {
  if (['ArrowLeft','a'].includes(e.key))  { e.preventDefault(); pressLeft(true); }
  if (['ArrowRight','d'].includes(e.key)) { e.preventDefault(); pressRight(true); }
  if (['ArrowUp','w',' '].includes(e.key)){ e.preventDefault(); pressGas(true); }
  if (e.key === 'Shift') pressTurbo(true);
});
document.addEventListener('keyup', e => {
  if (['ArrowLeft','a'].includes(e.key))   pressLeft(false);
  if (['ArrowRight','d'].includes(e.key))  pressRight(false);
  if (['ArrowUp','w',' '].includes(e.key)) pressGas(false);
  if (e.key === 'Shift') pressTurbo(false);
});
document.addEventListener('contextmenu', e => e.preventDefault());

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== CONFETTI =====
function launchConfetti() {
  const c = document.getElementById('confettiContainer');
  c.innerHTML = '';
  const colors = ['#ff2244','#ffcc00','#00aaff','#00ff88','#ff6600','#fff'];
  for (let i = 0; i < 100; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${1.4+Math.random()*2}s;animation-delay:${Math.random()*0.6}s;width:${5+Math.random()*8}px;height:${5+Math.random()*8}px;`;
    c.appendChild(p);
  }
  setTimeout(() => c.innerHTML = '', 5000);
}
