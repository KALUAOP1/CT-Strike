/* ============================================================
   Soldier models. CT: gas mask, slate-blue fatigues, khaki plate
   carrier, harness, knee pads. T: knitted balaclava, plaid shirt,
   soft vest, camo cargo pants. Built from shaped primitives and
   merged per material, so each bot is only a few draw calls.
   Hits use invisible boxes, so the look can change freely.
   ============================================================ */
const Soldiers = (() => {
  const V3 = THREE.Vector3;
  const fabricN = loadTex("fabric_n", false, 5), leatherN = loadTex("leather_n", false, 2);
  const nS = (s) => new THREE.Vector2(s, s);
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88 }, o));
  const cloth = (color, o = {}) => std(Object.assign({ color, normalMap: fabricN, normalScale: nS(1) }, o));
  const tex = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const noise = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${a * Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };

  // plaid flannel: pink-beige with mauve and cream bands
  const plaidDraw = (g, w, h) => {
    g.fillStyle = "#cfb3a8"; g.fillRect(0, 0, w, h);
    for (const [pos, wd, col] of [[0.1, 0.18, "rgba(140,96,104,.38)"], [0.55, 0.12, "rgba(140,96,104,.3)"], [0.36, 0.03, "rgba(245,235,225,.7)"], [0.8, 0.03, "rgba(245,235,225,.6)"], [0.3, 0.012, "rgba(90,60,70,.6)"], [0.72, 0.012, "rgba(90,60,70,.5)"]]) {
      g.fillStyle = col; g.fillRect(pos * w, 0, wd * w, h); g.fillRect(0, pos * h, w, wd * h);
    }
    noise(g, w, h, 3000, 0.08);
  };
  const plaidBody = tex(128, 128, plaidDraw, 5, 2), plaidArm = tex(128, 128, plaidDraw, 2, 1.2);
  // olive woodland camo for the T's cargo pants
  const camo = tex(256, 256, (g, w, h) => {
    g.fillStyle = "#5d6449"; g.fillRect(0, 0, w, h);
    for (const col of ["#4a5139", "#6f7556", "#3d432f", "#666b4e"]) for (let i = 0; i < 14; i++) {
      g.fillStyle = col; g.beginPath();
      const x = Math.random() * w, y = Math.random() * h;
      g.ellipse(x, y, 10 + Math.random() * 24, 6 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
    noise(g, w, h, 4000, 0.1);
  }, 1.5, 2.5);
  // knitted balaclava with eye and mouth holes; the sphere's front (-z) sits at u = 0.75
  const knitHead = tex(1024, 512, (g, w, h) => {
    g.fillStyle = "#46503a"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) { g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(x, 0, 2, h); g.fillStyle = "rgba(255,255,230,.07)"; g.fillRect(x + 3, 0, 2, h); }
    noise(g, w, h, 9000, 0.12);
    const fx = 0.75 * w;
    const hole = (cx, cy, rx, ry) => {
      g.fillStyle = "#c98f6c"; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#323a29"; g.lineWidth = 4; g.stroke();
    };
    for (const s of [-1, 1]) {
      const ex = fx + s * 0.052 * w, ey = 0.45 * h;
      hole(ex, ey, 0.026 * w, 0.042 * h);
      g.fillStyle = "#b47a5a"; g.fillRect(ex - 0.024 * w, ey - 0.036 * h, 0.048 * w, 0.014 * h);          // brow shadow
      g.fillStyle = "#f2ede6"; g.beginPath(); g.ellipse(ex, ey + 2, 0.017 * w, 0.02 * h, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4f78a8"; g.beginPath(); g.arc(ex + s * 1, ey + 2, 0.0085 * w, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#111"; g.beginPath(); g.arc(ex + s * 1, ey + 2, 0.004 * w, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#5a3a2a"; g.lineWidth = 3; g.beginPath(); g.ellipse(ex, ey + 2, 0.019 * w, 0.022 * h, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    hole(fx, 0.665 * h, 0.03 * w, 0.03 * h);
    g.fillStyle = "#9c5f55"; g.beginPath(); g.ellipse(fx, 0.668 * h, 0.02 * w, 0.011 * h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#4a2a26"; g.fillRect(fx - 0.018 * w, 0.666 * h, 0.036 * w, 2);
  });
  // SAS-style sleeve patch: white winged dagger on navy
  const patch = tex(64, 64, (g, w) => {
    g.fillStyle = "#2b3550"; g.fillRect(0, 0, w, w);
    g.strokeStyle = "#e8ecf2"; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(32, 54); g.lineTo(32, 12); g.moveTo(14, 30); g.lineTo(32, 18); g.lineTo(50, 30); g.moveTo(18, 42); g.lineTo(32, 32); g.lineTo(46, 42); g.stroke();
  });

  const MATS = {
    CT: {
      jacket: cloth(0x56657f), pants: cloth(0x4d596d), hood: cloth(0x2c323c), cuff: cloth(0x6c7b94),
      vest: cloth(0x7b785b, { roughness: 0.92 }), panel: cloth(0x77834a), web: cloth(0x8d8a6b), harness: cloth(0x6c7741),
      tan: cloth(0x9a8456), rubber: std({ color: 0x1b1d20, roughness: 0.55, normalMap: leatherN, normalScale: nS(0.3) }),
      chrome: std({ color: 0xd8dee6, metalness: 1, roughness: 0.18 }), lens: std({ color: 0x0d1014, metalness: 0.9, roughness: 0.04 }),
      ring: std({ color: 0x2a9ae0, emissive: 0x0b3a66, roughness: 0.4 }), plastic: std({ color: 0x9aa1a6, roughness: 0.45 }),
      holster: std({ color: 0x2a2e33, roughness: 0.55 }), boots: std({ color: 0x566070, roughness: 0.7, normalMap: leatherN }),
      sole: std({ color: 0x30353d, roughness: 0.9 }), glove: std({ color: 0x7d838a, roughness: 0.7, normalMap: leatherN, normalScale: nS(0.6) }),
      patch: std({ map: patch, roughness: 0.9 }), helmet: std({ color: 0x323b48, roughness: 0.6, normalMap: leatherN, normalScale: nS(0.4) })
    },
    T: {
      shirt: cloth(0xffffff, { map: plaidBody }), sleeve: cloth(0xffffff, { map: plaidArm }), skin: std({ color: 0xc98f6c, roughness: 0.62 }),
      head: std({ map: knitHead, roughness: 0.95, normalMap: fabricN, normalScale: nS(0.6) }), knit: cloth(0x46503a),
      vest: cloth(0xa2aa91, { roughness: 0.95 }), bind: cloth(0x858d74), velcro: cloth(0x666c62), tab: std({ color: 0x1c1c1c, roughness: 0.6 }),
      belt: cloth(0x2c3b42), brass: std({ color: 0xb79c5b, metalness: 0.7, roughness: 0.35 }), pouch: cloth(0x8e7550),
      pants: cloth(0xffffff, { map: camo }), patchP: cloth(0x4f563e), boots: std({ color: 0xa27c4b, roughness: 0.65, normalMap: leatherN }),
      sole: std({ color: 0x5a4632, roughness: 0.9 }), glove: std({ color: 0x5d646a, roughness: 0.7, normalMap: leatherN, normalScale: nS(0.6) }),
      helmet: std({ color: 0x4b4e39, roughness: 0.6, normalMap: leatherN, normalScale: nS(0.4) })
    }
  };

  /* ---------- geometry helpers ---------- */
  // one non-indexed geometry from many (all three primitives carry position, normal, uv)
  function merge(list) {
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  }
  // collects pieces per material, then merges them
  class Kit {
    constructor() { this.m = new Map(); }
    add(key, geo) { if (!this.m.has(key)) this.m.set(key, []); this.m.get(key).push(geo); return this; }
    build() { return [...this.m].map(([k, gs]) => [k, merge(gs)]); }
  }
  const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
  const place = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); return g.translate(x, y, z); };
  // tapered tube from a (radius r1) to b (radius r2)
  function tube(a, b, r1, r2, seg = 14) {
    const d = new V3().subVectors(b, a), len = d.length();
    const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, true).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()));
    return g.translate(a.x, a.y, a.z);
  }
  // rounded box centred on the origin
  function rbox(w, h, d, r = 0.01) {
    r = Math.min(r, w / 2.2, h / 2.2, d / 2.2);
    const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r, depth = Math.max(0.001, d - 2 * r);
    s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
    return g.translate(0, 0, -depth / 2);
  }
  const ring = (r, t, y, sx = 1, sz = 1, seg = 24) => new THREE.TorusGeometry(r, t, 6, seg).rotateX(Math.PI / 2).scale(sx, 1, sz).translate(0, y, 0);
  const lathe = (pts, sx, sz, seg = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).scale(sx, 1, sz);
  const V = (x, y, z) => new V3(x, y, z);

  /* ---------- shared pieces ---------- */
  // shoulder, elbow, hand for each arm (right arm first); same poses the old models used
  const ARM_POSE = {
    rifle: [[V(0.22, 1.44, 0), V(0.25, 1.24, -0.12), V(0.1, 1.29, -0.25)], [V(-0.22, 1.44, 0), V(-0.16, 1.26, -0.28), V(0.08, 1.32, -0.55)]],
    pistol: [[V(0.22, 1.44, 0), V(0.18, 1.33, -0.25), V(0.04, 1.36, -0.46)], [V(-0.22, 1.44, 0), V(-0.14, 1.33, -0.26), V(0.0, 1.35, -0.46)]],
    // hanging loose at the sides: the dead, and nothing in the hands
    limp: [[V(0.22, 1.44, 0), V(0.27, 1.17, 0.03), V(0.28, 0.93, -0.03)], [V(-0.22, 1.44, 0), V(-0.27, 1.17, 0.03), V(-0.28, 0.93, -0.03)]]
  };
  // torso profile (radius, height): hips, waist, chest, shoulders, neck
  const TORSO = [[0.001, 0.86], [0.15, 0.88], [0.172, 0.96], [0.166, 1.04], [0.176, 1.14], [0.196, 1.26], [0.206, 1.36], [0.19, 1.44], [0.14, 1.49], [0.075, 1.52], [0.062, 1.6]];
  const band = (r, t, p, dir) => {
    const g = new THREE.TorusGeometry(r, t, 6, 18);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir.clone().normalize()));
    return g.translate(p.x, p.y, p.z);
  };
  function glove(k, p, dir) {
    const f = p.clone().addScaledVector(dir, 0.04), side = p.x >= 0.05 ? 1 : -1;
    k.add("glove", sph(0.04, p.x, p.y, p.z, 1, 0.8, 1.25, 12, 10));
    k.add("glove", sph(0.03, f.x, f.y - 0.014, f.z, 1.15, 0.75, 1.1, 10, 8));            // curled fingers
    k.add("glove", sph(0.015, p.x - side * 0.03, p.y + 0.012, p.z - 0.012, 1, 1, 1.7, 8, 6)); // thumb
  }
  function arms(team, pose) {
    const k = new Kit();
    for (const [sh, el, hd] of pose) {
      const side = Math.sign(sh.x), dir = new V3().subVectors(hd, el).normalize();
      if (team === "CT") {
        k.add("jacket", sph(0.066, sh.x, sh.y, sh.z)).add("jacket", tube(sh, el, 0.066, 0.056)).add("jacket", sph(0.056, el.x, el.y, el.z)).add("jacket", tube(el, hd, 0.055, 0.045));
        k.add("cuff", tube(el.clone().lerp(hd, 0.8), el.clone().lerp(hd, 0.93), 0.051, 0.049));
        const pp = sh.clone().lerp(el, 0.32);
        k.add("patch", new THREE.BoxGeometry(0.008, 0.065, 0.055).translate(pp.x + side * 0.064, pp.y, pp.z));
      } else {
        const roll = sh.clone().lerp(el, 0.82);
        k.add("sleeve", sph(0.068, sh.x, sh.y, sh.z)).add("sleeve", tube(sh, roll, 0.07, 0.063)).add("sleeve", band(0.062, 0.017, roll, new V3().subVectors(el, sh)));
        k.add("skin", tube(roll, el, 0.052, 0.048)).add("skin", sph(0.048, el.x, el.y, el.z)).add("skin", tube(el, hd, 0.048, 0.037));
      }
      glove(k, hd, dir);
    }
    return k;
  }
  // one leg as two kits: thigh in hip space (pivot at the hip joint) and shin in knee space
  // (pivot at the knee, KNEE below the hip); side -1 = left, 1 = right
  function leg(team, side) {
    const th = new Kit(), sh = new Kit(), knee = V(0, -0.44, -0.012), ank = V(0, -0.79, 0);
    th.add("pants", sph(0.09, 0, 0, 0, 1, 0.9, 1)).add("pants", tube(V(0, 0.02, 0), knee, 0.09, 0.066));
    sh.add("pants", sph(0.066, knee.x, knee.y, knee.z)).add("pants", tube(knee, ank, 0.066, 0.058));
    sh.add("boots", tube(V(0, -0.77, 0.004), V(0, -0.88, 0.004), 0.061, 0.064)).add("boots", place(rbox(0.105, 0.085, 0.24, 0.03), 0, -0.868, -0.045));
    sh.add("boots", place(rbox(0.055, 0.05, 0.09, 0.015), 0, -0.82, -0.085, -0.5));
    sh.add("sole", place(rbox(0.116, 0.03, 0.266, 0.01), 0, -0.905, -0.05));
    if (team === "CT") {
      sh.add("pants", ring(0.063, 0.014, -0.765));                                         // trousers bloused into the boots
      sh.add("plastic", sph(0.06, 0, -0.44, -0.056, 1.05, 1.25, 0.55, 14, 10)).add("tan", ring(0.07, 0.01, -0.44));
      th.add("harness", ring(0.094, 0.012, -0.07));
      if (side > 0) {   // thigh holster and double pouch on the right leg
        th.add("holster", place(rbox(0.045, 0.19, 0.11, 0.012), 0.095, -0.2, 0.0)).add("holster", place(rbox(0.032, 0.07, 0.035, 0.008), 0.1, -0.075, 0.015));
        th.add("holster", ring(0.09, 0.01, -0.24)).add("holster", ring(0.085, 0.01, -0.31));
        th.add("holster", place(rbox(0.06, 0.075, 0.04, 0.01), 0.035, -0.15, -0.08)).add("holster", place(rbox(0.06, 0.075, 0.04, 0.01), 0.035, -0.24, -0.075));
      }
    } else {
      sh.add("pants", ring(0.064, 0.012, -0.76));
      sh.add("patchP", place(rbox(0.1, 0.12, 0.022, 0.008), 0, -0.43, -0.068));               // knee patch
      th.add("pants", place(rbox(0.032, 0.14, 0.12, 0.012), side * 0.085, -0.22, 0.0));        // cargo pocket
    }
    const shin = sh.build();
    for (const [, g] of shin) g.translate(-knee.x, -knee.y, -knee.z);
    return [th.build(), shin];
  }

  /* ---------- CT: gas mask, plate carrier, harness ---------- */
  function bodyCT() {
    const k = new Kit();
    k.add("jacket", lathe(TORSO, 1.12, 0.68)).add("jacket", sph(0.074, 0.205, 1.425, 0, 1, 0.9, 1)).add("jacket", sph(0.074, -0.205, 1.425, 0, 1, 0.9, 1));
    k.add("jacket", ring(0.08, 0.02, 1.5, 1.1, 0.85)).add("pants", sph(0.17, 0, 0.93, 0, 1.08, 0.5, 0.74));
    // hood under the mask
    k.add("hood", tube(V(0, 1.49, 0), V(0, 1.62, 0.005), 0.072, 0.066)).add("hood", sph(0.118, 0, 1.685, 0.012, 0.95, 1.06, 1, 24, 18));
    // respirator: rubber face, two round lenses in chrome rims, front filter, side ports, head straps
    k.add("rubber", sph(0.1, 0, 1.665, -0.052, 1, 1.15, 0.85, 24, 16));
    for (const s of [-1, 1]) {
      k.add("chrome", place(new THREE.TorusGeometry(0.033, 0.0075, 8, 22), s * 0.043, 1.705, -0.128, 0, s * 0.3, 0));
      k.add("lens", place(new THREE.CylinderGeometry(0.031, 0.031, 0.01, 22), s * 0.043, 1.705, -0.126, Math.PI / 2, s * 0.3, 0));
      k.add("rubber", place(new THREE.CylinderGeometry(0.018, 0.021, 0.026, 12), s * 0.07, 1.622, -0.112, Math.PI / 2, s * 0.6, 0));
    }
    k.add("rubber", place(new THREE.CylinderGeometry(0.036, 0.04, 0.056, 18), 0, 1.598, -0.152, 1.15));
    k.add("rubber", place(new THREE.TorusGeometry(0.039, 0.006, 6, 18), 0, 1.592, -0.163, 1.15 - Math.PI / 2));
    k.add("chrome", place(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16), 0, 1.585, -0.178, 1.15));
    k.add("rubber", new THREE.TorusGeometry(0.119, 0.009, 6, 20, Math.PI).translate(0, 1.69, 0.012));
    k.add("rubber", new THREE.TorusGeometry(0.121, 0.009, 6, 20, Math.PI).rotateX(Math.PI / 2).translate(0, 1.665, 0.004));
    // headset with the blue ring, radio antenna, coiled cable
    k.add("rubber", place(new THREE.CylinderGeometry(0.046, 0.046, 0.032, 20), -0.122, 1.665, 0, 0, 0, Math.PI / 2));
    k.add("ring", place(new THREE.TorusGeometry(0.046, 0.007, 6, 24), -0.13, 1.665, 0, 0, Math.PI / 2, 0));
    k.add("rubber", tube(V(-0.13, 1.4, 0.1), V(-0.135, 1.86, 0.11), 0.006, 0.004, 6));
    k.add("rubber", new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.12, 1.63, -0.03), V(-0.1, 1.55, -0.1), V(-0.05, 1.46, -0.155), V(-0.02, 1.38, -0.172)]), 16, 0.007, 5));
    // plate carrier
    k.add("vest", place(rbox(0.35, 0.33, 0.065, 0.02), 0, 1.275, -0.128)).add("vest", place(rbox(0.35, 0.36, 0.06, 0.02), 0, 1.28, 0.125));
    k.add("vest", new THREE.CylinderGeometry(0.2, 0.192, 0.15, 22, 1, true).scale(1.13, 1, 0.72).translate(0, 1.15, 0));
    k.add("panel", place(rbox(0.17, 0.2, 0.02, 0.006), 0, 1.33, -0.163));
    for (const y of [1.395, 1.36]) k.add("web", place(rbox(0.33, 0.016, 0.012, 0.004), 0, y, -0.164));
    for (const s of [-1, 1]) k.add("vest", place(rbox(0.075, 0.028, 0.3, 0.01), s * 0.115, 1.462, 0, 0, 0, -s * 0.25));
    k.add("rubber", place(rbox(0.05, 0.03, 0.015, 0.005), 0, 1.42, -0.156));
    // pouches: a two-flap utility pouch on the right, three rifle mags on the left, knife up high
    k.add("vest", place(rbox(0.15, 0.12, 0.065, 0.012), 0.088, 1.175, -0.175)).add("web", place(rbox(0.152, 0.035, 0.07, 0.01), 0.088, 1.235, -0.177));
    for (let i = 0; i < 3; i++) {
      const x = -0.045 - i * 0.05;
      k.add("vest", place(rbox(0.046, 0.14, 0.055, 0.01), x, 1.17, -0.178)).add("web", place(rbox(0.048, 0.03, 0.06, 0.008), x, 1.235, -0.18));
    }
    k.add("tan", place(rbox(0.045, 0.15, 0.02, 0.008), 0.1, 1.36, -0.168, 0, 0, 0.08)).add("rubber", place(rbox(0.022, 0.05, 0.022, 0.006), 0.093, 1.45, -0.172));
    k.add("holster", place(rbox(0.07, 0.13, 0.05, 0.012), -0.12, 1.3, 0.17));
    // harness belt, centre strap, carabiner
    k.add("harness", ring(0.18, 0.018, 1.0, 1.1, 0.75)).add("harness", tube(V(0, 1.0, -0.13), V(0, 0.86, -0.08), 0.016, 0.016, 6));
    k.add("chrome", place(new THREE.TorusGeometry(0.024, 0.005, 6, 12), -0.19, 0.95, -0.05, 0, Math.PI / 2, 0));
    return k;
  }

  /* ---------- T: balaclava, plaid shirt, soft vest, camo cargos ---------- */
  function bodyT() {
    const k = new Kit();
    k.add("shirt", lathe(TORSO, 1.12, 0.68)).add("sleeve", sph(0.074, 0.205, 1.425, 0, 1, 0.9, 1)).add("sleeve", sph(0.074, -0.205, 1.425, 0, 1, 0.9, 1));
    k.add("pants", sph(0.17, 0, 0.93, 0, 1.08, 0.5, 0.74));
    // shirt collar, balaclava head and neck
    k.add("shirt", place(new THREE.TorusGeometry(0.078, 0.022, 6, 20, Math.PI * 1.6), 0, 1.5, 0, Math.PI / 2, 0, Math.PI * 0.7).scale(1.1, 1, 0.9));
    k.add("knit", tube(V(0, 1.49, 0), V(0, 1.6, 0.004), 0.07, 0.064));
    k.add("head", new THREE.SphereGeometry(0.12, 32, 22).scale(0.95, 1.08, 1).translate(0, 1.68, -0.008));
    k.add("knit", sph(0.03, 0, 1.79, 0.01, 1.4, 0.5, 1.4, 10, 6));                      // gathered crown
    // soft armour vest: shell over the chest, edge binding, straps, velcro band, name tab
    const shell = [[0.186, 1.04], [0.19, 1.14], [0.21, 1.26], [0.22, 1.36], [0.205, 1.44]];
    k.add("vest", new THREE.LatheGeometry(shell.map(([r, y]) => new THREE.Vector2(r, y)), 24).scale(1.12, 1, 0.74));
    k.add("bind", ring(0.188, 0.011, 1.04, 1.12, 0.74)).add("bind", ring(0.205, 0.011, 1.44, 1.12, 0.74));
    for (const s of [-1, 1]) k.add("vest", place(rbox(0.08, 0.026, 0.3, 0.01), s * 0.115, 1.465, 0, 0, 0, -s * 0.25)).add("bind", place(rbox(0.012, 0.3, 0.012, 0.004), s * 0.205, 1.24, -0.06));
    k.add("velcro", place(rbox(0.3, 0.075, 0.02, 0.006), 0, 1.13, -0.152));
    k.add("tab", place(rbox(0.09, 0.03, 0.01, 0.004), -0.08, 1.33, -0.168));
    // belt with brass buckle, pouch on the left, small holster on the right
    k.add("belt", ring(0.18, 0.02, 0.985, 1.1, 0.74)).add("brass", place(rbox(0.05, 0.035, 0.012, 0.004), 0, 0.985, -0.14));
    k.add("pouch", place(rbox(0.07, 0.08, 0.05, 0.012), -0.17, 0.96, -0.06)).add("pouch", place(rbox(0.06, 0.1, 0.04, 0.01), 0.19, 0.95, 0.02));
    return k;
  }

  // open-face helmet; only shown when the bot bought armour + helmet
  function helmetGeo(team) {
    const k = new Kit(), key = "helmet";
    k.add(key, new THREE.SphereGeometry(0.142, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1, 0.9, 1.05).translate(0, 1.695, 0.008));
    k.add(key, ring(0.142, 0.008, 1.69, 1, 1.05));
    if (team === "CT") k.add("rubber", place(rbox(0.05, 0.03, 0.03, 0.008), 0, 1.79, -0.1));   // NVG mount
    else k.add("knit", ring(0.139, 0.014, 1.715, 1, 1.05));                                  // cloth band
    return k;
  }

  /* ---------- per-team templates (built once, shared by all bots) ---------- */
  const T_CACHE = {};
  function templates(team) {
    if (T_CACHE[team]) return T_CACHE[team];
    return (T_CACHE[team] = {
      body: (team === "CT" ? bodyCT() : bodyT()).build(),
      legs: [leg(team, -1), leg(team, 1)],
      limp: arms(team, ARM_POSE.limp).build(),
      rifle: arms(team, ARM_POSE.rifle).build(),
      pistol: arms(team, ARM_POSE.pistol).build(),
      helmet: helmetGeo(team).build()
    });
  }
  // small decorative parts (straps, patches, buckles, mask rims). They are tagged so the
  // per-frame update can hide them on bots far from the camera, where a 3 cm strap is
  // smaller than a pixel; see Bots.update (g07b_bots.js).
  const DETAIL = new Set(["cuff", "patch", "patchP", "web", "tan", "chrome", "lens", "ring",
    "harness", "holster", "plastic", "velcro", "tab", "brass", "pouch", "panel", "bind", "belt"]);
  function group(parent, parts, team) {
    const gr = new THREE.Group();
    for (const [key, geo] of parts) {
      const mat = MATS[team][key] || MATS.CT[key] || MATS.T[key];
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      if (DETAIL.has(key)) m.userData.detail = true;
      gr.add(m);
    }
    parent.add(gr);
    return gr;
  }
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  function proxy(geo, parent, bot, part, x, y, z) {
    const m = new THREE.Mesh(geo, proxyMat);
    m.position.set(x, y, z); m.userData = { bot, part };
    parent.add(m); bot.hit.push(m);
    return m;
  }

  // builds both team looks onto a bot; Soldiers.show picks the one for bot.team.
  // Rig: group (feet, yaw) > hips (drops when crouching) > upper (bends at the waist) > torso
  //      (body, arms, helmet, guns), and hips > legs[i] (hip joint) > shins[i] (knee joint)
  const HIP_Y = 0.92, KNEE = [0, -0.44, -0.012];
  function attach(bot, g) {
    bot.hit = []; bot.variants = {}; bot.helmets = {};
    const hips = new THREE.Group(), upper = new THREE.Group(), torso = new THREE.Group();
    upper.position.y = HIP_Y; torso.position.y = -HIP_Y;
    g.add(hips); hips.add(upper); upper.add(torso);
    Object.assign(bot, { hips, upper, torso, legs: [], shins: [] });
    for (const s of [-1, 1]) {
      const h = new THREE.Group(), k = new THREE.Group();
      h.position.set(s * 0.105, HIP_Y, 0); k.position.set(...KNEE);
      hips.add(h); h.add(k); bot.legs.push(h); bot.shins.push(k);
    }
    bot.rifleArms = new THREE.Group(); bot.pistolArms = new THREE.Group(); bot.limpArms = new THREE.Group();
    torso.add(bot.rifleArms, bot.pistolArms, bot.limpArms);
    for (const team of ["CT", "T"]) {
      const t = templates(team);
      bot.variants[team] = [
        group(torso, t.body, team),
        group(bot.legs[0], t.legs[0][0], team), group(bot.shins[0], t.legs[0][1], team),
        group(bot.legs[1], t.legs[1][0], team), group(bot.shins[1], t.legs[1][1], team),
        group(bot.rifleArms, t.rifle, team), group(bot.pistolArms, t.pistol, team), group(bot.limpArms, t.limp, team)
      ];
      bot.helmets[team] = group(torso, t.helmet, team);
    }
    // every tagged detail mesh of this bot, both team looks, for the distance cull
    bot.detail = [];
    for (const k in bot.variants) for (const gr of bot.variants[k])
      gr.traverse((o) => { if (o.isMesh && o.userData.detail) bot.detail.push(o); });
    bot.limpArms.visible = false;
    proxy(new THREE.SphereGeometry(0.13, 10, 8), torso, bot, "head", 0, 1.68, -0.01);
    proxy(new THREE.BoxGeometry(0.46, 0.62, 0.34), torso, bot, "body", 0, 1.2, 0);
    for (let i = 0; i < 2; i++) {
      proxy(new THREE.CylinderGeometry(0.1, 0.085, 0.46, 8), bot.legs[i], bot, "legs", 0, -0.22, 0);
      proxy(new THREE.CylinderGeometry(0.085, 0.07, 0.48, 8), bot.shins[i], bot, "legs", 0, -0.22, 0.012);
    }
  }
  function show(bot) {
    for (const k in bot.variants) for (const gr of bot.variants[k]) gr.visible = k === bot.team;
    showHelmet(bot);
  }
  function showHelmet(bot) { for (const k in bot.helmets) bot.helmets[k].visible = !!bot.helmet && k === bot.team; }

  return { attach, show, showHelmet, MATS };
})();
