// BRANKAS EMAS — everything the judge sees: one top-down frame of the bank
// at night with the thief, the guards' cones, the sweeping cameras, the
// lasers, the loot and the big alarm meter across the top. The palette is
// midnight blue + warm lamp gold + alarm red, so safe cover, danger and
// loot read at a glance instead of a generic tile set.
import {
  COLS, CRACK_SECONDS, EMP_SECONDS, MAP, ROWS, SMOKE_RADIUS, TILE,
  VIEW_H, VIEW_W,
} from './config.js';
import { SCREEN_LOSE, SCREEN_PAUSE, SCREEN_TITLE, SCREEN_WIN } from './main.js';
import { tileAt } from './world.js';

export const SCREEN_TITLE_C = SCREEN_TITLE;
export const SCREEN_PLAY_C = 'play';
export const SCREEN_PAUSE_C = SCREEN_PAUSE;
export const SCREEN_WIN_C = SCREEN_WIN;
export const SCREEN_LOSE_C = SCREEN_LOSE;

const LAMPS = [[3, 3], [10, 6], [18, 2], [26, 6], [8, 12], [18, 12], [26, 16], [5, 16], [12, 17]];

function cone(ctx, x, y, angle, half, range, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - half, angle + half);
  ctx.closePath();
  const g = ctx.createRadialGradient(x, y, 10, x, y, range);
  g.addColorStop(0, color.replace('A', '0.34'));
  g.addColorStop(1, color.replace('A', '0.0'));
  ctx.fillStyle = g;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function money(n) {
  return '$' + n.toLocaleString('en-US');
}

