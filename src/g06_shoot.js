/* ============================================================
   Shooting: spread, recoil, damage, armour, muzzle flash,
   brass, tracers, bullet holes and dust puffs
   ============================================================ */
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3(), tmpM = new THREE.Vector3();

function currentSpread() {
  const w = curW();
  let s = w.id === "awp" && arms.scope ? w.scoped : w.base;
  s += w.move * clamp((player.speed - 1.2) / 4.2, 0, 1);
  if (!player.onGround) s += w.air;
  s *= 1 - player.crouch * 0.35;
  if (w.id !== "awp") s += Math.min(arms.shots, 12) * 0.0018 * (w.auto ? 1 : 2.5);
  return s;
}

// CS-style armour: it soaks up part of each hit and loses points doing it. Heads need a helmet.
function applyArmor(target, dmg, part, pen) {
  const covered = target.armor > 0 && (part === "body" || (part === "head" && target.helmet));
  if (!covered) return dmg;
  const taken = dmg * pen;
  target.armor = Math.max(0, Math.round(target.armor - (dmg - taken) * 0.5));
  return taken;
}

/* ---------- knife ---------- */
function knifeAttack(now, heavy) {
  arms.nextFire = now + (heavy ? 1.0 : 0.45); arms.swingStart = now; arms.swingHeavy = heavy; arms.inspectStart = -99;
  Sound.swing(heavy);
  camera.getWorldDirection(tmpV);
  raycaster.set(camera.position, tmpV); raycaster.far = 1.9;
  const hits = raycaster.intersectObjects(solidMeshes.concat(Bots.hitMeshes(player.team)), false);
  raycaster.far = Infinity;
  if (!hits.length) return;
  const h = hits[0], ud = h.object.userData;
  if (ud.bot) {
    const b = ud.bot, bp = b.group.position;
    // a backstab is when you hit them from behind, pointing the way they face
    const dx = bp.x - player.pos.x, dz = bp.z - player.pos.z, dl = Math.hypot(dx, dz) || 1;
    const back = (dx / dl) * -Math.sin(b.yaw) + (dz / dl) * -Math.cos(b.yaw) > 0.45;
    const dmg = heavy ? (back ? 180 : 65) : (back ? 90 : 40);
    puff(h.point, 0x7d1712, 6, 0.5);
    Sound.stab(true);
    hurt(b, dmg, "body", WEAPONS.knife, player);
  } else {
    puff(h.point, 0xc9b089, 3, 0.25);
    Sound.stab(false);
  }
}

/* ---------- grenades: hold a mouse button to pull the pin, release to throw ---------- */
function nadeInput(now, w) {
  if (arms.afterThrow && now - arms.throwStart >= 0.55) {
    arms.afterThrow = false;
    const t = nextNadeType(w.id);
    if (t) { arms.nade = { id: t, ammo: 0, reserve: 0 }; equip("nade", false, true); }
    else { arms.nade = null; equip(bestSlot()); }
    return;
  }
  if (arms.afterThrow || now < arms.switchEnd) return;
  const held = mouseDown || mouse2Down;
  if (held && !arms.pin) { arms.pin = now; Sound.pin(); }
  if (held) arms.lob = mouse2Down && !mouseDown;
  if (arms.pin && !held && now - arms.pin > 0.15) throwNade(now, w);
}
function throwNade(now, w) {
  arms.pin = 0; arms.throwStart = now; arms.afterThrow = true;
  camera.getWorldDirection(tmpV);
  const vel = tmpV.clone().multiplyScalar(arms.lob ? 7 : 15.5);
  vel.y += arms.lob ? 1.4 : 2.2;
  vel.x += player.vel.x * 0.8; vel.z += player.vel.z * 0.8;
  const pos = camera.position.clone().addScaledVector(tmpV, 0.35); pos.y -= 0.1;
  Nades.throw(player, w.id, pos, vel);
  arms.nades[w.id] = Math.max(0, arms.nades[w.id] - 1);
  Sound.swing(false);
  HUD.ammo();
}

