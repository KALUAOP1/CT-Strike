/* ============================================================
   Bots: 4 teammates + 5 enemies. Models in team colours,
   senses, gunfights, grenades and the bomb objective.
   ============================================================ */
const Bots = (() => {
  const list = [];
  let D = DIFFICULTY.normal;

  function nameTag(name) {
    const tex = canvasTex(256, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.font = "600 46px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 8; g.strokeStyle = "rgba(10,14,20,.85)"; g.strokeText(name, s / 2, s / 2);
      g.fillStyle = "#8ec5ff"; g.fillText(name, s / 2, s / 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0.9 }));
    sp.scale.set(0.9, 0.9, 1); sp.position.y = 2.05; sp.renderOrder = 5;
    return sp;
  }

  function makeBot(name) {
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const bot = { name, group: g, hit: [], legs: [], team: "T", kills: 0, deaths: 0, hs: 0, money: 800, armor: 0, helmet: false,
      primary: null, secondary: "glock", nades: { he: 0, flash: 0, smoke: 0 }, kit: false, alive: false };
    Soldiers.attach(bot, g);   // CT + T looks, hips, arm poses, hit boxes (g07a_models.js)
    bot.tag = nameTag(name); g.add(bot.tag);
    bot.guns = {};
    g.visible = false;
    scene.add(g);
    return bot;
  }
  function dress(b) {
    Soldiers.show(b);
    b.tag.visible = b.team === player.team;
  }
  // show the right gun model in the bot's hands
  function arm(b) {
    const id = b.weapon, pistol = WEAPONS[id].slot === "secondary";
    for (const k in b.guns) b.guns[k].visible = false;
    if (!b.guns[id]) {
      const gun = worldGun(id);
      if (pistol) gun.position.set(0.03, 1.4, -0.44); else gun.position.set(0.1, 1.38, -0.22);
      b.torso.add(gun); b.guns[id] = gun;
    }
    b.guns[id].visible = true;
    b.rifleArms.visible = !pistol; b.pistolArms.visible = pistol; b.limpArms.visible = false;
    Soldiers.showHelmet(b);
  }

  // 9 bots: the 4 listed first play on your side
  function setup(diffKey) {
    D = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    if (!list.length) {
      const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 9);
      for (const n of names) list.push(makeBot(n));
    }
    list.forEach((b, i) => {
      Object.assign(b, { squad: i < 4 ? "us" : "them", kills: 0, deaths: 0, hs: 0 });
      resetGear(b);
    });
    setSides();
  }
  function setSides() {
    const them = player.team === "CT" ? "T" : "CT";
    for (const b of list) { b.team = b.squad === "us" ? player.team : them; dress(b); }
  }
  // dying costs a bot its guns, grenades and armour; halftime also resets the money
  function loseGear(b) {
    Object.assign(b, { armor: 0, helmet: false, primary: null, secondary: "glock", kit: false });
    b.nades.he = b.nades.flash = b.nades.smoke = 0;
  }
  function resetGear(b) { loseGear(b); b.money = 800; b.alive = false; }

  // CS-style shopping: rifle + armour when they can afford it, an AWP now and then,
  // pistols on eco rounds, then grenades and a kit with what is left
  function shop(b) {
    const rifle = b.team === "T" ? "ak47" : "m4a4", need = WEAPONS[rifle].price + (b.team === "CT" ? 400 : 650);
    if (!b.primary) {
      if (D.awp && b.money >= 5750 && Math.random() < D.awp) { b.primary = "awp"; b.money -= 4750; }
      else if (b.money >= need) { b.primary = rifle; b.money -= WEAPONS[rifle].price; }
      // eco round: if a loss bonus would get you a rifle next round, keep the money (pistol only)
      else if (Game.round > 1 && b.money + lossBonus(Economy.loss[b.team]) >= need) { b.weapon = b.secondary; arm(b); return; }
    }
    if (b.armor < 100 || (!b.helmet && b.primary)) {
      if (b.money >= 1000) { b.armor = 100; b.helmet = true; b.money -= 1000; }
      else if (b.money >= 650 && b.armor < 100) { b.armor = 100; b.money -= 650; }
    }
    if (!b.primary && b.secondary === "glock" && b.money >= 700 && Game.round > 1 && Math.random() < 0.55) { b.secondary = "deagle"; b.money -= 700; }
    if (b.team === "CT" && !b.kit && b.money >= 400 && b.primary && Math.random() < 0.6) { b.kit = true; b.money -= 400; }
    if (b.primary || Game.round > 1) {
      for (const t of ["smoke", "flash", "he"]) {
        const w = WEAPONS[t];
        if (b.nades[t] < 1 && b.money >= w.price + 100 && Math.random() < D.nades * 0.8) { b.nades[t]++; b.money -= w.price; }
      }
    }
    b.weapon = b.primary || b.secondary;
    arm(b);
  }

  function spawnAll() {
    const slots = { CT: SPAWN.CT.xs.slice(), T: SPAWN.T.xs.slice() };
    // your own spawn spot is taken out first
    const mine = slots[player.team]; mine.splice(Math.floor(mine.length / 2), 1);
    for (const k in slots) slots[k].sort(() => Math.random() - 0.5);
    for (const b of list) {
      const g = b.group, sp = SPAWN[b.team];
      g.visible = true; g.scale.set(1, 1, 1);
      g.position.set(slots[b.team].pop() + rand(-0.8, 0.8), 0, sp.z + rand(-0.8, 0.8));
      if (!NAV.free(g.position.x, g.position.z)) { const f = NAV.randomFree(sp.z - 1.5, sp.z + 1.5); g.position.set(f.x, 0, f.z); }
      g.rotation.set(0, sp.yaw, 0);
      Object.assign(b, {
        hp: 100, yaw: sp.yaw, state: "obj", path: null, pathAt: 0, pathGoal: null, goal: null, enemy: null,
        seen: false, reactAt: 0, lastSeen: null, lastSeenAt: -99, lostAt: 0, nextShot: 0, burstLeft: 0,
        spottedUntil: 0, blindUntil: 0, stepDist: 0, deathT: 1, strafe: Math.random() < 0.5 ? -1 : 1, strafeAt: 0,
        stuckCheck: 0, stuckN: 0, anchorUntil: 0, wasMoving: false, stuckPos: g.position.clone(), moving: false, phase: Math.random() * 6, busy: false,
        nextVision: Math.random() * 0.1, holdUntil: 0, lookAt: null, nadeAt: 0, plan: null, huntUntil: 0
      });
      if (!b.alive) loseGear(b);
      b.alive = true; b.crouchy = false; b.handsBusy = false;
      BotAnim.reset(b); b.tag.visible = b.team === player.team;
      shop(b);
    }
    Brain.newRound();
  }

  /* ---------- senses ---------- */
  const eyeV = new THREE.Vector3(), tV = new THREE.Vector3(), camV = new THREE.Vector3();
  function canSee(b, e) {
    const g = b.group.position, ep = entPos(e);
    const dx = ep.x - g.x, dz = ep.z - g.z, dist = Math.hypot(dx, dz);
    if (dist > 75) return false;
    const off = Math.abs(wrapAngle(Math.atan2(-dx, -dz) - b.yaw)) * 180 / Math.PI;
    if (!(off < D.fov / 2 || dist < 3.5 || (b.enemy === e && b.state === "fight"))) return false;
    entEye(b, eyeV);
    entEye(e, tV); tV.y -= 0.05;
    if (lineClear(eyeV, tV) && !Nades.blocks(eyeV, tV)) return true;
    entChest(e, tV); tV.y -= 0.3;
    return lineClear(eyeV, tV) && !Nades.blocks(eyeV, tV);
  }
  function vision(b, now) {
    // you spot enemies on the radar whenever you have a clear line to them
    if (b.team !== player.team && player.alive) {
      entChest(b, tV); camV.copy(camera.position);
      if (camV.distanceTo(tV) < 75 && lineClear(camV, tV) && !Nades.blocks(camV, tV)) b.spottedUntil = now + 1.2;
    }
    if (now < b.blindUntil) { b.seen = false; return; }
    let best = null, bd = 1e9;
    for (const e of allEnts()) {
      if (!e.alive || e.team === b.team) continue;
      const ep = entPos(e), d = Math.hypot(ep.x - b.group.position.x, ep.z - b.group.position.z) * (e === b.enemy ? 0.6 : 1);
      if (d < bd && canSee(b, e)) { best = e; bd = d; }
    }
    if (!best) { b.seen = false; return; }
    if (b.team === player.team) best.spottedUntil = now + 1.2;     // teammates share what they see
    if (b.state !== "fight") {
      // holding an angle (standing still on your spot) means you are pre-aimed: faster and steadier first shots
      const still = !b.wasMoving && b.state === "obj";
      b.anchorUntil = still ? now + 2.5 : 0;
      b.reactAt = now + D.react * rand(0.8, 1.3) * (still ? 0.5 : 1) * (defending(b) ? 0.85 : 1) + (b.weapon === "awp" ? 0.3 : 0);
      b.burstLeft = D.burst;
      b.crouchy = WEAPONS[b.weapon].auto && Math.random() < 0.3;   // some crouch to spray
      Brain.callout(b, best);
    } else if (!b.seen || best !== b.enemy) b.reactAt = Math.max(b.reactAt, now + D.react * 0.4);
    if (b.busy) Brain.interrupt(b);
    b.enemy = best; b.seen = true; b.state = "fight";
    const ep = entPos(best); b.lastSeen = { x: ep.x, z: ep.z }; b.lastSeenAt = now;
  }
  // gunshots, footsteps and grenades give your position away to the other team
  function hear(pos, mul, team) {
    const now = Game.time;
    for (const b of list) {
      if (!b.alive || b.team === team || b.state === "fight") continue;
      const d = Math.hypot(b.group.position.x - pos.x, b.group.position.z - pos.z);
      if (d > D.hear * mul) continue;
      b.lookAt = { x: pos.x, z: pos.z, until: now + 2.5 };
      if (!b.busy && d < 24 && Brain.mayHunt(b)) {
        b.state = "hunt"; b.huntUntil = now + 7; b.path = null;
        b.lastSeen = { x: pos.x + rand(-3, 3), z: pos.z + rand(-3, 3) }; b.lastSeenAt = now;
      }
    }
  }
  // getting shot always gives away the shooter's position
  function wasHit(b, by) {
    const p = entPos(by), now = Game.time;
    b.lastSeen = { x: p.x, z: p.z }; b.lastSeenAt = now;
    if (b.busy) Brain.interrupt(b, true);
    if (b.state !== "fight") { b.state = "fight"; b.enemy = by; b.reactAt = now + D.react * 0.6; b.burstLeft = D.burst; b.lostAt = now; }
  }

  /* ---------- shooting ---------- */
  const defending = (b) => (b.team === "CT") === (Bomb.state !== "planted");
  function shoot(b, e) {
    const g = b.group.position, w = WEAPONS[b.weapon];
    const tgt = entChest(e, new THREE.Vector3());
    const dist = Math.hypot(tgt.x - g.x, tgt.z - g.z);
    let p = D.acc * clamp(1.25 - dist / 38, 0.12, 1.1);
    if (w.slot === "secondary" && dist > 22) p *= 0.7;      // pistols are poor at long range
    if (e.isPlayer) {
      if (player.speed > 3) p *= 0.62;
      if (!player.onGround) p *= 0.6;
      p *= 1 - player.crouch * 0.15;
    } else if (e.moving) p *= 0.72;
    if (b.wasMoving) p *= 0.82;      // shooting on the move is inaccurate
    if (b.burstLeft === D.burst) p *= 1.15;
    if (Game.time < b.anchorUntil) p *= 1.4;
    if (defending(b)) p *= 1.2;      // defenders know the angles: CTs before the plant, Ts after it
    if (w.id === "awp") p = Math.min(0.95, p * 1.5); else if (w.slot === "secondary") p *= w.id === "deagle" ? 0.8 : 0.9;
    const gun = b.guns[b.weapon]; gun.updateWorldMatrix(true, false);
    const muzzle = GUN_MUZZLE[w.id].clone().applyMatrix4(gun.matrixWorld);
    const dCam = muzzle.distanceTo(camera.position);
    _ear.set(g.x, 1.5, g.z);
    Sound.shot(w.id, dCam, relPan(g), dCam > 3 && !lineClear(_ear, camera.position));
    hear(g, 1.7, b.team);
    if (dCam < 70) flashAt(muzzle);
    if (Math.random() >= p) {
      tgt.x += rand(-1.2, 1.2); tgt.y += rand(-0.6, 1); tgt.z += rand(-1.2, 1.2);
      if (e.isPlayer) Sound.whiz(relPan(tgt));          // the miss cracks past your head
      if (dCam < 70) tracer(muzzle, muzzle.clone().add(tgt.sub(muzzle).normalize().multiplyScalar(dist + 6)), 0xffd890);
      if (e.isPlayer && Math.random() < 0.3) Sound.impact(1.5);
      return;
    }
    if (dCam < 70) tracer(muzzle, tgt, 0xffd890);
    const r = Math.random(), part = r < D.hs ? "head" : r > 0.88 ? "legs" : "body";
    // the AWP stays a one-shot threat; everything else is scaled by difficulty
    const mul = w.id === "awp" ? Math.max(D.dmgMul, 0.9) : D.dmgMul;
    const dmg = w.dmg * mul * Math.pow(w.falloff, dist / 12.7) * rand(0.92, 1.08) * (part === "head" ? 4 : part === "legs" ? 0.75 : 1);
    if (!e.isPlayer) puff(tgt, 0x7d1712, 3, 0.4);
    hurt(e, dmg, part, w, b);
  }
  const flashes = [];
  const botFlashMat = new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  function flashAt(pos) {
    const s = new THREE.Sprite(botFlashMat);
    s.position.copy(pos); s.scale.setScalar(rand(0.35, 0.5));
    scene.add(s); flashes.push({ s, t: 0.05 });
  }
  function throwNade(b, type, to, lob = false) {
    if (!b.alive || b.nades[type] <= 0) return false;
    b.nades[type]--; b.nadeAt = Game.time;
    const from = entEye(b, new THREE.Vector3());
    from.x -= Math.sin(b.yaw) * 0.3; from.z -= Math.cos(b.yaw) * 0.3;
    Nades.throw(b, type, from, Nades.aim(from, to, lob));
    return true;
  }

  /* ---------- objectives: T stage, execute, plant, guard; CT hold, rotate, retake, defuse ---------- */
  const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
  const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function freeNear(x, z, r = 2) {
    for (let n = 0; n < 40; n++) {
      const a = rand(0, 6.283), d = n === 0 ? 0 : rand(0, r);
      const px = clamp(x + Math.cos(a) * d, -31, 31), pz = clamp(z + Math.sin(a) * d, -31, 31);
      if (NAV.free(px, pz)) return { x: px, z: pz };
    }
    return { x, z };
  }
  function inSite(s) {
    for (let n = 0; n < 60; n++) {
      const x = rand(s.minX + 1.2, s.maxX - 1.2), z = rand(s.minZ + 1.2, s.maxZ - 1.2);
      if (NAV.free(x, z)) return { x, z };
    }
    return freeNear(s.x, s.z, 3);
  }
  const Brain = {
    site: SITES.A, execAt: 20, executing: false, defuser: null,
    newRound() {
      this.site = Math.random() < 0.5 ? SITES.A : SITES.B;
      this.execAt = rand(12, 26); this.executing = false; this.defuser = null;
      const ct = ["A", "B", "A", "B"].sort(() => Math.random() - 0.5).concat(["mid"]);
      let ti = Math.floor(Math.random() * 3), ci = 0;
      for (const b of list) {
        Object.assign(b, { stagePt: null, execSpot: null, guard: null, hold: null, plantSpot: null, cover: null, nadePlan: null, retook: false, rotateTo: null });
        if (b.team === "T") b.stageIdx = ti++; else b.siteId = ct[ci++];
      }
    },
    tick(now) {
      const planted = Bomb.state === "planted";
      if (!this.executing && !planted) {
        // if you walk onto a site as a T, your team follows you there
        const mine = player.team === "T" && player.alive && siteAt(player.pos.x, player.pos.z);
        if (mine) this.site = mine;
        if (mine || Game.roundClock >= this.execAt || Game.timeLeft < 35) this.startExec(now);
      }
      if (planted && (!this.defuser || !this.defuser.alive)) {
        let best = null, bd = 1e9;
        for (const b of list) {
          if (!b.alive || b.team !== "CT") continue;
          const d = Math.hypot(b.group.position.x - Bomb.pos.x, b.group.position.z - Bomb.pos.z);
          if (d < bd) { bd = d; best = b; }
        }
        this.defuser = best;
      }
    },
    startExec(now) {
      this.executing = true;
      const s = this.site;
      for (const b of list) {
        if (!b.alive || b.team !== "T") continue;
        b.execSpot = null;
        const type = b.nades.smoke ? "smoke" : b.nades.flash ? "flash" : b.nades.he ? "he" : null;
        if (!type || Math.random() > D.nades) continue;
        // smoke off the CT side of the site, flash and HE into it
        const to = type === "smoke" ? (s.smoke || { x: s.x * 0.7, z: s.z + 4 }) : { x: s.x + rand(-2, 2), z: s.z + rand(-2, 2) };
        b.nadePlan = { type, to, at: now + rand(0.2, 1.6), lob: type === "flash" };
      }
    },
    stageGoal(b) {
      if (!b.stagePt) { const st = this.site.stages[b.stageIdx % this.site.stages.length]; b.stagePt = freeNear(st.x, st.z, 2.5); }
      return { x: b.stagePt.x, z: b.stagePt.z, face: yawTo(b.stagePt, this.site) };
    },
    fetcher() {
      let best = null, bd = 1e9;
      for (const b of list) {
        if (!b.alive || b.team !== "T") continue;
        const d = Math.hypot(b.group.position.x - Bomb.pos.x, b.group.position.z - Bomb.pos.z);
        if (d < bd) { bd = d; best = b; }
      }
      // you are the closer T: the bots leave it to you
      if (player.team === "T" && player.alive && Math.hypot(player.pos.x - Bomb.pos.x, player.pos.z - Bomb.pos.z) < bd - 3) return null;
      return best;
    },
    goal(b, now) {
      const B = Bomb, planted = B.state === "planted", pos = b.group.position;
      if (b.team === "T") {
        if (planted) {
          if (!b.guard || b.guardSite !== B.site) { b.guard = freeNear(B.pos.x + rand(-5, 5), B.pos.z + rand(-5, 5), 2.5); b.guardSite = B.site; b.guardFace = pick(B.site.entrances); }
          return { x: b.guard.x, z: b.guard.z, face: yawTo(b.guard, b.guardFace) };
        }
        if (B.state === "dropped" && b === this.fetcher()) return { x: B.pos.x, z: B.pos.z };
        const s = this.site;
        if (B.carrier === b) {
          if (!this.executing) return this.stageGoal(b);
          if (!b.plantSpot) b.plantSpot = freeNear(s.x + rand(-2, 2), s.z + rand(-2, 2), 2);
          if (near(pos, b.plantSpot, 0.9) && siteAt(pos.x, pos.z) && now - b.lastSeenAt > 1.5) B.startPlant(b);
          return { x: b.plantSpot.x, z: b.plantSpot.z };
        }
        if (!this.executing) return this.stageGoal(b);
        if (!b.execSpot) { b.execSpot = inSite(s); b.execFace = pick(s.entrances.concat([{ x: s.x * 0.5, z: 30 }])); }
        return { x: b.execSpot.x, z: b.execSpot.z, face: yawTo(b.execSpot, b.execFace) };
      }
      if (planted) {
        const p = B.pos;
        if (!b.retook && near(pos, p, 15)) {
          b.retook = true;
          if (b.nades.flash && Math.random() < D.nades) b.nadePlan = { type: "flash", to: { x: p.x + rand(-2, 2), z: p.z + rand(-2, 2) }, at: now + 0.2, lob: true };
        }
        if (b === this.defuser && !(B.act && B.act.ent === player)) {
          if (near(pos, p, 1.5) && now - b.lastSeenAt > 1.2) B.startDefuse(b);
          return { x: p.x, z: p.z };
        }
        if (!b.cover || b.coverFor !== p) { b.cover = freeNear(p.x + rand(-4, 4), p.z + rand(-4, 4), 2); b.coverFor = p; }
        return { x: b.cover.x, z: b.cover.z, face: yawTo(p, b.cover) };
      }
      if (b.rotateTo && now >= b.rotateAt) { b.siteId = b.rotateTo; b.rotateTo = null; b.hold = null; }
      if (!b.hold) {
        if (b.siteId === "mid") { b.hold = freeNear(MAP.midHold.x, MAP.midHold.z, 3); b.holdYaw = 0; }
        else { const s = SITES[b.siteId]; b.hold = inSite(s); b.holdYaw = yawTo(b.hold, pick(s.entrances)); }
      }
      return { x: b.hold.x, z: b.hold.z, face: b.holdYaw };
    },
    // a CT who sees an enemy near a site calls it, and some teammates rotate there
    callout(b, e) {
      if (b.team !== "CT" || Bomb.state === "planted" || Game.roundClock < 4) return;
      const p = entPos(e);
      for (const s of [SITES.A, SITES.B]) {
        if (Math.hypot(p.x - s.x, p.z - s.z) > 20) continue;
        for (const o of list) {
          if (o.alive && o.team === "CT" && o !== b && o.siteId !== s.id && !o.rotateTo && o.state !== "fight" && Math.random() < 0.9) {
            o.rotateTo = s.id; o.rotateAt = Game.time + rand(0.4, 2.2);
          }
        }
      }
    },
    mayHunt(b) {
      if (Bomb.carrier === b || Bomb.state === "planted") return false;
      return b.team === "T" ? !this.executing || Math.random() < 0.5 : Math.random() < 0.2;   // CTs mostly hold their spot
    },
    // seeing or getting shot stops a plant; a defuse only goes on if there's no time to fight
    interrupt(b) {
      const A = Bomb.act;
      if (!A || A.ent !== b) { b.busy = false; return; }
      if (A.kind === "defuse" && Bomb.timeLeft() < Bomb.actLeft() + 1.5) return;
      Bomb.cancel(b);
    }
  };

  /* ---------- movement ---------- */
  function moveToward(b, tx, tz, speed, dt) {
    const g = b.group.position;
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const step = Math.min(d, speed * dt);
    g.x += (dx / d) * step; g.z += (dz / d) * step;
    return d;
  }
  function turnTo(b, yaw, rate, dt) {
    const diff = wrapAngle(yaw - b.yaw);
    b.yaw += clamp(diff, -rate * dt, rate * dt);
  }
  function followPath(b, goal, speed, dt, now) {
    const g = b.group.position;
    if (!b.path || now > b.pathAt + 4 || (b.pathGoal && Math.hypot(b.pathGoal.x - goal.x, b.pathGoal.z - goal.z) > 1.5)) {
      if (now > b.pathAt + 0.7 || !b.path) {
        const p = NAV.path(g.x, g.z, goal.x, goal.z);
        b.path = p || []; b.noPath = !p;
        b.pathAt = now; b.pathGoal = { x: goal.x, z: goal.z };
      }
    }
    if (!b.path.length) return true;
    const wp = b.path[0];
    const d = moveToward(b, wp.x, wp.z, speed, dt);
    turnTo(b, Math.atan2(-(wp.x - g.x), -(wp.z - g.z)), 6, dt);
    b.moving = true;
    if (d < 0.35) b.path.shift();
    return b.path.length === 0;
  }
  // a spot that can't be reached is forgotten so a new one gets picked
  function forgetSpots(b) { b.stagePt = b.execSpot = b.guard = b.hold = b.plantSpot = b.cover = null; b.path = null; b.pathAt = -9; }

  function fight(b, dt, now) {
    const g = b.group.position, e = b.enemy;
    if (!e || !e.alive) { b.enemy = null; b.seen = false; b.state = "obj"; b.path = null; return; }
    const ep = entPos(e);
    const want = Math.atan2(-(ep.x - g.x), -(ep.z - g.z));
    if (now < b.blindUntil) { b.yaw += Math.sin(now * 3 + b.phase) * dt * 2; }
    else turnTo(b, want, 9, dt);
    if (b.seen) {
      b.lostAt = now;
      if (D.strafe && now >= b.blindUntil && !(b.crouchy && Math.hypot(ep.x - g.x, ep.z - g.z) > 10)) {
        if (now > b.strafeAt) { b.strafe = -b.strafe; b.strafeAt = now + rand(0.4, 1.1); }
        const sx = Math.cos(b.yaw) * b.strafe, sz = -Math.sin(b.yaw) * b.strafe;
        if (NAV.free(g.x + sx * 0.4, g.z + sz * 0.4)) { g.x += sx * 1.6 * dt; g.z += sz * 1.6 * dt; b.moving = true; }
      }
      const aimed = Math.abs(wrapAngle(want - b.yaw)) < 0.12;
      if (aimed && now >= b.reactAt && now >= b.nextShot) {
        shoot(b, e);
        const w = WEAPONS[b.weapon];
        b.burstLeft--;
        if (!w.auto) { b.burstLeft = D.burst; b.nextShot = now + Math.max(w.rate * 1.6, w.id === "glock" ? 0.22 : 0.4) * rand(0.9, 1.3); }
        else if (b.burstLeft <= 0) { b.burstLeft = D.burst; b.nextShot = now + rand(0.3, 0.65); }
        else b.nextShot = now + w.rate * 1.1;
      }
    } else if (now - b.lostAt > 0.7) {
      // lost them: maybe an HE where they were, then go and look
      const ls = b.lastSeen;
      if (ls && b.nades.he && now - b.nadeAt > 3 && Math.random() < D.nades * 0.6) {
        const d = Math.hypot(ls.x - g.x, ls.z - g.z);
        if (d > 6 && d < 22) { b.yaw = Math.atan2(-(ls.x - g.x), -(ls.z - g.z)); throwNade(b, "he", ls); }
      }
      b.enemy = null;
      if (Bomb.carrier === b || Bomb.state === "planted" || !ls || (b.team === "CT" && Math.random() < 0.5)) b.state = "obj";
      else { b.state = "hunt"; b.huntUntil = now + 6; }
      b.path = null;
    }
  }

  function update(dt, now) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].t -= dt;
      if (flashes[i].t <= 0) { scene.remove(flashes[i].s); flashes.splice(i, 1); }
    }
    if (Game.state === "live") Brain.tick(now);
    let fetch;
    for (const b of list) {
      const g = b.group;
      // LOD: past ~24 m the tagged straps, patches and buckles (g07a_models.js) stop being
      // drawn — sub-pixel there, but each one is a draw call in both the main and shadow pass
      const far = g.position.distanceToSquared(camera.position) > 576;
      if (far !== b.detailFar) { b.detailFar = far; for (const m of b.detail) m.visible = !far; }
      if (!b.alive) { BotAnim.dead(b, dt); continue; }
      b.wasMoving = b.moving; b.moving = false;
      if (Game.state !== "live") { BotAnim.pose(b, dt, now, {}); g.rotation.set(0, b.yaw, 0); continue; }

      b.nextVision -= dt;
      if (b.nextVision <= 0) { vision(b, now); b.nextVision = 0.1; }
      const pos = g.position, speed = D.speed * WEAPONS[b.weapon].speedMul;

      if (b.busy) {
        // planting or defusing: kneeling, not moving; a defuser faces the bomb
        if (Bomb.state === "planted") turnTo(b, Math.atan2(-(Bomb.pos.x - pos.x), -(Bomb.pos.z - pos.z)), 6, dt);
      } else if (b.state === "fight") fight(b, dt, now);
      else if (b.nadePlan && now >= b.nadePlan.at) {
        const n = b.nadePlan, want = Math.atan2(-(n.to.x - pos.x), -(n.to.z - pos.z));
        turnTo(b, want, 8, dt);
        if (Math.abs(wrapAngle(want - b.yaw)) < 0.2 || now > n.at + 1.5) { throwNade(b, n.type, n.to, n.lob); b.nadePlan = null; }
      } else if (b.state === "hunt" && b.lastSeen) {
        const done = followPath(b, b.lastSeen, speed * 0.85, dt, now);
        if (done || now > b.huntUntil) { b.state = "obj"; b.path = null; }
      } else if ((fetch = Drops.botGoal(b))) {
        // a better gun lies close by: grab it on the way
        if (fetch !== b.fetch) { b.fetch = fetch; b.path = null; b.noPath = false; }
        const d = b.fetch.root.position;
        if (near(pos, d, 0.7)) { b.weapon = Drops.botTake(b, b.fetch); arm(b); b.fetch = null; b.path = null; }
        else { followPath(b, { x: d.x, z: d.z }, speed, dt, now); if (b.noPath) { Drops.unreachable(b.fetch); b.fetch = null; b.path = null; } }
      } else {
        if (b.fetch) { b.fetch = null; b.path = null; }
        b.state = "obj";
        const goal = Brain.goal(b, now);
        if (goal && !near(pos, goal, 0.6)) {
          followPath(b, goal, speed, dt, now);
          if (b.noPath) forgetSpots(b);
        } else {
          b.path = null;
          if (b.lookAt && now < b.lookAt.until) turnTo(b, Math.atan2(-(b.lookAt.x - pos.x), -(b.lookAt.z - pos.z)), 5, dt);
          else if (goal && goal.face !== undefined) turnTo(b, goal.face + Math.sin(now * 0.4 + b.phase) * 0.35, 2.5, dt);
        }
      }

      // keep out of walls, each other and you
      collideCircle(pos, 0.32, 0.1, 1.8);
      for (const o of allEnts()) {
        if (o === b || !o.alive) continue;
        const op = entPos(o), dx = pos.x - op.x, dz = pos.z - op.z, d = Math.hypot(dx, dz);
        if (d > 0 && d < 0.75) { const k = o.isPlayer ? 1 : 0.5; pos.x += dx / d * (0.75 - d) * k; pos.z += dz / d * (0.75 - d) * k; }
      }
      // repath if stuck
      b.stuckCheck += dt;
      if (b.stuckCheck > 1.2) {
        if (b.moving && pos.distanceTo(b.stuckPos) < 0.3) { b.path = null; b.pathAt = -9; if (++b.stuckN > 2) { forgetSpots(b); b.stuckN = 0; } }
        else b.stuckN = 0;
        b.stuckPos.copy(pos); b.stuckCheck = 0;
      }

      // body animation; footsteps land with the feet
      if (b.busy !== b.handsBusy) {
        b.handsBusy = b.busy;
        if (b.busy) { for (const id in b.guns) b.guns[id].visible = false; b.rifleArms.visible = false; b.pistolArms.visible = true; }
        else arm(b);
      }
      const crouch = b.state === "fight" && b.crouchy && b.seen && !b.moving;
      let pitch = -0.04;
      if (b.state === "fight" && b.enemy) {
        const ec = entChest(b.enemy, _ec);
        pitch = Math.atan2(ec.y - (pos.y + (crouch ? 1.1 : 1.4)), Math.hypot(ec.x - pos.x, ec.z - pos.z) || 1);
      }
      const footDown = BotAnim.pose(b, dt, now, { kneel: b.busy, crouch, pitch, typing: b.busy && Bomb.act && Bomb.act.ent === b });
      if (b.moving) {
        b.stepDist += dt * speed;
        if (b.stepDist > 2.2) { b.stepDist = 0; hear(pos, 0.45, b.team); }
      }
      // every third footfall is audible (same rhythm as your own steps)
      if (footDown && (b.feet = (b.feet || 0) + 1) % 3 === 0 && b.state !== "fight") {
        const d = pos.distanceTo(camera.position);
        if (d < 22) Sound.step(d, relPan(pos), b.team === player.team ? 0.45 : 0.9, surfaceAt(pos.x, pos.z, 0));
      }
      g.rotation.set(0, b.yaw, 0);
    }
  }

  const _ec = new THREE.Vector3(), _ear = new THREE.Vector3();
  const alive = (team) => list.filter((b) => b.alive && (!team || b.team === team));
  const hitMeshes = (exclude) => { const out = []; for (const b of list) if (b.alive && b.team !== exclude) out.push(...b.hit); return out; };
  function hideAll() { for (const b of list) b.group.visible = false; }
  function halftime() { for (const b of list) resetGear(b); setSides(); }
  return { list, setup, setSides, halftime, spawnAll, update, hitMeshes, hear, wasHit, alive, hideAll, throwNade, Brain, get D() { return D; } };
})();
