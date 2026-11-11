/* ============================================================
   Player: state, weapon table, inventory, input and movement
   ============================================================ */
const EYE = 1.62, EYE_CROUCH = 1.1, P_RADIUS = 0.38, BASE_FOV = 74;
const player = {
  isPlayer: true, name: "You", team: "CT",
  pos: new THREE.Vector3(0, 0, 29), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
  onGround: true, crouch: 0, hp: 100, armor: 0, helmet: false, kit: false, alive: true, money: 800,
  kills: 0, deaths: 0, hs: 0, stepDist: 0, speed: 0, blindAt: -99, blindDur: 0, spottedUntil: 0, jumpReady: true, land: 0, bob: 0
};
const SENS = 0.0021;
const keys = Object.create(null);
let mouseDown = false, mouse2Down = false, pointerLocked = false;
let mouseDX = 0, mouseDY = 0;

/* ---------- weapons: numbers follow CS2 where it makes sense ----------
   dmg = body damage at 0 m, pen = share of damage that goes through armour,
   base/move/air = spread (radians) standing, running, airborne. */
const WEAPONS = {
  glock: { id: "glock", name: "Glock-18", slot: "secondary", price: 200, reward: 300, mag: 20, reserve: 120, rate: 0.15, auto: false,
    dmg: 30, pen: 0.47, falloff: 0.85, reload: 2.2, base: 0.0045, move: 0.035, air: 0.12, speedMul: 1, kick: 0.05, climb: 0.022, shell: [0.0048, 0.019] },
  deagle: { id: "deagle", name: "Desert Eagle", slot: "secondary", price: 700, reward: 300, mag: 7, reserve: 35, rate: 0.225, auto: false,
    dmg: 63, pen: 0.93, falloff: 0.81, reload: 2.2, base: 0.004, move: 0.07, air: 0.22, speedMul: 0.96, kick: 0.12, climb: 0.055, shell: [0.0065, 0.033] },
  ak47: { id: "ak47", name: "AK-47", slot: "primary", price: 2700, reward: 300, mag: 30, reserve: 90, rate: 0.1, auto: true, team: "T",
    dmg: 36, pen: 0.775, falloff: 0.98, reload: 2.45, base: 0.0028, move: 0.075, air: 0.18, speedMul: 0.9, kick: 0.05, climb: 0.021, shell: [0.0056, 0.039] },
  m4a4: { id: "m4a4", name: "M4A4", slot: "primary", price: 3100, reward: 300, mag: 30, reserve: 90, rate: 0.09, auto: true, team: "CT",
    dmg: 33, pen: 0.7, falloff: 0.97, reload: 3.0, base: 0.0024, move: 0.065, air: 0.17, speedMul: 0.93, kick: 0.04, climb: 0.018, shell: [0.0048, 0.045] },
  awp: { id: "awp", name: "AWP", slot: "primary", price: 4750, reward: 100, mag: 5, reserve: 30, rate: 1.46, auto: false,
    dmg: 115, pen: 0.975, falloff: 0.99, reload: 3.6, base: 0.085, scoped: 0.0006, move: 0.22, air: 0.35, speedMul: 0.83, kick: 0.15, climb: 0.05, shell: [0.0065, 0.062] },
  // left click slashes (40, 90 in the back), right click stabs (65, 180 in the back)
  knife: { id: "knife", name: "Knife", slot: "knife", price: 0, reward: 1500, mag: 0, reserve: 0, rate: 0.45, auto: true, melee: true,
    dmg: 40, heavy: 65, pen: 0.85, falloff: 1, reload: 0, base: 0.001, move: 0, air: 0, speedMul: 1.0, kick: 0, climb: 0, shell: [0, 0] },
  he: { id: "he", name: "HE Grenade", slot: "nade", price: 300, reward: 300, max: 1, nade: true, dmg: 98, pen: 0.5, falloff: 1,
    mag: 0, reserve: 0, rate: 0, auto: false, base: 0.001, move: 0, air: 0, speedMul: 1, kick: 0, climb: 0, shell: [0, 0] },
  flash: { id: "flash", name: "Flashbang", slot: "nade", price: 200, reward: 0, max: 2, nade: true, dmg: 0, pen: 1, falloff: 1,
    mag: 0, reserve: 0, rate: 0, auto: false, base: 0.001, move: 0, air: 0, speedMul: 1, kick: 0, climb: 0, shell: [0, 0] },
  smoke: { id: "smoke", name: "Smoke Grenade", slot: "nade", price: 300, reward: 0, max: 1, nade: true, dmg: 0, pen: 1, falloff: 1,
    mag: 0, reserve: 0, rate: 0, auto: false, base: 0.001, move: 0, air: 0, speedMul: 1, kick: 0, climb: 0, shell: [0, 0] }
};
const NADE_TYPES = ["he", "flash", "smoke"];
const SCOPE_FOV = [BASE_FOV, 40, 14];
const BOMB_WEAPON = { id: "c4", name: "C4", reward: 0, pen: 1 };

