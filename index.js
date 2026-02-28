// ============================================================
//  🏎️ RaceFire — game.js
//  كل منطق اللعبة: الفيزياء، المضمار، السيارات، التحكم
// ============================================================

// ===== CONFIG =====
const TOTAL_LAPS  = 3;
const TRACK_WIDTH = 52;
const CAR_COLORS  = ['#ff2244', '#00aaff', '#ffcc00', '#00ff88'];
const CAR_EMOJIS  = ['🔴', '🔵', '🟡', '🟢'];

// نقاط المضمار — قيم بين 0 و 1 (تُضرب في عرض/ارتفاع الشاشة)
const TRACK_POINTS = [
  { x: 0.50, y: 0.12 },
  { x: 0.82, y: 0.15 },
  { x: 0.88, y: 0.30 },
  { x: 0.85, y: 0.48 },
  { x: 0.72, y: 0.58 },
  { x: 0.60, y: 0.52 },
  { x: 0.55, y: 0.62 },
  { x: 0.65, y: 0.75 },
  { x: 0.70, y: 0.88 },
  { x: 0.50, y: 0.92 },
  { x: 0.30, y: 0.88 },
  { x: 0.22, y: 0.75 },
  { x: 0.32, y: 0.62 },
  { x: 0.38, y: 0.52 },
  { x: 0.25, y: 0.48 },
  { x: 0.12, y: 0.42 },
  { x: 0.14, y: 0.25 },
  { x: 0.30, y: 0.14 },
];

// ===== STATE =====
let myIndex    = 0;
let players    = [];
let isHost     = false;
let roomCode   = '';
let gameRunning = false;
let animFrame  = null;
let lastTime   = 0;

let canvas, ctx, W, H;
let trackPath  = [];
let trackLength = 0;
let localCars  = [];

const keys = { left: false, right: false, gas: false };

// ============================================================
//  CANVAS
// ============================================================
function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx    = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildTrack();
}

// ============================================================
//  TRACK
// ============================================================
function buildTrack() {
  trackPath = TRACK_POINTS.map(p => ({ x: p.x * W, y: p.y * H }));

  const dists = [0];
  for (let i = 1; i < trackPath.length; i++) {
    const dx = trackPath[i].x - trackPath[i - 1].x;
    const dy = trackPath[i].y - trackPath[i - 1].y;
    dists.push(dists[i - 1] + Math.hypot(dx, dy));
  }

  const cx = trackPath[0].x - trackPath[trackPath.length - 1].x;
  const cy = trackPath[0].y - trackPath[trackPath.length - 1].y;
  trackLength = dists[dists.length - 1] + Math.hypot(cx, cy);
  trackPath._dists = dists;
}

/** موقع على المضمار من تقدّم (0–1) */
function getTrackPos(progress) {
  const dist = ((progress % 1) + 1) % 1 * trackLength;
  const n    = trackPath.length;

  let seg = 0;
  for (let i = 0; i < n; i++) {
    const nextDist = i === n - 1 ? trackLength : trackPath._dists[i + 1];
    if (dist <= nextDist) { seg = i; break; }
  }

  const p1      = trackPath[seg];
  const p2      = seg === n - 1 ? trackPath[0] : trackPath[seg + 1];
  const segStart = trackPath._dists[seg];
  const segEnd   = seg === n - 1 ? trackLength : trackPath._dists[seg + 1];
  const t        = segEnd > segStart ? (dist - segStart) / (segEnd - segStart) : 0;

  return {
    x:     p1.x + (p2.x - p1.x) * t,
    y:     p1.y + (p2.y - p1.y) * t,
    angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
  };
}

// ============================================================
//  CARS
// ============================================================
function initCars(count) {
  localCars = [];
  for (let i = 0; i < count; i++) {
    localCars.push({
      id:         i,
      name:       i === 0 ? (players[0]?.name || 'أنت') : `لاعب ${i + 1}`,
      progress:   i * 0.04,   // بداية متدرجة
      speed:      0,
      angle:      0,
      lap:        1,
      finished:   false,
      finishTime: null,
      isMe:       i === myIndex,
    });
  }
}

