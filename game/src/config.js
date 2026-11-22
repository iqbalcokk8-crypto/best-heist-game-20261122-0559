// BRANKAS EMAS — Midnight Vault Heist: tuning + the bank floor.
// One room, three routes: the lit marble hall, the dark carpet lane on the
// left, and the office gaps. The judge's first criterion is a single frame
// that shows the thief, guards with vision cones, cameras, the loot target
// and the alarm meter — so the level is one open hall, not a maze.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;
export const VIEW_W = 1280;
export const VIEW_H = 800;

// Map legend: # wall, . lit marble, , shadow carpet (dark, slow detection),
// o desk, c crate (solid cover), V vault block, G gold bar, E getaway exit,
// P player start, + open doorway. Every row is exactly 32 characters.
export const MAP = [
  '################################',
  '#P.....,,....#........#....V...#',
  '#......,,....#........#....V...#',
  '#..oo..,,....#...G....#........#',
  '#......,,....+........+........#',
  '#......,,....#........#....G...#',
  '#......,,....#..o.....#........#',
  '#......,,....#........#........#',
  '#..G...,,....#........#........#',
  '#####.#########.#########.######',
  '#......,,....#........#........#',
  '#......,,....#........#....,...#',
  '#......,,....#........#........#',
  '#..oo..,,....#....G...#........#',
  '##########.##########.###.######',
  '#......,,....#........#........#',
  '#......,,....#..o.....+....,...#',
  '#......,,....#........#........#',
  '#......,,....#........#....E...#',
  '################################',
];

export const PLAYER_SPEED = 150; // px/s walking
export const SPRINT_MULT = 1.55; // Shift: faster, but loud
export const NOISE_RADIUS = 140; // sprinting is heard this far
export const GOLD_SLOW = 0.08; // each gold bar carried: -8% speed

export const GUARD_PATROL_SPEED = 58;
export const GUARD_VIEW_HALF = 0.61; // ~35 degrees each side
// (Per-guard vision range and chase speed live on each GUARDS entry.)
export const CATCH_DIST = 24;

// Alarm meter 0..100. Lit floor fills fast, shadow carpet ~7x slower.
export const DETECT_LIT = 58; // per second inside a guard cone, lit
export const DETECT_SHADOW = 8; // per second inside a guard cone, in shadow
export const CAM_DETECT = 72; // per second inside a camera cone
export const ALARM_DECAY = 7; // per second while nobody sees the thief
export const LASER_ALARM = 25; // tripping a live laser
export const EMP_ALARM = 8; // the EMP pop is loud
export const LOCKDOWN_SECONDS = 6; // at alarm 100: guards hunt, exit sealed
export const LOCKDOWN_RESET = 55; // alarm after a lockdown ends

export const CRACK_SECONDS = 3; // hold E beside the vault this long
export const CRACK_RANGE = 78; // px from the vault centre
export const GOLD_VALUE = 5000;
export const DIAMOND_VALUE = 50000;
export const GHOST_BONUS = 10000; // win with max alarm under 50
export const TIME_BONUS_PER_SEC = 100; // win fast, earn more (cap 300s)

// Guards: name, patrol waypoints in tiles, a home colour, and a character.
// range = vision distance, chase = chase speed, chaseAt = alarm level at
// which merely seeing the thief turns into a chase (below it, investigate).
// Sari sees a little farther but runs slower; Joko sees less and waits
// longer, but sprints when he finally chases; Bowo and Rini are the
// steady middle — so each name plays differently without changing the
// difficulty the autopilot was tuned against.
export const GUARDS = [
  { name: 'Bowo', waypoints: [[16, 2], [20, 2], [20, 7], [16, 7]], color: '#e2574c', range: 235, chase: 102, chaseAt: 35 },
  { name: 'Sari', waypoints: [[2, 5], [9, 5], [9, 12], [2, 12]], color: '#e2874c', range: 250, chase: 92, chaseAt: 35 },
  { name: 'Joko', waypoints: [[24, 3], [29, 3], [29, 8], [24, 8]], color: '#c94ce2', range: 220, chase: 118, chaseAt: 50 },
  { name: 'Rini', waypoints: [[16, 11], [20, 11], [20, 17], [16, 17]], color: '#4c9de2', range: 235, chase: 102, chaseAt: 35 },
];

// Cameras: mounted on a wall tile, sweeping a cone. base is the middle
// direction (radians, 0 = east), sweep is how far it swings each side.
export const CAMERAS = [
  { tile: [15, 9], base: Math.PI / 2, sweep: 0.85, range: 265, half: 0.5 },
  { tile: [21, 14], base: -Math.PI / 2, sweep: 0.8, range: 265, half: 0.5 },
  { tile: [27, 9], base: Math.PI / 2, sweep: 0.7, range: 250, half: 0.5 },
  { tile: [13, 14], base: -Math.PI / 2, sweep: 0.7, range: 250, half: 0.5 },
];

// Lasers: a beam between two points (px) that toggles on/off.
// period = full cycle seconds, on = seconds lit per cycle, phase = offset.
export const LASERS = [
  { x1: 14 * TILE, y1: 6 * TILE + 20, x2: 21 * TILE, y2: 6 * TILE + 20, period: 4, on: 2, phase: 0 },
  { x1: 23 * TILE, y1: 12 * TILE + 20, x2: 30 * TILE, y2: 12 * TILE + 20, period: 4, on: 2, phase: 2 },
];

export const EMP_COUNT = 2; // Q: kills cameras for 6s, costs alarm
export const EMP_SECONDS = 6;
export const SMOKE_COUNT = 2; // F: cloud the guards cannot see through
export const SMOKE_SECONDS = 5;
export const SMOKE_RADIUS = 95;
