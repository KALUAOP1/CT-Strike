/* ============================================================
   Guns, part 5: knife, grenades and the C4.
   These are built in "grip space" (+y runs up the handle, -z is
   the side the fingers wrap), then moved onto the hand with the
   same matrix the arms use, so the fist always closes round them.
   ============================================================ */
GM.nadeOlive = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.6, metalness: 0.2, roughnessMap: ROUGH.worn });
GM.nadeAlu = new THREE.MeshStandardMaterial({ color: 0x9a9c9e, roughness: 0.4, metalness: 0.9, roughnessMap: ROUGH.brushed });
GM.nadeSmoke = new THREE.MeshStandardMaterial({ color: 0x5f6a5a, roughness: 0.55, metalness: 0.35, roughnessMap: ROUGH.worn });
GM.paintRed = new THREE.MeshStandardMaterial({ color: 0x9a2a1c, roughness: 0.6 });
GM.paintBlue = new THREE.MeshStandardMaterial({ color: 0x2e5a8a, roughness: 0.6 });
GM.blade = new THREE.MeshStandardMaterial({ color: 0xc9cbcd, metalness: 1, roughness: 0.22, roughnessMap: ROUGH.brushed });
GM.c4 = new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 0.85, normalMap: GM.grip.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) });
GM.c4dark = new THREE.MeshStandardMaterial({ color: 0x1d1f1c, roughness: 0.6 });
GM.led = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
GM.wireR = new THREE.MeshStandardMaterial({ color: 0xa8231a, roughness: 0.5 });
GM.wireY = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5 });

function gripMatrix(gp) {
  return new THREE.Matrix4().compose(V3(0, gp.y, -gp.f), new THREE.Quaternion().setFromEuler(new THREE.Euler(-gp.tilt * DEG, 0, 0)), V3(1, 1, 1));
}
// Adds geometries built in grip space to a kit, moved into gun space.
function addGrip(k, m, mat, ...geos) { for (const g of geos) { g.applyMatrix4(m); k.add(mat, g); } }

/* ---------- knife: oval rubber handle, finger guard, clip-point blade ---------- */
function buildKnife() {
  const body = new Kit(), gp = { f: 0, y: 0, tilt: 72 }, m = gripMatrix(gp);
  const handle = new THREE.CylinderGeometry(0.0165, 0.0175, 0.115, 16); handle.scale(0.75, 1, 1); handle.translate(0, -0.004, 0);
  addGrip(body, m, GM.grip, handle);
  addGrip(body, m, GM.steel, peg(0, -0.066, 0, 0.014, 0.012, "y", 16));                 // pommel
  addGrip(body, m, GM.steel, blk(0, 0.058, 0.052, 0.009, 0.024));                      // guard
  addGrip(body, m, GM.blade, prof([[0.013, 0.062], [0.016, 0.17], [0.006, 0.235], [-0.002, 0.262], [-0.008, 0.222], [-0.004, 0.205], [-0.013, 0.19], [-0.013, 0.062]], 0.0038, { bevel: 0.0012 }));
  addGrip(body, m, GM.steel, prof([[-0.004, 0.07], [-0.004, 0.18], [-0.009, 0.18], [-0.009, 0.07]], 0.0042, { bevel: 0.0005 }));   // fuller line
  const tip = V3(0, 0.25, 0).applyMatrix4(m);
  return finishGun(new THREE.Group(), { body }, { muzzle: tip, eject: V3(0, 0, 0), grip: gp, gripR: 0.026, pistol: true, oneHand: true, melee: true });
}