// ============================================================
//  GAME LOOP
// ============================================================
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  update(dt);
  render();

  if (gameRunning) animFrame = requestAnimationFrame(gameLoop);
}

// ===== UPDATE =====
function update(dt) {
  localCars.forEach((car, i) => {
    if (car.finished) return;

    let turning      = 0;
    let accelerating = false;

    if (car.isMe) {
      // تحكم اللاعب
      turning      = keys.left ? -1 : keys.right ? 1 : 0;
      accelerating = keys.gas;
    } else {
      // ذكاء اصطناعي بسيط: انظر قُدُماً على المضمار
      const ahead       = getTrackPos(car.progress + 0.008);
      const pos         = getTrackPos(car.progress);
      const targetAngle = Math.atan2(ahead.y - pos.y, ahead.x - pos.x);
      let   da          = targetAngle - car.angle;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      turning      = Math.sign(da) * Math.min(Math.abs(da) * 3, 1);
      accelerating = true;
    }

    // فيزياء بسيطة
    const maxSpeed  = car.isMe ? 180 : 140 + i * 10;
    const accel     = accelerating ? 280 : 0;
    const friction  = 120;
    const turnSpeed = 2.5;

    car.speed = Math.max(0, Math.min(car.speed + (accel - friction) * dt, maxSpeed));
    car.angle += turning * turnSpeed * dt * (car.speed / maxSpeed);

    car.progress += (car.speed * dt) / trackLength;

    // عدّ اللفّات
    if (car.progress >= car.lap) {
      if (car.lap < TOTAL_LAPS) {
        car.lap++;
        if (car.isMe) showToast(`✅ لفّة ${car.lap}!`);
      } else {
        car.finished    = true;
        car.finishTime  = Date.now();
        if (car.isMe) setTimeout(showResults, 1500);
      }
    }
  });

  updateLeaderboard();
  updateHUD();
}

// ===== RENDER =====
function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, W, H);
  drawTrack();
  drawCars();
}

