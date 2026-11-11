/* ============================================================
   HUD, radar, scoreboard, spectator camera and the main loop
   ============================================================ */
const HUD = (() => {
  const el = {
    money: $("money"), pop: $("money-pop"), mag: $("mag"), res: $("res"), wname: $("wname"), hp: $("hp"), hpN: $("hp-n"), arN: $("ar-n"), hpbar: $("hpbar"),
    timer: $("timer"), roundNo: $("round-no"), sYou: $("score-you"), sBots: $("score-bots"), lblUs: $("lbl-us"), lblThem: $("lbl-them"),
    sideUs: $("side-us"), sideThem: $("side-them"), aliveUs: $("alive-us"), aliveThem: $("alive-them"),
    feed: $("feed"), hint: $("hint"), hit: $("hitmark"), hurt: $("hurt"), hurtDir: $("hurt-dir").firstElementChild,
    banner: $("banner"), big: $("banner-big"), small: $("banner-small"), rows: $("board-rows"),
    ch: [...$("crosshair").children], radar: $("radar"), bombIco: $("bomb-ico"), kitIco: $("kit-ico"),
    prog: $("prog"), progBar: $("prog-bar"), progTxt: $("prog-txt"), blind: $("blind"), smoke: $("smokeover")
  };
  const rctx = el.radar.getContext("2d");
  // the unchanging part of the big map (floor, walls, crates, sites, spawns), drawn once
  let mapLayer = null;
  function buildMapLayer(S, M, k) {
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const g = cv.getContext("2d"), R = (x0, z0, x1, z1) => g.fillRect((x0 + M) * k, (z0 + M) * k, (x1 - x0) * k, (z1 - z0) * k);
    g.fillStyle = "rgba(196,174,132,.5)"; R(-32, -32, 32, 32);
    for (const sp of Object.values(SPAWN)) {
      if (!sp || !sp.xs) continue;
      g.fillStyle = "rgba(241,233,216,.08)"; R(Math.min(...sp.xs) - 2, sp.z - 2.5, Math.max(...sp.xs) + 2, sp.z + 2.5);
    }
    for (const s of Object.values(SITES)) { g.fillStyle = "rgba(200,60,40,.22)"; R(s.minX, s.minZ, s.maxX, s.maxZ); }
    // low cover is lighter than walls, so you can tell what you can shoot over
    const cs = colliders.filter((c) => c.minY < 2).sort((a, b) => a.maxY - b.maxY);
    for (const c of cs) {
      g.fillStyle = c.maxY > 1.6 ? "rgba(23,20,15,.88)" : c.maxY > 0.9 ? "rgba(70,58,42,.85)" : "rgba(120,100,72,.7)";
      R(c.minX, c.minZ, c.maxX, c.maxZ);
    }
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const s of Object.values(SITES)) {
      g.font = "bold 64px sans-serif"; g.fillStyle = "rgba(255,120,90,.85)";
      g.fillText(s.id, (s.x + M) * k, (s.z + M) * k);
    }
    g.font = "600 30px 'Barlow Condensed', sans-serif"; g.fillStyle = "rgba(241,233,216,.6)";
    for (const [id, sp] of Object.entries(SPAWN)) if (sp && sp.xs) g.fillText(`${id} spawn`, (sp.xs.reduce((a, b) => a + b, 0) / sp.xs.length + M) * k, (sp.z + M) * k + (sp.z > 0 ? -48 : 48));
    return cv;
  }
  let lastHp = -1, lastAr = -1, lastHelmet = null, lastTimer = "", hintTimer = 0, popTimer = 0;
  const skull = '<svg viewBox="0 0 24 24" aria-label="headshot"><path d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.6 1.2 4.6 3 5.9V19c0 .6.4 1 1 1h1.5v-2h1.5v2h3v-2H15v2h1.5c.6 0 1-.4 1-1v-2.9c1.8-1.3 3-3.3 3-5.9C20.5 5.6 17 2 12 2zm-3.5 11a2 2 0 110-4 2 2 0 010 4zm7 0a2 2 0 110-4 2 2 0 010 4z"/></svg>';
  const other = (t) => (t === "CT" ? "T" : "CT");

  function fmt(t) { t = Math.ceil(t); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }

  const H = {
    ammo() {
      const a = slotOf(), w = curW();
      if (w.melee) { el.mag.textContent = "–"; el.res.textContent = "–"; el.mag.classList.remove("low"); }
      else if (w.nade) {
        el.mag.textContent = arms.nades[w.id];
        el.res.textContent = arms.nades.he + arms.nades.flash + arms.nades.smoke;
        el.mag.classList.remove("low");
      } else {
        el.mag.textContent = a.ammo;
        el.mag.classList.toggle("low", a.ammo <= Math.ceil(w.mag * 0.2));
        el.res.textContent = a.reserve;
      }
      el.wname.textContent = w.name;
    },
    vitals(force) {
      if (!force && player.hp === lastHp && player.armor === lastAr && player.helmet === lastHelmet) return;
      lastHp = player.hp; lastAr = player.armor; lastHelmet = player.helmet;
      $("armor").classList.toggle("helmet", player.helmet && player.armor > 0);
      el.hpN.textContent = player.hp; el.arN.textContent = player.armor;
      el.hpbar.style.transform = `scaleX(${player.hp / 100})`;
      el.hp.classList.toggle("low", player.hp <= 25);
    },
    money(delta, why) {
      el.money.textContent = `$${player.money.toLocaleString("en-US")}`;
      if (!delta) return;
      el.pop.textContent = `${delta > 0 ? "+" : "−"}$${Math.abs(delta).toLocaleString("en-US")}  ${why || ""}`;
      el.pop.classList.toggle("spend", delta < 0);
      el.pop.classList.remove("on"); void el.pop.offsetWidth; el.pop.classList.add("on");
      clearTimeout(popTimer); popTimer = setTimeout(() => el.pop.classList.remove("on"), 2600);
    },
    score() {
      el.sYou.textContent = Game.us; el.sBots.textContent = Game.them;
      el.lblUs.textContent = player.team; el.lblThem.textContent = other(player.team);
      el.sideUs.classList.toggle("t", player.team === "T"); el.sideThem.classList.toggle("t", player.team !== "T");
      el.roundNo.textContent = `Round ${Game.round}`;
    },
    alive() {
      const dots = (team, mine) => allEnts().filter((e) => e.team === team).sort((a, b) => (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0)).map((e) => {
        const i = document.createElement("i");
        i.className = (e.alive ? "" : "dead") + (e.isPlayer ? " me" : "") + (mine ? "" : " en");
        return i;
      });
      el.aliveUs.replaceChildren(...dots(player.team, true));
      el.aliveThem.replaceChildren(...dots(other(player.team), false));
    },
    bomb() {
      el.bombIco.classList.toggle("on", Bomb.carrier === player);
      el.kitIco.classList.toggle("on", !!player.kit && player.team === "CT");
    },
    hint(text, ms = 0) {
      clearTimeout(hintTimer);
      el.hint.textContent = text; el.hint.classList.toggle("on", !!text);
      if (text && ms) hintTimer = setTimeout(() => H.hint(""), ms);
    },
    hitmark(head) {
      el.hit.classList.remove("on"); void el.hit.offsetWidth;
      el.hit.classList.toggle("head", !!head); el.hit.classList.add("on");
    },
    hurt(from) {
      el.hurt.style.transition = "none"; el.hurt.style.opacity = 0.9; void el.hurt.offsetWidth;
      el.hurt.style.transition = ""; el.hurt.style.opacity = 0;
      const a = Math.atan2(from.x - player.pos.x, from.z - player.pos.z);
      const facing = Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
      const rel = wrapAngle(a - facing);
      const d = el.hurtDir;
      d.style.transition = "none"; d.style.transform = `rotate(${-rel}rad)`; d.style.opacity = 1; void d.offsetWidth;
      d.style.transition = ""; d.style.opacity = 0;
      H.vitals();
    },
    // classes: you / fr (your team) / en (other team) / world (the bomb)
    kill(killer, kCls, victim, vCls, weapon, head) {
      const row = document.createElement("div");
      row.className = "kill" + (kCls === "you" || vCls === "you" ? " mine" : "");
      row.innerHTML = `<span class="${kCls}"></span><span class="w"></span>${head ? skull : ""}<span class="${vCls}"></span>`;
      row.children[0].textContent = killer; row.children[1].textContent = weapon;
      row.lastElementChild.textContent = victim;
      el.feed.append(row);
      while (el.feed.children.length > 6) el.feed.firstElementChild.remove();
      setTimeout(() => row.remove(), 7000);
    },
    banner(big, small = "", cls = "") {
      el.big.textContent = big; el.small.textContent = small;
      el.big.className = "big " + cls;
      el.banner.classList.toggle("on", !!big);
    },
    board() {
      const row = (e) => ({ name: e.name + (e === Bomb.carrier && e.team === player.team ? "  ●" : ""), kills: e.kills, deaths: e.deaths, hs: e.hs, you: e.isPlayer, dead: !e.alive,
        money: e.team === player.team ? `$${e.money.toLocaleString("en-US")}` : "" });
      const out = [];
      for (const team of [player.team, other(player.team)]) {
        const sep = document.createElement("tr"); sep.className = "sep " + (team === "T" ? "t" : "ct");
        const td = document.createElement("td"); td.colSpan = 5;
        td.textContent = `${SIDE_NAME[team]}  ·  ${team === player.team ? Game.us : Game.them}`;
        sep.append(td); out.push(sep);
        const rows = allEnts().filter((e) => e.team === team).map(row).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
        for (const r of rows) {
          const tr = document.createElement("tr");
          tr.className = (r.you ? "you" : team === player.team ? "fr" : "en") + (r.dead ? " dead" : "");
          for (const v of [r.name, r.kills, r.deaths, r.kills ? Math.round(r.hs / r.kills * 100) + "%" : "–", r.money]) {
            const c = document.createElement("td"); c.textContent = v; tr.append(c);
          }
          out.push(tr);
        }
      }
      el.rows.replaceChildren(...out);
    },
    all() { lastHp = -1; H.ammo(); H.vitals(true); H.money(); H.score(); H.alive(); H.bomb(); },

    frame() {
      H.vitals();
      const planted = Bomb.state === "planted";
      const t = planted ? "C4" : fmt(Game.state === "freeze" ? ROUND_TIME : Game.timeLeft);
      if (t !== lastTimer) { el.timer.textContent = t; lastTimer = t; }
      el.timer.classList.toggle("low", !planted && Game.timeLeft < 20);
      el.timer.classList.toggle("planted", planted);
      const px = (window.innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const gap = 3 + currentSpread() * px * 0.9;
      const [t1, b1, l1, r1] = el.ch;
      const len = 8 * SETTINGS.xsize / 100;
      t1.style.top = `${-gap - len}px`; b1.style.top = `${gap}px`;
      l1.style.left = `${-gap - len}px`; r1.style.left = `${gap}px`;
      document.body.classList.toggle("nocross", curW().id === "awp" || !player.alive);
      document.body.classList.toggle("can-buy", Buy.canBuy());
      document.body.classList.toggle("dead", !player.alive);
      if (document.body.classList.contains("tab")) H.board();
      // plant / defuse progress
      const pr = Bomb.progress();
      el.prog.classList.toggle("on", !!pr);
      if (pr) {
        el.progBar.style.transform = `scaleX(${pr.p})`;
        el.progTxt.textContent = `${pr.kind === "plant" ? "Planting the bomb" : "Defusing"}  ${pr.left.toFixed(1)}s`;
      }
      // flashbang white-out and the grey inside a smoke
      const bt = Game.time - player.blindAt, dur = player.blindDur;
      let blind = 0;
      if (player.alive && bt < dur) { const fade = Math.min(1.6, dur * 0.6); blind = bt < dur - fade ? 1 : (dur - bt) / fade; }
      el.blind.style.opacity = blind.toFixed(3);
      el.smoke.style.opacity = (Nades.inside(camera.position) * 0.94).toFixed(3);
      H.radar();
      if (H.mapOpen) H.drawMap();
    },
    /* ---------- M: the whole map, north up ---------- */
    mapOpen: false,
    toggleMap() { H.mapOpen = !H.mapOpen; document.body.classList.toggle("map", H.mapOpen); if (H.mapOpen) H.drawMap(); },
    drawMap() {
      const cv = $("bigmap-c"), g = cv.getContext("2d"), S = cv.width, M = 33, k = S / (2 * M);
      const P = (x, z) => [(x + M) * k, (z + M) * k];
      if (!mapLayer) mapLayer = buildMapLayer(S, M, k);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, S, S);
      g.drawImage(mapLayer, 0, 0);
      const now = Game.time;
      g.textAlign = "center"; g.textBaseline = "middle";
      // guns lying on the ground
      g.fillStyle = "rgba(255,250,235,.95)";
      for (const d of Drops.list) { const [x, y] = P(d.root.position.x, d.root.position.z); g.save(); g.translate(x, y); g.rotate(-d.root.rotation.y); g.fillRect(-9, -2.5, 18, 5); g.restore(); }
      // the bomb: Ts always know where it is, CTs once it is planted
      const bombP = Bomb.state === "dropped" || Bomb.state === "planted" ? Bomb.pos : Bomb.state === "carried" ? entPos(Bomb.carrier) : null;
      if (bombP && (player.team === "T" || Bomb.state === "planted") && (Bomb.state !== "planted" || Math.sin(now * 10) > -0.3)) {
        const [x, y] = P(bombP.x, bombP.z);
        g.fillStyle = "#ff3b2a"; g.fillRect(x - 11, y - 8 + (Bomb.state === "carried" ? 20 : 0), 22, 16);
        g.fillStyle = "#17140f"; g.font = "bold 11px sans-serif"; g.fillText("C4", x, y + (Bomb.state === "carried" ? 20 : 0));
      }
      const dot = (p, yaw, color, label, ring) => {
        const [x, y] = P(p.x, p.z);
        if (yaw !== null) {   // a wedge pointing where they face
          g.fillStyle = color; g.globalAlpha = 0.35;
          g.beginPath(); g.moveTo(x, y); g.arc(x, y, 34, -Math.PI / 2 - yaw - 0.45, -Math.PI / 2 - yaw + 0.45); g.closePath(); g.fill(); g.globalAlpha = 1;
        }
        g.fillStyle = color; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
        g.strokeStyle = ring || "rgba(23,20,15,.9)"; g.lineWidth = ring ? 3 : 2; g.stroke();
        if (label) { g.font = "600 26px 'Barlow Condensed', sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(23,20,15,.85)"; g.strokeText(label, x, y - 26); g.fillStyle = "#f1e9d8"; g.fillText(label, x, y - 26); }
      };
      const cross = (p, color) => {
        const [x, y] = P(p.x, p.z);
        g.strokeStyle = color; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9); g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9); g.stroke();
      };
      for (const b of Bots.list) {
        if (!b.group.visible) continue;
        const mate = b.team === player.team, p = b.group.position;
        if (!b.alive) cross(p, mate ? "rgba(110,170,240,.75)" : "rgba(230,165,60,.75)");
        else if (mate) dot(p, b.yaw, "#6eaaf0", b.name, b === Game.spec ? "#fff" : null);
        else if (now < b.spottedUntil) dot(p, b.yaw, "#e6a53c", null);
      }
      if (player.alive) {
        // you: an arrow
        const [x, y] = P(player.pos.x, player.pos.z);
        g.save(); g.translate(x, y); g.rotate(-player.yaw);
        g.fillStyle = "#f1e9d8"; g.strokeStyle = "rgba(23,20,15,.9)"; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, -20); g.lineTo(14, 14); g.lineTo(0, 6); g.lineTo(-14, 14); g.closePath(); g.stroke(); g.fill();
        g.restore();
      }
      g.font = "600 30px 'Barlow Condensed', sans-serif"; g.fillStyle = "rgba(241,233,216,.75)"; g.textAlign = "left";
      g.fillText(`${MAP.name}  ·  M to close`, 22, 30);
    },
    /* The static part of the radar (map background, sites, walls, the ring) is drawn once
       into an offscreen canvas; every frame then only paints that image plus the dots. */
    radarLayer: null,
    radar() {
      const S = el.radar.width, C = S / 2, k = C / 24;
      if (!this.radarLayer) {
        const L = document.createElement("canvas"); L.width = L.height = S;
        const g = L.getContext("2d");
        g.translate(C, C); g.scale(k, k);
        g.fillStyle = "rgba(216,195,154,.28)";
        g.fillRect(-32, -32, 64, 64);
        // bomb sites
        for (const s of Object.values(SITES)) {
          g.fillStyle = "rgba(200,60,40,.16)";
          g.fillRect(s.minX, s.minZ, s.maxX - s.minX, s.maxZ - s.minZ);
        }
        g.fillStyle = "rgba(23,20,15,.75)";
        for (const c of colliders) if (c.minY < 2 && (c.maxY > 1.2 || c.minY === 0)) g.fillRect(c.minX, c.minZ, c.maxX - c.minX, c.maxZ - c.minZ);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.strokeStyle = "rgba(241,233,216,.25)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(C, C); g.lineTo(C - C * 0.7, C - C * 0.7); g.moveTo(C, C); g.lineTo(C + C * 0.7, C - C * 0.7); g.stroke();
        this.radarLayer = L;
      }
      const me = !player.alive && Game.spec ? { pos: Game.spec.group.position, yaw: Game.spec.yaw } : player;
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.clearRect(0, 0, S, S);
      rctx.drawImage(this.radarLayer, 0, 0);
      rctx.save();
      rctx.translate(C, C); rctx.scale(k, k); rctx.rotate(me.yaw); rctx.translate(-me.pos.x, -me.pos.z);
      for (const s of Object.values(SITES)) {
        rctx.save(); rctx.translate(s.x, s.z); rctx.rotate(-me.yaw);
        rctx.fillStyle = "rgba(255,120,90,.9)"; rctx.font = "bold 4px sans-serif"; rctx.textAlign = "center"; rctx.textBaseline = "middle";
        rctx.fillText(s.id, 0, 0); rctx.restore();
      }
      const now = Game.time;
      const X = (p, color) => {
        rctx.strokeStyle = color; rctx.lineWidth = 0.35;
        rctx.beginPath(); rctx.moveTo(p.x - 0.7, p.z - 0.7); rctx.lineTo(p.x + 0.7, p.z + 0.7);
        rctx.moveTo(p.x + 0.7, p.z - 0.7); rctx.lineTo(p.x - 0.7, p.z + 0.7); rctx.stroke();
      };
      for (const b of Bots.list) {
        if (!b.group.visible) continue;
        const p = b.group.position, mate = b.team === player.team;
        if (!b.alive) X(p, mate ? "rgba(110,170,240,.7)" : "rgba(230,165,60,.7)");
        else if (mate || now < b.spottedUntil) {
          rctx.fillStyle = mate ? "#6eaaf0" : "#e6a53c";
          rctx.beginPath(); rctx.arc(p.x, p.z, 0.85, 0, Math.PI * 2); rctx.fill();
          if (b === Game.spec) { rctx.strokeStyle = "#fff"; rctx.lineWidth = 0.3; rctx.stroke(); }
        }
      }
      // the bomb: always shown to Ts, to CTs once it is planted
      const bombP = Bomb.state === "dropped" || Bomb.state === "planted" ? Bomb.pos : Bomb.state === "carried" && !Bomb.carrier.isPlayer ? Bomb.carrier.group.position : null;
      if (bombP && (player.team === "T" || Bomb.state === "planted") && (Bomb.state !== "planted" || Math.sin(now * 10) > -0.3)) {
        rctx.fillStyle = "#ff3b2a";
        rctx.fillRect(bombP.x - 0.6, bombP.z - 0.45 + (Bomb.state === "carried" ? 1.3 : 0), 1.2, 0.9);
      }
      rctx.restore();
      if (player.alive) {
        rctx.fillStyle = "#f1e9d8";
        rctx.beginPath(); rctx.moveTo(C, C - 11); rctx.lineTo(C + 8, C + 8); rctx.lineTo(C, C + 3); rctx.lineTo(C - 8, C + 8); rctx.closePath(); rctx.fill();
      }
    }
  };
  return H;
})();
