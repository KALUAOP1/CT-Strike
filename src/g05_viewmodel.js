/* ============================================================
   Viewmodel: the gun in your hands. Poses, drawing, reloads,
   slide and bolt actions, inspect (F), AWP scope.
   ============================================================ */
// where each gun sits in front of the eye: x, y, z, yaw, cant
const VM_POSE = {
  ak47: [0.125, -0.15, -0.35, 0.1, -0.13], m4a4: [0.125, -0.145, -0.35, 0.1, -0.13], awp: [0.125, -0.155, -0.34, 0.09, -0.12],
  deagle: [0.08, -0.068, -0.3, 0.07, -0.06], glock: [0.075, -0.064, -0.28, 0.07, -0.06],
  knife: [0.11, -0.115, -0.25, 0.32, -0.25],
  he: [0.1, -0.1, -0.26, 0.1, -0.12], flash: [0.1, -0.105, -0.26, 0.1, -0.12], smoke: [0.1, -0.11, -0.26, 0.1, -0.12]
};
const DRAW_TIME = { ak47: 0.6, m4a4: 0.6, awp: 0.9, deagle: 0.5, glock: 0.45, knife: 0.35, he: 0.45, flash: 0.45, smoke: 0.45 };
const VM = { root: new THREE.Group(), models: {}, gun: null, id: null, kick: 0, bob: 0, swayX: 0, swayY: 0, lastDX: 0, lastDY: 0 };
wScene.add(VM.root);
for (const id of Object.keys(WEAPONS)) {
  const g = makeViewmodel(id), d = g.userData, p = VM_POSE[id];
  if (d.mag) {
    const c = new THREE.Box3().setFromObject(d.mag).getCenter(new THREE.Vector3());
    d.magOff = d.guard ? new THREE.Vector3(0, c.y - d.guard.y - 0.01, c.z + d.guard.f) : new THREE.Vector3(0, -0.06, 0.02);
  }
  d.pose = { pos: new THREE.Vector3(p[0], p[1], p[2]), rot: new THREE.Vector3(0.02, p[3], p[4]) };
  g.visible = false;
  VM.root.add(g); VM.models[id] = g;
}

/* ---------- planting: the C4 comes up in both hands and you key in the code ----------
   Hands are built in C4 space (keys on top at y 0.067, near edge towards +z). */
const C4VM = (() => {
  const root = new THREE.Group(), c4 = buildC4(), TILT = 0.95, X = V3(1, 0, 0);
  const toC4 = (x, y, z) => V3(x, y, z).normalize().applyAxisAngle(X, -TILT);   // a view-space direction in C4 space
  root.add(c4); c4.rotation.x = TILT; root.visible = false; wScene.add(root);
  // left hand: palm on the left side, fingers over the top edge, thumb underneath
  const lk = new Kit();
  lk.add(GM.glove, ellipsoid(-0.118, 0.02, 0.0, 0.02, 0.045, 0.062), ellipsoid(-0.085, 0.06, -0.004, 0.03, 0.011, 0.056),
    capsule(V3(-0.112, -0.004, 0.045), V3(-0.07, -0.01, 0.02), 0.01));
  forearm(lk, V3(-0.125, 0.004, 0.062), toC4(-0.35, -0.55, 1));
  c4.add(lk.bake(false));
  // right hand: index finger out, tip at the group origin, the rest curled into a fist
  const rk = new Kit(), knuckle = V3(0.02, 0.05, 0.042);
  rk.add(GM.glove, capsule(V3(0, 0.006, 0), knuckle, 0.0095), ellipsoid(0.04, 0.062, 0.07, 0.038, 0.03, 0.05),
    ellipsoid(0.032, 0.04, 0.072, 0.03, 0.02, 0.04), capsule(V3(0.012, 0.05, 0.08), V3(-0.01, 0.045, 0.05), 0.0095));
  forearm(rk, V3(0.05, 0.065, 0.105), toC4(0.45, -0.35, 1));
  const rh = rk.bake(false);
  c4.add(rh);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; o.frustumCulled = false; } });
  const key = (i) => { i = ((i * 5 + 3) % 9 + 9) % 9; return [-0.016 + (i % 3) * 0.016, 0.012 + Math.floor(i / 3) * 0.014]; };
  // e: seconds since the plant started, or < 0 when not planting
  function update(e, bob) {
    root.visible = e >= 0;
    if (e < 0) return;
    const up = ss(e / 0.3), down = seg(e, PLANT_TIME - 0.35, PLANT_TIME);
    root.position.set(0.0, -0.215 - (1 - up) * 0.22 - down * 0.14 + bob, -0.47 - down * 0.05);
    root.rotation.set(down * 0.35, 0, (1 - up) * 0.3);
    // one key press per beep, sliding over to the next key in between
    const i = Math.floor(e / 0.42), q = (e % 0.42) / 0.42;
    const a = key(i), b = key(i + 1), m = ss((q - 0.3) / 0.6);
    const press = q < 0.3 ? Math.sin(q / 0.3 * Math.PI) : 0;
    rh.position.set(a[0] + (b[0] - a[0]) * m, 0.072 + 0.022 * (1 - press), a[1] + (b[1] - a[1]) * m);
  }
  return { update, root };
})();

