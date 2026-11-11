/* ============================================================
   Guns, part 1: modelling kit and materials.
   Every gun is built at real-world size in metres.
   Local frame: -Z is the muzzle direction, +Y up, +X right.
   Side profiles are written as [forward, up] pairs, read off
   reference photos, then extruded to the part's thickness.
   ============================================================ */

// Grey noise canvases used as roughness maps (linear, not sRGB).
function noiseTex(size, draw, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = MAX_ANISO;
  return t;
}
const ROUGH = {
  // worn gun finish: mid grey with lighter scuffs (rougher) and darker polished spots
  worn: noiseTex(256, (g, s) => {
    g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = Math.floor(rand(90, 190));
      g.fillStyle = `rgba(${v},${v},${v},${rand(0.15, 0.5)})`;
      g.fillRect(rand(0, s), rand(0, s), rand(1, 4), rand(1, 3));
    }
  }, 6),
  // brushed stainless: long horizontal streaks
  brushed: noiseTex(256, (g, s) => {
    g.fillStyle = "#6e6e6e"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = Math.floor(rand(60, 150));
      g.fillStyle = `rgba(${v},${v},${v},${rand(0.2, 0.6)})`;
      g.fillRect(rand(-s, s), rand(0, s), rand(s * 0.3, s * 1.2), 1);
    }
  }, 8)
};

const GM = {
  steel: new THREE.MeshStandardMaterial({ color: 0x2c2d30, metalness: 0.85, roughness: 0.55, roughnessMap: ROUGH.worn }),
  steelLight: new THREE.MeshStandardMaterial({ color: 0x55575b, metalness: 0.9, roughness: 0.5, roughnessMap: ROUGH.worn }),
  anodized: new THREE.MeshStandardMaterial({ color: 0x232427, metalness: 0.45, roughness: 0.62, roughnessMap: ROUGH.worn }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x1e1e1f, metalness: 0, roughness: 0.68, normalMap: loadTex("leather_n", false, 14), normalScale: new THREE.Vector2(0.35, 0.35) }),
  grip: new THREE.MeshStandardMaterial({ color: 0x19191a, metalness: 0, roughness: 0.85, normalMap: loadTex("leather_n", false, 22), normalScale: new THREE.Vector2(0.9, 0.9) }),
  wood: new THREE.MeshStandardMaterial({
    map: loadTex("gunwood_d", true, 2.5), normalMap: loadTex("gunwood_n", false, 2.5), roughnessMap: loadTex("gunwood_r", false, 2.5),
    color: 0xa08a78, roughness: 0.62, metalness: 0
  }),
  olive: new THREE.MeshStandardMaterial({ color: 0x4d5536, metalness: 0, roughness: 0.78, normalMap: loadTex("leather_n", false, 10), normalScale: new THREE.Vector2(0.4, 0.4) }),
  scope: new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.5, roughness: 0.42, roughnessMap: ROUGH.worn }),
  lens: new THREE.MeshStandardMaterial({ color: 0x1a2e3a, metalness: 1, roughness: 0.04, envMapIntensity: 1.6 }),
  stainless: new THREE.MeshStandardMaterial({ color: 0xb2b3b4, metalness: 1, roughness: 0.42, roughnessMap: ROUGH.brushed }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc89b54, metalness: 1, roughness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 }),
  bore: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }),
  // arms
  glove: new THREE.MeshStandardMaterial({ color: 0x3b342c, roughness: 0.82, normalMap: loadTex("leather_n", false, 3), normalScale: new THREE.Vector2(0.8, 0.8) }),
  knuckle: new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.7 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x46525c, roughness: 0.95, normalMap: loadTex("fabric_n", false, 3), normalScale: new THREE.Vector2(1.2, 1.2) }),
  cuff: new THREE.MeshStandardMaterial({ color: 0x2f373e, roughness: 0.9, normalMap: loadTex("fabric_n", false, 5) })
};

/* ---------- geometry helpers: each returns a geometry already placed in gun space ---------- */
const DEG = Math.PI / 180;

// Side profile [[fwd, up], ...] extruded `w` wide, centred on x (+ optional x offset).
function prof(pts, w, opt = {}) {
  const shape = new THREE.Shape(pts.map(([f, y]) => new THREE.Vector2(f, y)));
  for (const hole of opt.holes || []) shape.holes.push(new THREE.Path(hole.map(([f, y]) => new THREE.Vector2(f, y))));
  const bev = opt.bevel ?? Math.min(0.003, w * 0.18);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, w - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8,
    bevelSegments: opt.seg ?? 2, curveSegments: 8
  });
  g.rotateY(Math.PI / 2);                       // shape x -> -z (forward), extrusion -> +x
  g.translate(-(w - bev * 2) / 2 + (opt.x || 0), 0, 0);
  return g;
}
// Round tube along the bore axis from f0 to f1 (r0 at f0, r1 at f1).
function tube(f0, f1, r0, r1, y = 0, x = 0, seg = 18, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(f1 - f0), seg, 1, open);
  g.rotateX(-Math.PI / 2);                      // +y (top radius) -> forward
  g.translate(x, y, -(f0 + f1) / 2);
  return g;
}
// Box by centre (forward, up, x) and size (along, tall, wide), optional pitch in degrees.
function blk(f, y, len, h, w, x = 0, pitch = 0, yaw = 0) {
  const g = new THREE.BoxGeometry(w, h, len);
  if (pitch) g.rotateX(pitch * DEG);
  if (yaw) g.rotateY(yaw * DEG);
  g.translate(x, y, -f);
  return g;
}
// Cylinder standing up (y axis) or sideways (x axis) at a point.
function peg(f, y, x, r, h, axis = "y", seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  g.translate(x, y, -f);
  return g;
}
// Points along a circular arc, used for curved magazines and trigger guards.
function arc(cf, cy, r, a0, a1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cf + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}