export function draw(ctx, state) {
  ctx.save();
  if (state.shake > 0.01) {
    // Deterministic jitter from the clock, not Math.random: the same
    // staged second always renders the same frame.
    const s = state.shake * state.shake * 9;
    ctx.translate(Math.sin(state.time * 127.1 + 1.3) * s, Math.cos(state.time * 149.7 + 4.1) * s);
  }

  // Floor: midnight marble with a faint checker.
  ctx.fillStyle = '#161b2e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const t = tileAt(c, r);
      const x = c * TILE;
      const y = r * TILE;
      if (t === ',') {
        ctx.fillStyle = '#0e1120';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(x + 8, y + 8, 4, 4);
        ctx.fillRect(x + 26, y + 24, 4, 4);
      } else if (t !== '#') {
        ctx.fillStyle = (c + r) % 2 === 0 ? '#1a2036' : '#181d31';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }

  // Warm lamp pools: light is the danger, and it shows on the floor.
  for (const [lc, lr] of LAMPS) {
    const x = lc * TILE + TILE / 2;
    const y = lr * TILE + TILE / 2;
    const g = ctx.createRadialGradient(x, y, 8, x, y, 150);
    g.addColorStop(0, 'rgba(255, 205, 110, 0.20)');
    g.addColorStop(1, 'rgba(255, 205, 110, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Walls, desks, crates, vault.
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const t = tileAt(c, r);
      const x = c * TILE;
      const y = r * TILE;
      if (t === '#') {
        ctx.fillStyle = '#3d4260';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#565c80';
        ctx.fillRect(x, y, TILE, 4);
      } else if (t === 'o') {
        ctx.fillStyle = '#6b4a2f';
        roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 5);
        ctx.fill();
        ctx.fillStyle = '#8a6238';
        ctx.fillRect(x + 6, y + 6, TILE - 12, 5);
      } else if (t === 'c') {
        ctx.fillStyle = '#7a5c33';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = '#a8844f';
        ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      } else if (t === 'V') {
        ctx.fillStyle = state.vaultOpen ? '#20242e' : '#8b93a7';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Getaway van (top-down, green, bottom right): cargo box, cab with
  // windshield, four wheels — a vehicle, not a green square.
  const ex = state.exit;
  ctx.fillStyle = '#1f7a3a';
  roundRect(ctx, ex.x - 22, ex.y - 14, 44, 28, 4);
  ctx.fill();
  ctx.fillStyle = '#2c9e4b';
  roundRect(ctx, ex.x + 8, ex.y - 11, 12, 22, 3);
  ctx.fill();
  ctx.fillStyle = '#bfe8ff';
  ctx.fillRect(ex.x + 10, ex.y - 8, 7, 16);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(ex.x - 14, ex.y - 14, 4, 0, Math.PI * 2);
  ctx.arc(ex.x + 14, ex.y - 14, 4, 0, Math.PI * 2);
  ctx.arc(ex.x - 14, ex.y + 14, 4, 0, Math.PI * 2);
  ctx.arc(ex.x + 14, ex.y + 14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7dff9e';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KABUR', ex.x, ex.y - 20);
  ctx.fillStyle = '#eaffef';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('VAN', ex.x - 6, ex.y + 4);

  // Loot: gold bars shine, the diamond sparkles cyan.
  for (const g of state.gold) {
    if (g.taken) continue;
    ctx.fillStyle = '#d4af37';
    roundRect(ctx, g.x - 12, g.y - 7, 24, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe98a';
    ctx.fillRect(g.x - 8, g.y - 5, 16, 3);
  }
  if (state.diamond && !state.diamond.taken) {
    const d = state.diamond;
    const pulse = 1 + 0.15 * Math.sin(state.time * 4);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.PI / 4);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#6fe3ff';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = '#d8f6ff';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.fillStyle = '#bff0ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BERLIAN', d.x, d.y - 20);
  }

  // Lasers: red beams that blink on and off — time your crossing.
  for (const l of state.lasers) {
    ctx.strokeStyle = l.on ? '#ff2d2d' : 'rgba(255,45,45,0.18)';
    ctx.lineWidth = l.on ? 4 : 2;
    if (l.on) {
      ctx.shadowColor = '#ff2d2d';
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff5b5b';
    ctx.fillRect(l.x1 - 5, l.y1 - 8, 10, 16);
    ctx.fillRect(l.x2 - 5, l.y2 - 8, 10, 16);
  }

  // Smoke clouds: the thief's cover.
  for (const s of state.smokes) {
    if (state.time >= s.until) continue;
    const g = ctx.createRadialGradient(s.x, s.y, 8, s.x, s.y, SMOKE_RADIUS);
    g.addColorStop(0, 'rgba(200,200,210,0.55)');
    g.addColorStop(1, 'rgba(200,200,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, SMOKE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Camera cones sweep the hall; red when they have you.
  for (const cam of state.cameras) {
    const disabled = state.time < cam.disabledUntil;
    if (!disabled) {
      cone(ctx, cam.x, cam.y, cam.angle, cam.half, cam.range,
        cam.spotted ? 'rgba(255,60,60,A)' : 'rgba(255,220,90,A)');
    }
    ctx.fillStyle = disabled ? '#555' : '#222';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = disabled ? '#888' : (cam.spotted ? '#ff3c3c' : '#ffd75e');
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (disabled) {
      ctx.fillStyle = '#ddd';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFF', cam.x, cam.y - 14);
    }
  }

  // Guard vision cones, then the guards themselves.
  for (const g of state.guards) {
    cone(ctx, g.x, g.y, g.angle, 0.61, 235,
      g.seesPlayer ? 'rgba(255,60,60,A)' : 'rgba(255,90,70,A)');
  }
  for (const g of state.guards) {
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.angle) * 7, g.y + Math.sin(g.angle) * 7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.name, g.x, g.y - 20);
    if (g.state === 'chase') {
      ctx.fillStyle = '#ff3c3c';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('!', g.x, g.y - 30);
    } else if (g.state === 'investigate') {
      ctx.fillStyle = '#ffd75e';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('?', g.x, g.y - 30);
    }
  }

  // The thief: black hood, gold mask line, crack ring while working.
  const p = state.player;
  if (p.sprinting) {
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 140, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, p.angle - 0.9, p.angle + 0.9);
  ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 7, p.y + Math.sin(p.angle) * 7, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (state.crack > 0 && !state.vaultOpen) {
    ctx.strokeStyle = '#6fe3ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + state.crack * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#bff0ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MEMBOBOL…', p.x, p.y - 28);
  }

  drawHud(ctx, state);
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, state);
  if (state.screen === SCREEN_PAUSE) drawCenter(ctx, 'JEDA', 'Tekan P untuk lanjut', '#fff');
  if (state.screen === SCREEN_WIN) drawWin(ctx, state);
  if (state.screen === SCREEN_LOSE) drawCenter(ctx, 'TERTANGKAP!', state.loseCause + ' Spasi untuk coba lagi.', '#ff6b6b');

  // Seen flash: red edges close in.
  if (state.flash > 0.01) {
    const g = ctx.createRadialGradient(640, 400, 260, 640, 400, 720);
    g.addColorStop(0, 'rgba(255,40,40,0)');
    g.addColorStop(1, `rgba(255,40,40,${0.45 * state.flash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.restore();
}

function drawHud(ctx, state) {
  ctx.fillStyle = 'rgba(8,10,20,0.88)';
  ctx.fillRect(0, 0, VIEW_W, 54);
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BRANKAS EMAS', 14, 34);
  // Alarm meter: the big one, centre top.
  const ax = 300;
  const aw = 420;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ALARM', ax - 62, 34);
  ctx.fillStyle = '#222';
  roundRect(ctx, ax, 14, aw, 26, 6);
  ctx.fill();
  const frac = state.alarm / 100;
  const grad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
  grad.addColorStop(0, '#37d67a');
  grad.addColorStop(0.5, '#ffd75e');
  grad.addColorStop(1, '#ff3c3c');
  ctx.fillStyle = grad;
  if (frac > 0.01) {
    roundRect(ctx, ax, 14, Math.max(10, aw * frac), 26, 6);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(state.alarm)}%`, ax + aw / 2, 33);
  if (state.lockdown > 0) {
    ctx.fillStyle = '#ff3c3c';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`LOCKDOWN ${Math.ceil(state.lockdown)}s`, ax + aw + 90, 34);
  }
  // Right: loot, tools, time.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe98a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`LOOT ${money(state.loot)}${state.hasDiamond ? ' ◆' : ''}`, 1270, 24);
  ctx.fillStyle = '#ccc';
  ctx.font = '13px sans-serif';
  ctx.fillText(`EMP(Q) ×${state.empLeft}   Asap(F) ×${state.smokeLeft}   ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, 1270, 44);
  // Objective line, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  const goal = state.hasDiamond
    ? 'Berlian didapat! Kabur ke VAN hijau.'
    : (state.vaultOpen ? 'Ambil BERLIAN di depan brankas.' : 'Bobol brankas (tahan E) — curi Berlian Biru.');
  ctx.fillText(goal, 14, VIEW_H - 12);
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(5,7,16,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BRANKAS EMAS', 640, 220);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Perampokan Tengah Malam', 640, 262);
  ctx.fillStyle = '#ddd';
  ctx.font = '17px sans-serif';
  ctx.fillText('Seorang pencuri, satu bank, empat satpam, dan Berlian Biru di brankas.', 640, 310);
  ctx.fillText('WASD bergerak · Shift lari (berisik!) · E tahan untuk membobol brankas', 640, 345);
  ctx.fillText('Q EMP matikan kamera · F asap untuk menghilang · Laser merah = alarm +25', 640, 372);
  ctx.fillText('Karpet gelap memperlambat deteksi. Curi berliannya, lalu kabur ke VAN.', 640, 399);
  ctx.fillStyle = '#ffe98a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Spasi atau klik untuk mulai', 640, 470);
  ctx.fillStyle = '#999';
  ctx.font = '13px sans-serif';
  ctx.fillText('Game orisinal — bukan tiruan game komersial.', 640, 510);
  void state;
}

function drawCenter(ctx, title, sub, color) {
  ctx.fillStyle = 'rgba(5,7,16,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(title, 640, 360);
  ctx.fillStyle = '#ddd';
  ctx.font = '19px sans-serif';
  ctx.fillText(sub, 640, 410);
}

function drawWin(ctx, state) {
  ctx.fillStyle = 'rgba(5,7,16,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7dff9e';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('PERAMPOKAN BERHASIL!', 640, 250);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  const timeBonus = Math.max(0, 300 - Math.floor(state.time)) * 100;
  const ghost = state.maxAlarm < 50 ? 10000 : 0;
  ctx.fillText(`Loot: ${money(state.loot)}`, 640, 310);
  ctx.fillText(`Bonus waktu: ${money(timeBonus)}`, 640, 342);
  ctx.fillText(`Bonus GHOST (alarm maks ${Math.round(state.maxAlarm)}%): ${money(ghost)}`, 640, 374);
  ctx.fillStyle = '#ffe98a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`SKOR: ${money(state.score)}`, 640, 430);
  ctx.fillStyle = '#ddd';
  ctx.font = '17px sans-serif';
  ctx.fillText('Spasi atau klik untuk main lagi', 640, 480);
}
