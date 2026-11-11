/* ============================================================
   Weapons on the ground. A dead player's or bot's best gun falls
   where they died; G throws your own gun. Walk over a gun to take
   it when that slot is empty, or press E to swap. Bots pick up
   better guns they pass. The ground is cleared every round.
   ============================================================ */
const Drops = (() => {
  const list = [];
  const MAX = 24;
  let hintAt = 0, hintTxt = "";

  // the highest walkable surface under (x, z) at or below height y
  function floorAt(x, z, y) {
    let f = 0;
    for (const c of colliders) {
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      if (c.maxY <= y + 0.02 && c.maxY > f) f = c.maxY;
    }
    return f;
  }

  function spawn(id, ammo, reserve, pos, vel, by) {
    const w = WEAPONS[id];
    if (!w || w.melee || w.nade) return null;
    const root = new THREE.Group(), gun = worldGun(id);
    root.add(gun);
    root.position.copy(pos);
    root.rotation.y = rand(0, 6.28);
    scene.add(root);
    const d = { id, ammo, reserve, root, gun, vel: vel.clone(), spin: new THREE.Vector3(rand(-9, 9), rand(-4, 4), rand(-9, 9)),
      landed: false, by, at: Game.time, claim: null, claimT: 0, badUntil: 0 };
    list.push(d);
    while (list.length > MAX) remove(list[0]);
    return d;
  }
  function remove(d) {
    const i = list.indexOf(d);
    if (i >= 0) list.splice(i, 1);
    scene.remove(d.root);
  }
  function clear() { while (list.length) remove(list[0]); }

  // a gun leaves somebody's hands: tossed forward (G) or flung by the killing hit
  function throwFrom(e, id, ammo, reserve, dir, power) {
    const p = entPos(e), y = e.isPlayer ? camera.position.y - 0.45 : p.y + 1.15;
    const v = new THREE.Vector3(dir.x * power, 1.6 + Math.random() * 0.8, dir.z * power);
    return spawn(id, ammo, reserve, new THREE.Vector3(p.x + dir.x * 0.35, y, p.z + dir.z * 0.35), v, e);
  }
  function onDeath(v) {
    let id, ammo, reserve;
    if (v.isPlayer) {
      const a = arms.primary || arms.secondary;
      if (!a) return;
      ({ id, ammo, reserve } = a);
    } else {
      id = v.primary || v.secondary;
      if (!id) return;
      ammo = WEAPONS[id].mag; reserve = WEAPONS[id].reserve;
    }
    // fling it the way the bullet was going
    const p = entPos(v), f = v.killer && v.killer !== v ? entPos(v.killer) : null;
    let dx = f ? p.x - f.x : rand(-1, 1), dz = f ? p.z - f.z : rand(-1, 1);
    const l = Math.hypot(dx, dz) || 1;
    throwFrom(v, id, ammo, reserve, { x: dx / l, z: dz / l }, rand(1.2, 2.2));
  }

  /* ---------- you ---------- */
  // G: throw the gun in your hands; with the knife or a grenade out, G drops the bomb
  function playerDrop() {
    const slot = arms.current;
    if (slot !== "primary" && slot !== "secondary") { Bomb.drop(player, true); return; }
    const a = arms[slot];
    if (!a || !Game.inMatch() || Game.state === "over") return;
    camera.getWorldDirection(_dv);
    const l = Math.hypot(_dv.x, _dv.z) || 1;
    throwFrom(player, a.id, a.ammo, a.reserve, { x: _dv.x / l, z: _dv.z / l }, 4.2);
    arms[slot] = null;
    Sound.foley("drop");
    equip(bestSlot(), false, true);
  }
  const _dv = new THREE.Vector3();
  function take(e, d) {
    remove(d);
    if (e.isPlayer) {
      const w = WEAPONS[d.id];
      arms[w.slot] = { id: d.id, ammo: d.ammo, reserve: d.reserve };
      equip(w.slot, false, true);
      Sound.foley("pickup");
      HUD.hint(`Picked up the ${w.name}`, 1200);
    }
  }
  // the gun you are looking at (or standing on), within reach
  function facing() {
    camera.getWorldDirection(_dv);
    let best = null, bs = -1;
    for (const d of list) {
      if (!d.landed && d.root.position.y > player.pos.y + 0.6) continue;
      const dx = d.root.position.x - player.pos.x, dz = d.root.position.z - player.pos.z, dist = Math.hypot(dx, dz);
      if (dist > 1.8) continue;
      const dot = dist < 0.6 ? 1 : (dx * _dv.x + dz * _dv.z) / (dist * (Math.hypot(_dv.x, _dv.z) || 1));
      if (dot < 0.5) continue;
      const score = dot - dist * 0.2;
      if (score > bs) { bs = score; best = d; }
    }
    return best;
  }
  // E pressed: swap for the gun in front of you. Returns true if it used the key.
  function use() {
    if (!player.alive || !Game.inMatch()) return false;
    // planting and defusing come first
    if (Bomb.carrier === player && siteAt(player.pos.x, player.pos.z)) return false;
    if (player.team === "CT" && Bomb.state === "planted" && Math.hypot(player.pos.x - Bomb.pos.x, player.pos.z - Bomb.pos.z) <= 1.8) return false;
    const d = facing();
    if (!d) return false;
    const w = WEAPONS[d.id], old = arms[w.slot];
    if (old) {
      throwFrom(player, old.id, old.ammo, old.reserve, { x: rand(-0.3, 0.3), z: rand(-0.3, 0.3) }, 0.6);
      arms[w.slot] = null;
    }
    take(player, d);
    return true;
  }

  /* ---------- bots ---------- */
  const better = (b, id) => {
    const w = WEAPONS[id];
    if (w.slot === "primary") return !b.primary || w.price > WEAPONS[b.primary].price;
    return !b.primary && w.price > WEAPONS[b.secondary || "glock"].price;
  };
  // a better gun close by that this bot should walk over and take
  function botGoal(b) {
    if (b.busy || Bomb.carrier === b && Brain().executing) return null;
    let best = null, bd = 9;
    const p = b.group.position, now = Game.time;
    for (const d of list) {
      // a claim lapses when its bot stops walking to it (a fight, death, or no path)
      if (!d.landed || now < d.badUntil || (d.claim && d.claim !== b && d.claim.alive && now - d.claimT < 0.5)) continue;
      if (d.by === b && Game.time - d.at < 3) continue;
      const dist = Math.hypot(d.root.position.x - p.x, d.root.position.z - p.z);
      if (dist < bd && better(b, d.id)) { bd = dist; best = d; }
    }
    if (best) { best.claim = b; best.claimT = now; }
    return best;
  }
  function botTake(b, d) {
    const w = WEAPONS[d.id];
    const old = w.slot === "primary" ? b.primary : b.secondary;
    if (old) {
      const yaw = b.yaw + rand(-0.5, 0.5);
      throwFrom(b, old, WEAPONS[old].mag, WEAPONS[old].reserve, { x: Math.sin(yaw), z: Math.cos(yaw) }, 0.8);
    }
    if (w.slot === "primary") b.primary = d.id; else b.secondary = d.id;
    remove(d);
    return d.id;
  }
  const Brain = () => Bots.Brain;

  /* ---------- per frame: falling guns, walking over guns, the E prompt ---------- */
  function update(dt) {
    for (const d of list) {
      if (d.landed) continue;
      const r = d.root;
      d.vel.y -= 14 * dt;
      r.position.addScaledVector(d.vel, dt);
      d.gun.rotation.x += d.spin.x * dt; d.gun.rotation.y += d.spin.y * dt; d.gun.rotation.z += d.spin.z * dt;
      collideCircle(r.position, 0.12, r.position.y - 0.05, r.position.y + 0.05);
      const f = floorAt(r.position.x, r.position.z, r.position.y + 0.3);
      if (r.position.y <= f + 0.04) {
        r.position.y = f + 0.035; d.landed = true;
        // settle lying on its side
        d.gun.rotation.set(0, 0, Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1));
        const dist = r.position.distanceTo(camera.position);
        if (dist < 25) Sound.foley("land", dist, relPan(r.position));
      }
    }
    if (!player.alive || !Game.inMatch()) return;
    const now = Game.time;
    // walk over a gun whose slot is empty
    for (const d of list) {
      if (!d.landed || (d.by === player && now - d.at < 1.2)) continue;
      const w = WEAPONS[d.id];
      if (arms[w.slot]) continue;
      if (Math.hypot(d.root.position.x - player.pos.x, d.root.position.z - player.pos.z) < 0.85 && Math.abs(d.root.position.y - player.pos.y) < 1) { take(player, d); break; }
    }
    // swap prompt
    const f = facing();
    const txt = f && arms[WEAPONS[f.id].slot] ? `E  Swap for the ${WEAPONS[f.id].name}` : "";
    if (txt && (txt !== hintTxt || now > hintAt)) { HUD.hint(txt, 700); hintAt = now + 0.5; }
    hintTxt = txt;
  }
  // a bot found no way to reach it: leave it alone for a while
  const unreachable = (d) => { d.claim = null; d.badUntil = Game.time + 6; };
  return { list, spawn, clear, onDeath, playerDrop, use, botGoal, botTake, unreachable, update, floorAt };
})();
