/* ---------- collision helpers ---------- */
// Pushes a circle (x,z,r) out of every collider overlapping the vertical span [y0,y1].
function collideCircle(pos, r, y0, y1) {
  for (const c of colliders) {
    if (y1 <= c.minY || y0 >= c.maxY) continue;
    const nx = clamp(pos.x, c.minX, c.maxX), nz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), push = r - d;
      pos.x += (dx / d) * push; pos.z += (dz / d) * push;
    } else {
      // centre inside the box: leave by the nearest face
      const l = pos.x - c.minX, rr = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z;
      const m = Math.min(l, rr, t, b);
      if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r;
      else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
    }
  }
}
// Segment vs all colliders (slab test). Returns true if nothing blocks a→b.
function lineClear(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  for (const c of colliders) {
    let t0 = 0, t1 = 1, ok = true;
    for (const [p, d, mn, mx] of [[a.x, dx, c.minX, c.maxX], [a.y, dy, c.minY, c.maxY], [a.z, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) { ok = false; break; } continue; }
      let ta = (mn - p) / d, tb = (mx - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok) return false;
  }
  return true;
}

// what you are standing on at (x, z) with your feet at height y, for footstep sounds
const GROUND_SURF = { dust2: "sand", dust: "sand", harbor: "concrete", frost: "snow" };
function surfaceAt(x, z, y = 0) {
  let top = null;
  for (const c of colliders) {
    if (x < c.minX - 0.2 || x > c.maxX + 0.2 || z < c.minZ - 0.2 || z > c.maxZ + 0.2) continue;
    if (c.maxY > 0.05 && Math.abs(c.maxY - y) < 0.12 && (!top || c.maxY > top.maxY)) top = c;
  }
  if (!top) return GROUND_SURF[MAP_ID] || "sand";
  const m = top.mat || "";
  if (m === "steel" || m.startsWith("c_") || m === "craneY") return "metal";
  if (m === "crate" || m === "logs" || m === "frameWood" || m === "gable" || m === "bark") return "wood";
  return "concrete";
}

/* ---------- navigation grid + A* for bots ---------- */
const NAV = (() => {
  const N = MAP_HALF * 2, R = 0.6;
  const blocked = new Uint8Array(N * N);
  const idx = (i, j) => j * N + i;
  const toCell = (v) => clamp(Math.floor(v + MAP_HALF), 0, N - 1);
  const center = (i) => i - MAP_HALF + 0.5;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = center(i), z = center(j);
    for (const c of colliders) {
      if (c.minY > 1.5) continue;
      if (x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R) { blocked[idx(i, j)] = 1; break; }
    }
  }
  function free(x, z) { return !blocked[idx(toCell(x), toCell(z))]; }
  function nearestFree(x, z) {
    let i = toCell(x), j = toCell(z);
    if (!blocked[idx(i, j)]) return [i, j];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < N && b < N && !blocked[idx(a, b)]) return [a, b];
    }
    return [i, j];
  }
  function walkable(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.35);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!free(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  function path(sx, sz, tx, tz) {
    const [si, sj] = nearestFree(sx, sz), [ti, tj] = nearestFree(tx, tz);
    const start = idx(si, sj), goal = idx(ti, tj);
    const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const open = [start]; g[start] = 0;
    const h = (k) => Math.hypot((k % N) - ti, Math.floor(k / N) - tj);
    const f = new Float32Array(N * N).fill(Infinity); f[start] = h(start);
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % N, cj = Math.floor(cur / N);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = idx(ni, nj);
        if (blocked[nk] || closed[nk]) continue;
        if (di && dj && (blocked[idx(ci + di, cj)] || blocked[idx(ci, cj + dj)])) continue;
        const ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; f[nk] = ng + h(nk); from[nk] = cur; open.push(nk); }
      }
    }
    if (from[goal] === -1 && goal !== start) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = from[k]) { cells.push({ x: center(k % N), z: center(Math.floor(k / N)) }); if (k === start) break; }
    cells.reverse();
    // string-pull: skip points that are directly reachable
    const out = [];
    let ax = sx, az = sz, k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) if (walkable(ax, az, cells[m].x, cells[m].z)) { far = m; break; }
      out.push(cells[far]); ax = cells[far].x; az = cells[far].z; k = far + 1;
    }
    return out;
  }
  function randomFree(zMin = -30, zMax = 30) {
    for (let n = 0; n < 200; n++) {
      const x = rand(-30, 30), z = rand(zMin, zMax);
      if (free(x, z)) return { x, z };
    }
    return { x: 0, z: 0 };
  }
  return { path, free, randomFree, walkable };
})();

