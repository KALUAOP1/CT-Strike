/* ============================================================
   Grenades: bouncing physics, HE blast, flashbang blindness,
   smoke clouds that block sight (for bots and for you)
   ============================================================ */
const Nades = (() => {
  const flying = [], smokes = [];
  const GRAV = 14, R = 0.05, SMOKE_R = 3.6, SMOKE_LIFE = 18;
  const templates = {};
  const smokeMat = new THREE.SpriteMaterial({ map: puffTex, color: 0xb9b6ae, transparent: true, depthWrite: false, opacity: 0.9 });
  const blastLight = new THREE.PointLight(0xffc27a, 0, 16, 2);
  scene.add(blastLight);
  let blastUntil = 0, blastPeak = 0;

  function model(type) {
    if (!templates[type]) {
      const t = GUN_BUILDERS[type]();
      t.userData = {};
      t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      templates[type] = t;
    }
    return templates[type].clone();
  }

  function throwNade(owner, type, pos, vel) {
    const mesh = model(type);
    mesh.position.copy(pos);
    scene.add(mesh);
    flying.push({ type, owner, team: owner.team, pos: pos.clone(), vel: vel.clone(), t: 0, mesh,
      spin: new THREE.Vector3(rand(-14, 14), rand(-8, 8), rand(-14, 14)), lastBounce: 0 });
  }
  // launch velocity that lands roughly at `to` (ignores walls; the bounce sorts out the rest)
  function aim(from, to, lob = false) {
    const dx = to.x - from.x, dz = to.z - from.z, d = Math.max(0.5, Math.hypot(dx, dz));
    const th = lob ? 0.95 : 0.6;
    const v = clamp(Math.sqrt(GRAV * d / Math.sin(2 * th)) * 0.92, 3, 17);
    return new THREE.Vector3(dx / d * v * Math.cos(th), v * Math.sin(th), dz / d * v * Math.cos(th));
  }

  function land(v, h) {
    if (v.y < -1.5) { v.y = -v.y * 0.35; v.x *= 0.7; v.z *= 0.7; return true; }
    v.y = 0; const f = Math.exp(-5 * h); v.x *= f; v.z *= f;
    return false;
  }
  function step(n, h) {
    const p = n.pos, v = n.vel, ox = p.x, oy = p.y, oz = p.z;
    v.y -= GRAV * h;
    p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;
    let hit = false;
    if (p.y < R) { p.y = R; hit = land(v, h) || hit; }
    for (const c of colliders) {
      if (p.x < c.minX - R || p.x > c.maxX + R || p.y < c.minY - R || p.y > c.maxY + R || p.z < c.minZ - R || p.z > c.maxZ + R) continue;
      if (ox <= c.minX - R || ox >= c.maxX + R) { p.x = ox; v.x = -v.x * 0.45; v.z *= 0.8; v.y *= 0.85; hit = true; }
      else if (oz <= c.minZ - R || oz >= c.maxZ + R) { p.z = oz; v.z = -v.z * 0.45; v.x *= 0.8; v.y *= 0.85; hit = true; }
      else if (oy >= c.maxY + R - 1e-4) { p.y = c.maxY + R; hit = land(v, h) || hit; }
      else { p.y = oy; v.y = -Math.abs(v.y) * 0.3; hit = true; }
    }
    p.x = clamp(p.x, -31.9, 31.9); p.z = clamp(p.z, -31.9, 31.9);
    return hit;
  }

  function update(dt) {
    for (let i = flying.length - 1; i >= 0; i--) {
      const n = flying[i];
      n.t += dt;
      let hit = false;
      for (let s = 0; s < 4; s++) hit = step(n, dt / 4) || hit;
      const sp = n.vel.length();
      if (hit && sp > 1.2 && n.t - n.lastBounce > 0.08) {
        n.lastBounce = n.t;
        Sound.bounce(n.pos.distanceTo(player.pos), relPan(n.pos));
      }
      n.mesh.position.copy(n.pos);
      const spin = Math.min(1, sp / 4);
      n.mesh.rotation.x += n.spin.x * dt * spin; n.mesh.rotation.y += n.spin.y * dt * spin; n.mesh.rotation.z += n.spin.z * dt * spin;
      const pop = n.type === "smoke" ? (n.t > 0.9 && sp < 0.35) || n.t > 3.5 : n.t >= 1.6;
      if (!pop) continue;
      flying.splice(i, 1);
      scene.remove(n.mesh);
      if (n.type === "he") explodeHE(n); else if (n.type === "flash") explodeFlash(n); else popSmoke(n);
    }
    updateSmokes(dt);
    const now = Game.time;
    blastLight.intensity = now < blastUntil ? blastPeak * (blastUntil - now) / 0.25 : 0;
  }

  /* ---------- HE: up to 98 damage, falls off over 8.5 m, walls block it ---------- */
  function explodeHE(n) {
    const p = n.pos, from = p.clone(); from.y += 0.3;
    const d0 = p.distanceTo(player.pos);
    Sound.boom(d0, relPan(p));
    blast(p, 0xffd08a, 9);
    puff(from, 0xffc27a, 6, 2.2);
    puff(from, 0x5a4c3e, 10, 3.0);
    Game.shake = Math.max(Game.shake, clamp(0.06 * (1 - d0 / 25), 0, 0.06));
    for (const e of allEnts()) {
      if (!e.alive || (e.team === n.team && e !== n.owner)) continue;
      const c = entChest(e), d = c.distanceTo(p);
      if (d > 8.5 || !lineClear(from, c)) continue;
      const dmg = 98 * Math.pow(1 - d / 8.5, 1.4) * (e === n.owner ? 0.5 : 1);
      if (dmg >= 1) hurt(e, dmg, "body", WEAPONS.he, n.owner);
    }
    Bots.hear(p, 1.6, n.team);
  }

  /* ---------- flashbang: blinds anyone who can see it, worst if they look at it ---------- */
  const look = new THREE.Vector3(), toF = new THREE.Vector3();
  function explodeFlash(n) {
    const p = n.pos.clone(); p.y += 0.15;
    Sound.pop(p.distanceTo(player.pos), relPan(p));
    blast(p, 0xffffff, 14);
    for (const e of allEnts()) {
      if (!e.alive || (!e.isPlayer && e.team === n.team && e !== n.owner)) continue;   // bots know their own team's flashes
      const eye = entEye(e), d = eye.distanceTo(p);
      if (d > 32 || !lineClear(p, eye) || blocks(p, eye)) continue;
      toF.copy(p).sub(eye).normalize();
      if (e.isPlayer) camera.getWorldDirection(look); else look.set(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
      const dot = look.dot(toF);
      let dur = dot > 0.6 ? 4.4 : dot > 0.1 ? 2.8 : dot > -0.3 ? 1.3 : 0.45;
      dur *= clamp(1.2 - d / 30, 0.25, 1);
      blind(e, dur);
    }
  }
  function blind(e, dur) {
    if (e.isPlayer) {
      const left = player.blindDur - (Game.time - player.blindAt);
      if (dur > left) { player.blindAt = Game.time; player.blindDur = dur; Sound.ring(dur); }
    } else e.blindUntil = Math.max(e.blindUntil || 0, Game.time + dur);
  }

  // bright core + a short burst of light in the world
  function blast(p, color, light) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    s.position.copy(p); s.position.y += 0.4; s.scale.setScalar(color === 0xffffff ? 2.2 : 3.4);
    scene.add(s);
    fx.push({ obj: s, life: 0.18, max: 0.18, kind: "puff", size: 1, vel: new THREE.Vector3() });
    blastLight.position.copy(p); blastLight.position.y += 0.8;
    blastPeak = light; blastUntil = Game.time + 0.25;
  }

  /* ---------- smoke ---------- */
  function popSmoke(n) {
    const s = { x: n.pos.x, y: 1.45, z: n.pos.z, born: Game.time, r: 0, sprites: [] };
    for (let i = 0; i < 34; i++) {
      const sp = new THREE.Sprite(smokeMat.clone());
      // random point in a squashed ball, more of them low down
      let ox, oy, oz;
      do { ox = rand(-1, 1); oy = rand(-1, 1); oz = rand(-1, 1); } while (ox * ox + oy * oy + oz * oz > 1);
      sp.userData = { off: new THREE.Vector3(ox * SMOKE_R * 0.72, oy * 1.2 - 0.15, oz * SMOKE_R * 0.72), size: rand(2.6, 3.8), drift: rand(-0.06, 0.06) };
      sp.material.rotation = rand(0, 6.28);
      sp.material.color.setHex([0xb9b6ae, 0xc4c1b9, 0xaeaaa2][i % 3]);
      scene.add(sp); s.sprites.push(sp);
    }
    smokes.push(s);
    Sound.hiss(n.pos.distanceTo(player.pos), relPan(n.pos));
  }
  function updateSmokes(dt) {
    const now = Game.time;
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i], age = now - s.born;
      if (age > SMOKE_LIFE) { for (const sp of s.sprites) { scene.remove(sp); sp.material.dispose(); } smokes.splice(i, 1); continue; }
      const grow = ss(age / 1.3), fade = 1 - ss((age - (SMOKE_LIFE - 3)) / 3);
      s.r = SMOKE_R * grow * (fade > 0.4 ? 1 : fade / 0.4);
      for (const sp of s.sprites) {
        const u = sp.userData;
        sp.position.set(s.x + u.off.x * (0.35 + grow * 0.65), s.y + u.off.y * grow + age * 0.006, s.z + u.off.z * (0.35 + grow * 0.65));
        sp.scale.setScalar(u.size * (0.4 + grow * 0.6) * (1 + age * 0.008));
        sp.material.opacity = 0.9 * Math.min(1, grow * 1.5) * fade;
        sp.material.rotation += u.drift * dt;
      }
    }
  }
  // does any smoke cloud cut the line a -> b?
  const segD = new THREE.Vector3(), toC = new THREE.Vector3();
  function blocks(a, b) {
    for (const s of smokes) {
      if (s.r < 1) continue;
      segD.subVectors(b, a); toC.set(s.x - a.x, (s.y - a.y), s.z - a.z);
      segD.y /= 0.75; toC.y /= 0.75;                       // the cloud is a squashed ball
      const L2 = segD.lengthSq();
      const t = L2 > 0 ? clamp(toC.dot(segD) / L2, 0, 1) : 0;
      const dx = toC.x - segD.x * t, dy = toC.y - segD.y * t, dz = toC.z - segD.z * t;
      if (dx * dx + dy * dy + dz * dz < (s.r * 0.88) ** 2) return true;
    }
    return false;
  }
  // 0..1: how deep the camera is inside a smoke (for the grey screen)
  function inside(p) {
    let k = 0;
    for (const s of smokes) {
      const d = Math.hypot(p.x - s.x, (p.y - s.y) / 0.75, p.z - s.z);
      if (s.r > 0.5) k = Math.max(k, clamp(1.25 - d / s.r, 0, 1));
    }
    return k;
  }

  function clear() {
    for (const n of flying) scene.remove(n.mesh);
    flying.length = 0;
    for (const s of smokes) for (const sp of s.sprites) { scene.remove(sp); sp.material.dispose(); }
    smokes.length = 0;
    blastLight.intensity = 0; blastUntil = 0;
  }
  return { throw: throwNade, aim, update, blocks, inside, clear, flying, smokes };
})();
