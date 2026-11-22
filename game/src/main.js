// BRANKAS EMAS — Midnight Vault Heist: the simulation.
// Pure logic (createState / stepGame) with no DOM, so node tests and the
// screenshot autopilot drive the exact same rules the player plays.
// The browser shell (boot) only wires input, sound and the canvas.
import {
  CAMERAS, CAM_DETECT, CATCH_DIST, CRACK_RANGE, CRACK_SECONDS,
  DETECT_LIT, DETECT_SHADOW, DIAMOND_VALUE, EMP_ALARM, EMP_COUNT,
  EMP_SECONDS, GOLD_SLOW, GOLD_VALUE, GHOST_BONUS, GUARDS,
  GUARD_PATROL_SPEED, GUARD_VIEW_HALF, LASERS, LASER_ALARM,
  LOCKDOWN_RESET, LOCKDOWN_SECONDS, ALARM_DECAY, MAP, NOISE_RADIUS,
  PLAYER_SPEED, SMOKE_COUNT, SMOKE_RADIUS, SMOKE_SECONDS, SPRINT_MULT,
  TILE, TIME_BONUS_PER_SEC,
} from './config.js';
import { takeClick } from './input.js';
import { findPath, hasLineOfSight, isShadowAt, moveCircle, parseLevel } from './world.js';
import { mulberry32 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function createState(seed = 1) {
  const level = parseLevel();
  const rng = mulberry32(seed);
  void rng;
  return {
    seed,
    screen: SCREEN_TITLE,
    time: 0,
    alarm: 0,
    maxAlarm: 0,
    lockdown: 0,
    lockdowns: 0,
    loot: 0,
    goldCarried: 0,
    hasDiamond: false,
    crack: 0,
    vaultOpen: false,
    diamond: null,
    empLeft: EMP_COUNT,
    smokeLeft: SMOKE_COUNT,
    smokes: [],
    score: 0,
    loseCause: '',
    shake: 0,
    flash: 0,
    player: { x: level.player.x, y: level.player.y, angle: 0, moving: false, sprinting: false },
    gold: level.gold.map((g) => ({ ...g })),
    vault: level.vault,
    exit: level.exit,
    guards: GUARDS.map((g, i) => {
      const [cx, cy] = g.waypoints[0];
      return {
        name: g.name, color: g.color,
        range: g.range, chaseSpeed: g.chase, chaseAt: g.chaseAt,
        x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2,
        angle: 0, state: 'patrol', waypoint: 1,
        waypoints: g.waypoints,
        path: [], replan: 0, target: null, lastSeen: null,
        lookTimer: 0, loseTimer: 0, seesPlayer: false,
      };
    }),
    cameras: CAMERAS.map((c, i) => ({
      ...c, index: i, angle: c.base, disabledUntil: -1, spotted: false,
      x: c.tile[0] * TILE + TILE / 2, y: c.tile[1] * TILE + TILE / 2,
    })),
    lasers: LASERS.map((l) => ({ ...l, on: false, cooldown: 0 })),
    sfx: [],
    prev: { emp: false, smoke: false, pause: false, start: false },
  };
}

export function resetState(state) {
  const fresh = createState(state.seed);
  Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
}

function inSmoke(state, x, y) {
  for (const s of state.smokes) {
    if (state.time < s.until && Math.hypot(x - s.x, y - s.y) < SMOKE_RADIUS) return true;
  }
  return false;
}

function guardSees(state, g) {
  const p = state.player;
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const d = Math.hypot(dx, dy);
  if (d > g.range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), g.angle)) > GUARD_VIEW_HALF) return false;
  if (inSmoke(state, p.x, p.y)) return false;
  return hasLineOfSight(g.x, g.y, p.x, p.y);
}

function cameraSees(state, cam) {
  const p = state.player;
  if (state.time < cam.disabledUntil) return false;
  const dx = p.x - cam.x;
  const dy = p.y - cam.y;
  const d = Math.hypot(dx, dy);
  if (d > cam.range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), cam.angle)) > cam.half) return false;
  if (inSmoke(state, p.x, p.y)) return false;
  return hasLineOfSight(cam.x, cam.y, p.x, p.y);
}

