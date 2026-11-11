/* ============================================================
   The bomb: carried by a T, planted on A or B (hold E, 3.2 s),
   40 s fuse, defused by a CT (hold E, 10 s or 5 s with a kit)
   ============================================================ */
const BOMB_TIME = 40, PLANT_TIME = 3.2, DEFUSE_TIME = 10, KIT_TIME = 5, BOMB_RADIUS = 22;

const Bomb = (() => {
  const mesh = buildC4();
  mesh.scale.setScalar(1.3);
  mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  mesh.visible = false; scene.add(mesh);
  const led = mesh.userData.led;
  // the brick a bot carries on its back
  const back = buildC4();
  back.scale.setScalar(1.2); back.rotation.set(-Math.PI / 2, 0, 0); back.position.set(0, 1.28, 0.2);
  const glow = new THREE.PointLight(0xff2a1a, 0, 3, 2);
  scene.add(glow);
  let ledOff = 0, hintAt = 0;

  const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function place(x, y, z, yaw) {
    mesh.position.set(x, y, z); mesh.rotation.set(0, yaw === undefined ? rand(0, 6.28) : yaw, 0); mesh.visible = true;
    glow.position.set(x, y + 0.3, z);
  }
  function give(e) {
    B.state = "carried"; B.carrier = e; mesh.visible = false;
    if (back.parent) back.parent.remove(back);
    if (!e.isPlayer) (e.torso || e.group).add(back);
    else HUD.hint("You have the bomb: hold E on site A or B to plant. G drops it", 4500);
    HUD.bomb();
  }

  const B = {
    state: "none", carrier: null, pos: new THREE.Vector3(), site: null, plantedAt: 0, act: null, nextBeep: 0, dropper: null, dropAt: 0,
    reset() {
      B.clear();
      // you get the bomb when you play T, otherwise a random T bot carries it
      const ts = teamAlive("T");
      const c = ts.includes(player) ? player : ts[Math.floor(Math.random() * ts.length)];
      if (c) give(c);
    },
    clear() {
      if (B.act && !B.act.ent.isPlayer) B.act.ent.busy = false;
      Object.assign(B, { state: "none", carrier: null, site: null, act: null, dropper: null });
      mesh.visible = false; glow.intensity = 0;
      if (back.parent) back.parent.remove(back);
      HUD.bomb();
    },
    drop(e, thrown) {
      if (B.state !== "carried" || B.carrier !== e || (B.act && B.act.ent === e)) return;
      if (!Game.inMatch() || Game.state === "end") return;
      const p = entPos(e);
      let x = p.x, z = p.z;
      if (thrown) {
        const fx = x - Math.sin(e.yaw) * 1.6, fz = z - Math.cos(e.yaw) * 1.6;
        if (NAV.free(fx, fz) && lineClear(new THREE.Vector3(x, 0.4, z), new THREE.Vector3(fx, 0.4, fz))) { x = fx; z = fz; }
      }
      B.state = "dropped"; B.carrier = null; B.dropper = e; B.dropAt = Game.time;
      B.pos.set(x, 0, z);
      if (back.parent) back.parent.remove(back);
      place(x, 0.04, z);
      if (e.isPlayer && thrown) HUD.hint("Bomb dropped", 1200);
      else if (player.team === "T") HUD.hint("The bomb has been dropped", 2000);
      HUD.bomb();
    },
    onDeath(v) {
      if (B.act && B.act.ent === v) B.cancel(v);
      if (B.carrier === v) B.drop(v, false);
    },
    startPlant(e) {
      if (B.act || B.state !== "carried" || B.carrier !== e || Game.state !== "live") return false;
      const p = entPos(e);
      if (!siteAt(p.x, p.z)) return false;
      B.act = { ent: e, kind: "plant", start: Game.time, dur: PLANT_TIME, tick: 0, spot: plantSpot(e), yaw: e.yaw, shown: false };
      if (!e.isPlayer) e.busy = true; else arms.pin = 0;
      return true;
    },
    startDefuse(e) {
      if (B.act || B.state !== "planted" || e.team !== "CT" || Game.state !== "live") return false;
      if (dist2d(entPos(e), B.pos) > 1.8) return false;
      B.act = { ent: e, kind: "defuse", start: Game.time, dur: e.kit ? KIT_TIME : DEFUSE_TIME, tick: 0 };
      if (!e.isPlayer) e.busy = true; else arms.pin = 0;
      if (e.isPlayer && !e.kit) HUD.hint("Defusing without a kit takes 10 seconds", 1800);
      return true;
    },
    cancel(e) {
      if (!B.act || B.act.ent !== e) return;
      const A = B.act;
      B.act = null;
      if (!e.isPlayer) e.busy = false;
      // a half-planted bomb goes back on the planter's back
      if (A.kind === "plant" && B.state === "carried") {
        mesh.visible = false;
        if (!e.isPlayer && B.carrier === e) (e.torso || e.group).add(back);
      }
    },
    playerBusy() { return !!(B.act && B.act.ent === player); },
    timeLeft() { return B.state === "planted" ? Math.max(0, BOMB_TIME - (Game.time - B.plantedAt)) : BOMB_TIME; },
    actLeft() { return B.act ? Math.max(0, B.act.dur - (Game.time - B.act.start)) : 0; },
    // for the HUD bar: what you are doing and how far along
    progress() { return B.act && B.act.ent === player ? { kind: B.act.kind, p: clamp((Game.time - B.act.start) / B.act.dur, 0, 1), left: B.actLeft() } : null; },

    update(dt) {
      const now = Game.time;
      if (Game.state !== "live") return;
      // you: hold E to plant or defuse, let go to stop
      if (player.alive) {
        const holding = !!keys.KeyE && !Buy.open;
        if (holding && !B.act) {
          if (B.carrier === player) {
            if (!player.onGround) { /* jumping */ }
            else if (siteAt(player.pos.x, player.pos.z)) B.startPlant(player);
            else if (now > hintAt) { HUD.hint("You can only plant on site A or B", 1500); hintAt = now + 2; }
          } else if (player.team === "CT" && B.state === "planted") {
            if (dist2d(player.pos, B.pos) <= 1.8) B.startDefuse(player);
            else if (now > hintAt && dist2d(player.pos, B.pos) < 5) { HUD.hint("Get closer to the bomb", 1200); hintAt = now + 1.5; }
          }
        }
        if (!holding && B.act && B.act.ent === player) B.cancel(player);
      }
      // anyone alive on T picks a dropped bomb up by walking over it
      if (B.state === "dropped") {
        for (const e of teamAlive("T")) {
          if (e === B.dropper && now - B.dropAt < 1.5) continue;
          if (dist2d(entPos(e), B.pos) < 1.1) { give(e); if (e.isPlayer) Sound.buy(true); break; }
        }
      }
      const A = B.act;
      if (A) {
        if (!A.ent.alive) B.cancel(A.ent);
        else {
          const close = A.ent.isPlayer || entPos(A.ent).distanceTo(camera.position) < 18;
          if (now >= A.tick) { if (close) (A.kind === "plant" ? Sound.plantTick() : Sound.defuseTick()); A.tick = now + (A.kind === "plant" ? 0.42 : 0.85); }
          // a kneeling bot takes the bomb off its back and lays it down in front of it
          if (A.kind === "plant" && !A.ent.isPlayer && !A.shown && now - A.start > 0.55) {
            A.shown = true;
            if (back.parent) back.parent.remove(back);
            place(A.spot.x, A.spot.y + 0.04, A.spot.z, A.yaw); led.visible = false;
          }
          if (now - A.start >= A.dur) { if (A.kind === "plant") plant(A.ent); else defuse(A.ent); }
        }
      }
      if (B.state === "planted") {
        const left = B.timeLeft();
        if (now >= B.nextBeep) {
          Sound.beep(left < 10);
          B.nextBeep = now + 0.12 + 0.88 * Math.pow(left / BOMB_TIME, 1.3);
          led.visible = true; glow.intensity = 1.6; ledOff = now + 0.09;
        } else if (now > ledOff) { led.visible = false; glow.intensity = 0; }
        if (left <= 0) explode();
      }
    }
  };

  // where the bomb goes: on the floor just in front of the planter, if that is still on the site
  function plantSpot(e) {
    const p = entPos(e), y = e.isPlayer ? player.pos.y : 0;
    const x = p.x - Math.sin(e.yaw) * 0.55, z = p.z - Math.cos(e.yaw) * 0.55;
    const ok = NAV.free(x, z) && siteAt(x, z) && Math.abs(Drops.floorAt(x, z, y + 0.3) - y) < 0.1 &&
      lineClear(new THREE.Vector3(p.x, y + 0.3, p.z), new THREE.Vector3(x, y + 0.3, z));
    return ok ? new THREE.Vector3(x, y, z) : new THREE.Vector3(p.x, y, p.z);
  }
  function plant(e) {
    const p = entPos(e), A = B.act, sp = A && A.spot ? A.spot : new THREE.Vector3(p.x, e.isPlayer ? player.pos.y : 0, p.z);
    B.act = null; if (!e.isPlayer) e.busy = false;
    B.state = "planted"; B.carrier = null; B.site = siteAt(sp.x, sp.z) || siteAt(p.x, p.z) || (dist2d(p, SITES.A) < dist2d(p, SITES.B) ? SITES.A : SITES.B);
    B.plantedAt = Game.time; B.nextBeep = Game.time; B.planter = e;
    B.pos.copy(sp);
    if (back.parent) back.parent.remove(back);
    place(sp.x, sp.y + 0.04, sp.z, A ? A.yaw : undefined);
    Economy.add(e, 300, "Planted the bomb");
    Sound.announce("planted");
    HUD.banner("Bomb planted", `Site ${B.site.id}`, "bomb");
    setTimeout(() => { if (B.state === "planted" && Game.state === "live") HUD.banner(""); }, 1800);
    if (e.isPlayer) equip(bestSlot());
    HUD.bomb();
  }
  function defuse(e) {
    B.act = null; if (!e.isPlayer) e.busy = false;
    B.state = "defused"; led.visible = false; glow.intensity = 0;
    Economy.add(e, 300, "Defused the bomb");
    Sound.announce("defused");
    Game.endRound("CT", e.isPlayer ? "You defused the bomb" : `${e.name} defused the bomb`, "defuse");
    HUD.bomb();
  }
  function explode() {
    const p = B.pos.clone();
    B.state = "exploded"; mesh.visible = false; glow.intensity = 0;
    Game.endRound("T", "The bomb exploded", "bomb");
    const d0 = p.distanceTo(camera.position);
    Sound.boom(d0, relPan(p), true);
    puff(p.clone().setY(1), 0xffc27a, 14, 6);
    puff(p.clone().setY(1.5), 0x5a4c3e, 18, 8);
    Game.shake = Math.max(Game.shake, clamp(0.14 * (1 - d0 / 60), 0.02, 0.14));
    for (const e of allEnts()) {
      if (!e.alive) continue;
      const d = entChest(e).distanceTo(p);
      if (d < BOMB_RADIUS) hurt(e, 500 * Math.pow(1 - d / BOMB_RADIUS, 2), "body", BOMB_WEAPON, null);
    }
    HUD.bomb();
  }
  return B;
})();