function tryFire(now) {
  const w = curW(), a = slotOf();
  if (!player.alive || Game.state !== "live" || Buy.open || Bomb.playerBusy()) { arms.pin = 0; return; }
  if (w.nade) { nadeInput(now, w); return; }
  if (w.melee) {
    if ((mouseDown || mouse2Down) && now >= arms.nextFire && now >= arms.switchEnd) knifeAttack(now, mouse2Down && !mouseDown);
    return;
  }
  if (!mouseDown) return;
  if (now < arms.nextFire || now < arms.switchEnd || arms.reloading) return;
  if (!w.auto && arms.triggerHeld) return;
  arms.triggerHeld = true;
  arms.inspectStart = -99;
  if (a.ammo <= 0) {
    Sound.click(); arms.nextFire = now + 0.25;
    if (a.reserve > 0) startReload(); else HUD.hint("Out of ammo. Press Q to swap weapons", 2000);
    return;
  }
  a.ammo--; arms.nextFire = now + w.rate; arms.lastShot = now;

  // direction with spread
  camera.getWorldDirection(tmpV);
  tmpR.setFromMatrixColumn(camera.matrixWorld, 0);
  tmpU.setFromMatrixColumn(camera.matrixWorld, 1);
  const sp = currentSpread(), ang = Math.random() * Math.PI * 2, mag = Math.sqrt(Math.random()) * sp;
  tmpV.addScaledVector(tmpR, Math.cos(ang) * mag).addScaledVector(tmpU, Math.sin(ang) * mag).normalize();

  // recoil: rifles climb then drift side to side, pistols and the AWP kick once
  const i = arms.shots++;
  if (w.auto) {
    const c = w.climb;
    arms.recoilP += i < 9 ? c - i * c * 0.062 : c * 0.2;
    arms.recoilY += i < 9 ? rand(-0.003, 0.003) : (Math.floor((i - 9) / 7) % 2 ? -0.011 : 0.009);
    arms.recoilP = Math.min(arms.recoilP, 0.3);
  } else {
    arms.recoilP += w.climb; arms.recoilY += rand(-0.25, 0.25) * w.climb;
  }
  VM.kick = w.kick;

  // muzzle flash, brass, sound
  const scoped = arms.scope > 0;
  muzzleFlash(w, now);
  if (w.id === "awp") {
    if (scoped) { arms.rescope = arms.scope; setScope(0); }
    if (a.ammo > 0) { arms.boltStart = now + 0.3; arms.boltEjected = false; Sound.bolt(0.3); }
  } else ejectShell(w);
  if (VM.gun.userData.slide) arms.slideKick = now;
  Sound.shot(w.id);
  Bots.hear(player.pos, 1.7, player.team);

  raycaster.set(camera.position, tmpV);
  raycaster.far = 260;
  const hits = raycaster.intersectObjects(solidMeshes.concat(Bots.hitMeshes(player.team)), false);
  const from = scoped ? camera.position.clone().addScaledVector(tmpU, -0.06).addScaledVector(tmpV, 0.4) : muzzleWorld(new THREE.Vector3());
  let end;
  if (hits.length) {
    const h = hits[0];
    end = h.point;
    const ud = h.object.userData;
    if (ud.bot) {
      let dmg = w.dmg * Math.pow(w.falloff, h.distance / 12.7);
      if (ud.part === "head") dmg *= 4; else if (ud.part === "legs") dmg *= 0.75;
      puff(h.point, 0x7d1712, 5, 0.5);
      hurt(ud.bot, dmg, ud.part, w, player);
    } else {
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      decal(h.point, n);
      puff(h.point.clone().addScaledVector(n, 0.05), 0xc9b089, 3, 0.35);
      Sound.impact(h.distance);
    }
  } else end = camera.position.clone().addScaledVector(tmpV, 240);
  tracer(from, end, 0xffe2a0, w.id === "awp" ? 0.02 : 0.012);
  HUD.ammo();
  if (a.ammo === 0 && a.reserve > 0) setTimeout(() => { if (slotOf() === a) startReload(); }, w.id === "awp" ? 500 : 250);
}

