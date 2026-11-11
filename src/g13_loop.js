/* ---------- cameras + main loop ---------- */
let lastT = performance.now();
// you drop to the floor, tipping the way the shot pushed you, and turn towards your killer
function deathCam(dt) {
  const D = player.death || { roll: 0.45, pitch: 0, yaw: null }, k = Math.min(1, dt * 3.2);
  player.deathT = (player.deathT || 0) + dt;
  const fall = Math.min(1, player.deathT / 0.55), floorY = player.pos.y + 0.3;
  camera.position.y += (floorY + (1 - fall * fall) * (camera.position.y - floorY) - camera.position.y) * Math.min(1, dt * 9);
  camera.rotation.z += (D.roll - camera.rotation.z) * k;
  camera.rotation.x += (D.pitch - camera.rotation.x) * k;
  if (D.yaw !== null && player.deathT > 0.4) camera.rotation.y += wrapAngle(D.yaw - camera.rotation.y) * Math.min(1, dt * 1.6);
}
// over-the-shoulder view of the teammate you are watching
const _sc = new THREE.Vector3(), _sh = new THREE.Vector3();
function specCam(dt) {
  const b = Game.spec;
  if (!b) { deathCam(dt); return; }
  const p = b.group.position, s = Math.sin(b.yaw), c = Math.cos(b.yaw);
  _sh.set(p.x, p.y + 1.7, p.z);
  _sc.set(p.x + s * 2.4 + c * 0.45, p.y + 2.15, p.z + c * 2.4 - s * 0.45);
  if (!lineClear(_sh, _sc)) _sc.lerpVectors(_sh, _sc, 0.3);
  camera.position.lerp(_sc, Math.min(1, dt * 7));
  camera.lookAt(p.x - s * 6, p.y + 1.35, p.z - c * 6);
}
function menuCam(t) {
  const s = t * 0.04;
  camera.position.set(-20 + Math.sin(s) * 7, 6.5 + Math.sin(s * 0.7), 27 - (Math.cos(s) + 1) * 4);
  camera.lookAt(4 + Math.sin(s * 0.8) * 8, 1.5, -6);
}
function step(dt, now) {
  Game.time += dt;
  Game.update(dt);
  Buy.tick();
  if (player.alive) updatePlayer(dt); else specCam(dt);
  tryFire(now);
  Bots.update(dt, Game.time);
  Nades.update(dt);
  Bomb.update(dt);
  Drops.update(dt);
  updateFx(dt);
}
function frame(tms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (tms - lastT) / 1000);
  lastT = tms;
  const now = tms / 1000;
  const inGame = Game.inMatch();
  if (!inGame) menuCam(now);
  else if (!Game.paused) {
    step(dt, now);
    updateViewmodel(dt, now);
    if (Game.shake > 0.002) {
      camera.position.x += rand(-1, 1) * Game.shake; camera.position.y += rand(-1, 1) * Game.shake;
      Game.shake *= Math.exp(-dt * 6);
    }
    HUD.frame();
  }
  if (MAP.tick) MAP.tick(dt, camera);
  renderer.clear();
  renderer.render(scene, camera);
  if (inGame && player.alive) { renderer.clearDepth(); renderer.render(wScene, wCamera); }
}
requestAnimationFrame(frame);

// Hook for automated testing only: open the page with #test
if (location.hash === "#test") {
  window.__dl = { Game, player, Bots, BotAnim, C4VM, surfaceAt, Bomb, Nades, Economy, Drops, Sound, bestSlot, updatePlayer, step(dt, now) { step(dt, now); }, SITES, SPAWN, NAV, arms, keys, HUD, Buy, VM, WEAPONS, equip, equipNade, giveWeapon, giveNade, startInspect, cycleScope, startReload,
    updateViewmodel, setScope, allEnts, teamAlive, hurt, siteAt, inBuyZone, lineClear, colliders, camera, scene, solidMeshes, MAP, SETTINGS, Settings, renderer, sun, SCOPE_FOV,
    fire(v) { mouseDown = v; if (!v) arms.triggerHeld = false; },
    fire2(v) { mouse2Down = v; },
    forceLock() { pointerLocked = true; Game.paused = false; show(null); },
    look(dx, dy) { mouseDX += dx; mouseDY += dy; },
    setSide(s) { document.querySelector(`input[name="side"][value="${s}"]`).checked = true; },
    // run the simulation without rendering (software GL in CI is very slow)
    sim(sec, onTick) {
      const dt = 1 / 60;
      // sync with the real clock once per call (so it never runs backwards), then step purely by dt
      this.clock = Math.max(this.clock || 0, performance.now() / 1000);
      for (let i = 0; i < sec * 60; i++) {
        if (!Game.inMatch()) break;
        this.clock += dt;
        step(dt, this.clock);
        if (onTick && onTick(i)) break;
      }
      HUD.frame();
    },
    shootAt(bot, part) {
      player.vel.set(0, 0, 0); updatePlayer(0);   // put the camera where you stand before aiming
      const m = bot.hit.find((h) => h.userData.part === part);
      bot.group.updateMatrixWorld(true); const p = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());   // some hit boxes are offset in their geometry
      const d = p.sub(camera.position);
      player.yaw = Math.atan2(-d.x, -d.z); player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      arms.recoilP = arms.recoilY = 0; arms.shots = 0; player.vel.set(0, 0, 0); player.speed = 0;
      updatePlayer(0); bot.group.rotation.set(0, bot.yaw, 0); scene.updateMatrixWorld(true);
      mouseDown = true; arms.triggerHeld = false; arms.nextFire = 0;
      this.clock = Math.max(this.clock || 0, performance.now() / 1000) + 2; tryFire(this.clock); mouseDown = false;
      return { hp: bot.hp, alive: bot.alive };
    } };
}

})();
</script>
</body>
</html>