/* ---------- grenades ---------- */
// fuse head shared by all three: body cap, spoon down the back, pull ring on the left
function fuse(k, m, top, r) {
  addGrip(k, m, GM.steelLight, peg(0, top + 0.008, 0, 0.0095, 0.018, "y", 14));
  addGrip(k, m, GM.steelLight, blk(-0.014, top + 0.012, 0.03, 0.006, 0.014));
  addGrip(k, m, GM.steelLight, blk(-r - 0.004, top - 0.03, 0.004, 0.075, 0.013, 0, -6));   // spoon (lever)
  const ring = new THREE.TorusGeometry(0.011, 0.0016, 6, 18); ring.rotateY(Math.PI / 2); ring.translate(-0.016, top + 0.012, 0.006);
  addGrip(k, m, GM.steel, ring);
}
function buildHE() {
  const body = new Kit(), gp = { f: 0, y: 0, tilt: 12 }, m = gripMatrix(gp);
  addGrip(body, m, GM.nadeOlive, ellipsoid(0, 0, 0, 0.031, 0.04, 0.031));
  for (let y = -0.024; y <= 0.026; y += 0.0125) addGrip(body, m, GM.nadeOlive, peg(0, y, 0, Math.sqrt(Math.max(0, 1 - (y / 0.04) ** 2)) * 0.0318, 0.003, "y", 18));
  addGrip(body, m, GM.paintRed, peg(0, 0.033, 0, 0.017, 0.004, "y", 16));
  fuse(body, m, 0.038, 0.03);
  return finishGun(new THREE.Group(), { body }, { muzzle: V3(0, 0.05, 0).applyMatrix4(m), eject: V3(0, 0, 0), grip: gp, gripR: 0.034, pistol: true, oneHand: true, nade: "he" });
}
function buildFlash() {
  const body = new Kit(), gp = { f: 0, y: 0, tilt: 12 }, m = gripMatrix(gp);
  addGrip(body, m, GM.nadeAlu, peg(0, 0, 0, 0.021, 0.1, "y", 20));
  for (const y of [-0.03, -0.01, 0.01, 0.03]) for (let a = 0; a < 6; a++) {
    const p = V3(Math.sin(a * Math.PI / 3) * 0.0205, y, Math.cos(a * Math.PI / 3) * 0.0205);
    const hole = peg(0, 0, 0, 0.0038, 0.002, "z", 8); hole.lookAt(p); hole.translate(p.x, p.y, p.z);
    addGrip(body, m, GM.bore, hole);
  }
  addGrip(body, m, GM.paintBlue, peg(0, -0.047, 0, 0.0215, 0.006, "y", 20));
  fuse(body, m, 0.05, 0.021);
  return finishGun(new THREE.Group(), { body }, { muzzle: V3(0, 0.06, 0).applyMatrix4(m), eject: V3(0, 0, 0), grip: gp, gripR: 0.026, pistol: true, oneHand: true, nade: "flash" });
}
function buildSmoke() {
  const body = new Kit(), gp = { f: 0, y: 0, tilt: 12 }, m = gripMatrix(gp);
  addGrip(body, m, GM.nadeSmoke, peg(0, 0, 0, 0.026, 0.11, "y", 22));
  addGrip(body, m, GM.white, peg(0, 0.03, 0, 0.0263, 0.012, "y", 22));
  for (let a = 0; a < 4; a++) {
    const p = V3(Math.sin(a * Math.PI / 2 + 0.4) * 0.026, -0.052, Math.cos(a * Math.PI / 2 + 0.4) * 0.026);
    const hole = peg(0, 0, 0, 0.004, 0.002, "z", 8); hole.lookAt(p); hole.translate(p.x, p.y, p.z);
    addGrip(body, m, GM.bore, hole);
  }
  fuse(body, m, 0.055, 0.026);
  return finishGun(new THREE.Group(), { body }, { muzzle: V3(0, 0.06, 0).applyMatrix4(m), eject: V3(0, 0, 0), grip: gp, gripR: 0.03, pistol: true, oneHand: true, nade: "smoke" });
}

/* ---------- C4: taped explosive bricks, keypad, wires and a blinking light ---------- */
function buildC4() {
  const body = new Kit();
  for (const x of [-0.07, 0, 0.07]) body.add(GM.c4, blk(0, 0.025, 0.2, 0.05, 0.066, x));
  for (const f of [-0.06, 0.06]) body.add(GM.c4dark, blk(f, 0.026, 0.02, 0.053, 0.215));
  body.add(GM.c4dark, blk(0.005, 0.058, 0.11, 0.016, 0.09));
  body.add(GM.white, blk(0.03, 0.067, 0.04, 0.002, 0.07));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) body.add(GM.steelLight, blk(-0.012 - r * 0.014, 0.067, 0.009, 0.004, 0.01, -0.016 + c * 0.016));
  body.add(GM.wireR, tube(-0.09, 0.09, 0.0028, 0.0028, 0.053, 0.05, 8));
  body.add(GM.wireY, tube(-0.09, 0.07, 0.0028, 0.0028, 0.053, -0.048, 8));
  const g = finishGun(new THREE.Group(), { body }, {});
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), GM.led);
  led.position.set(0.032, 0.07, 0.02);
  g.add(led); g.userData.led = led;
  return g;
}

Object.assign(GUN_BUILDERS, { knife: buildKnife, he: buildHE, flash: buildFlash, smoke: buildSmoke });
