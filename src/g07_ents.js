/* ============================================================
   Entities shared by the player and the bots: positions,
   damage (no friendly fire), deaths and the kill feed
   ============================================================ */
const DIFFICULTY = {
  easy:   { react: 0.8,  acc: 0.32, fov: 100, burst: 3, dmgMul: 0.5,  hs: 0.03, speed: 3.3, hear: 18, strafe: false, awp: 0,    nades: 0.4 },
  normal: { react: 0.48, acc: 0.5,  fov: 120, burst: 4, dmgMul: 0.6,  hs: 0.07, speed: 3.8, hear: 26, strafe: true,  awp: 0.15, nades: 0.7 },
  hard:   { react: 0.27, acc: 0.7,  fov: 140, burst: 5, dmgMul: 0.72, hs: 0.12, speed: 4.2, hear: 34, strafe: true,  awp: 0.3,  nades: 1 }
};
const BOT_NAMES = ["Viper", "Rook", "Sable", "Dune", "Kestrel", "Mako", "Hex", "Tarn", "Brick", "Onyx", "Ash", "Flint", "Gale", "Moss"];

const _ev = new THREE.Vector3();
const allEnts = () => [player].concat(Bots.list);
const entPos = (e) => (e.isPlayer ? player.pos : e.group.position);
function entEye(e, out = new THREE.Vector3()) {
  if (e.isPlayer) return out.copy(camera.position);
  const p = e.group.position;
  return out.set(p.x, p.y + (e.busy ? 1.15 : 1.62), p.z);
}
function entChest(e, out = new THREE.Vector3()) {
  const p = entPos(e);
  return out.set(p.x, p.y + (e.isPlayer ? 1.2 - player.crouch * 0.35 : e.busy ? 0.85 : 1.2), p.z);
}
const enemies = (team) => allEnts().filter((e) => e.alive && e.team !== team);
const teamAlive = (team) => allEnts().filter((e) => e.alive && e.team === team);

// stereo pan of a world position, relative to where you are looking
function relPan(pos) {
  const a = Math.atan2(pos.x - camera.position.x, pos.z - camera.position.z);
  const facing = Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
  return -Math.sin(wrapAngle(a - facing));
}

// Every point of damage goes through here. Teammates can't hurt each other;
// your own grenade can still hurt you.
function hurt(v, dmg, part, w, by) {
  if (!v.alive || Game.state === "over") return;
  if (by && by !== v && by.team === v.team) return;
  const taken = Math.max(1, Math.round(applyArmor(v, dmg, part, w.pen)));
  v.hp = Math.max(0, v.hp - taken);
  const head = part === "head";
  if (by === player && v !== player) { if (head) Sound.dink(); else Sound.hit(); HUD.hitmark(head); }
  if (v === player) { Sound.hurt(); HUD.hurt(by ? entPos(by) : player.pos); }
  else if (by && by !== v) Bots.wasHit(v, by);
  if (v.hp <= 0) killEnt(v, by, w, head);
}

function killEnt(v, by, w, head) {
  v.alive = false; v.hp = 0; v.deaths++; v.killer = by;
  const credit = by && by !== v && by.team !== v.team;
  if (credit) { by.kills++; if (head) by.hs++; Economy.killReward(by, w); }
  const cls = (e) => (!e ? "world" : e.isPlayer ? "you" : e.team === player.team ? "fr" : "en");
  HUD.kill(by ? by.name : "", cls(by), v.name, cls(v), w.name, head && credit);
  v.deathHead = !!head;
  Drops.onDeath(v);
  Bomb.onDeath(v);
  if (v === player) Game.onPlayerDown(by, head);
  else { v.busy = false; BotAnim.die(v); }
  Game.checkElim();
}