// Inventory: primary, pistol, knife and a grenade slot. Each gun remembers its own ammo.
const arms = {
  primary: null, secondary: { id: "glock", ammo: 20, reserve: 120 }, knife: { id: "knife", ammo: 0, reserve: 0 }, nade: null,
  nades: { he: 0, flash: 0, smoke: 0 },
  current: "secondary", last: "primary",
  nextFire: 0, reloadStart: 0, reloadEnd: 0, reloading: false, switchEnd: 0,
  shots: 0, lastShot: 0, recoilP: 0, recoilY: 0, triggerHeld: false,
  scope: 0, rescope: 0, inspectStart: -99, boltStart: -99, slideKick: -99,
  swingStart: -99, swingHeavy: false, pin: 0, throwStart: -99
};
const slotOf = (s = arms.current) => arms[s];
const curW = () => WEAPONS[arms[arms.current].id];
// the best thing left in your hands: main gun, else pistol, else the knife
const bestSlot = () => (arms.primary ? "primary" : arms.secondary ? "secondary" : "knife");

function giveWeapon(id) {
  const w = WEAPONS[id];
  arms[w.slot] = { id, ammo: w.mag, reserve: w.reserve };
  equip(w.slot, false, true);
}
function giveNade(id) {
  arms.nades[id]++;
  if (arms.current !== "nade") arms.nade = { id, ammo: 0, reserve: 0 };
  HUD.ammo();
}
// pick the grenade to hold: keep the current type if any are left, else the next one
function nextNadeType(from) {
  const start = Math.max(0, NADE_TYPES.indexOf(from));
  for (let i = 0; i < NADE_TYPES.length; i++) {
    const t = NADE_TYPES[(start + i) % NADE_TYPES.length];
    if (arms.nades[t] > 0) return t;
  }
  return null;
}
function equipNade() {
  if (arms.current === "nade" && arms.nade) {
    // pressing 4 again cycles through the grenade types you carry
    const i = NADE_TYPES.indexOf(arms.nade.id);
    for (let k = 1; k <= NADE_TYPES.length; k++) {
      const t = NADE_TYPES[(i + k) % NADE_TYPES.length];
      if (arms.nades[t] > 0 && t !== arms.nade.id) { arms.nade = { id: t, ammo: 0, reserve: 0 }; equip("nade", false, true); return; }
    }
    return;
  }
  const t = nextNadeType(arms.nade && arms.nade.id);
  if (!t) { HUD.hint("No grenades. Buy them with B", 1600); return; }
  arms.nade = { id: t, ammo: 0, reserve: 0 };
  equip("nade");
}
// round start: keep what you carried, refill every magazine
function refillArms() {
  for (const s of ["primary", "secondary"]) {
    const a = arms[s]; if (!a) continue;
    const w = WEAPONS[a.id]; a.ammo = w.mag; a.reserve = w.reserve;
  }
  arms.recoilP = arms.recoilY = 0; arms.shots = 0; arms.pin = 0;
  const t = nextNadeType(); arms.nade = t ? { id: t, ammo: 0, reserve: 0 } : null;
  equip(bestSlot(), true, true);
}
// dying costs you your guns, grenades and armour
function stripArms() {
  arms.primary = null; arms.secondary = { id: "glock", ammo: 20, reserve: 120 }; arms.nade = null;
  arms.nades.he = arms.nades.flash = arms.nades.smoke = 0;
  player.armor = 0; player.helmet = false; player.kit = false;
}