// The gun is drawn by a different camera, so map its muzzle onto the world camera's view.
function muzzleWorld(out) {
  const g = VM.gun;
  tmpM.copy(g.userData.muzzle).applyMatrix4(g.matrixWorld).project(wCamera);
  return out.set(tmpM.x, tmpM.y, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(0.7).add(camera.position);
}

/* ---------- muzzle flash: star sprite at the muzzle + a short light in the world ---------- */
const flashTex = canvasTex(128, (g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,250,220,1)"); grd.addColorStop(0.25, "rgba(255,200,90,.9)"); grd.addColorStop(1, "rgba(255,120,20,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  g.strokeStyle = "rgba(255,220,140,.9)"; g.lineWidth = 6;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * s * .48, s / 2 + Math.sin(a) * s * .48); g.stroke(); }
});
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
flash.visible = false; flash.renderOrder = 10;
wScene.add(flash);
const flashLight = new THREE.PointLight(0xffb85a, 0, 9, 2);
scene.add(flashLight);
const vmFlashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2);
wScene.add(vmFlashLight);
let flashUntil = 0;
function muzzleFlash(w, now) {
  flashUntil = now + 0.045;
  flash.material.rotation = Math.random() * Math.PI;
  flash.scale.setScalar(w.slot === "primary" ? rand(0.13, 0.2) : rand(0.08, 0.12));
  flashLight.position.copy(camera.position).addScaledVector(tmpV, 1);
}
function updateFlash(now) {
  const on = now < flashUntil && !arms.scope;
  flash.visible = on;
  flashLight.intensity = now < flashUntil ? 2.4 : 0;
  vmFlashLight.intensity = on ? 1.6 : 0;
  if (on) {
    const g = VM.gun;
    flash.position.copy(g.userData.muzzle).applyMatrix4(g.matrixWorld);
    vmFlashLight.position.copy(flash.position);
  }
}

/* ---------- brass: spent cases fly out of the ejection port ---------- */
const shellGeo = new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2);
const shells = [];
function ejectShell(w) {
  const g = VM.gun;
  if (!g || arms.scope) return;
  const m = new THREE.Mesh(shellGeo, GM.brass);
  m.scale.set(w.shell[0], w.shell[0], w.shell[1]);
  m.position.copy(g.userData.eject).applyMatrix4(g.matrixWorld);
  m.rotation.set(rand(0, 3), rand(0, 3), 0);
  wScene.add(m);
  shells.push({ m, life: 0.6, vel: new THREE.Vector3(rand(1.1, 1.6), rand(0.9, 1.4), rand(0.1, 0.5)), spin: new THREE.Vector3(rand(-20, 20), rand(-20, 20), rand(-6, 6)) });
  if (shells.length > 14) wScene.remove(shells.shift().m);
  Sound.brass();
}
function updateShells(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    s.life -= dt;
    if (s.life <= 0) { wScene.remove(s.m); shells.splice(i, 1); continue; }
    s.vel.y -= 7 * dt;
    s.m.position.addScaledVector(s.vel, dt);
    s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt; s.m.rotation.z += s.spin.z * dt;
  }
}

/* ============================================================
   Hit effects: tracers, bullet holes, dust and blood puffs
   ============================================================ */
const fx = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
function tracer(from, to, color, width = 0.012) {
  const len = from.distanceTo(to);
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.position.copy(from); m.lookAt(to); m.scale.set(width, width, len);
  scene.add(m);
  fx.push({ obj: m, life: 0.07, max: 0.07, kind: "tracer" });
}
const holeTex = canvasTex(64, (g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(20,14,8,1)"); grd.addColorStop(0.35, "rgba(40,28,16,.9)"); grd.addColorStop(0.6, "rgba(80,60,40,.35)"); grd.addColorStop(1, "rgba(80,60,40,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
});
const holeMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const holeGeo = new THREE.PlaneGeometry(0.13, 0.13);
const holes = [];
function decal(point, normal) {
  const m = new THREE.Mesh(holeGeo, holeMat);
  m.position.copy(point).addScaledVector(normal, 0.004);
  m.lookAt(point.clone().add(normal));
  m.rotateZ(Math.random() * 6.28);
  scene.add(m); holes.push(m);
  if (holes.length > 90) scene.remove(holes.shift());
}
const puffTex = canvasTex(64, (g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,255,255,.9)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
});
function puff(point, color, count, size) {
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color, transparent: true, depthWrite: false, opacity: 0.8 }));
    s.position.copy(point);
    s.scale.setScalar(size * rand(0.3, 0.6));
    scene.add(s);
    fx.push({ obj: s, life: rand(0.35, 0.6), max: 0.6, kind: "puff", size, vel: new THREE.Vector3(rand(-0.8, 0.8), rand(0.2, 1.4), rand(-0.8, 0.8)) });
  }
}
function clearHoles() { while (holes.length) scene.remove(holes.pop()); }
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) { scene.remove(f.obj); f.obj.material.dispose(); fx.splice(i, 1); continue; }
    const t = f.life / f.max;
    if (f.kind === "tracer") f.obj.material.opacity = t * 0.9;
    else {
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.scale.multiplyScalar(1 + dt * 2.2);
      f.obj.material.opacity = Math.min(0.8, t);
    }
  }
}