function drawTrack() {
  const n = trackPath.length;

  // عشب خارجي
  ctx.strokeStyle = 'rgba(0,80,0,0.4)';
  ctx.lineWidth   = TRACK_WIDTH * 2.2;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(trackPath[0].x, trackPath[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(trackPath[i].x, trackPath[i].y);
  ctx.closePath();
  ctx.stroke();

  // سطح المضمار
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth   = TRACK_WIDTH;
  ctx.beginPath();
  ctx.moveTo(trackPath[0].x, trackPath[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(trackPath[i].x, trackPath[i].y);
  ctx.closePath();
  ctx.stroke();

  // خط منتصف متقطع
  ctx.strokeStyle = 'rgba(255,200,0,0.5)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(trackPath[0].x, trackPath[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(trackPath[i].x, trackPath[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // خط البداية/النهاية (مربعات) 
  const sp    = trackPath[0];
  const np    = trackPath[1];
  const ang   = Math.atan2(np.y - sp.y, np.x - sp.x);
  const perpX = Math.cos(ang + Math.PI / 2);
  const perpY = Math.sin(ang + Math.PI / 2);
  ctx.save();
  for (let i = -3; i < 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
    ctx.fillRect(sp.x + perpX * i * 9 - 4, sp.y + perpY * i * 9 - 4, 9, 9);
  }
  ctx.restore();
}

function drawCars() {
  const sorted = [...localCars].sort((a, b) => a.progress - b.progress);

  sorted.forEach(car => {
    const tp      = getTrackPos(car.progress);
    const offsetX = (car.id - 1.5) * 8;
    const ox      = tp.x + offsetX * Math.cos(tp.angle + Math.PI / 2);
    const oy      = tp.y + offsetX * Math.sin(tp.angle + Math.PI / 2);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(tp.angle + Math.PI / 2);

    ctx.shadowColor = CAR_COLORS[car.id];
    ctx.shadowBlur  = car.isMe ? 20 : 10;

    const cw = car.isMe ? 14 : 11;
    const ch = car.isMe ? 22 : 18;

    // جسم السيارة
    ctx.fillStyle = CAR_COLORS[car.id];
    ctx.beginPath();
    ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 4);
    ctx.fill();

    // زجاج أمامي
    ctx.fillStyle = 'rgba(0,200,255,0.5)';
    ctx.fillRect(-cw / 2 + 2, -ch / 2 + 3, cw - 4, ch / 3);

    // إطارات
    ctx.fillStyle = '#111';
    [-cw / 2 - 2, cw / 2 - 2].forEach(wx => ctx.fillRect(wx, -ch / 4, 4, ch / 2.5));

    // لهب العادم
    if (car.isMe && keys.gas && car.speed > 50) {
      ctx.shadowBlur = 0;
      const fs   = 6 + Math.random() * 8;
      const grad = ctx.createLinearGradient(0, ch / 2, 0, ch / 2 + fs);
      grad.addColorStop(0, 'rgba(255,100,0,0.9)');
      grad.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, ch / 2 + fs / 2, 4, fs / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // تسمية اللاعب
    if (car.isMe) {
      ctx.fillStyle  = 'rgba(255,200,0,0.9)';
      ctx.font       = 'bold 10px Cairo';
      ctx.textAlign  = 'center';
      ctx.fillText('أنت ▲', ox, oy - 18);
    }
  });
}

// ============================================================
//  HUD & LEADERBOARD
// ============================================================
function updateHUD() {
  const me = localCars[myIndex];
  if (!me) return;
  document.getElementById('lapDisplay').textContent   = `${Math.min(me.lap, TOTAL_LAPS)} / ${TOTAL_LAPS}`;
  document.getElementById('speedDisplay').textContent = Math.round(me.speed);
}

function updateLeaderboard() {
  const sorted = [...localCars].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.progress - a.progress;
  });

  document.getElementById('lbRows').innerHTML = sorted.map((car, i) => `
    <div class="lb-row ${car.isMe ? 'me' : ''}">
      <span class="lb-pos">${i + 1}</span>
      <span class="lb-car">${CAR_EMOJIS[car.id]}</span>
      <span class="lb-name">${car.name}</span>
      <span class="lb-lap">L${Math.min(car.lap, TOTAL_LAPS)}</span>
    </div>
  `).join('');
}

// ============================================================
//  CONTROLS
// ============================================================
function pressLeft(v)  { keys.left  = v; document.getElementById('btnLeft').classList.toggle('pressed', v); }
function pressRight(v) { keys.right = v; document.getElementById('btnRight').classList.toggle('pressed', v); }
function pressGas(v)   { keys.gas   = v; document.getElementById('btnGas').classList.toggle('pressed', v); }

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') pressLeft(true);
  if (e.key === 'ArrowRight' || e.key === 'd') pressRight(true);
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === ' ') pressGas(true);
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') pressLeft(false);
  if (e.key === 'ArrowRight' || e.key === 'd') pressRight(false);
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === ' ') pressGas(false);
});
document.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
//  SCREENS
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function goLobby() {
  gameRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  showScreen('lobby');
}

// ============================================================
//  LOBBY ACTIONS
// ============================================================
function createRoom() {
  const name = document.getElementById('createName').value.trim() || 'لاعب 1';
  roomCode   = Math.random().toString(36).substr(2, 4).toUpperCase();
  isHost     = true;
  myIndex    = 0;
  players    = [{ name, id: 0 }];

  document.getElementById('displayCode').textContent = roomCode;
  updateWaitingPlayers();
  showScreen('waiting');
  document.getElementById('startBtn').style.display = 'block';
  showToast('✅ تم إنشاء الغرفة!');

  // محاكاة انضمام لاعبين (وضع تجريبي)
  setTimeout(() => simulateJoin('خالد', 1), 1200);
  setTimeout(() => simulateJoin('سارة', 2), 2200);
  setTimeout(() => simulateJoin('علي',   3), 3000);
}