/* ---------- input ---------- */
document.addEventListener("keydown", (e) => {
  if (e.code === "Tab") { e.preventDefault(); document.body.classList.add("tab"); }
  if (e.code === "Space" && pointerLocked) e.preventDefault();
  keys[e.code] = true;
  if (!Game.active() || e.repeat) return;
  if (e.code === "KeyM") { HUD.toggleMap(); return; }
  if (e.code === "KeyB") { Buy.toggle(); return; }
  if (Buy.open) {
    const n = e.code === "Digit0" ? 10 : +e.code.replace("Digit", "");
    if (n >= 1 && n <= 10) Buy.choose(n);
    if (e.code === "Escape") Buy.close();
    return;
  }
  if (!player.alive) return;
  if (e.code === "KeyR") startReload();
  if (e.code === "KeyF") startInspect();
  if (e.code === "Digit1") equip("primary");
  if (e.code === "Digit2") equip("secondary");
  if (e.code === "Digit3") equip("knife");
  if (e.code === "Digit4") equipNade();
  if (e.code === "KeyQ") equip(arms.last);
  if (e.code === "KeyG") Drops.playerDrop();
  // E swaps for a gun on the ground (planting and defusing take priority)
  if (e.code === "KeyE" && Drops.use()) keys.KeyE = false;
});
document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "Tab") document.body.classList.remove("tab");
});
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; mouseDown = mouse2Down = false; document.body.classList.remove("tab"); });
document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  mouseDX += e.movementX || 0; mouseDY += e.movementY || 0;
});
document.addEventListener("mousedown", (e) => {
  if (!pointerLocked) return;
  if (!player.alive && Game.inMatch()) { if (e.button === 0) Game.nextSpec(); return; }
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) {
    mouse2Down = true;
    if (Game.active() && curW().id === "awp") cycleScope();
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0) { mouseDown = false; arms.triggerHeld = false; }
  if (e.button === 2) mouse2Down = false;
});
document.addEventListener("contextmenu", (e) => { if (pointerLocked) e.preventDefault(); });