// Inspect: keyframes [time, x, y, z, pitch, yaw, roll] added to the normal pose.
const INSPECT = [
  [0, 0, 0, 0, 0, 0, 0],
  [0.55, -0.075, 0.06, 0.03, 0.12, 0.85, 0.3],     // swing the left side round to face you
  [1.4, -0.08, 0.065, 0.03, 0.06, 1.0, 0.22],      // hold it there, drifting slowly
  [2.05, -0.07, 0.085, 0.03, 0.02, -0.18, -0.95],  // support hand lets go, roll it over to show the other side
  [2.75, -0.07, 0.08, 0.03, 0.04, -0.26, -0.88],
  [3.3, 0, 0, 0, 0, 0, 0]
];
const INSPECT_LEN = INSPECT[INSPECT.length - 1][0];
function startInspect() {
  const now = performance.now() / 1000;
  if (!player.alive || arms.reloading || arms.scope || now < arms.switchEnd || now < arms.nextFire - 0.05) return;
  if (now - arms.inspectStart < INSPECT_LEN) return;
  arms.inspectStart = now;
}
const ss = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t, a, b) => ss((t - a) / (b - a));

function resetParts(g) {
  const d = g.userData;
  if (d.mag) { d.mag.position.set(0, 0, 0); d.mag.visible = true; }
  if (d.slide) d.slide.position.z = 0;
  if (d.bolt) { d.bolt.position.set(0, 0.012, 0); d.bolt.rotation.set(0, 0, 0); }
  if (d.leftArm) d.leftArm.position.set(0, 0, 0);
}

function equip(slot, instant = false, force = false) {
  const a = arms[slot];
  if (!a || !player.alive) return;
  if (slot === arms.current && VM.id === a.id && !force) return;
  if (slot !== arms.current) { arms.last = arms.current; arms.current = slot; }
  arms.reloading = false; arms.shots = 0; arms.rescope = 0; arms.inspectStart = -99; arms.boltStart = -99;
  arms.pin = 0; arms.throwStart = -99; arms.swingStart = -99;
  setScope(0);
  arms.switchEnd = instant ? 0 : performance.now() / 1000 + DRAW_TIME[a.id];
  for (const id in VM.models) VM.models[id].visible = id === a.id;
  VM.gun = VM.models[a.id]; VM.id = a.id;
  resetParts(VM.gun);
  if (!instant) Sound.draw(a.id);
  HUD.ammo();
}

function startReload() {
  const w = curW(), a = slotOf(), now = performance.now() / 1000;
  if (w.melee || w.nade) return;
  if (arms.reloading || a.ammo >= w.mag || a.reserve <= 0 || !player.alive || now < arms.switchEnd) return;
  if (w.id === "awp" && now < arms.nextFire) return;            // let the bolt finish first
  arms.reloading = true; arms.inspectStart = -99; arms.rescope = 0;
  setScope(0);
  arms.reloadStart = now; arms.reloadEnd = now + w.reload;
  if (w.id === "awp" && a.ammo === 0) { arms.boltStart = arms.reloadEnd - 0.95; arms.boltEjected = true; }
  Sound.reload(w.reload, w.id, a.ammo === 0);
  HUD.hint("Reloading");
}

