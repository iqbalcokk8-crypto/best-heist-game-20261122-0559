// BRANKAS EMAS — the staged screenshots behind ?shot=title|play|alert|win.
// Each scene plays the real rules forward from a fresh world for a fixed
// script, steered by a waypoint autopilot that walks the weighted
// shortest path (the same findPath the guards use), so every frame is what
// a real game looks like and the same seed always gives the same frame.
// The vault crack uses one smoke bomb: the tool the game itself teaches.
import { TILE } from './config.js';
import { SCREEN_PLAY, SCREEN_WIN, distToSegment, stepGame } from './main.js';
import { findPath } from './world.js';

const DT = 1 / 60;
const MAX_STEPS = 60 * 240;

function blankInput() {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, crack: false, emp: false, smoke: false,
    pause: false, start: false, hasClick: false,
    clickX: 0, clickY: 0, mouseX: 0, mouseY: 0,
  };
}

function tileCentre(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

// The autopilot: follow the path to the current waypoint, one tile centre
// at a time, as a human would with WASD.
function drive(state, pilot, tx, ty, sprint) {
  const input = blankInput();
  const p = state.player;
  if (pilot.path.length === 0 || pilot.target.x !== tx || pilot.target.y !== ty) {
    pilot.target = { x: tx, y: ty };
    pilot.path = findPath(p.x, p.y, tx, ty);
  }
  if (pilot.path.length === 0) {
    return { input, arrived: Math.hypot(p.x - tx, p.y - ty) < 24 };
  }
  const next = pilot.path[0];
  const dx = next.x - p.x;
  const dy = next.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    pilot.path.shift();
    return { input, arrived: false };
  }
  const nx = dx / d;
  const ny = dy / d;
  if (nx > 0.3) input.right = true;
  if (nx < -0.3) input.left = true;
  if (ny > 0.3) input.down = true;
  if (ny < -0.3) input.up = true;
  input.sprint = !!sprint;
  return { input, arrived: false };
}

// Shadow-lane refuges: when a guard gives chase, the autopilot sprints
// for the nearest one (a real route, never straight into a wall corner)
// until the guard loses the trail, then resumes its phase.
const REFUGES = [tileCentre(7, 12), tileCentre(27, 16)];

