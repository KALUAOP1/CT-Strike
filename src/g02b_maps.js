/* ============================================================
   Maps. Pick one in the menu (it reloads the page with ?map=id).
   Every map keeps the same frame so the bots and the HUD work
   everywhere: a 64 x 64 m arena, CT spawn in the south, T spawn
   in the north, site A in the west and site B in the east.
   ============================================================ */
const MAP_LIST = { dust2: "Dust II", dust: "Dust Town", harbor: "Harbor", frost: "Frostbite" };
const MAP_ID = (() => { const q = new URLSearchParams(location.search).get("map"); return MAP_LIST[q] ? q : "dust2"; })();
const MAP = { id: MAP_ID, name: MAP_LIST[MAP_ID], midHold: { x: 0, z: 9 } };

// ground with large-scale brightness variation, which hides the tiling of the photo
function groundPlane(mat, tint) {
  const gGeo = new THREE.PlaneGeometry(160, 160, 80, 80);
  const gp = gGeo.attributes.position, gc = [];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getY(i);
    const v = 0.93 + 0.06 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 - 0.4) + 0.04 * Math.sin(x * 0.31 + z * 0.23) + 0.03 * Math.cos(x * 0.53 - z * 0.47);
    gc.push(v * tint[0], v * tint[1], v * tint[2]);
  }
  gGeo.setAttribute("color", new THREE.Float32BufferAttribute(gc, 3));
  const ground = new THREE.Mesh(gGeo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  solidMeshes.push(ground);
}
function perimeter(mat, h = 7) {
  addBlock(0, -33, 68, 2, h, mat);
  addBlock(0, 33, 68, 2, h, mat);
  addBlock(-33, 0, 2, 64, h, mat);
  addBlock(33, 0, 2, 64, h, mat);
}

/* ---------- Dust II: the classic two-site desert layout ----------
   T spawn across the whole north edge; long A down the west side behind
   the long doors; roofed B tunnels down the east side; mid through the
   centre with the double doors and dogleg cross-walls; A short (catwalk)
   and the B window connect mid to the sites; CT spawn in the south. */
