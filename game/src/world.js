// BRANKAS EMAS — the floor: parsing the map, solid tiles, line of sight,
// and the weighted shortest path the guards and the autopilot walk.
// A guard never steers straight into a wall: it follows the path, replans
// twice a second, and the path graph covers every walkable tile, edges
// included — the perimeter bug that cost the stealth build an audit round.
import { COLS, MAP, ROWS, TILE } from './config.js';

export const KIND_FLOOR = 0;
export const KIND_WALL = 1;

export function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
  return MAP[row][col];
}

export function tileSolid(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'o' || t === 'c' || t === 'V';
}

export function tileShadow(col, row) {
  return tileAt(col, row) === ',';
}

export function isShadowAt(x, y) {
  return tileShadow(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function pointSolid(x, y) {
  return tileSolid(Math.floor(x / TILE), Math.floor(y / TILE));
}

// A circle (the thief, a guard) may not overlap a solid tile: push it out
// along the smallest penetration axis, one tile at a time.
export function moveCircle(x, y, dx, dy, radius) {
  let nx = x + dx;
  let ny = y + dy;
  const minC = Math.max(0, Math.floor((nx - radius) / TILE));
  const maxC = Math.min(COLS - 1, Math.floor((nx + radius) / TILE));
  const minR = Math.max(0, Math.floor((ny - radius) / TILE));
  const maxR = Math.min(ROWS - 1, Math.floor((ny + radius) / TILE));
  for (let r = minR; r <= maxR; r += 1) {
    for (let c = minC; c <= maxC; c += 1) {
      if (!tileSolid(c, r)) continue;
      const cx = Math.max(c * TILE, Math.min(nx, c * TILE + TILE));
      const cy = Math.max(r * TILE, Math.min(ny, r * TILE + TILE));
      const ddx = nx - cx;
      const ddy = ny - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= radius * radius) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (ddx / d) * radius;
        ny = cy + (ddy / d) * radius;
      } else {
        ny = r * TILE - radius;
      }
    }
  }
  return { x: nx, y: ny };
}

// True when the segment between two points crosses no solid tile: the
// guards' cones are cut by walls and desks, exactly as drawn.
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointSolid(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

function tileIndex(col, row) {
  return row * COLS + col;
}

// Weighted shortest path over every walkable tile (Dijkstra). Returns an
// array of tile centres in px, start excluded, goal included; [] when the
// goal is unreachable or already reached. Diagonal steps cost sqrt(2) and
// never cut a solid corner.
export function findPath(sx, sy, gx, gy) {
  const sc = Math.floor(sx / TILE);
  const sr = Math.floor(sy / TILE);
  const gc = Math.floor(gx / TILE);
  const gr = Math.floor(gy / TILE);
  if (tileSolid(gc, gr)) return [];
  if (sc === gc && sr === gr) return [];
  const dist = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const done = new Uint8Array(COLS * ROWS);
  const start = tileIndex(sc, sr);
  dist[start] = 0;
  const open = [start];
  const DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
  ];
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (dist[open[i]] < dist[open[best]]) best = i;
    }
    const cur = open.splice(best, 1)[0];
    if (done[cur]) continue;
    done[cur] = 1;
    const cc = cur % COLS;
    const cr = Math.floor(cur / COLS);
    if (cc === gc && cr === gr) break;
    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (tileSolid(nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (tileSolid(cc + dc, cr) || tileSolid(cc, cr + dr))) continue;
      const ni = tileIndex(nc, nr);
      const nd = dist[cur] + cost;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = cur;
        if (!done[ni]) open.push(ni);
      }
    }
  }
  const goal = tileIndex(gc, gr);
  if (!done[goal]) return [];
  const tiles = [];
  let cur = goal;
  while (cur !== start && cur !== -1) {
    tiles.push(cur);
    cur = prev[cur];
  }
  tiles.reverse();
  return tiles.map((i) => ({
    x: (i % COLS) * TILE + TILE / 2,
    y: Math.floor(i / COLS) * TILE + TILE / 2,
  }));
}

export function parseLevel() {
  const gold = [];
  const vaultTiles = [];
  let player = { x: TILE * 1.5, y: TILE * 1.5 };
  let exit = { x: TILE * 27.5, y: TILE * 18.5 };
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const t = MAP[r][c];
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;
      if (t === 'P') player = { x: cx, y: cy };
      if (t === 'G') gold.push({ x: cx, y: cy, taken: false });
      if (t === 'V') vaultTiles.push({ x: cx, y: cy });
      if (t === 'E') exit = { x: cx, y: cy };
    }
  }
  const vault = {
    x: vaultTiles.reduce((s, v) => s + v.x, 0) / Math.max(1, vaultTiles.length),
    y: vaultTiles.reduce((s, v) => s + v.y, 0) / Math.max(1, vaultTiles.length),
  };
  return { gold, vault, player, exit };
}
