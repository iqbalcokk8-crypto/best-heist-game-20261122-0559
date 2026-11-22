// BRANKAS EMAS — node tests for the real rules (no browser, no DOM).
// Run: node tools/verify.mjs [repo-dir]
import { createState, stepGame } from '../game/src/main.js';
import { stageShot } from '../game/src/shots.js';
import { findPath, pointSolid, tileSolid } from '../game/src/world.js';
import { COLS, MAP, ROWS, TILE } from '../game/src/config.js';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const repo = resolve(process.argv[2] ?? '.');
void repo;

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed += 1; console.log(`*** FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
function blankInput() {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, crack: false, emp: false, smoke: false,
    pause: false, start: false, hasClick: false,
    clickX: 0, clickY: 0, mouseX: 0, mouseY: 0,
  };
}
function stepFor(state, input, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) stepGame(state, input, 1 / 60);
}
function startPlay(state) {
  state.screen = 'play';
}
function parkGuards(state, x = 60, y = 740) {
  for (const g of state.guards) {
    g.x = x; g.y = y; g.angle = Math.PI; g.state = 'patrol'; g.path = [];
  }
}

// 1. Map shape: 20 rows, 32 chars each, walled border, one P/V-set/Gx4/E.
check('map rows', MAP.length === ROWS && MAP.every((r) => r.length === COLS),
  `${MAP.length}x${MAP[0].length}`);
const flat = MAP.join('');
check('map border walls', MAP[0] === '#'.repeat(COLS) && MAP[ROWS - 1] === '#'.repeat(COLS)
  && MAP.every((r) => r[0] === '#' && r[COLS - 1] === '#'));
check('map markers', (flat.match(/P/g) || []).length === 1
  && (flat.match(/V/g) || []).length === 2
  && (flat.match(/G/g) || []).length === 4
  && (flat.match(/E/g) || []).length === 1);

// 2. Reachability: every walkable tile reachable from the player (BFS).
{
  const seen = new Set();
  const queue = [[1, 1]];
  seen.add('1,1');
  while (queue.length) {
    const [c, r] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc; const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (tileSolid(nc, nr) || seen.has(`${nc},${nr}`)) continue;
      seen.add(`${nc},${nr}`);
      queue.push([nc, nr]);
    }
  }
  let walkable = 0;
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) if (!tileSolid(c, r)) walkable += 1;
  check('all walkable tiles reachable', seen.size === walkable, `${seen.size}/${walkable}`);
}

// 3. Pathfinding: routes through the wall gaps, never through a solid tile.
{
  const path = findPath(20 * TILE + 20, 2 * TILE + 20, 20 * TILE + 20, 11 * TILE + 20);
  const throughWall = path.some((p) => tileSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE)));
  check('findPath crosses the row-9 wall via a gap', path.length > 10 && !throughWall, `${path.length} steps`);
  const perim = findPath(5 * TILE + 20, 10 * TILE + 20, 1 * TILE + 20, 1 * TILE + 20);
  check('findPath reaches the perimeter corner', perim.length > 0, `${perim.length} steps`);
}

// 4. Detection: lit floor fills ~58/s, shadow carpet ~8/s (same geometry).
{
  const lit = createState(1);
  startPlay(lit);
  lit.player.x = 700; lit.player.y = 140;
  lit.guards[0].x = 620; lit.guards[0].y = 140; lit.guards[0].angle = 0; lit.guards[0].state = 'patrol';
  parkGuards(lit, 60, 740);
  lit.guards[0].x = 620; lit.guards[0].y = 140; lit.guards[0].angle = 0;
  stepFor(lit, blankInput(), 0.5);
  check('detection lit ~58/s', lit.alarm > 20 && lit.alarm < 40, `alarm ${lit.alarm.toFixed(1)} in 0.5s`);

  const dark = createState(1);
  startPlay(dark);
  dark.player.x = 300; dark.player.y = 140; // ',' shadow carpet
  parkGuards(dark, 60, 740);
  dark.guards[0].x = 220; dark.guards[0].y = 140; dark.guards[0].angle = 0;
  stepFor(dark, blankInput(), 0.5);
  check('detection shadow ~8/s', dark.alarm > 2 && dark.alarm < 8, `alarm ${dark.alarm.toFixed(1)} in 0.5s`);
}

// 5. Laser trip: crossing a live beam adds +25 alarm and alerts a guard.
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  s.player.x = 700; s.player.y = 260; // on laser 1 (y=260, x 560..840), on at t=0
  stepFor(s, blankInput(), 0.1);
  check('laser trip +25 alarm', s.alarm >= 20 && s.alarm <= 30, `alarm ${s.alarm.toFixed(1)}`);
  check('laser trip investigates a guard', s.guards.some((g) => g.state === 'investigate'));
}

// 6. Vault crack: 3s of holding E beside the vault opens it, diamond spawns.
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  s.player.x = 1060; s.player.y = 60;
  const input = blankInput();
  input.crack = true;
  stepFor(s, input, 3.2);
  check('vault opens after 3s crack', s.vaultOpen && s.diamond !== null);
  check('crack progress resets when interrupted', (() => {
    const t = createState(1);
    startPlay(t);
    parkGuards(t);
    t.player.x = 1060; t.player.y = 60;
    const held = blankInput(); held.crack = true;
    stepFor(t, held, 1.5);
    const mid = t.crack;
    stepFor(t, blankInput(), 2);
    return mid > 0.3 && t.crack < mid;
  })());
}

// 7. EMP: one charge disables all cameras for 6s and costs alarm.
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  const input = blankInput(); input.emp = true;
  stepGame(s, input, 1 / 60);
  input.emp = false;
  stepFor(s, input, 0.1);
  check('EMP disables cameras', s.empLeft === 1 && s.cameras.every((c) => s.time < c.disabledUntil),
    `empLeft ${s.empLeft}, alarm ${s.alarm.toFixed(1)}`);
}

// 8. Smoke: a guard staring at the thief through smoke sees nothing.
{
  const s = createState(1);
  startPlay(s);
  s.player.x = 700; s.player.y = 140;
  parkGuards(s, 60, 740);
  s.guards[0].x = 620; s.guards[0].y = 140; s.guards[0].angle = 0;
  const input = blankInput(); input.smoke = true;
  stepGame(s, input, 1 / 60);
  input.smoke = false;
  const before = s.alarm;
  stepFor(s, input, 0.5);
  check('smoke blocks detection', s.alarm <= before + 0.5, `alarm ${before.toFixed(1)} -> ${s.alarm.toFixed(1)}`);
}

// 9. Staged shots: the autopilot plays the real rules to each frame.
{
  const play = createState(1);
  stageShot(play, 'play');
  check('shot play: mid-heist, still playing', play.screen === 'play' && play.time >= 10,
    `t=${play.time.toFixed(1)} alarm=${play.alarm.toFixed(0)}`);

  const alert = createState(1);
  stageShot(alert, 'alert');
  check('shot alert: alarm high, not caught', alert.screen === 'play' && alert.alarm >= 60,
    `alarm=${alert.alarm.toFixed(0)} guards=${alert.guards.map((g) => g.state).join(',')}`);

  const win = createState(1);
  stageShot(win, 'win');
  check('shot win: full heist wins', win.screen === 'win' && win.hasDiamond && win.score > 50000,
    `screen=${win.screen} score=${win.score} t=${win.time.toFixed(1)}`);
}

// 10. Walk speed: 3s holding right moves ~450px in simulated time
// (the browser playtest only checks direction — headless FPS is low).
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  const input = blankInput();
  input.right = true;
  stepFor(s, input, 3);
  check('walk speed 150px/s', s.player.x > 480 && s.player.x <= 508, `x=${s.player.x.toFixed(0)}`);
}

// 11. Audit R1 — input.js keyup releases EVERY boolean key, including
// P (pause) and Space (start). Without these, P could never resume a
// paused game and Space could never restart after a win/lose.
{
  const src = readFileSync(resolve(repo, 'game/src/input.js'), 'utf8');
  check('keyup releases P and Space', src.includes("case 'KeyP': input.pause = false;")
    && src.includes("case 'Space': input.start = false;"));
  check('keyup releases Q/F correctly (no cross-wire)', src.includes("case 'KeyQ': input.emp = false;")
    && src.includes("case 'KeyF': input.smoke = false;"));
}

// 12. Audit R1 — guards are collision-aware: a 120s free run never leaves
// any guard inside a solid tile (the old followPath could clip corners
// when a path was replanned mid-tile).
{
  const s = createState(1);
  startPlay(s);
  const dirs = ['right', 'down', 'left', 'up'];
  let bad = 0;
  for (let i = 0; i < 60 * 120; i += 1) {
    const input = blankInput();
    input[dirs[Math.floor(i / 60) % 4]] = true;
    stepGame(s, input, 1 / 60);
    for (const g of s.guards) if (pointSolid(g.x, g.y)) bad += 1;
    if (s.screen === 'win' || s.screen === 'lose') break;
  }
  check('guards never inside a solid tile (120s run)', bad === 0, `${bad} bad samples`);
}

// 13. Audit R1 — last-seen: a guard that loses the trail investigates
// where it LAST SAW the thief, not where the thief is when the trail
// goes cold (the thief teleports away mid-chase in this test).
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  s.alarm = 50; // above Bowo's chaseAt (35): seeing means chase
  s.player.x = 700; s.player.y = 140;
  s.guards[0].x = 620; s.guards[0].y = 140; s.guards[0].angle = 0;
  stepFor(s, blankInput(), 0.3);
  const chased = s.guards[0].state === 'chase' && s.guards[0].lastSeen !== null;
  s.player.x = 60; s.player.y = 60; // teleport far away, out of sight
  stepFor(s, blankInput(), 3.5);
  const t = s.guards[0].target;
  check('guard investigates last-seen, not current pos', chased
    && s.guards[0].state === 'investigate' && t !== null
    && Math.hypot(t.x - 700, t.y - 140) < 10
    && Math.hypot(t.x - 60, t.y - 60) > 100,
    `target=(${t ? t.x.toFixed(0) : '?'},${t ? t.y.toFixed(0) : '?'})`);
}

// 14. Audit R1 — lasers cool down independently: tripping laser 1 never
// shields the thief from laser 2.
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  s.player.x = 700; s.player.y = 260; // on laser 1, live at t=0
  stepFor(s, blankInput(), 0.1);
  check('laser cooldown is per-laser', s.lasers[0].cooldown > 0 && s.lasers[1].cooldown === 0
    && !('laserTripCooldown' in s), `l1=${s.lasers[0].cooldown.toFixed(2)} l2=${s.lasers[1].cooldown}`);
}

// 15. Audit R1 — guards differ by character: Sari sees farther than Joko.
{
  const near = (idx, x) => {
    const s = createState(1);
    startPlay(s);
    parkGuards(s);
    // Middle room, same row, no wall between: guard at (585,100),
    // player at (820,100) — 235px apart.
    s.player.x = 820; s.player.y = 100;
    s.guards[idx].x = x; s.guards[idx].y = 100; s.guards[idx].angle = 0;
    stepGame(s, blankInput(), 1 / 60);
    return s.guards[idx].seesPlayer;
  };
  // 235px away: inside Sari's 250 range, outside Joko's 220.
  check('Sari sees far, Joko does not', near(1, 585) === true && near(2, 585) === false);
  const s = createState(1);
  check('chase speeds differ by guard', s.guards[1].chaseSpeed === 92 && s.guards[2].chaseSpeed === 118,
    `Sari ${s.guards[1].chaseSpeed} vs Joko ${s.guards[2].chaseSpeed}`);
}

// 16. Audit R1 — staged screenshots are fully deterministic: no
// Math.random anywhere in the renderer (shake is clock-based).
{
  const src = readFileSync(resolve(repo, 'game/src/render.js'), 'utf8');
  check('renderer has no Math.random', !src.includes('Math.random('));
}

// 17. Audit R1 — EMP pop is loud: nearby guards come to investigate the
// thief's position instead of staying on patrol.
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  s.player.x = 700; s.player.y = 140;
  s.guards[0].x = 700; s.guards[0].y = 300; s.guards[0].angle = 0;
  const input = blankInput(); input.emp = true;
  stepGame(s, input, 1 / 60);
  const t = s.guards[0].target;
  check('EMP noise draws nearby guards', s.guards[0].state === 'investigate' && t !== null
    && Math.hypot(t.x - 700, t.y - 140) < 5, `target=(${t ? t.x.toFixed(0) : '?'},${t ? t.y.toFixed(0) : '?'})`);
}

// 18. Audit R1 — sprint noise re-aims an investigating guard, not just
// patrolling ones (the thief is out of the cone, inside the noise ring).
{
  const s = createState(1);
  startPlay(s);
  parkGuards(s);
  s.player.x = 620; s.player.y = 60;
  const g = s.guards[0];
  g.x = 620; g.y = 140; g.angle = 0; g.state = 'investigate'; g.target = { x: 100, y: 100 };
  const input = blankInput(); input.up = true; input.sprint = true;
  stepFor(s, input, 0.5);
  check('sprint noise re-aims investigating guard', g.state === 'investigate' && g.target !== null
    && Math.hypot(g.target.x - s.player.x, g.target.y - s.player.y) < 150,
    `target=(${g.target ? g.target.x.toFixed(0) : '?'},${g.target ? g.target.y.toFixed(0) : '?'})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