function buildDust2() {
  Object.assign(SITES, {
    A: { id: "A", x: -25, z: 21, minX: -31.2, maxX: -18.2, minZ: 13, maxZ: 29,
         entrances: [{ x: -29, z: 8 }, { x: -18.5, z: 5 }, { x: -15, z: 27.5 }], smoke: { x: -17, z: 28 },
         stages: [{ x: -29, z: -26 }, { x: -28.5, z: -12 }, { x: -28.5, z: -2 }, { x: -21.5, z: 1.5 }, { x: -25, z: 6 }] },
    B: { id: "B", x: 25, z: 21, minX: 18.2, maxX: 31.2, minZ: 13.5, maxZ: 29,
         entrances: [{ x: 29, z: 10 }, { x: 16.8, z: 16.5 }, { x: 16.8, z: 26 }], smoke: { x: 17, z: 26 },
         stages: [{ x: 18, z: -25 }, { x: 24, z: -19 }, { x: 28, z: -12 }, { x: 24, z: 6 }, { x: 29, z: 4 }] }
  });
  MAP.midHold = { x: 0, z: 8 };
  // warmer, lower sun and a tan haze: the CS2 Dust II grade
  scene.fog.color.set(0xd8c294); scene.fog.near = 40; scene.fog.far = 185;
  hemi.color.set(0xfff0dc); hemi.groundColor.set(0xb08a5e); hemi.intensity = 0.4;
  sun.color.set(0xffe0ac); sun.intensity = 2.35; sun.position.set(-40, 36, 20);
  MAT.plaster.color.set(0xd8c8a4);

  groundPlane(MAT.sand, [1, 0.985, 0.96]);
  perimeter("stone");

  /* ---------- west: outside long, the long doors, long A, site A ---------- */
  house(-22, -14, 10, 9, 5.5);                 // the long-side building: makes long a real corridor
  // long doors: stone jamb + one leaf swung open, with a lintel arch over the gap
  addBlock(-30.85, -14, 1.9, 1.2, 4.5, "stone");
  addBlock(-29.75, -12.7, 0.16, 2.6, 3.3, "frameWood");
  addBlock(-28.45, -14, 2.9, 1.2, 1.1, "stone", 3.4, { cap: false });
  // long A cover: boxes on the corner, a low wall, the site's boxes and the pit
  crate(-29, -4, 1.5); crate(-29, -4, 1.2, 1.5, 0.3);
  addBlock(-28.5, 3, 6, 0.8, 1.1, "stone");
  crate(-30, 14, 1.4); crate(-24, 13, 1.5);
  addBlock(-23, 16.4, 4, 0.8, 1.1, "stone");
  crate(-28.5, 19.5, 1.5); crate(-28.5, 21, 1.4); crate(-28.5, 21, 1.1, 1.4);
  crate(-20, 26, 1.5); crate(-21.6, 26, 1.5);
  crate(-19, 2.2, 1.5); crate(-19, 2.2, 1.2, 1.5, 0.3);   // breaks long-to-catwalk sightline

  /* ---------- centre: top mid, the mid doors, CT mid, the cross-walls ---------- */
  addBlock(-7, -12.3, 1.2, 20.6, 4.5, "stone");  // mid west wall, T band to the doors
  addBlock(7, -12.3, 1.2, 20.6, 4.5, "stone");   // mid east wall
  // mid doors: stone pier with two wooden leaves swung open, so spawn cannot see spawn
  addBlock(-4.6, -2, 3.6, 1.2, 4.5, "stone");
  addBlock(4.6, -2, 3.6, 1.2, 4.5, "stone");
  addBlock(0, -2, 3.2, 1.2, 4.5, "stone");
  addBlock(-1.68, -3.5, 0.16, 1.8, 3.3, "frameWood");
  addBlock(1.68, -0.5, 0.16, 1.8, 3.3, "frameWood");
  addBlock(0, -2, 5.6, 1.2, 1.1, "stone", 3.4, { cap: false });   // arch over the doors
  // dogleg cross-walls: the way through the doors is never a straight line
  addBlock(-1.7, -20, 9.4, 1.2, 4.5, "stone");
  addBlock(1.7, 16, 9.4, 1.2, 4.5, "stone");
  // A short (catwalk): a walled lane from long's corner across to CT mid
  addBlock(-11.7, 0, 10.6, 1.2, 4.5, "stone");
  addBlock(-11.7, 4.4, 10.6, 1.2, 4.5, "stone");
  // A site east wall: catwalk slips around its north end, the CT ramp hits it south end
  addBlock(-17, 16, 1.2, 20, 4.5, "stone");
  // CT mid cover: the xbox, pocket crates, a low wall
  crate(2, 12, 1.5); crate(2, 12, 1.2, 1.5, 0.4);
  crate(-12, 10, 1.4); crate(-15, 15, 1.3);
  addBlock(-3, 20, 5, 0.8, 1.1, "stone");

  /* ---------- east: the T plaza, B plat house, roofed tunnels, site B ---------- */
  house(15.1, -7.5, 15, 11, 5.5);              // B plat house splits the T-side east half
  addBlock(26, -16.3, 1.2, 12.6, 4.5, "stone"); // tunnel west wall, mouth to the connector gap
  addBlock(26, 0.5, 1.2, 13, 4.5, "stone");
  addBlock(29.3, -7.8, 5.8, 30, 0.4, "trim", 3.2, { cap: false });  // the tunnel roof
  addBlock(29.2, -22.6, 6.4, 1.2, 1.1, "stone", 3.3, { cap: false }); // arch over the tunnel mouth
  crate(29, -14, 1.4);
  crate(12, -18, 1.5); crate(20, -19, 1.5); crate(20, -19, 1.2, 1.5, 0.4);
  crate(24, -7, 1.5); crate(24, -7, 1.2, 1.5, 0.4);   // breaks the T plaza sightline south
  crate(20, 4, 1.5);
  // B site north wall (the tunnels enter around its east end) and west wall
  addBlock(21.5, 13, 10.2, 1.2, 4.5, "stone");  // window gap and the B doors are the west wall's two gaps
  addBlock(17, 14, 1.2, 2, 4.5, "stone");
  addBlock(17, 19.5, 1.2, 3, 4.5, "stone");
  addBlock(17, 22.5, 1.2, 3, 4.5, "stone");
  addBlock(17, 29.9, 1.2, 3.8, 4.5, "stone");
  // B site cover: the car, a low wall, back-plat boxes
  crate(25, 17, 1.5); crate(25, 17, 1.2, 1.5, 0.4);
  addBlock(24, 23, 4, 0.8, 1.1, "stone");
  crate(29, 27, 1.5); crate(29, 27, 1.2, 1.5, 0.3);
  crate(11, 17, 1.4); crate(14, 26, 1.3);

  /* ---------- spawns ---------- */
  crate(-4, 27); crate(5, 27.5, 1.5); crate(2, -27, 1.5); crate(-6, -26.5);
  crate(-18, -27, 1.5); crate(16, -27, 1.5);
  crate(-29, -24, 1.5); crate(-25, -26, 1.3);

  for (const s of Object.values(SITES)) siteDecal(s);

  // skyline beyond the walls so the horizon isn't a flat edge
  const skyline = [[-42, -48, 14, 8, 13], [-16, -47, 10, 9, 10], [8, -46, 12, 8, 12], [30, -45, 9, 10, 9],
    [-46, -14, 8, 12, 11], [-45, 16, 10, 9, 9], [-43, 38, 11, 8, 12], [44, -18, 8, 10, 10],
    [46, 8, 9, 10, 12], [42, 36, 12, 8, 11], [-8, 47, 12, 7, 9], [22, 46, 10, 8, 10]];
  for (const [x, z, w, d, h] of skyline) addBlock(x, z, w, d, h, "distant", 0, { solid: false, shadow: false });
}