/* ---------- AWP scope: right mouse cycles 1x -> 2 zoom levels -> off ---------- */
function setScope(level) {
  arms.scope = level;
  document.body.classList.toggle("scoped", level > 0);
  const fov = SCOPE_FOV[level];
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
function cycleScope() {
  const now = performance.now() / 1000;
  if (curW().id !== "awp" || arms.reloading || !player.alive || now < arms.switchEnd) return;
  arms.inspectStart = -99;
  if (now < arms.nextFire) { arms.rescope = arms.rescope ? 0 : 1; return; }   // queue it behind the bolt
  setScope((arms.scope + 1) % SCOPE_FOV.length);
  Sound.zoom();
}

/* ---------- per-frame animation ---------- */
const vmQ = new THREE.Quaternion(), vmV = new THREE.Vector3();
function updateViewmodel(dt, now) {
  const a = slotOf(), w = curW(), g = VM.gun, d = g.userData;
  if (arms.reloading && now >= arms.reloadEnd) {
    const take = Math.min(w.mag - a.ammo, a.reserve);
    a.ammo += take; a.reserve -= take; arms.reloading = false;
    HUD.ammo(); HUD.hint("");
  }
  if (arms.rescope && now >= arms.nextFire && !arms.reloading && player.alive) { setScope(arms.rescope); arms.rescope = 0; }

  // keep the viewmodel lit by the same sun as the world
  vmQ.copy(camera.quaternion).invert();
  wSun.position.copy(SUN_DIR).applyQuaternion(vmQ).multiplyScalar(5);

  // walk bob, mouse sway, recoil kick
  const moving = player.onGround ? Math.min(1, player.speed / 5.4) : 0;
  VM.bob += dt * (6 + player.speed * 1.4) * (moving > 0.05 ? 1 : 0);
  VM.kick += (0 - VM.kick) * Math.min(1, dt * 14);
  VM.swayX += (clamp(-(VM.lastDX || 0) * 0.0003, -0.025, 0.025) - VM.swayX) * Math.min(1, dt * 8);
  VM.swayY += (clamp((VM.lastDY || 0) * 0.0003, -0.025, 0.025) - VM.swayY) * Math.min(1, dt * 8);
  const bx = Math.sin(VM.bob) * 0.01 * moving, by = -Math.abs(Math.cos(VM.bob)) * 0.01 * moving;
  let dip = 0, drawRot = 0;
  if (now < arms.switchEnd) { const k = ss((arms.switchEnd - now) / DRAW_TIME[w.id]); dip = k * 0.22; drawRot = k * 0.9; }
  if (!player.alive) dip += 0.5;
  // planting puts the gun away for the C4; defusing lowers it out of the way
  const act = player.alive ? Bomb.progress() : null, planting = !!act && act.kind === "plant";
  if (act) dip += planting ? 0.6 : 0.32 * ss(act.p * 10);
  C4VM.update(planting ? act.p * PLANT_TIME : -1, by * 0.5);
  // strafing leans the gun a touch the other way; landings push it down
  const sideV = player.vel.x * Math.cos(player.yaw) - player.vel.z * Math.sin(player.yaw);
  VM.roll = (VM.roll || 0) + (clamp(-sideV * 0.01, -0.05, 0.05) - (VM.roll || 0)) * Math.min(1, dt * 7);
  const land = Math.sin(Math.min(1, player.land) * Math.PI) * 0.03;
  VM.root.position.set(bx + VM.swayX, by + VM.swayY - dip - player.crouch * 0.008 - land, VM.kick * 0.45);
  VM.root.rotation.set(VM.kick * 1.1 - drawRot * 0.5 + land * 0.6, 0, drawRot * 0.35 + VM.roll);
  VM.root.visible = !arms.scope;

  let ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0, release = 0;
  resetParts(g);
  g.visible = !planting;

  // knife: a quick right-to-left slash, or a heavier forward stab
  if (w.melee) {
    const st = now - arms.swingStart;
    if (arms.swingHeavy && st < 0.7) {
      const back = seg(st, 0, 0.18) - seg(st, 0.18, 0.3), thrust = seg(st, 0.18, 0.3) - seg(st, 0.4, 0.7);
      oz += back * 0.06 - thrust * 0.16; oy += back * 0.03; rx += back * 0.5 - thrust * 0.35; ox -= thrust * 0.04;
    } else if (!arms.swingHeavy && st < 0.42) {
      const out = seg(st, 0, 0.1) - seg(st, 0.22, 0.42), sweep = seg(st, 0.04, 0.18);
      ox += out * (0.08 - sweep * 0.2); oy += out * 0.04; oz -= out * 0.08;
      ry += out * (0.9 - sweep * 1.6); rz += out * -0.9; rx += out * 0.2;
    }
  }
  // grenades: hold left/right mouse to pull the pin and wind up, release to throw
  if (w.nade) {
    const wind = arms.pin ? Math.min(1, (now - arms.pin) / 0.25) : 0;
    oy += wind * 0.05; oz += wind * 0.09; rx += wind * 0.7; ox += wind * 0.02;
    const tt = now - arms.throwStart;
    if (tt >= 0 && tt < 0.6) {
      const fwd = seg(tt, 0, 0.12), gone = tt > 0.08;
      oz -= fwd * 0.22; oy += fwd * 0.04 - seg(tt, 0.15, 0.6) * 0.3; rx -= fwd * 0.9;
      g.visible = !gone;
    }
  }

  // reload: tilt, old magazine drops, support hand brings the new one
  if (arms.reloading) {
    const t = (now - arms.reloadStart) / w.reload;
    const tilt = seg(t, 0, 0.15) - seg(t, 0.82, 1);
    rz += tilt * (d.pistol ? 0.28 : 0.45); rx += tilt * 0.14; ox -= tilt * 0.02; oy -= tilt * 0.015;
    if (d.mag) {
      if (t < 0.4) { const out = seg(t, 0.12, 0.32); d.mag.position.y = -out * 0.3; d.mag.visible = out < 0.97; }
      else d.mag.position.y = -(1 - seg(t, 0.45, 0.7)) * 0.22;
      if (t > 0.7 && t < 0.8) oy += Math.sin((t - 0.7) / 0.1 * Math.PI) * 0.008;   // seat it
    }
    if (d.leftArm) {
      if (d.pistol) d.leftArm.position.y = -(seg(t, 0.1, 0.3) - seg(t, 0.72, 0.9)) * 0.09;
      else {
        const go = seg(t, 0.12, 0.35) - seg(t, 0.74, 0.92), m = d.magOff;
        const extra = t < 0.45 ? -0.22 * seg(t, 0.3, 0.45) : d.mag.position.y;
        d.leftArm.position.set(m.x * go, m.y * go + (t < 0.74 ? extra : 0), m.z * go);
      }
    }
  }
  // pistol slide: blowback on every shot, locked back on an empty magazine
  if (d.slide) {
    const k = now - arms.slideKick;
    let z = k >= 0 && k < 0.09 ? Math.sin((k / 0.09) * Math.PI) * 0.028 : 0;
    const releasing = arms.reloading && now > arms.reloadEnd - 0.15;
    if (a.ammo === 0 && !releasing) z = Math.max(z, 0.024);
    d.slide.position.z = z;
  }
  // AWP bolt: lift, pull back (spent case flies out), push, lock down
  if (d.bolt) {
    const bt = (now - arms.boltStart) / 0.9;
    if (bt > 0 && bt < 1) {
      const up = seg(bt, 0, 0.15) - seg(bt, 0.75, 0.9), pull = seg(bt, 0.2, 0.42) - seg(bt, 0.5, 0.72);
      d.bolt.rotation.z = up * 1.05; d.bolt.position.z = pull * 0.08;
      rz += up * 0.14; rx += up * 0.04; oy -= up * 0.01;
      if (!arms.boltEjected && bt > 0.38) { arms.boltEjected = true; ejectShell(w); }
    }
  }
  // inspect
  const it = now - arms.inspectStart;
  if (it >= 0 && it < INSPECT_LEN) {
    let i = 0; while (INSPECT[i + 1][0] < it) i++;
    const A = INSPECT[i], B = INSPECT[i + 1], k = ss((it - A[0]) / (B[0] - A[0]));
    const L = (j) => A[j] + (B[j] - A[j]) * k;
    ox += L(1); oy += L(2); oz += L(3); rx += L(4); ry += L(5); rz += L(6);
    release = seg(it, 1.45, 1.85) - seg(it, 2.8, 3.2);
  }
  const P = d.pose;
  g.position.set(P.pos.x + ox, P.pos.y + oy, P.pos.z + oz);
  g.rotation.set(P.rot.x + rx, P.rot.y + ry, P.rot.z + rz);
  // the released support hand drops down and back, out of view (offset given in view space)
  if (release > 0 && d.leftArm) {
    vmV.set(-0.04, -0.3, 0.14).multiplyScalar(release).applyQuaternion(vmQ.setFromEuler(g.rotation).invert());
    d.leftArm.position.add(vmV);
  }
  VM.root.updateMatrixWorld(true);
  updateFlash(now);
  updateShells(dt);
}

