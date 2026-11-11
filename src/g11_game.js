/* ============================================================
   Game flow (5v5, bomb rounds, halftime), spectating, menus
   ============================================================ */
const ROUNDS_TO_WIN = 7, HALF_AFTER = 6, ROUND_TIME = 115, FREEZE_TIME = 6, END_TIME = 5;
const SIDE_NAME = { CT: "Counter-Terrorists", T: "Terrorists" };

const Game = {
  state: "menu", paused: false, time: 0, roundClock: 0, round: 1, us: 0, them: 0, shake: 0,
  diff: "normal", stateT: 0, timeLeft: ROUND_TIME, spec: null, specT: 0,
  inMatch() { return this.state === "freeze" || this.state === "live" || this.state === "end"; },
  active() { return pointerLocked && !this.paused && this.inMatch(); },

  startMatch() {
    this.diff = (document.querySelector('input[name="diff"]:checked') || {}).value || "normal";
    let side = (document.querySelector('input[name="side"]:checked') || {}).value || "CT";
    if (side === "random") side = Math.random() < 0.5 ? "CT" : "T";
    player.team = side;
    Bots.setup(this.diff);
    Object.assign(player, { kills: 0, deaths: 0, hs: 0, diedLastRound: false });
    Economy.reset(); stripArms();
    this.us = this.them = 0; this.round = 1;
    document.body.classList.add("playing");
    show(null);
    this.startRound();
  },
  startRound() {
    if (player.diedLastRound) { stripArms(); player.diedLastRound = false; }
    const sp = SPAWN[player.team];
    Object.assign(player, { hp: 100, alive: true, yaw: sp.yaw, pitch: 0, crouch: 0, onGround: true, blindDur: 0, spottedUntil: 0 });
    player.pos.set(sp.xs[2] + rand(-0.4, 0.4), 0, sp.z); player.vel.set(0, 0, 0);
    camera.rotation.set(0, sp.yaw, 0);
    Nades.clear(); Drops.clear(); clearHoles(); Bots.spawnAll(); refillArms(); Buy.close();
    this.spec = null; this.specT = 0; $("spec").classList.remove("on");
    $("feed").replaceChildren();
    $("flash").style.opacity = 0;
    this.state = "freeze"; this.stateT = FREEZE_TIME; this.timeLeft = ROUND_TIME; this.roundClock = 0;
    document.body.classList.toggle("side-t", player.team === "T");
    const title = this.round === 1 ? "Pistol round" : this.round === HALF_AFTER + 1 ? "Second half" : `Round ${this.round}`;
    HUD.banner(title, `${SIDE_NAME[player.team]}  ·  Starts in ${FREEZE_TIME}`, "");
    HUD.all();
    HUD.hint(`$${player.money.toLocaleString("en-US")} to spend. Press B to buy`, 4000);
    Bomb.reset();
    if (player.team === "CT") setTimeout(() => { if (Game.state === "freeze") HUD.hint("Defend sites A and B. Hold E on a planted bomb to defuse", 4000); }, 4200);
    Sound.cue("start");
  },
  endRound(winSide, reason, kind = "elim") {
    if (this.state !== "live") return;
    this.state = "end"; this.stateT = END_TIME;
    const ours = winSide === player.team;
    if (ours) this.us++; else this.them++;
    Economy.roundEnd(winSide, kind);
    Buy.close();
    for (const b of Bots.list) b.busy = false;
    const over = this.us >= ROUNDS_TO_WIN || this.them >= ROUNDS_TO_WIN;
    HUD.banner(`${SIDE_NAME[winSide]} win`, reason, ours ? "win" : "lose");
    Sound.cue(over ? (ours ? "match" : "lose") : ours ? "win" : "lose");
    HUD.score(); HUD.alive();
  },
  // a side with nobody left loses, unless the Ts already planted: then the CTs still have to defuse
  checkElim() {
    HUD.alive();
    if (this.state !== "live") return;
    const ct = teamAlive("CT").length, t = teamAlive("T").length;
    if (ct === 0) this.endRound("T", "All Counter-Terrorists eliminated");
    else if (t === 0 && Bomb.state !== "planted") this.endRound("CT", "All Terrorists eliminated");
  },
  onPlayerDown(by, head) {
    player.alive = false; mouseDown = mouse2Down = false; player.diedLastRound = true; arms.pin = 0;
    setScope(0); Buy.close();
    // which way the death cam falls: away from the shot, looking over at the killer
    const k = by && by !== player ? entPos(by) : null, p = player.pos;
    const rel = k ? wrapAngle(Math.atan2(-(k.x - p.x), -(k.z - p.z)) - player.yaw) : rand(-3, 3);
    const side = Math.abs(rel) < 0.8 ? (Math.random() < 0.5 ? -1 : 1) * 0.25 : (rel > 0 ? -1 : 1) * rand(0.4, 0.6);
    player.death = { roll: side, pitch: Math.abs(rel) < 0.8 ? 0.3 : Math.abs(rel) > 2.3 ? -0.45 : 0, yaw: k ? Math.atan2(-(k.x - p.x), -(k.z - p.z)) : null };
    player.deathT = 0;
    $("flash").style.opacity = 0.45;
    HUD.hint(by && by !== player ? `${by.name} got you${head ? " with a headshot" : ""}` : "You died", 2600);
    this.specT = 1.8;     // a moment of death cam, then you watch a teammate
  },
  nextSpec() {
    const mates = Bots.list.filter((b) => b.alive && b.team === player.team);
    if (!mates.length) { this.spec = null; $("spec").classList.remove("on"); return; }
    this.spec = mates[(mates.indexOf(this.spec) + 1) % mates.length];
    $("spec-name").textContent = this.spec.name;
    $("spec").classList.add("on");
  },
  update(dt) {
    if (this.state === "freeze") {
      this.stateT -= dt;
      $("banner-small").textContent = `${SIDE_NAME[player.team]}  ·  Starts in ${Math.max(1, Math.ceil(this.stateT))}  ·  B to buy`;
      if (this.stateT <= 0) { this.state = "live"; HUD.banner(""); }
    } else if (this.state === "live") {
      this.roundClock += dt;
      if (Bomb.state !== "planted") {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.endRound("CT", "Time ran out before the bomb was planted", "time"); }
      }
    } else if (this.state === "end") {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.us >= ROUNDS_TO_WIN || this.them >= ROUNDS_TO_WIN) this.finish();
        else {
          if (this.round === HALF_AFTER) this.halftime();
          this.round++; this.startRound();
        }
      }
    }
    if (!player.alive && this.inMatch()) {
      if (this.specT > 0) { this.specT -= dt; if (this.specT <= 0) this.nextSpec(); }
      else if (this.spec && !this.spec.alive) this.nextSpec();
    }
  },
  // sides swap, money and gear reset, like a CS halftime
  halftime() {
    player.team = player.team === "CT" ? "T" : "CT";
    Bots.halftime();
    stripArms(); player.diedLastRound = false;
    player.money = MONEY_START; Economy.loss = { CT: 0, T: 0 };
  },
  finish() {
    this.state = "over";
    setScope(0); Buy.close(); Bomb.clear(); Nades.clear(); Drops.clear();
    document.body.classList.remove("playing", "map"); HUD.mapOpen = false;
    HUD.banner("");
    Bots.hideAll();
    if (document.pointerLockElement) document.exitPointerLock();
    const won = this.us > this.them;
    const diffName = { easy: "Easy", normal: "Normal", hard: "Hard" }[this.diff];
    $("over-title").textContent = won ? "Match won" : "Match lost";
    $("over-text").textContent = won
      ? `Your team took it ${this.us} to ${this.them} against ${diffName} bots.`
      : `The other team won ${this.them} to ${this.us} on ${diffName}. Smoke off long sightlines, flash before you peek, and listen for footsteps.`;
    $("f-score").textContent = `${this.us} : ${this.them}`;
    $("f-kills").textContent = player.kills;
    $("f-hs").textContent = player.kills ? Math.round(player.hs / player.kills * 100) + "%" : "0%";
    show("over");
  },
  toMenu() {
    this.state = "menu"; this.paused = false;
    setScope(0); Buy.close(); Bomb.clear(); Nades.clear(); Drops.clear();
    document.body.classList.remove("playing", "tab", "map"); HUD.mapOpen = false;
    $("spec").classList.remove("on");
    HUD.banner(""); Bots.hideAll();
    show("menu");
  }
};

/* ---------- screens + pointer lock ---------- */
function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("on", s.id === id);
  fitScreens();
}
function lock() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { Game.paused = true; show("pause"); });
  } catch (e) { Game.paused = true; show("pause"); }
}
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) { Game.paused = false; show(null); }
  else if (Game.inMatch()) { Game.paused = true; mouseDown = mouse2Down = false; show("pause"); }
});
$("play").addEventListener("click", () => { Sound.init(); Game.startMatch(); Game.paused = true; lock(); });
$("resume").addEventListener("click", () => { Sound.init(); lock(); });
$("quit").addEventListener("click", () => Game.toMenu());
$("again").addEventListener("click", () => { Sound.init(); Game.startMatch(); Game.paused = true; lock(); });
$("to-menu").addEventListener("click", () => Game.toMenu());
canvas.addEventListener("click", () => { if (Game.inMatch() && !pointerLocked) lock(); });