function simulateJoin(name, idx) {
  players[idx] = { name, id: idx };
  updateWaitingPlayers();
  showToast(`🎮 ${name} انضم!`);
}

function joinRoom() {
  const name = document.getElementById('joinName').value.trim() || 'لاعب';
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code || code.length < 4) { showToast('❌ أدخل كود صحيح'); return; }

  myIndex  = 1;
  players  = [{ name: 'المضيف', id: 0 }, { name, id: 1 }];
  roomCode = code;

  document.getElementById('displayCode').textContent = roomCode;
  updateWaitingPlayers();
  showScreen('waiting');
  showToast('✅ انضممت للغرفة!');
}

function updateWaitingPlayers() {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (players[i]) {
      slot.classList.add('filled');
      slot.innerHTML = `<div class="car-emoji">${CAR_EMOJIS[i]}</div><div class="player-name">${players[i].name}</div>`;
    } else {
      slot.classList.remove('filled');
      slot.innerHTML = `<div class="car-emoji">${CAR_EMOJIS[i]}</div><div class="waiting-text">انتظار...</div>`;
    }
  }
  const count = players.filter(Boolean).length;
  document.getElementById('waitingStatus').textContent =
    count >= 2 ? `${count} لاعبين جاهزون ✅` : 'في انتظار لاعب آخر...';
}

// ============================================================
//  GAME START / COUNTDOWN
// ============================================================
function startGame() {
  runCountdown(3, () => {
    showScreen('game');
    initCanvas();
    buildTrack();
    initCars(players.filter(Boolean).length);
    gameRunning = true;
    lastTime    = performance.now();
    animFrame   = requestAnimationFrame(gameLoop);
  });
}

function runCountdown(n, cb) {
  showScreen('countdown');
  const el = document.getElementById('countNum');
  el.style.color = 'var(--neon-yellow)';
  el.textContent = n;

  if (n > 0) {
    setTimeout(() => runCountdown(n - 1, cb), 900);
  } else {
    el.textContent = 'GO!';
    el.style.color = '#00ff88';
    setTimeout(cb, 600);
  }
}

// ============================================================
//  RESULTS
// ============================================================
function showResults() {
  gameRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);

  const sorted = [...localCars].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
    return b.progress - a.progress;
  });

  // ترتيب المنصة: ثانٍ، أول، ثالث
  const order  = sorted.length >= 3
    ? [sorted[1], sorted[0], sorted[2]]
    : sorted.length === 2
      ? [null, sorted[0], sorted[1]]
      : [null, sorted[0], null];

  const places = ['p2', 'p1', 'p3'];
  const nums   = ['2', '1', '3'];

  document.getElementById('podium').innerHTML = order
    .map((car, i) => car ? `
      <div class="podium-place ${places[i]}">
        <div class="podium-car">${CAR_EMOJIS[car.id]}</div>
        <div class="podium-name">${car.name}</div>
        <div class="podium-block">${nums[i]}</div>
      </div>` : ''
    ).join('');

  showScreen('results');
  launchConfetti();
}

// ============================================================
//  CONFETTI
// ============================================================
function launchConfetti() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  const colors = ['#ff2244', '#ffcc00', '#00aaff', '#00ff88', '#ff6600', '#fff'];

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.5}s;
      transform: rotate(${Math.random() * 360}deg);
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
    `;
    container.appendChild(piece);
  }
  setTimeout(() => (container.innerHTML = ''), 4000);
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ============================================================
//  TELEGRAM WEBAPP INIT
// ============================================================
if (window.Telegram?.WebApp) {
  const tg     = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser?.first_name) {
    document.getElementById('createName').value = tgUser.first_name;
    document.getElementById('joinName').value   = tgUser.first_name;
  }
}