/* ---------- movement ---------- */
function applyLook() {
  const z = camera.fov / SCOPE_FOV[0];               // slower look when zoomed in
  const s = SENS * SETTINGS.sens * z * (z < 0.99 ? SETTINGS.zsens : 1);
  player.yaw -= mouseDX * s;
  player.pitch = clamp(player.pitch - mouseDY * s * (SETTINGS.invert ? -1 : 1), -1.5, 1.5);
  VM.lastDX = mouseDX; VM.lastDY = mouseDY;
  mouseDX = mouseDY = 0;
}
// movement tuning, after Counter-Strike's sv_friction 5.2, sv_accelerate 5.5, sv_stopspeed 80, sv_airaccelerate 12
const MOVE = { friction: 5.2, accel: 5.5, stop: 2.0, airAccel: 12, airWish: 0.8 };
function accelerate(v, wx, wz, wish, amount) {
  const add = wish - (v.x * wx + v.z * wz);
  if (add <= 0) return;
  const a = Math.min(amount, add);
  v.x += wx * a; v.z += wz * a;
}
function updatePlayer(dt) {
  applyLook();
  const busy = Bomb.playerBusy();                    // planting or defusing roots you to the spot
  const live = Game.state === "live" && player.alive && !busy;
  const crouching = (!!keys.KeyC || busy) && player.alive;
  const walking = !!(keys.ShiftLeft || keys.ShiftRight);
  player.crouch += ((crouching ? 1 : 0) - player.crouch) * Math.min(1, dt * 9);

  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  let wx = 0, wz = 0;
  if (live) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    wx = fx * f + rx * s; wz = fz * f + rz * s;
    const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
  }
  const mul = arms.scope ? 0.45 : curW().speedMul;
  const max = (crouching ? 2.0 : walking ? 2.6 : 5.4) * mul;
  const v = player.vel;
  // Counter-Strike style: friction slows you, acceleration only adds speed along where you want to go.
  // Letting go of the keys glides you to a stop; pressing the opposite key (counter-strafe) stops you dead.
  if (player.onGround) {
    const sp = Math.hypot(v.x, v.z);
    if (sp > 0) {
      // the stop-speed floor only applies when gliding to a halt, so slow walks (crouch, scoped) still reach full speed
      const drop = (wx || wz ? sp : Math.max(sp, MOVE.stop)) * MOVE.friction * dt, ns = Math.max(0, sp - drop) / sp;
      v.x *= ns; v.z *= ns;
    }
    if (wx || wz) accelerate(v, wx, wz, max, MOVE.accel * max * dt);
    else if (Math.hypot(v.x, v.z) < 0.05) v.x = v.z = 0;
    if (live && keys.Space && player.jumpReady) { v.y = 6.1; player.onGround = false; player.jumpReady = false; }
  } else if (wx || wz) {
    // air strafing: a little control in the air, never faster than a running jump
    accelerate(v, wx, wz, Math.min(max, MOVE.airWish), MOVE.airAccel * max * dt);
    const hs = Math.hypot(v.x, v.z), cap = Math.max(max, 5.4) * 1.08;
    if (hs > cap) { v.x *= cap / hs; v.z *= cap / hs; }
  }
  if (!keys.Space) player.jumpReady = true;
  v.y -= 20 * dt;
  const p = player.pos;
  p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
  // stand on crates and low walls you land on
  let floor = 0;
  for (const c of colliders) {
    if (c.maxY > 1.6 || p.x < c.minX - 0.2 || p.x > c.maxX + 0.2 || p.z < c.minZ - 0.2 || p.z > c.maxZ + 0.2) continue;
    if (p.y >= c.maxY - 0.25) floor = Math.max(floor, c.maxY);
  }
  if (p.y <= floor) {
    if (!player.onGround) {
      // landing: the view dips with the impact; a hard landing costs you some speed
      const hit = clamp((-v.y - 2) / 9, 0, 1);
      player.land = Math.max(player.land || 0, hit);
      if (v.y < -2.5) Sound.land(hit);
      if (v.y < -4) { v.x *= 0.8; v.z *= 0.8; }
    }
    p.y = floor; v.y = 0; player.onGround = true;
  } else if (player.onGround && p.y > floor + 0.05) player.onGround = false;
  const eye = EYE - (EYE - EYE_CROUCH) * player.crouch;
  collideCircle(p, P_RADIUS, p.y + 0.05, p.y + eye + 0.1);
  p.x = clamp(p.x, -31.5, 31.5); p.z = clamp(p.z, -31.5, 31.5);

  player.speed = Math.hypot(v.x, v.z);
  // footsteps: running is loud, walking (Shift) and crouching are silent, like in CS
  if (player.onGround) {
    player.stepDist += player.speed * dt;
    player.bob = (player.bob || 0) + player.speed * dt * Math.PI / 2.3;    // one bob per footstep
    if (player.stepDist > 2.3) {
      player.stepDist = 0;
      if (player.speed > 3.4 && player.crouch < 0.5) { Sound.step(0, 0, 0.55); Bots.hear(p, 0.45, player.team); }
    }
  }
  player.land = Math.max(0, (player.land || 0) - dt * 3.2);

  // recoil recovery once the trigger is released
  const now = performance.now() / 1000;
  if (now - arms.lastShot > 0.12) {
    const k = Math.exp(-dt * 7);
    arms.recoilP *= k; arms.recoilY *= k;
    if (now - arms.lastShot > 0.4) arms.shots = 0;
  }
  // a light head bob while running and the landing dip
  const run = player.onGround ? clamp((player.speed - 1) / 4.4, 0, 1) : 0;
  const landDip = Math.sin(Math.min(1, player.land) * Math.PI) * 0.09 * Math.min(1, player.land * 2);
  camera.position.set(p.x, p.y + eye - Math.abs(Math.sin(player.bob || 0)) * 0.014 * run - landDip, p.z);
  camera.rotation.set(player.pitch + arms.recoilP, player.yaw + arms.recoilY, 0);
}