function nearestRefuge(state) {
  const p = state.player;
  let best = REFUGES[0];
  let bestD = Infinity;
  for (const r of REFUGES) {
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

function runScript(state, phases, stopAt, allowReactiveSmoke = false) {
  state.screen = SCREEN_PLAY;
  const pilot = { path: [], target: { x: -1, y: -1 } };
  let phase = 0;
  let phaseTime = 0;
  let smokeUsed = false;
  let fleeTarget = null;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (stopAt !== null && state.time >= stopAt) break;
    if (state.screen === SCREEN_WIN || state.screen === 'lose') break;
    if (phase >= phases.length) break;
    const ph = phases[phase];
    phaseTime += DT;
    let input = blankInput();
    let done = false;
    if (ph.type === 'goto') {
      const r = drive(state, pilot, ph.x, ph.y, ph.sprint);
      input = r.input;
      done = r.arrived;
    } else if (ph.type === 'crack') {
      const v = tileCentre(26, 1);
      const d = Math.hypot(state.player.x - v.x, state.player.y - v.y);
      if (d > 30) {
        const r = drive(state, pilot, v.x, v.y, false);
        input = r.input;
      } else {
        if (!smokeUsed && state.smokeLeft > 0) {
          input.smoke = true;
          smokeUsed = true;
        }
        input.crack = true;
        done = state.vaultOpen;
      }
    } else if (ph.type === 'stand') {
      done = phaseTime >= ph.seconds;
    } else if (ph.type === 'waitAlarm') {
      done = state.alarm >= ph.min;
    } else if (ph.type === 'waitWin') {
      done = state.screen === SCREEN_WIN;
    }
    // Chased and close: abandon the phase for a sprint to a shadow
    // refuge. The phase resumes once the guard loses the trail. Never
    // stand still at a refuge while chased: hop to the other one, so a
    // guard that followed the trail finds an empty room, not a cornered
    // thief.
    let chased = false;
    for (const g of state.guards) {
      if (g.state === 'chase' && Math.hypot(g.x - state.player.x, g.y - state.player.y) < 170) {
        chased = true;
        break;
      }
    }
    if (chased) {
      if (!fleeTarget) {
        fleeTarget = nearestRefuge(state);
      } else if (Math.hypot(state.player.x - fleeTarget.x, state.player.y - fleeTarget.y) < 40) {
        fleeTarget = fleeTarget === REFUGES[0] ? REFUGES[1] : REFUGES[0];
      }
      const r = drive(state, pilot, fleeTarget.x, fleeTarget.y, true);
      input = r.input;
    } else {
      fleeTarget = null;
    }
    // Reactive smoke: spotted and the alarm is climbing — pop a smoke
    // bomb to break every line of sight at once. One smoke is always
    // kept in reserve for the vault crack, and the alert scene never
    // uses it (it needs the alarm to rise).
    if (allowReactiveSmoke && ph.type !== 'crack' && state.alarm >= 25
      && state.smokeLeft > 1
      && !state.smokes.some((s) => state.time < s.until)) {
      input.smoke = true;
    }
    // Time the lasers: never step onto a live beam. If the thief is
    // about to cross one, stand still until it goes dark (at most 2s).
    // A chase overrides the wait — running beats standing when a guard
    // is already on your heels.
    if (!chased) {
      for (const l of state.lasers) {
        if (!l.on) continue;
        const d = distToSegment(state.player.x, state.player.y, l.x1, l.y1, l.x2, l.y2);
        if (d < 42) {
          input = blankInput();
          break;
        }
      }
    }
    stepGame(state, input, DT);
    if (globalThis.__brankasDebug && Math.floor(state.time * 2) !== Math.floor((state.time - DT) * 2)) {
      globalThis.__brankasDebug({
        t: state.time.toFixed(1), phase, alarm: Math.round(state.alarm),
        px: Math.round(state.player.x), py: Math.round(state.player.y),
        screen: state.screen, lockdown: state.lockdown.toFixed(1),
        guards: state.guards.map((g) => `${g.name}:${g.state[0]}${Math.round(Math.hypot(g.x - state.player.x, g.y - state.player.y))}`).join(' '),
      });
    }
    if (done) {
      phase += 1;
      phaseTime = 0;
      pilot.path = [];
    }
  }
}

export function stageShot(state, name) {
  if (name === 'title') return; // fresh title screen, nothing to play
  if (name === 'play') {
    // No reactive smoke here: the play frame should show the alarm
    // meter working (mid-heist, alarm climbing), not a clean getaway.
    runScript(state, [
      { type: 'goto', ...tileCentre(17, 3) },
      { type: 'crack' },
      { type: 'goto', ...tileCentre(27, 5) },
    ], 14, false);
    return;
  }
  if (name === 'alert') {
    // Stand on the gold at (17,3) until Bowo's northbound patrol spots
    // the thief, then freeze the frame the moment the alarm passes 45:
    // the chase has just begun, the guard is still a sprint away, and
    // the alarm meter reads high. No flee — fleeing is what gets the
    // thief cornered in a doorway.
    runScript(state, [
      { type: 'goto', ...tileCentre(17, 3) },
      { type: 'waitAlarm', min: 45 },
    ], 20);
    return;
  }
  if (name === 'win') {
    runScript(state, [
      { type: 'goto', ...tileCentre(17, 3) },
      { type: 'crack' },
      { type: 'goto', ...tileCentre(27, 5) },
      { type: 'goto', ...tileCentre(27, 18) },
      // A lockdown seals the exit: wait at the van until it lifts.
      { type: 'waitWin' },
    ], null, true);
    return;
  }
}

export function shotReady() {
  return true;
}