function followPath(mover, path, speed, dt) {
  if (path.length === 0) return true;
  const next = path[0];
  const dx = next.x - mover.x;
  const dy = next.y - mover.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) {
    path.shift();
    return path.length === 0;
  }
  const step = Math.min(d, speed * dt);
  // Collision-aware like the player: a guard never clips a wall corner
  // when its path is replanned mid-tile.
  const pos = moveCircle(mover.x, mover.y, (dx / d) * step, (dy / d) * step, 13);
  mover.x = pos.x;
  mover.y = pos.y;
  mover.angle = Math.atan2(dy, dx);
  return false;
}

function guardTo(state, g, tx, ty, speed, dt) {
  g.replan -= dt;
  if (g.replan <= 0) {
    g.path = findPath(g.x, g.y, tx, ty);
    g.replan = 0.5;
  }
  if (g.path.length === 0) {
    // No path (already there, or target inside a wall): walk straight.
    const dx = tx - g.x;
    const dy = ty - g.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const pos = moveCircle(g.x, g.y, (dx / d) * speed * dt, (dy / d) * speed * dt, 13);
      g.x = pos.x;
      g.y = pos.y;
      g.angle = Math.atan2(dy, dx);
    }
    return d <= 8;
  }
  return followPath(g, g.path, speed, dt);
}

function stepGuards(state, dt) {
  const p = state.player;
  for (const g of state.guards) {
    g.seesPlayer = guardSees(state, g);
    if (g.seesPlayer) {
      g.loseTimer = 0;
      // Remember exactly where the thief was last seen: a guard that
      // loses the trail investigates that spot, not where the thief
      // happens to be when the trail goes cold.
      g.lastSeen = { x: p.x, y: p.y };
      if (state.alarm >= g.chaseAt || g.state === 'chase') {
        g.state = 'chase';
      } else {
        g.state = 'investigate';
        g.target = { x: p.x, y: p.y };
        g.replan = 0;
      }
    }
    if (g.state === 'chase') {
      const arrived = guardTo(state, g, p.x, p.y, g.chaseSpeed, dt);
      void arrived;
      if (!g.seesPlayer) {
        g.loseTimer += dt;
        if (g.loseTimer > 3) {
          g.state = 'investigate';
          g.target = g.lastSeen ? { ...g.lastSeen } : { x: p.x, y: p.y };
          g.replan = 0;
          g.loseTimer = 0;
        }
      }
      if (Math.hypot(p.x - g.x, p.y - g.y) < CATCH_DIST) {
        state.screen = SCREEN_LOSE;
        state.loseCause = `${g.name} menangkapmu di tengah aula.`;
        state.sfx.push('lose');
      }
    } else if (g.state === 'investigate' && g.target) {
      const arrived = guardTo(state, g, g.target.x, g.target.y, GUARD_PATROL_SPEED * 1.35, dt);
      if (arrived) {
        g.lookTimer += dt;
        g.angle += dt * 1.6;
        if (g.lookTimer > 2) {
          g.state = 'patrol';
          g.lookTimer = 0;
          g.replan = 0;
        }
      }
    } else {
      const wp = g.waypoints[g.waypoint];
      const tx = wp[0] * TILE + TILE / 2;
      const ty = wp[1] * TILE + TILE / 2;
      const arrived = guardTo(state, g, tx, ty, GUARD_PATROL_SPEED, dt);
      if (arrived) g.waypoint = (g.waypoint + 1) % g.waypoints.length;
    }
  }
}

function stepLasers(state, dt) {
  const p = state.player;
  for (const l of state.lasers) {
    // Each laser cools down on its own: tripping one never shields
    // the thief from the other.
    l.cooldown = Math.max(0, l.cooldown - dt);
    l.on = ((state.time + l.phase) % l.period) < (l.period / 2);
    if (!l.on || l.cooldown > 0) continue;
    const d = distToSegment(p.x, p.y, l.x1, l.y1, l.x2, l.y2);
    if (d < 14) {
      state.alarm = Math.min(100, state.alarm + LASER_ALARM);
      l.cooldown = 1.5;
      state.shake = Math.max(state.shake, 0.7);
      state.flash = Math.max(state.flash, 0.6);
      state.sfx.push('laser');
      const midX = (l.x1 + l.x2) / 2;
      const midY = (l.y1 + l.y2) / 2;
      for (const g of state.guards) {
        if (g.state === 'patrol') {
          g.state = 'investigate';
          g.target = { x: midX, y: midY };
          g.replan = 0;
        }
      }
    }
  }
}