// Merges every geometry that shares a material into one mesh: few draw calls per gun.
function mergeGeos(geos) {
  const pos = [], nor = [], uv = [];
  for (let g of geos) {
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
// A Kit collects geometry per material, then bakes it into a Group.
class Kit {
  constructor() { this.buckets = new Map(); }
  add(mat, ...geos) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(...geos);
    return this;
  }
  bake(shadow = true) {
    const grp = new THREE.Group();
    for (const [mat, geos] of this.buckets) {
      const m = new THREE.Mesh(mergeGeos(geos), mat);
      m.castShadow = shadow; m.receiveShadow = true;
      grp.add(m);
    }
    return grp;
  }
}

/* ============================================================
   Guns, part 2: rifles. y = 0 is the bore axis, f = 0 is the
   top of the pistol grip. Sizes follow the real rifles.
   ============================================================ */
function finishGun(root, kits, data) {
  for (const [name, kit] of Object.entries(kits)) {
    const g = kit.bake();
    root.add(g);
    if (name !== "body") root.userData[name] = g;
  }
  Object.assign(root.userData, data);
  return root;
}
function triggerParts(k, f, mat = GM.steel) {
  k.add(mat, prof([[f + 0.01, -0.044], [f + 0.006, -0.056], [f - 0.002, -0.064], [f + 0.002, -0.057], [f + 0.003, -0.044]], 0.006, { bevel: 0.001 }));
}

/* ---------- AK-47: stamped receiver, laminated wood, curved steel magazine ---------- */
function buildAK() {
  const body = new Kit(), mag = new Kit();
  const S = GM.steel, W = GM.wood;
  // receiver + rounded dust cover
  body.add(S, prof([[-0.075, 0.015], [-0.075, -0.03], [-0.06, -0.045], [0.205, -0.045], [0.205, 0.015]], 0.036));
  body.add(GM.steelLight, prof([[-0.072, 0.012], [-0.072, 0.024], [-0.06, 0.033], [0.18, 0.033], [0.18, 0.012]], 0.034, { bevel: 0.006, seg: 3 }));
  // rivets on both sides
  for (const [f, y] of [[-0.05, -0.03], [-0.02, -0.03], [0.02, -0.032], [0.175, -0.03], [0.19, -0.012], [0.155, -0.035]]) body.add(S, peg(f, y, 0, 0.0022, 0.04, "x", 8));
  // rear sight block, leaf and notch
  body.add(S, prof([[0.18, 0.012], [0.18, 0.036], [0.2, 0.046], [0.25, 0.046], [0.25, 0.012]], 0.03));
  body.add(S, blk(0.218, 0.05, 0.062, 0.005, 0.024, 0, 6));
  body.add(S, blk(0.192, 0.055, 0.006, 0.008, 0.02));
  // trunnion, handguards, retainer band
  body.add(S, prof([[0.2, -0.03], [0.2, 0.012], [0.232, 0.012], [0.232, -0.03]], 0.04));
  body.add(W, prof([[0.228, -0.034], [0.238, -0.043], [0.385, -0.041], [0.4, -0.03], [0.4, 0.004], [0.228, 0.004]], 0.052, { bevel: 0.009, seg: 3 }));
  body.add(W, prof([[0.236, 0.013], [0.236, 0.04], [0.252, 0.051], [0.378, 0.049], [0.39, 0.04], [0.39, 0.013]], 0.036, { bevel: 0.009, seg: 3 }));
  body.add(S, prof([[0.398, -0.032], [0.398, 0.012], [0.414, 0.012], [0.414, -0.032]], 0.044));
  // gas tube, gas block, barrel, cleaning rod
  body.add(S, tube(0.24, 0.47, 0.0105, 0.0105, 0.033));
  body.add(S, prof([[0.46, -0.012], [0.46, 0.046], [0.497, 0.046], [0.497, -0.012]], 0.026));
  body.add(S, tube(0.2, 0.6, 0.0105, 0.0092));
  body.add(S, tube(0.405, 0.585, 0.003, 0.003, -0.017));
  // front sight: triangular base, protective ears, post
  body.add(S, prof([[0.553, -0.013], [0.558, 0.03], [0.572, 0.072], [0.594, 0.072], [0.602, 0.03], [0.602, -0.013]], 0.026));
  for (const x of [-0.0115, 0.0115]) body.add(S, blk(0.583, 0.079, 0.028, 0.03, 0.004, x));
  body.add(S, blk(0.583, 0.077, 0.004, 0.026, 0.003));
  // slant brake + bore
  body.add(S, tube(0.6, 0.646, 0.0125, 0.0122));
  body.add(GM.bore, peg(0.6465, 0, 0, 0.0052, 0.002, "z", 12));
  // trigger guard, trigger, charging handle, selector
  body.add(S, prof([[0.0, -0.04], [0.0, -0.07], [0.012, -0.077], [0.07, -0.074], [0.088, -0.05], [0.088, -0.04]], 0.012,
    { holes: [[[0.008, -0.047], [0.008, -0.066], [0.016, -0.07], [0.066, -0.068], [0.08, -0.049], [0.08, -0.047]]], bevel: 0.002 }));
  triggerParts(body, 0.04);
  body.add(S, peg(0.165, 0.006, 0.032, 0.0055, 0.03, "x", 10));
  body.add(S, peg(0.165, 0.006, 0.047, 0.008, 0.008, "x", 10));
  body.add(S, blk(0.06, 0.004, 0.115, 0.012, 0.004, 0.0195, -7));
  // pistol grip and stock
  body.add(W, prof([[0.012, -0.044], [-0.028, -0.044], [-0.074, -0.145], [-0.068, -0.153], [-0.036, -0.153], [-0.03, -0.142], [-0.006, -0.09], [0.012, -0.056]], 0.032, { bevel: 0.009, seg: 3 }));
  body.add(W, prof([[-0.07, 0.012], [-0.075, -0.042], [-0.13, -0.06], [-0.25, -0.09], [-0.415, -0.135], [-0.425, -0.138], [-0.425, -0.02], [-0.41, -0.016], [-0.13, 0.0]], 0.042, { bevel: 0.009, seg: 3 }));
  body.add(S, prof([[-0.424, -0.019], [-0.424, -0.139], [-0.434, -0.139], [-0.434, -0.019]], 0.044, { bevel: 0.003 }));
  // curved 30-round magazine with a reinforcing rib
  const C = [0.465, -0.04], R = 0.36, a0 = Math.PI - 0.03, a1 = Math.PI + 0.58;
  const rear = arc(C[0], C[1], R + 0.031, a0, a1, 12), front = arc(C[0], C[1], R - 0.031, a1, a0, 12);
  mag.add(S, prof(rear.concat(front), 0.026, { bevel: 0.004 }));
  mag.add(S, prof(arc(C[0], C[1], R + 0.012, a0 + 0.08, a1 - 0.05, 10).concat(arc(C[0], C[1], R + 0.002, a1 - 0.05, a0 + 0.08, 10)), 0.03, { bevel: 0.002 }));
  const bot = arc(C[0], C[1], R, a1, a1, 1)[0];
  mag.add(S, blk(bot[0], bot[1] - 0.004, 0.07, 0.008, 0.03, 0, -33));
  return finishGun(new THREE.Group(), { body, mag }, {
    muzzle: new THREE.Vector3(0, 0, -0.65), eject: new THREE.Vector3(0.02, 0.02, -0.12),
    grip: { f: -0.03, y: -0.095, tilt: 24 }, guard: { f: 0.315, y: -0.015, r: 0.03 }
  });
}

/* ---------- M4A4: flat-top upper, A-frame front sight, ribbed handguard, STANAG magazine ---------- */
function buildM4() {
  const body = new Kit(), mag = new Kit();
  const A = GM.anodized, S = GM.steel, P = GM.polymer;
  // upper with Picatinny rail
  body.add(A, prof([[-0.075, -0.012], [-0.075, 0.028], [0.17, 0.028], [0.17, -0.012]], 0.034));
  body.add(A, blk(0.047, 0.031, 0.235, 0.007, 0.022));
  for (let f = -0.066; f < 0.165; f += 0.0105) body.add(A, blk(f, 0.0375, 0.0055, 0.006, 0.022));
  body.add(A, peg(-0.035, 0.012, 0.024, 0.0075, 0.016, "x", 12));
  body.add(GM.bore, blk(0.03, 0.006, 0.05, 0.014, 0.002, 0.0172));
  body.add(A, blk(-0.072, 0.023, 0.014, 0.008, 0.05));
  // lower receiver with flared magwell, trigger guard, trigger, grip
  body.add(A, prof([[-0.07, -0.012], [-0.07, -0.04], [-0.05, -0.05], [0.06, -0.05], [0.065, -0.07], [0.145, -0.072], [0.15, -0.05], [0.155, -0.04], [0.155, -0.012]], 0.03));
  body.add(A, prof([[0.0, -0.045], [-0.004, -0.07], [0.06, -0.072], [0.06, -0.045]], 0.012, { holes: [[[0.006, -0.051], [0.004, -0.065], [0.054, -0.066], [0.054, -0.051]]], bevel: 0.002 }));
  triggerParts(body, 0.03);
  body.add(S, peg(0.005, -0.03, 0.016, 0.006, 0.006, "x", 10));
  body.add(P, prof([[0.0, -0.05], [-0.035, -0.05], [-0.075, -0.15], [-0.068, -0.158], [-0.035, -0.158], [-0.03, -0.145], [-0.012, -0.1], [-0.004, -0.085], [0.002, -0.07]], 0.03, { bevel: 0.008, seg: 3 }));
  // buffer tube + collapsible stock
  body.add(A, tube(-0.29, -0.075, 0.016, 0.016, 0.006));
  body.add(A, tube(-0.09, -0.075, 0.019, 0.019, 0.006));
  body.add(P, prof([[-0.17, 0.03], [-0.32, 0.034], [-0.335, 0.03], [-0.335, -0.095], [-0.322, -0.1], [-0.29, -0.06], [-0.2, -0.022], [-0.17, -0.014]], 0.04, { bevel: 0.007, seg: 3 }));
  body.add(GM.grip, prof([[-0.335, 0.03], [-0.335, -0.095], [-0.349, -0.095], [-0.349, 0.03]], 0.043, { bevel: 0.004 }));
  // handguard: octagonal tube with four rails, delta ring
  body.add(A, tube(0.175, 0.37, 0.029, 0.029, 0.006, 0, 8));
  const rails = [[0.037, 0, 0.006, 0.02, 0.0045, 0], [-0.025, 0, 0.006, 0.02, -0.0045, 0], [0.006, 0.031, 0.02, 0.006, 0, 0.0045], [0.006, -0.031, 0.02, 0.006, 0, -0.0045]];
  for (const [y, x, h, w, dy, dx] of rails) {
    body.add(A, blk(0.272, y, 0.19, h, w, x));
    for (let f = 0.185; f < 0.365; f += 0.0105) body.add(A, blk(f, y + dy, 0.0055, h, w, x + dx));
  }
  body.add(A, tube(0.165, 0.18, 0.034, 0.034, 0.006, 0, 20));
  // barrel, A-frame front sight, sling loop, birdcage flash hider
  body.add(S, tube(0.17, 0.556, 0.0088, 0.0085));
  body.add(A, prof([[0.405, -0.016], [0.405, 0.012], [0.418, 0.07], [0.432, 0.07], [0.448, 0.012], [0.448, -0.016]], 0.018, { holes: [[[0.416, 0.016], [0.424, 0.052], [0.427, 0.052], [0.437, 0.016]]], bevel: 0.002 }));
  body.add(A, blk(0.425, 0.076, 0.004, 0.016, 0.003));
  body.add(A, blk(0.432, -0.022, 0.02, 0.01, 0.008));
  const loop = new THREE.TorusGeometry(0.011, 0.0018, 6, 16); loop.rotateY(Math.PI / 2); loop.translate(0, -0.038, -0.43);
  body.add(S, loop);
  body.add(S, tube(0.555, 0.6, 0.0108, 0.0108));
  for (const r of [0, 60, 120]) { const sl = blk(0.585, 0, 0.026, 0.0035, 0.0222); sl.rotateZ(r * DEG); body.add(GM.bore, sl); }
  body.add(GM.bore, peg(0.6005, 0, 0, 0.005, 0.002, "z", 12));
  // flip-up rear sight on the rail
  body.add(A, blk(-0.028, 0.046, 0.034, 0.012, 0.026));
  body.add(A, prof([[-0.04, 0.05], [-0.036, 0.074], [-0.026, 0.074], [-0.022, 0.05]], 0.022, { holes: [[[-0.034, 0.064], [-0.034, 0.07], [-0.028, 0.07], [-0.028, 0.064]]], bevel: 0.001 }));
  // STANAG magazine, almost straight
  const C = [1.105, -0.05], R = 1.0, a0 = Math.PI - 0.02, a1 = Math.PI + 0.19;
  mag.add(GM.steelLight, prof(arc(C[0], C[1], R + 0.031, a0, a1, 6).concat(arc(C[0], C[1], R - 0.031, a1, a0, 6)), 0.024, { bevel: 0.003 }));
  const bot = arc(C[0], C[1], R, a1, a1, 1)[0];
  mag.add(P, blk(bot[0], bot[1] - 0.004, 0.07, 0.01, 0.028, 0, -11));
  return finishGun(new THREE.Group(), { body, mag }, {
    muzzle: new THREE.Vector3(0, 0, -0.605), eject: new THREE.Vector3(0.02, 0.008, -0.03),
    grip: { f: -0.035, y: -0.1, tilt: 22 }, guard: { f: 0.29, y: 0.006, r: 0.031 }
  });
}

/* ============================================================
   Guns, part 3: AWP sniper rifle and the two pistols.
   ============================================================ */

/* ---------- AWP: olive thumbhole stock, heavy barrel, big scope, folded bipod ---------- */
function buildAWP() {
  const body = new Kit(), mag = new Kit(), bolt = new Kit();
  const O = GM.olive, S = GM.steel, A = GM.anodized, SC = GM.scope;
  // one-piece thumbhole stock
  body.add(O, prof([
    [0.48, -0.006], [0.48, -0.04], [0.46, -0.055], [0.2, -0.06], [0.13, -0.06], [0.125, -0.066], [0.075, -0.066], [0.07, -0.06], [0.005, -0.06],
    [-0.005, -0.08], [-0.02, -0.14], [-0.03, -0.155], [-0.07, -0.155], [-0.09, -0.13], [-0.38, -0.12], [-0.445, -0.14], [-0.462, -0.14],
    [-0.462, 0.025], [-0.45, 0.035], [-0.3, 0.04], [-0.17, 0.045], [-0.13, 0.03], [-0.1, 0.008], [-0.07, -0.006], [0.2, -0.006]
  ], 0.05, { bevel: 0.01, seg: 3, holes: [[[-0.07, -0.045], [-0.075, -0.06], [-0.085, -0.112], [-0.33, -0.103], [-0.37, -0.085], [-0.37, -0.02], [-0.3, 0.005], [-0.16, 0.008], [-0.11, -0.012]]] }));
  body.add(GM.grip, prof([[-0.461, -0.14], [-0.461, 0.025], [-0.476, 0.025], [-0.476, -0.14]], 0.052, { bevel: 0.005 }));
  // action, top rail, trigger guard + trigger
  body.add(S, tube(-0.06, 0.2, 0.018, 0.018, 0.012, 0, 20));
  body.add(A, blk(0.07, 0.034, 0.26, 0.008, 0.02));
  for (let f = -0.05; f < 0.195; f += 0.012) body.add(A, blk(f, 0.04, 0.006, 0.005, 0.02));
  body.add(S, prof([[0.0, -0.055], [0.0, -0.075], [0.012, -0.088], [0.07, -0.086], [0.08, -0.06], [0.08, -0.055]], 0.012,
    { holes: [[[0.008, -0.06], [0.008, -0.073], [0.016, -0.081], [0.066, -0.079], [0.072, -0.06]]], bevel: 0.002 }));
  body.add(S, prof([[0.042, -0.058], [0.037, -0.07], [0.03, -0.078], [0.034, -0.071], [0.036, -0.058]], 0.006, { bevel: 0.001 }));
  // heavy barrel, muzzle brake with ports
  body.add(S, tube(0.2, 0.72, 0.0128, 0.0108, 0, 0, 20));
  body.add(S, tube(0.718, 0.776, 0.0148, 0.0148, 0, 0, 20));
  for (const f of [0.735, 0.758]) body.add(GM.bore, blk(f, 0, 0.012, 0.012, 0.0302));
  body.add(GM.bore, peg(0.7765, 0, 0, 0.0055, 0.002, "z", 12));
  // folded bipod
  body.add(S, blk(0.47, -0.05, 0.03, 0.024, 0.042));
  for (const x of [-0.016, 0.016]) { body.add(S, tube(0.29, 0.46, 0.0045, 0.0045, -0.07, x, 8)); body.add(GM.grip, tube(0.27, 0.295, 0.007, 0.006, -0.07, x, 10)); }
  // scope: ocular bell, 30 mm tube, turrets, objective bell, lenses, rings
  const Y = 0.078;
  body.add(SC, tube(-0.168, -0.112, 0.021, 0.021, Y, 0, 24), tube(-0.112, -0.08, 0.021, 0.0155, Y, 0, 24));
  body.add(GM.grip, tube(-0.1, -0.085, 0.0175, 0.0175, Y, 0, 24));
  body.add(SC, tube(-0.08, 0.2, 0.0155, 0.0155, Y, 0, 24), tube(0.2, 0.25, 0.0155, 0.029, Y, 0, 28), tube(0.25, 0.322, 0.029, 0.029, Y, 0, 28));
  body.add(SC, blk(0.065, Y, 0.04, 0.034, 0.034));
  body.add(SC, peg(0.065, Y + 0.026, 0, 0.012, 0.02, "y", 18), peg(0.065, Y, 0.026, 0.012, 0.02, "x", 18), peg(0.065, Y, -0.024, 0.01, 0.016, "x", 18));
  body.add(GM.white, peg(0.065, Y + 0.0365, 0, 0.0122, 0.001, "y", 18));
  body.add(GM.lens, peg(0.3225, Y, 0, 0.026, 0.002, "z", 28), peg(-0.1685, Y, 0, 0.0185, 0.002, "z", 24));
  for (const f of [-0.015, 0.15]) { body.add(A, tube(f - 0.011, f + 0.011, 0.0185, 0.0185, Y, 0, 20)); body.add(A, blk(f, 0.05, 0.022, 0.03, 0.028)); }
  // detachable box magazine
  mag.add(A, prof([[0.045, -0.05], [0.045, -0.098], [0.12, -0.098], [0.12, -0.05]], 0.03, { bevel: 0.003 }));
  mag.add(GM.grip, blk(0.0825, -0.101, 0.08, 0.006, 0.032));
  // bolt (pivot on the action axis, so geometry is built relative to y = 0.012)
  bolt.add(S, tube(-0.095, -0.058, 0.0125, 0.0125, 0, 0, 16));
  const handle = peg(-0.045, 0, 0, 0.0045, 0.05, "x", 10); handle.rotateZ(-0.35); handle.translate(0.03, -0.006, 0);
  const knob = new THREE.SphereGeometry(0.011, 14, 10); knob.translate(0.056, -0.016, 0.045);
  bolt.add(S, handle, knob);
  const g = finishGun(new THREE.Group(), { body, mag, bolt }, {
    muzzle: new THREE.Vector3(0, 0, -0.78), eject: new THREE.Vector3(0.02, 0.02, -0.03), scopeY: Y,
    grip: { f: -0.045, y: -0.105, tilt: 14 }, guard: { f: 0.33, y: -0.035, r: 0.034 }
  });
  g.userData.bolt.position.y = 0.012;
  return g;
}

/* ---------- Desert Eagle: brushed stainless, long fixed barrel, rubber wrap grip ---------- */
function buildDeagle() {
  const body = new Kit(), slide = new Kit(), mag = new Kit();
  const X = GM.stainless, S = GM.steel;
  body.add(X, prof([[0.075, -0.008], [0.075, 0.024], [0.205, 0.024], [0.209, 0.018], [0.209, -0.008]], 0.033));
  body.add(X, blk(0.14, 0.028, 0.13, 0.006, 0.014));
  body.add(GM.bore, peg(0.2095, 0.008, 0, 0.0058, 0.002, "z", 14));
  body.add(S, blk(0.197, 0.036, 0.012, 0.012, 0.004));
  body.add(X, prof([[-0.07, -0.008], [-0.07, -0.03], [0.2, -0.03], [0.205, -0.024], [0.205, -0.008]], 0.03));
  body.add(X, prof([[0.005, -0.028], [0.005, -0.07], [0.015, -0.078], [0.085, -0.078], [0.092, -0.07], [0.095, -0.05], [0.088, -0.028]], 0.018,
    { holes: [[[0.013, -0.032], [0.013, -0.068], [0.02, -0.072], [0.08, -0.072], [0.085, -0.05], [0.078, -0.032]]], bevel: 0.002 }));
  body.add(S, prof([[0.045, -0.03], [0.04, -0.045], [0.032, -0.055], [0.037, -0.046], [0.04, -0.03]], 0.006, { bevel: 0.001 }));
  body.add(GM.grip, prof([[0.0, -0.028], [-0.062, -0.028], [-0.068, -0.04], [-0.09, -0.13], [-0.085, -0.138], [-0.035, -0.138], [-0.03, -0.13], [-0.008, -0.05]], 0.036, { bevel: 0.007, seg: 3 }));
  body.add(S, prof([[-0.07, 0.0], [-0.082, 0.012], [-0.088, 0.019], [-0.084, 0.023], [-0.074, 0.012]], 0.01, { bevel: 0.002 }));
  body.add(S, blk(0.02, -0.018, 0.03, 0.006, 0.004, 0.0165));
  slide.add(X, prof([[-0.075, -0.008], [-0.075, 0.016], [-0.07, 0.024], [0.075, 0.024], [0.075, -0.008]], 0.032));
  for (let f = -0.066; f < -0.03; f += 0.005) slide.add(S, blk(f, 0.006, 0.002, 0.02, 0.0334));
  slide.add(S, blk(-0.064, 0.03, 0.012, 0.01, 0.024));
  slide.add(S, peg(-0.058, 0.01, 0, 0.0055, 0.04, "x", 10));
  mag.add(S, prof([[-0.012, -0.03], [-0.06, -0.03], [-0.084, -0.135], [-0.036, -0.135]], 0.026, { bevel: 0.001 }));
  mag.add(X, blk(-0.06, -0.141, 0.052, 0.008, 0.034, 0, 0));
  return finishGun(new THREE.Group(), { body, slide, mag }, {
    muzzle: new THREE.Vector3(0, 0.008, -0.212), eject: new THREE.Vector3(0.018, 0.022, -0.05),
    grip: { f: -0.045, y: -0.085, tilt: 20 }, pistol: true
  });
}

/* ---------- Glock-18: polymer frame, boxy black slide, fire selector ---------- */
function buildGlock() {
  const body = new Kit(), slide = new Kit(), mag = new Kit();
  const P = GM.polymer, M = GM.anodized;
  body.add(P, prof([[-0.035, -0.005], [-0.035, -0.022], [0.145, -0.022], [0.148, -0.018], [0.148, -0.005]], 0.028));
  for (let f = 0.1; f < 0.14; f += 0.01) body.add(GM.bore, blk(f, -0.021, 0.003, 0.002, 0.0285));
  body.add(P, prof([[0.0, -0.02], [0.0, -0.055], [0.008, -0.062], [0.07, -0.062], [0.078, -0.055], [0.08, -0.02]], 0.016,
    { holes: [[[0.008, -0.024], [0.008, -0.052], [0.013, -0.056], [0.066, -0.056], [0.072, -0.05], [0.072, -0.024]]], bevel: 0.002 }));
  body.add(P, prof([[0.032, -0.02], [0.028, -0.035], [0.022, -0.044], [0.027, -0.036], [0.03, -0.02]], 0.006, { bevel: 0.001 }));
  body.add(GM.grip, prof([[0.0, -0.02], [-0.035, -0.02], [-0.04, -0.03], [-0.07, -0.105], [-0.065, -0.112], [-0.025, -0.112], [-0.022, -0.104], [-0.008, -0.07], [-0.004, -0.05], [0.002, -0.035]], 0.031, { bevel: 0.007, seg: 3 }));
  slide.add(M, prof([[-0.035, -0.005], [-0.035, 0.019], [-0.032, 0.023], [0.147, 0.023], [0.15, 0.019], [0.15, -0.005]], 0.0255, { bevel: 0.003 }));
  for (let f = -0.03; f < -0.01; f += 0.0035) slide.add(GM.bore, blk(f, 0.008, 0.0016, 0.018, 0.0262));
  slide.add(GM.bore, blk(0.045, 0.0225, 0.034, 0.002, 0.013, 0.002));
  slide.add(GM.steelLight, blk(0.045, 0.019, 0.03, 0.006, 0.012, 0.002));
  slide.add(GM.bore, peg(0.1505, 0.006, 0, 0.0055, 0.002, "z", 12));
  slide.add(M, blk(-0.025, 0.027, 0.008, 0.008, 0.022), blk(0.14, 0.027, 0.008, 0.008, 0.004));
  slide.add(GM.white, blk(-0.0205, 0.029, 0.0006, 0.003, 0.003, -0.006), blk(-0.0205, 0.029, 0.0006, 0.003, 0.003, 0.006), blk(0.1359, 0.0285, 0.0006, 0.003, 0.003));
  slide.add(M, blk(-0.028, 0.004, 0.006, 0.012, 0.004, -0.0135));
  mag.add(P, prof([[-0.012, -0.022], [-0.038, -0.022], [-0.066, -0.11], [-0.026, -0.11]], 0.024, { bevel: 0.001 }));
  mag.add(P, blk(-0.045, -0.1155, 0.044, 0.007, 0.03));
  return finishGun(new THREE.Group(), { body, slide, mag }, {
    muzzle: new THREE.Vector3(0, 0.006, -0.153), eject: new THREE.Vector3(0.015, 0.022, -0.045),
    grip: { f: -0.035, y: -0.068, tilt: 22 }, pistol: true
  });
}

const GUN_BUILDERS = { ak47: buildAK, m4a4: buildM4, awp: buildAWP, deagle: buildDeagle, glock: buildGlock };

/* ============================================================
   Guns, part 4: gloved hands and sleeves for the first-person
   view. Hands are built from an ellipsoid palm, torus-arc fingers
   that wrap the grip, a capsule thumb and a tapered forearm.
   ============================================================ */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function ellipsoid(cx, cy, cz, rx, ry, rz, rotZ = 0) {
  const g = new THREE.SphereGeometry(1, 14, 10);
  g.scale(rx, ry, rz);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(cx, cy, cz);
  return g;
}
// capsule between two points
function capsule(a, b, r) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
// tapered cylinder from a to b
function limb(a, b, r0, r1, seg = 16) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
// glove cuff, sleeve and forearm from the wrist towards the (off-screen) elbow
function forearm(k, wrist, dir) {
  const at = (s) => wrist.clone().addScaledVector(dir, s);
  k.add(GM.glove, limb(at(-0.03), at(0.05), 0.027, 0.033));
  k.add(GM.cuff, limb(at(0.045), at(0.085), 0.041, 0.043));
  k.add(GM.sleeve, limb(at(0.08), at(0.46), 0.042, 0.055, 18));
}

/* Hand wrapped round a pistol grip. Built in "grip space" (grip axis = +y),
   then moved onto the gun with matrix m. Returns the wrist point in gun space. */
function gripHand(k, m, R = 0.028, yOff = 0) {
  const geos = [], pad = [];
  [0.024, 0.005, -0.014, -0.032].forEach((y, i) => {
    const t = 0.0094 - i * 0.0005, arcLen = Math.PI * (1.08 - i * 0.05), r = R * (1 - i * 0.03);
    const f = new THREE.TorusGeometry(r, t, 8, 16, arcLen);
    f.rotateX(-Math.PI / 2); f.rotateY(-0.4);            // start just behind the right side, wrap round the front
    f.scale(0.92, 1, 1.08); f.translate(0, y + yOff, 0);
    const ue = arcLen - 0.4;
    geos.push(f, ellipsoid(r * Math.cos(ue) * 0.92, y + yOff, -r * Math.sin(ue) * 1.08, t, t, t));
  });
  geos.push(ellipsoid(R + 0.004, yOff - 0.004, 0.01, 0.017, 0.05, 0.044));          // palm on the right side
  geos.push(ellipsoid(0.006, yOff + 0.006, R * 1.05 + 0.004, 0.026, 0.044, 0.016));   // heel of the hand on the backstrap
  geos.push(capsule(V3(0.004, yOff + 0.04, R * 0.9), V3(-R * 0.95, yOff + 0.032, -0.022), 0.0098)); // thumb over the left side
  pad.push(ellipsoid(R + 0.018, yOff + 0.002, -0.006, 0.006, 0.036, 0.024));          // hard knuckle pad
  for (const g of geos) g.applyMatrix4(m);
  for (const g of pad) g.applyMatrix4(m);
  k.add(GM.glove, ...geos); k.add(GM.knuckle, ...pad);
  return V3(0.016, yOff - 0.014, 0.062).applyMatrix4(m);
}

/* Support hand cupping a round handguard (axis along z) from the lower left. */
function guardHand(k, gd) {
  const R = gd.r + 0.012, cy = gd.y, cz = -gd.f, geos = [], pad = [];
  [-0.028, -0.009, 0.01, 0.028].forEach((z, i) => {
    const arcLen = Math.PI * (0.98 - i * 0.05);
    const f = new THREE.TorusGeometry(R, 0.0094 - i * 0.0004, 8, 18, arcLen);
    f.rotateZ(Math.PI * 1.2); f.translate(0, cy, cz + z);
    const ue = Math.PI * 1.2 + arcLen;
    geos.push(f, ellipsoid(Math.cos(ue) * R, cy + Math.sin(ue) * R, cz + z, 0.009, 0.009, 0.009));
  });
  const pa = Math.PI * 1.14, pr = R + 0.006;
  geos.push(ellipsoid(Math.cos(pa) * pr, cy + Math.sin(pa) * pr, cz + 0.006, 0.017, 0.044, 0.052, pa));
  const ta = Math.PI * 0.84;
  geos.push(capsule(V3(Math.cos(ta) * R - 0.006, cy + Math.sin(ta) * R - 0.01, cz + 0.035), V3(Math.cos(ta) * (R - 0.002), cy + Math.sin(ta) * (R - 0.002), cz - 0.035), 0.0098));
  pad.push(ellipsoid(Math.cos(pa) * (pr + 0.016), cy + Math.sin(pa) * (pr + 0.016), cz, 0.006, 0.032, 0.03, pa));
  k.add(GM.glove, ...geos); k.add(GM.knuckle, ...pad);
  return V3(Math.cos(pa) * pr + 0.006, cy + Math.sin(pa) * pr - 0.012, cz + 0.066);
}

// Hands + arms attached to a gun model. Returns { right, left } groups (children of the gun).
function attachArms(gun) {
  const d = gun.userData, gp = d.grip;
  const m = new THREE.Matrix4().compose(V3(0, gp.y, -gp.f), new THREE.Quaternion().setFromEuler(new THREE.Euler(-gp.tilt * DEG, 0, 0)), V3(1, 1, 1));
  const rk = new Kit();
  forearm(rk, gripHand(rk, m, d.gripR || (d.pistol ? 0.029 : 0.028)), V3(0.3, -0.5, 1).normalize());
  const right = rk.bake(false);
  const lk = new Kit();
  let left;
  if (d.oneHand) {
    left = new THREE.Group();           // knife and grenades: the off hand stays out of view
  } else if (d.pistol) {
    // support hand cups the shooting hand; built as a right hand and mirrored
    forearm(lk, gripHand(lk, m, 0.041, -0.014), V3(0.25, -0.6, 1).normalize());
    left = lk.bake(false);
    left.scale.x = -1;
  } else {
    forearm(lk, guardHand(lk, d.guard), V3(-0.45, -0.5, 1).normalize());
    left = lk.bake(false);
  }
  gun.add(right, left);
  d.rightArm = right; d.leftArm = left;
  return gun;
}

function makeViewmodel(id) {
  const g = attachArms(GUN_BUILDERS[id]());
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  return g;
}

// Third-person guns for the bots: build each model once, then share its geometry.
// (userData holds part groups, which Object3D.clone() cannot copy, so it is cleared on the template.)
const GUN_TEMPLATES = {}, GUN_MUZZLE = {};
function worldGun(id) {
  let t = GUN_TEMPLATES[id];
  if (!t) {
    t = GUN_TEMPLATES[id] = GUN_BUILDERS[id]();
    GUN_MUZZLE[id] = t.userData.muzzle.clone();
    t.userData = {};
    t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }
  return t.clone();
}