/* ---------- Dust Town: the original desert compound ---------- */
function buildDust() {
  Object.assign(SITES, {
    A: { id: "A", x: -25, z: 21.5, minX: -31.2, maxX: -19, minZ: 15, maxZ: 29.5,
         entrances: [{ x: -22, z: 8 }, { x: -13, z: 20 }], stages: [{ x: -14, z: 1 }, { x: -16, z: -5 }, { x: -3.5, z: -4 }] },
    B: { id: "B", x: 25, z: 17.5, minX: 18, maxX: 31.2, minZ: 8.5, maxZ: 28,
         entrances: [{ x: 27, z: 6 }, { x: 13, z: 10 }, { x: 13, z: 24 }], stages: [{ x: 12.5, z: 1 }, { x: 27, z: -10 }, { x: 4, z: -5 }] }
  });
  groundPlane(MAT.sand, [1, 0.985, 0.96]);
  perimeter("stone");

  // mid: two long walls with offset doorways, zig-zag cover at each end
  addBlock(-7, -8.5, 1.4, 13, 4.5, "stone");
  addBlock(-7, 9.5, 1.4, 11, 4.5, "stone");
  addBlock(7, -9.5, 1.4, 11, 4.5, "stone");
  addBlock(7, 8.5, 1.4, 13, 4.5, "stone");
  addBlock(-2.85, -17, 7.3, 1.2, 4.5, "stone");
  addBlock(2.15, 17, 8.7, 1.2, 4.5, "stone");
  // mid doors: a stone pier with two wooden leaves swung open, so spawn cannot see spawn
  addBlock(0, 0, 3.2, 1.2, 4.5, "stone");
  addBlock(-1.68, -1.5, 0.16, 1.8, 3.3, "frameWood");
  addBlock(1.68, 1.5, 0.16, 1.8, 3.3, "frameWood");
  // stacked crates break the long lanes that run beside the mid walls
  for (const [x, z] of [[-8.6, -10], [-10.4, 9], [8.6, 10], [10.2, -9]]) { crate(x, z, 1.5); crate(x, z, 1.2, 1.5, 0.3); }
  crate(-3, 3); crate(3.4, -8.5); crate(3.4, -8.5, 1.1, 1.4);

  // west lane: A building, long wall, small house
  house(-20, -20, 9, 7, 5.5);
  addBlock(-25, 2, 12, 1.4, 3.5, "stone");
  house(-15, 14, 7, 6, 5);
  crate(-27, -10, 1.5); crate(-11.5, -7, 1.5); crate(-11.5, -7, 1.2, 1.5);
  crate(-26, 12, 1.5); crate(-20, 26, 1.5); crate(-21.6, 26, 1.5); crate(-12, 4.5, 1.3);

  // east lane: B block, wall, shed
  house(20, -2, 7, 12, 5.5);
  addBlock(26, -17, 12, 1.4, 3.5, "stone");
  house(14, 18, 6, 5, 4.5);
  crate(12, -12, 1.5); crate(28, -26, 1.5); crate(29, 10, 1.5); crate(27.4, 10, 1.5); crate(27.4, 10, 1.2, 1.5);
  crate(11, 6, 1.4);

  // spawns
  crate(-4, 27); crate(5, 27.5, 1.5); crate(2, -27, 1.5); crate(-6, -26.5);

  // bomb sites: a low wall and some boxes to fight over, and a painted letter on the ground
  addBlock(-23, 16.4, 4, 0.8, 1.1, "stone");
  crate(-28.5, 19.5, 1.5); crate(-28.5, 21, 1.4); crate(-28.5, 21, 1.1, 1.4);
  addBlock(24, 22.6, 4, 0.8, 1.1, "stone");
  crate(21.5, 13, 1.5);
  for (const s of Object.values(SITES)) siteDecal(s);

  // skyline beyond the walls so the horizon isn't a flat edge
  const skyline = [[-40, -45, 10, 8, 11], [-22, -48, 12, 7, 14], [-2, -46, 9, 9, 9], [18, -47, 14, 8, 12], [38, -42, 8, 10, 10],
    [-46, -18, 8, 12, 12], [-45, 10, 9, 10, 9], [-44, 34, 10, 9, 13], [46, -16, 8, 10, 13], [45, 14, 9, 12, 10],
    [42, 40, 12, 8, 12], [-16, 46, 12, 8, 10], [10, 47, 14, 7, 13], [30, 45, 8, 8, 9]];
  for (const [x, z, w, d, h] of skyline) addBlock(x, z, w, d, h, "distant", 0, { solid: false, shadow: false });
}