export function stepGame(state, input, dt) {
  state.shake = Math.max(0, state.shake - dt * 1.4);
  state.flash = Math.max(0, state.flash - dt * 1.8);
  const startPressed = input.start && !state.prev.start;
  const pausePressed = input.pause && !state.prev.pause;
  state.prev.start = !!input.start;
  state.prev.pause = !!input.pause;

  if (state.screen === SCREEN_TITLE) {
    if (startPressed || takeClick(input)) {
      state.screen = SCREEN_PLAY;
      state.sfx.push('click');
    }
    return;
  }
  if (state.screen === SCREEN_PAUSE) {
    if (pausePressed || startPressed) {
      state.screen = SCREEN_PLAY;
      state.sfx.push('click');
    }
    return;
  }
  if (state.screen === SCREEN_WIN || state.screen === SCREEN_LOSE) {
    if (startPressed || takeClick(input)) resetState(state);
    return;
  }

  // --- play ---
  if (pausePressed) {
    state.screen = SCREEN_PAUSE;
    return;
  }
  state.time += dt;
  const p = state.player;

  // Tools (edge-triggered): EMP kills cameras, smoke hides the thief.
  if (input.emp && !state.prev.emp && state.empLeft > 0) {
    state.empLeft -= 1;
    for (const cam of state.cameras) cam.disabledUntil = state.time + EMP_SECONDS;
    state.alarm = Math.min(100, state.alarm + EMP_ALARM);
    state.sfx.push('emp');
    // The EMP pop is loud: nearby guards come to check where it went off.
    // Cameras die, but the room does not stay quiet — that is the trade.
    for (const g of state.guards) {
      if ((g.state === 'patrol' || g.state === 'investigate')
        && Math.hypot(g.x - p.x, g.y - p.y) < NOISE_RADIUS * 2) {
        g.state = 'investigate';
        g.target = { x: p.x, y: p.y };
        g.replan = 0;
      }
    }
  }
  if (input.smoke && !state.prev.smoke && state.smokeLeft > 0) {
    state.smokeLeft -= 1;
    state.smokes.push({ x: p.x, y: p.y, until: state.time + SMOKE_SECONDS });
    state.sfx.push('smoke');
  }
  state.prev.emp = !!input.emp;
  state.prev.smoke = !!input.smoke;

  // Cracking the vault: hold E beside it, standing still.
  const vaultDist = Math.hypot(p.x - state.vault.x, p.y - state.vault.y);
  const cracking = !state.vaultOpen && input.crack && vaultDist < CRACK_RANGE;
  if (cracking) {
    state.crack += dt / CRACK_SECONDS;
    state.sfx.push('cracktick');
    if (state.crack >= 1) {
      state.vaultOpen = true;
      state.diamond = { x: state.vault.x - 70, y: state.vault.y + 20, taken: false };
      state.sfx.push('crack');
    }
  } else if (!state.vaultOpen) {
    state.crack = Math.max(0, state.crack - dt * 0.4);
  }

  // Movement (frozen while cracking; gold slows the getaway).
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (cracking) { mx = 0; my = 0; }
  const moving = mx !== 0 || my !== 0;
  p.moving = moving;
  p.sprinting = moving && !!input.sprint;
  if (moving) {
    const len = Math.hypot(mx, my);
    const speed = PLAYER_SPEED * (p.sprinting ? SPRINT_MULT : 1) * (1 - state.goldCarried * GOLD_SLOW);
    const pos = moveCircle(p.x, p.y, (mx / len) * speed * dt, (my / len) * speed * dt, 13);
    p.x = pos.x;
    p.y = pos.y;
    p.angle = Math.atan2(my, mx);
    if (p.sprinting) {
      for (const g of state.guards) {
        // A guard already investigating re-aims at the fresh noise too:
        // sprinting past one never leaves its old target stale.
        if ((g.state === 'patrol' || g.state === 'investigate')
          && Math.hypot(g.x - p.x, g.y - p.y) < NOISE_RADIUS) {
          g.state = 'investigate';
          g.target = { x: p.x, y: p.y };
          g.replan = 0;
        }
      }
    }
  }

  // Loot.
  for (const g of state.gold) {
    if (!g.taken && Math.hypot(p.x - g.x, p.y - g.y) < 28) {
      g.taken = true;
      state.goldCarried += 1;
      state.loot += GOLD_VALUE;
      state.sfx.push('pickup');
    }
  }
  if (state.diamond && !state.diamond.taken && Math.hypot(p.x - state.diamond.x, p.y - state.diamond.y) < 30) {
    state.diamond.taken = true;
    state.hasDiamond = true;
    state.loot += DIAMOND_VALUE;
    state.sfx.push('pickup');
  }

  // Cameras sweep; a live cone fills the alarm fast.
  let seen = false;
  for (const cam of state.cameras) {
    cam.angle = cam.base + cam.sweep * Math.sin(state.time * 0.55 + cam.index * 1.7);
    cam.spotted = cameraSees(state, cam);
    if (cam.spotted) {
      seen = true;
      state.alarm = Math.min(100, state.alarm + CAM_DETECT * dt);
    }
  }

  // Guards: seeing the thief fills the alarm (slow in shadow, fast in light).
  for (const g of state.guards) {
    if (guardSees(state, g)) {
      seen = true;
      const rate = isShadowAt(p.x, p.y) ? DETECT_SHADOW : DETECT_LIT;
      state.alarm = Math.min(100, state.alarm + rate * dt);
    }
  }
  if (!seen) state.alarm = Math.max(0, state.alarm - ALARM_DECAY * dt);
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

  // Lockdown at alarm 100: the exit seals and every guard converges on
  // where the thief was last seen — but only a guard that actually sees
  // the thief gives chase, so a lockdown is survivable if you break
  // line of sight instead of a four-guard pile-on from across the map.
  if (state.alarm >= 100 && state.lockdown <= 0) {
    state.lockdown = LOCKDOWN_SECONDS;
    state.lockdowns += 1;
    state.shake = 1;
    state.flash = 1;
    state.sfx.push('alarm');
    for (const g of state.guards) {
      if (g.seesPlayer) {
        g.state = 'chase';
        g.loseTimer = 0;
      } else if (g.state === 'patrol') {
        g.state = 'investigate';
        g.target = g.lastSeen ? { ...g.lastSeen } : { x: p.x, y: p.y };
        g.replan = 0;
      }
    }
  }
  if (state.lockdown > 0) {
    state.lockdown -= dt;
    if (state.lockdown <= 0) {
      state.lockdown = 0;
      state.alarm = LOCKDOWN_RESET;
    }
  }

  stepLasers(state, dt);
  stepGuards(state, dt);

  // Win: diamond in hand, reach the getaway van, not during lockdown.
  if (state.hasDiamond && state.lockdown <= 0
    && Math.hypot(p.x - state.exit.x, p.y - state.exit.y) < 36) {
    state.screen = SCREEN_WIN;
    const timeBonus = Math.max(0, 300 - Math.floor(state.time)) * TIME_BONUS_PER_SEC;
    const ghost = state.maxAlarm < 50 ? GHOST_BONUS : 0;
    state.score = state.loot + timeBonus + ghost;
    state.sfx.push('win');
  }
}

