/* ============================================================
   Bot body animation on the soldier rig (g07a_models.js):
   walk/run cycle driven by the real ground speed, strafing steps,
   stepping round when turning on the spot, crouching, kneeling to
   plant or defuse, bending at the waist to aim up or down, and a
   fall when they die whose direction depends on the killing shot.
   ============================================================ */
const BotAnim = (() => {
  const THIGH = 0.44, SHIN = 0.465, LEG = THIGH + SHIN, STRIDE = 4.3;   // STRIDE: gait phase (radians) per metre
  // height of the hip joint above the sole: thigh angle (forward +), knee bend (negative), sideways swing
  const legH = (t, k, z) => (THIGH * Math.cos(t) + SHIN * Math.cos(t + k)) * Math.cos(z);
  const damp = (cur, want, rate, dt) => cur + (want - cur) * Math.min(1, rate * dt);
  const mix = (a, b, k) => a + (b - a) * k;
  const seg01 = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
  const L = [0, 0, 0], K = [0, 0, 0], Z = [0, 0, 0];

  // fresh state at spawn: standing straight
  function reset(b) {
    const g = b.group;
    b.an = { lx: g.position.x, lz: g.position.z, spd: 0, fwd: 1, side: 0, ph: b.phase || 0, lastYaw: b.yaw, turn: 0,
      crouch: 0, kneel: 0, pitch: 0, die: null };
    g.position.y = 0; g.rotation.set(0, b.yaw, 0);
    b.hips.position.set(0, 0, 0); b.hips.rotation.set(0, 0, 0); b.upper.rotation.set(0, 0, 0);
    for (let i = 0; i < 2; i++) { b.legs[i].rotation.set(0, 0, 0); b.shins[i].rotation.set(0, 0, 0); }
    b.limpArms.visible = false;
  }

  function setLegs(b) {
    for (let i = 0; i < 2; i++) { b.legs[i].rotation.set(L[i], 0, Z[i]); b.shins[i].rotation.x = K[i]; }
    // the lower of the two feet stays on the ground
    b.hips.position.y = Math.max(legH(L[0], K[0], Z[0]), legH(L[1], K[1], Z[1])) - LEG;
  }

  /* ctx: { kneel, crouch, pitch, typing }. Returns true on the frame a foot comes down. */
  function pose(b, dt, now, ctx) {
    const a = b.an, g = b.group, p = g.position;
    if (!a || dt <= 0) return false;
    const vx = (p.x - a.lx) / dt, vz = (p.z - a.lz) / dt;
    a.lx = p.x; a.lz = p.z;
    let sp = Math.hypot(vx, vz);
    if (sp > 12) sp = 0;                       // teleported (spawn)
    a.spd = damp(a.spd, sp, 10, dt);
    // which way the feet travel compared with where the body faces (forward is -Z)
    const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
    if (sp > 0.3) {
      a.fwd = damp(a.fwd, (-vx * s - vz * c) / sp, 9, dt);
      a.side = damp(a.side, (vx * c - vz * s) / sp, 9, dt);
    }
    a.turn = damp(a.turn, Math.abs(wrapAngle(b.yaw - a.lastYaw)) / dt, 8, dt);
    a.lastYaw = b.yaw;
    a.crouch = damp(a.crouch, ctx.crouch && !ctx.kneel ? 1 : 0, 9, dt);
    a.kneel = damp(a.kneel, ctx.kneel ? 1 : 0, 7, dt);

    // gait: amplitude follows the ground speed; turning on the spot shuffles the feet
    let amp = Math.min(1.15, a.spd / 3.2), fwd = a.fwd, side = a.side;
    const shuffle = a.spd < 0.4 && a.turn > 1.2 ? Math.min(0.45, a.turn * 0.12) : 0;
    if (shuffle > amp) { amp = shuffle; fwd = 0.3; side = 0.9; }
    amp *= 1 - 0.45 * a.crouch;
    const before = Math.floor(a.ph / Math.PI);
    a.ph += (sp * STRIDE + (shuffle ? a.turn * 1.6 : 0)) * dt;
    const stepped = amp > 0.15 && Math.floor(a.ph / Math.PI) !== before;
    if (amp < 0.05) a.ph = Math.round(a.ph / Math.PI) * Math.PI;   // stop with the feet together

    for (let i = 0; i < 2; i++) {
      const ph = a.ph + i * Math.PI, sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
      let t = sw * fwd * amp * 0.44, z = sw * side * amp * 0.2;
      let k = -(0.1 + (0.35 + 0.6 * Math.abs(fwd)) * lift) * amp;
      t += a.crouch * 0.95; k -= a.crouch * 1.5;
      // kneeling: left foot planted forward, right knee on the ground
      const kt = i === 0 ? 1.48 : 0.1, kk = i === 0 ? -1.48 : -1.62;
      L[i] = mix(t, kt, a.kneel); K[i] = mix(k, kk, a.kneel); Z[i] = z * (1 - a.kneel);
    }
    setLegs(b);

    // pelvis swings with the stride, shoulders counter-rotate, chest leans into a run
    const sw0 = Math.sin(a.ph), twist = sw0 * 0.07 * amp * fwd * (1 - a.kneel);
    b.hips.rotation.y = twist;
    a.pitch = damp(a.pitch, clamp(ctx.pitch || 0, -0.55, 0.55), 8, dt);
    let lean = -0.07 * Math.min(1, a.spd / 4) * fwd - 0.18 * a.crouch - 0.62 * a.kneel;
    if (ctx.typing) lean += Math.sin(now * 13) * 0.025;
    b.upper.rotation.set(a.pitch * (1 - a.kneel) + lean, -twist * 1.7, sw0 * 0.025 * amp * side);
    return stepped;
  }

  /* ---------- dying ---------- */
  // pick the fall from where the killing shot came from
  function die(b) {
    const g = b.group, k = b.killer && b.killer !== b ? entPos(b.killer) : null;
    const rel = k ? wrapAngle(Math.atan2(-(k.x - g.position.x), -(k.z - g.position.z)) - b.yaw) : rand(-Math.PI, Math.PI);
    let type;
    if (b.deathHead && Math.random() < 0.6) type = "crumple";
    else if (Math.abs(rel) < 0.85) type = "back";       // shot from the front: knocked over backwards
    else if (Math.abs(rel) > 2.3) type = "front";       // from behind: pitches onto the face
    else type = "side";
    // a shot from the left (rel > 0) throws the body to the right (negative roll)
    const dir = Math.abs(rel) > 0.2 ? (rel > 0 ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;
    if (!b.an) reset(b);
    b.an.die = { type, dir, t: 0, yaw0: b.yaw, twist: rand(-0.45, 0.45) };
    for (const id in b.guns) b.guns[id].visible = false;
    b.rifleArms.visible = b.pistolArms.visible = false; b.limpArms.visible = true;
    b.tag.visible = false;
  }
  // legs buckle, then the body tips over and settles with a small bounce.
  // A headshot crumples: knees go first, then the body slumps over sideways.
  const BUCKLE = { back: [0.35, -0.8], front: [0.6, -1.2], side: [0.45, -0.95], crumple: [1.5, -2.4] };
  const KEEP = { back: 0, front: 0, side: 0.35, crumple: 0.75 };   // how bent the legs stay once down
  function dead(b, dt) {
    const d = b.an && b.an.die;
    if (!d || d.t > 1.6) return;
    d.t += dt;
    const t = d.t, g = b.group, crum = d.type === "crumple";
    const t0 = crum ? 0.32 : 0.08, dur = crum ? 0.5 : 0.55;
    const x = seg01(t, t0, t0 + dur), f = x * x;                  // falls faster and faster
    const land = seg01(t, t0 + dur, t0 + dur + 0.28);
    const angle = Math.PI / 2 * f - (land > 0 && land < 1 ? Math.sin(land * Math.PI) * 0.07 : 0);
    const bk = seg01(t, 0, crum ? 0.32 : 0.22), [bt, bkn] = BUCKLE[d.type];
    const bend = bk * (1 - (1 - KEEP[d.type]) * f);
    for (let i = 0; i < 2; i++) { L[i] = bt * bend * (i ? 0.85 : 1); K[i] = bkn * bend * (i ? 1.1 : 1); Z[i] = 0; }
    setLegs(b);
    // the waist whips mid-fall and is flat again on the floor
    const whip = Math.sin(x * Math.PI);
    let rx = 0, rz = 0, bend2 = 0;
    if (d.type === "back") { rx = angle; bend2 = 0.35 * whip; }
    else if (d.type === "front") { rx = -angle; bend2 = -0.3 * whip; }
    else { rz = d.dir * angle; bend2 = crum ? -0.4 * bk * (1 - f) - 0.25 * f : -0.1 * whip; }
    b.upper.rotation.set(bend2, 0, rz ? -d.dir * 0.12 * f : 0);
    g.rotation.set(rx, d.yaw0 + d.twist * f, rz);
    // keep the body's thickness above the floor once it lies down
    g.position.y = Math.sin(angle) * (rz ? 0.24 : 0.14);
  }
  return { reset, pose, die, dead, legH };
})();