/* ---------- Harbor: a container yard on the docks ---------- */
// corrugated steel: ribs every 0.3 m (one texture tile = 2.4 m), with rust streaks
function containerMats() {
  const normal = canvasTex(256, (g, s) => {
    for (let x = 0; x < s; x++) { const v = Math.sin((x / 32) * Math.PI * 2); g.fillStyle = `rgb(${128 + Math.round(v * 90)},128,${255 - Math.round(Math.abs(v) * 50)})`; g.fillRect(x, 0, 1, s); }
  });
  normal.encoding = THREE.LinearEncoding;
  const mk = (hex) => {
    const map = canvasTex(256, (g, s) => {
      g.fillStyle = hex; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) { g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(x + 22, 0, 8, s); g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x + 6, 0, 8, s); }
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${90 + Math.random() * 40},${45 + Math.random() * 20},20,${0.08 + Math.random() * 0.18})`; g.fillRect(Math.random() * s, Math.random() * s * 0.6, 2 + Math.random() * 5, 30 + Math.random() * 120); }
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    });
    return new THREE.MeshStandardMaterial({ map, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.62, metalness: 0.3 });
  };
  const cols = { c_red: "#8e2f25", c_blue: "#2c5a8c", c_green: "#3d6b48", c_orange: "#c0682a", c_grey: "#8a9096", c_teal: "#2f7c7f" };
  for (const k in cols) MAT[k] = mk(cols[k]);
  return Object.keys(cols);
}
function buildHarbor() {
  Object.assign(SITES, {
    A: { id: "A", x: -25, z: 21.5, minX: -31.2, maxX: -19, minZ: 15, maxZ: 29.5,
         entrances: [{ x: -22, z: 8 }, { x: -13, z: 20 }], stages: [{ x: -14, z: 1 }, { x: -16, z: -5 }, { x: -3.5, z: -4 }] },
    B: { id: "B", x: 25, z: 17.5, minX: 18, maxX: 31.2, minZ: 8.5, maxZ: 28,
         entrances: [{ x: 27, z: 6 }, { x: 13, z: 10 }, { x: 13, z: 24 }], stages: [{ x: 12.5, z: 1 }, { x: 27, z: -10 }, { x: 4, z: -5 }] }
  });
  MAT.concrete = pbr("plaster", { repeat: 160 / 3.2, mat: { vertexColors: true, color: 0x93a3b6 } });
  MAT.wallC = MAT.plaster.clone(); MAT.wallC.color = new THREE.Color(0xa8b6c8);
  MAT.plaster.color = new THREE.Color(0xc4d0de);   // site office walls
  MAT.trim.color = new THREE.Color(0xb4c0ce);
  MAT.distant.color = new THREE.Color(0xa7adb3);
  MAT.steel = new THREE.MeshStandardMaterial({ color: 0x5b636b, roughness: 0.45, metalness: 0.7 });
  MAT.craneY = new THREE.MeshStandardMaterial({ color: 0xd9a426, roughness: 0.5, metalness: 0.4 });
  MAT.paint = new THREE.MeshStandardMaterial({ color: 0xe3c03a, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 });
  const colors = containerMats();
  let ci = 0;
  const nextCol = () => colors[(ci++ * 5 + 3) % colors.length];
  // shipping container: 20 ft (6.06 m) or 40 ft (12.2 m); alongZ turns it north-south
  const box = (x, z, len, alongZ, y = 0, col) => {
    const w = alongZ ? 2.44 : len, d = alongZ ? len : 2.44;
    const m = addBlock(x, z, w, d, 2.6, col || nextCol(), y, { unit: 2.4 });
    // dark door end with locking bars, on the short side facing +x / +z
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.45), MAT.steel);
    if (alongZ) door.position.set(x, y + 1.3, z + len / 2 + 0.01); else { door.rotation.y = Math.PI / 2; door.position.set(x + len / 2 + 0.01, y + 1.3, z); }
    scene.add(door);
    return m;
  };
  groundPlane(MAT.concrete, [1, 1, 1]);
  perimeter("wallC");
  // painted lane lines on the concrete
  for (const [x, z, w, d] of [[-14, 0, 0.18, 52], [14, 0, 0.18, 52], [0, 23.5, 26, 0.18], [0, -23.5, 26, 0.18]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), MAT.paint); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.011, z); p.receiveShadow = true; scene.add(p);
  }

  // mid: container walls with offset gaps, one container across the middle
  box(-7, -8.8, 12.2, true); box(-7, 9.4, 12.2, true); box(7, -9.4, 12.2, true); box(7, 8.8, 12.2, true);
  box(-7, -11.8, 6.06, true, 2.6); box(7, 11.8, 6.06, true, 2.6);
  box(0, 0, 6.06, false); box(-3.5, -17, 6.06, false); box(3.5, 17, 6.06, false); box(3.5, 17, 6.06, false, 2.6);
  for (const [x, z] of [[-9.0, -10], [-10.4, 9], [9.0, 10], [10.2, -9]]) { crate(x, z, 1.5); crate(x, z, 1.2, 1.5, 0.3); }
  crate(-3, 3.5); crate(3.4, -8.5); crate(3.4, -8.5, 1.1, 1.4);

  // west lane: dock office, container wall, a two-high stack
  house(-20, -20, 9, 7, 5.5);
  box(-25, 2, 12.2, false); box(-28, 2, 6.06, false, 2.6);
  box(-16.2, 14, 6.06, true); box(-13.76, 14, 6.06, true); box(-15, 14, 6.06, true, 2.6);
  crate(-27, -10, 1.5); crate(-11.5, -7, 1.5); crate(-11.5, -7, 1.2, 1.5);
  crate(-26, 12, 1.5); crate(-20, 26, 1.5); crate(-21.6, 26, 1.5); crate(-12, 4.5, 1.3);

  // east lane: warehouse block, container wall, covered loading bay over site B
  addBlock(20, -2, 7, 12, 6.5, "wallC");
  addBlock(20, -2, 7.4, 12.4, 0.3, "steel", 6.5, { solid: false });
  box(26, -17, 12.2, false); box(29, -17, 6.06, false, 2.6);
  box(14, 16.8, 6.06, false); box(14, 19.24, 6.06, false);
  crate(12, -12, 1.5); crate(28, -26, 1.5); crate(29, 10, 1.5); crate(27.4, 10, 1.5); crate(27.4, 10, 1.2, 1.5);
  crate(11, 6, 1.4);
  // the bay roof: steel slats with skylight gaps on six columns (above head height, so bots walk under)
  for (const [x, z] of [[18.4, 12.5], [31, 12.5], [18.4, 24.5], [31, 24.5], [24.7, 12.5], [24.7, 24.5]]) addBlock(x, z, 0.35, 0.35, 5.4, "steel");
  for (let k = 0; k < 5; k++) addBlock(24.7, 12.9 + k * 2.75, 13.2, 1.9, 0.22, "steel", 5.4, { unit: 2.4 });
  addBlock(24.7, 12.5, 13.2, 0.3, 0.5, "craneY", 4.9, { solid: false }); addBlock(24.7, 24.5, 13.2, 0.3, 0.5, "craneY", 4.9, { solid: false });

  // spawns
  crate(-4, 27); crate(5, 27.5, 1.5); crate(2, -27, 1.5); crate(-6, -26.5);
  box(-24, -28.5, 6.06, false); box(24, -28.5, 6.06, false);

  // bomb sites: concrete barriers and cargo
  addBlock(-23, 16.4, 4, 0.8, 1.1, "wallC");
  crate(-28.5, 19.5, 1.5); crate(-28.5, 21, 1.4); crate(-28.5, 21, 1.1, 1.4);
  addBlock(24, 22.6, 4, 0.8, 1.1, "wallC");
  crate(21.5, 13, 1.5);
  for (const s of Object.values(SITES)) siteDecal(s);

  // beyond the walls: container stacks and two gantry cranes
  const far = { solid: false, shadow: false, unit: 2.4 };
  for (const [x, z, n, al] of [[-42, -40, 3, 0], [-20, -42, 2, 0], [6, -43, 3, 0], [30, -41, 2, 0], [-43, -10, 3, 1], [-42, 18, 2, 1], [43, -12, 2, 1], [42, 22, 3, 1], [-18, 42, 2, 0], [16, 43, 3, 0]])
    for (let k = 0; k < n; k++) addBlock(x, z, al ? 2.44 : 12.2, al ? 12.2 : 2.44, 2.6, nextCol(), k * 2.6, far);
  for (const cx of [-14, 18]) {
    for (const [lx, lz] of [[-6, -38], [6, -38], [-6, -50], [6, -50]]) addBlock(cx + lx, lz, 0.9, 0.9, 24, "craneY", 0, { solid: false, shadow: false });
    addBlock(cx, -38, 13, 1.2, 1.6, "craneY", 24, { solid: false, shadow: false }); addBlock(cx, -50, 13, 1.2, 1.6, "craneY", 24, { solid: false, shadow: false });
    addBlock(cx, -40, 2.2, 30, 1.4, "craneY", 25.6, { solid: false, shadow: false });
  }
}

/* ---------- Frostbite: a snowed-in mountain village ---------- */
function frostMats() {
  const logs = canvasTex(256, (g, s) => {
    for (let i = 0; i < 8; i++) {
      const y = i * 32, gr = g.createLinearGradient(0, y, 0, y + 32);
      gr.addColorStop(0, "#2e2016"); gr.addColorStop(0.18, "#6e4f33"); gr.addColorStop(0.55, "#8a6644"); gr.addColorStop(0.85, "#5a3f28"); gr.addColorStop(1, "#22170f");
      g.fillStyle = gr; g.fillRect(0, y, s, 32);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(30,18,8,${Math.random() * 0.25})`; g.fillRect(Math.random() * s, y + 6 + Math.random() * 20, 20 + Math.random() * 60, 1); }
    }
  });
  const pine = canvasTex(128, (g, s) => {
    const gr = g.createLinearGradient(0, s, 0, 0);
    gr.addColorStop(0, "#1f3326"); gr.addColorStop(0.45, "#2c4a34"); gr.addColorStop(0.62, "#cfd9de"); gr.addColorStop(1, "#f4f7fa");
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 160; k++) { g.fillStyle = Math.random() < 0.5 ? "rgba(32,56,40,.55)" : "rgba(245,248,250,.5)"; g.fillRect(Math.random() * s, Math.random() * s, 2, 6 + Math.random() * 14); }
  });
  MAT.logs = new THREE.MeshStandardMaterial({ map: logs, normalMap: MAT.crate.normalMap, roughness: 0.9 });
  MAT.snow = new THREE.MeshStandardMaterial({ color: 0xeef3f8, normalMap: MAT.sand.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.82, vertexColors: true });
  MAT.snowRoof = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.75 });
  MAT.gable = MAT.logs.clone(); MAT.gable.side = THREE.DoubleSide;
  MAT.pine = new THREE.MeshStandardMaterial({ map: pine, roughness: 0.9 });
  MAT.bark = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.95 });
  MAT.ice = new THREE.MeshStandardMaterial({ color: 0xa8c8dc, roughness: 0.08, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1 });
  MAT.stone.color = new THREE.Color(0xb3c1d2);
  MAT.trim.color = new THREE.Color(0xf6f9fc);       // stone caps read as snow on the walls
  MAT.distant.color = new THREE.Color(0xb9c3cf);
  MAT.plaster.color = new THREE.Color(0xe6e2da);
}
// pitched roof over a w x d building of height h (snow on the slopes, log gables)
function roof(x, z, w, d, h) {
  const alongX = w >= d, wall = alongX ? d : w, span = wall + 1, len = (alongX ? w : d) + 0.8, rise = span * 0.38;
  const slope = Math.atan2(rise, span / 2), pw = Math.hypot(span / 2, rise) + 0.1;
  const g = new THREE.Group(); g.position.set(x, h, z); g.rotation.y = alongX ? 0 : Math.PI / 2;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, pw), MAT.snowRoof);
    m.position.set(0, rise / 2 + 0.05, s * span / 4); m.rotation.x = s * slope; m.castShadow = m.receiveShadow = true; g.add(m);
  }
  const t = new THREE.Shape(); const gh = rise * wall / span;
  t.moveTo(-wall / 2, 0); t.lineTo(wall / 2, 0); t.lineTo(0, gh); t.lineTo(-wall / 2, 0);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(t), MAT.gable);
    m.rotation.y = Math.PI / 2; m.position.set(s * (len - 0.8) / 2, 0, 0); m.castShadow = true; g.add(m);
  }
  scene.add(g);
}
function cabin(x, z, w, d, h) {
  addBlock(x, z, w, d, h, "logs", 0, { unit: 2.4 });
  addBlock(x, z, w + 0.12, d + 0.12, 0.5, "stone", 0, { solid: false, cap: false });
  roof(x, z, w, d, h);
  const faces = [[x + w / 2, z, d, Math.PI / 2], [x - w / 2, z, d, -Math.PI / 2], [x, z + d / 2, w, 0], [x, z - d / 2, w, Math.PI]];
  for (const [fx, fz, len, ry] of faces) {
    const n = len > 7 ? 2 : 1;
    for (let k = 0; k < n; k++) { const off = n === 1 ? 0 : (k ? 1 : -1) * len * 0.24; windowAt(fx + Math.cos(ry) * off, h * 0.55, fz - Math.sin(ry) * off, ry); }
  }
}
function buildFrost() {
  Object.assign(SITES, {
    A: { id: "A", x: -25, z: 20.5, minX: -31.2, maxX: -18.5, minZ: 13, maxZ: 29.5,
         entrances: [{ x: -19, z: 8 }, { x: -7.5, z: 21 }], stages: [{ x: -27, z: -10 }, { x: -14, z: -9 }, { x: -6, z: -10 }] },
    B: { id: "B", x: 24.5, z: 21.5, minX: 17.5, maxX: 31.2, minZ: 14.5, maxZ: 29.5,
         entrances: [{ x: 20, z: 8 }, { x: 8, z: 22 }], stages: [{ x: 27, z: -10 }, { x: 14, z: -6 }, { x: 6, z: -10 }] }
  });
  MAP.midHold = { x: 0, z: 8 };
  frostMats();
  // winter light: cooler sun, bright snow bounce, pale haze
  scene.fog.color.set(0xd5dde6); scene.fog.near = 32; scene.fog.far = 150;
  hemi.color.set(0xe4ecf8); hemi.groundColor.set(0xbfc9d6); hemi.intensity = 0.42;
  sun.color.set(0xfff4e6);
  groundPlane(MAT.snow, [1, 1, 1]);
  perimeter("stone");

  // T side: cabin, wall, barn, wall (gaps are staggered against the CT side)
  cabin(-21, -18, 9, 6, 4.2);
  addBlock(-8, -16, 9, 1.2, 3.4, "stone");
  cabin(14, -16, 10, 7, 4.8);
  addBlock(28, -15, 8, 1.2, 3.4, "stone");
  // middle: the lodge splits mid, cabins on each lane
  cabin(0, -2, 8, 10, 5.5);
  addBlock(0, -2, 1, 1, 7.6, "stone", 0, { solid: false, cap: false });      // chimney through the roof
  cabin(-20, -4, 8, 6, 4);
  cabin(21, -2, 7, 8, 4.2);
  addBlock(7.5, -5, 2.6, 2.6, 2.2, "stone");                                    // well house in mid
  addBlock(7.5, -5, 3.1, 3.1, 0.3, "trim", 2.2, { solid: false });
  // CT side
  cabin(-13, 14, 7, 6, 4);
  addBlock(2, 16, 10, 1.2, 3.4, "stone");
  cabin(13, 12, 6, 6, 4);
  addBlock(-26, 8, 10, 1.2, 3, "stone");
  addBlock(27, 9, 10, 1.2, 3, "stone");
  // low cover (waist-high walls, firewood and crates)
  addBlock(-9, 4, 4, 0.7, 1.1, "stone"); addBlock(10, 3, 0.7, 4, 1.1, "stone"); addBlock(-4, 9, 3.5, 0.7, 1.1, "stone");
  addBlock(-23, 18, 4, 0.8, 1.1, "stone"); addBlock(24, 24, 4, 0.8, 1.1, "stone");
  addBlock(-29, 24, 2.2, 3.5, 1.3, "logs", 0, { unit: 2.4 }); addBlock(29, 17, 2.2, 3.5, 1.3, "logs", 0, { unit: 2.4 });
  crate(-20, 26, 1.5); crate(-27.5, 15, 1.4); crate(-27.5, 15, 1.1, 1.4); crate(20.5, 17, 1.5); crate(27, 27.5, 1.5); crate(25.5, 27.5, 1.2);
  crate(-14, 4, 1.4); crate(15, 4.5, 1.4); crate(-4, 27); crate(5, 27.5, 1.5); crate(2, -27, 1.5); crate(-6, -26.5);
  crate(-27, -24, 1.5); crate(26, -24, 1.5); crate(-11, -6, 1.3); crate(4, 21, 1.4);
  for (const s of Object.values(SITES)) siteDecal(s);
  // a frozen pond on the T side
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), MAT.ice);
  pond.rotation.x = -Math.PI / 2; pond.scale.set(4.2, 2.6, 1); pond.position.set(-3, 0.012, -23); pond.receiveShadow = true; scene.add(pond);

  // pine trees: solid ones in the arena, a forest behind the walls (instanced: one draw call per part)
  const inside = [[-29, -4], [-12, -23], [8, -24], [29, -6], [-30, 11], [30, 12], [-17, 26], [12, 26], [-6, -12], [17, 6], [-24, 2.5]];
  const outside = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + Math.random() * 0.08, r = 38 + Math.random() * 16;
    outside.push([Math.cos(a) * r * 1.05, Math.sin(a) * r, 1.4 + Math.random() * 1.2]);
  }
  const all = inside.map(([x, z]) => [x, z, 0.9 + Math.random() * 0.25]).concat(outside);
  const parts = [[new THREE.CylinderGeometry(0.16, 0.24, 1.6, 8).translate(0, 0.8, 0), MAT.bark]];
  for (const [r, h, y] of [[1.7, 2.3, 1.1], [1.3, 2.0, 2.4], [0.85, 1.7, 3.6]]) parts.push([new THREE.ConeGeometry(r, h, 12, 1, true).translate(0, y + h / 2, 0), MAT.pine]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const [geo, mat] of parts) {
    const im = new THREE.InstancedMesh(geo, mat, all.length);
    all.forEach(([x, z, s], i) => { q.setFromAxisAngle(up, Math.random() * 6.28); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  for (const [x, z, s] of all.slice(0, inside.length)) {
    const r = 0.75 * s, hgt = 5.2 * s;
    colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: 0, maxY: hgt, mat: "bark" });
    const hb = new THREE.Mesh(new THREE.BoxGeometry(r * 2, hgt, r * 2), hidden); hb.position.set(x, hgt / 2, z); scene.add(hb); solidMeshes.push(hb);
  }
  // distant ridge line so the horizon isn't flat
  for (const [x, z, w, d, h] of [[-46, -30, 10, 30, 9], [46, 20, 10, 34, 11], [0, -48, 60, 8, 8], [-20, 48, 40, 8, 10], [25, 47, 30, 8, 7]])
    addBlock(x, z, w, d, h, "distant", 0, { solid: false, shadow: false });

  // falling snow around the camera
  const N = 1800, pos = new Float32Array(N * 3), BOX = 36;
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * BOX - BOX / 2; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = Math.random() * BOX - BOX / 2; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const flake = canvasTex(32, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.07, map: flake, transparent: true, depthWrite: false, opacity: 0.9 }));
  snow.frustumCulled = false; scene.add(snow);
  MAP.tick = (dt, cam) => {
    const p = sg.attributes.position.array, t = performance.now() / 1000, cx = cam.position.x, cz = cam.position.z, H = BOX / 2;
    const wrap = (v, c) => { const d = v - c; return d > H ? v - BOX : d < -H ? v + BOX : v; };
    for (let i = 0; i < N; i++) {
      let y = p[i * 3 + 1] - dt * (0.9 + (i % 7) * 0.08);
      if (y < 0) y += 14;
      p[i * 3 + 1] = y;
      p[i * 3] = wrap(p[i * 3] + Math.sin(t * 0.7 + i) * dt * 0.25, cx);
      p[i * 3 + 2] = wrap(p[i * 3 + 2], cz);
    }
    sg.attributes.position.needsUpdate = true;
  };
}

// build the chosen map
({ dust2: buildDust2, dust: buildDust, harbor: buildHarbor, frost: buildFrost })[MAP_ID]();
// then fuse the static map into one mesh per material (fewer draw calls, faster everywhere)
const MERGE_INFO = mergeStatic();

// menu: the map buttons reload the page with ?map=, keeping difficulty and side
(() => {
  const qs = new URLSearchParams(location.search);
  for (const n of ["diff", "side"]) { const v = qs.get(n), el = v && document.querySelector(`input[name="${n}"][value="${v}"]`); if (el) el.checked = true; }
  const cur = document.querySelector(`input[name="map"][value="${MAP_ID}"]`); if (cur) cur.checked = true;
  for (const el of document.querySelectorAll('input[name="map"]')) el.addEventListener("change", () => {
    const q = new URLSearchParams({ map: el.value });
    for (const n of ["diff", "side"]) { const c = document.querySelector(`input[name="${n}"]:checked`); if (c) q.set(n, c.value); }
    location.search = q.toString();
  });
})();