// --- browser shell ---
export function boot(canvas) {
  const ctx = canvas.getContext('2d');
  const state = createState(1);
  const input = { up: false, down: false, left: false, right: false, sprint: false, crack: false, emp: false, smoke: false, pause: false, start: false, hasClick: false, clickX: 0, clickY: 0, mouseX: 0, mouseY: 0 };
  let audio = null;
  const beep = (freq, dur, type = 'square', vol = 0.05) => {
    try {
      audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch { /* sound is decoration */ }
  };
  const playSfx = (name) => {
    if (name === 'pickup') beep(880, 0.12, 'sine', 0.07);
    else if (name === 'crack') { beep(520, 0.1, 'square', 0.06); setTimeout(() => beep(780, 0.14, 'square', 0.06), 90); }
    else if (name === 'laser') beep(180, 0.25, 'sawtooth', 0.08);
    else if (name === 'alarm') { beep(660, 0.2, 'square', 0.08); setTimeout(() => beep(660, 0.2, 'square', 0.08), 220); }
    else if (name === 'emp') beep(220, 0.3, 'sawtooth', 0.06);
    else if (name === 'smoke') beep(300, 0.2, 'sine', 0.05);
    else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sine', 0.07), i * 110)); }
    else if (name === 'lose') beep(140, 0.5, 'sawtooth', 0.08);
    else if (name === 'click') beep(600, 0.06, 'sine', 0.04);
  };
  return { state, input, ctx, playSfx };
}
