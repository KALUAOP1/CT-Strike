/* ============================================================
   Economy and buy menu, CS2 rules: $800 start, $16,000 cap,
   $3,250 per round win ($3,500 for the bomb or a defuse),
   a loss bonus that grows with each loss, +$800 to losing Ts
   who planted, kill rewards per weapon. Dying costs your gear.
   ============================================================ */
const MONEY_START = 800, MONEY_MAX = 16000, WIN_REWARD = 3250, OBJ_REWARD = 3500, BUY_TIME = 20;
const lossBonus = (n) => Math.min(3400, 1400 + 500 * n);

const Economy = {
  loss: { CT: 0, T: 0 },
  reset() { player.money = MONEY_START; this.loss = { CT: 0, T: 0 }; },
  add(who, amount, why) {
    if (!who || !amount) return;
    who.money = Math.min(MONEY_MAX, who.money + amount);
    if (who === player) HUD.money(amount, why);
  },
  killReward(who, w) { this.add(who, w.reward, who === player ? `Kill with the ${w.name}` : ""); },
  roundEnd(winSide, kind) {
    const loseSide = winSide === "CT" ? "T" : "CT";
    const win = kind === "bomb" || kind === "defuse" ? OBJ_REWARD : WIN_REWARD;
    const planted = Bomb.state === "planted" || Bomb.state === "defused" || Bomb.state === "exploded";
    const bonus = lossBonus(this.loss[loseSide]) + (loseSide === "T" && planted ? 800 : 0);
    for (const e of allEnts()) {
      if (e.team === winSide) this.add(e, win, "Round win");
      else this.add(e, bonus, "Round loss bonus");
    }
    this.loss[loseSide]++; this.loss[winSide] = Math.max(0, this.loss[winSide] - 1);
  }
};

// 1-9 and 0 in the buy menu
const BUY_ITEMS = [
  { id: "rifle", kind: "Rifle" }, { id: "awp", kind: "Sniper rifle" },
  { id: "deagle", kind: "Pistol" }, { id: "glock", kind: "Pistol" },
  { id: "kevlar", name: "Kevlar vest", kind: "Armour", price: 650 },
  { id: "helmet", name: "Kevlar + helmet", kind: "Armour", price: 1000 },
  { id: "he", kind: "Grenade" }, { id: "flash", kind: "Grenade" }, { id: "smoke", kind: "Grenade" },
  { id: "kit", name: "Defuse kit", kind: "CT only", price: 400 }
];

const Buy = (() => {
  const list = $("buy-list"), cash = $("buy-money");
  const realId = (it) => (it.id === "rifle" ? (player.team === "T" ? "ak47" : "m4a4") : it.id);
  // what an item costs you right now, and whether you can have it
  function state(it) {
    const id = realId(it), w = WEAPONS[id];
    if (w && w.nade) return { name: w.name, owned: arms.nades[id] >= w.max, price: w.price, tag: arms.nades[id] ? `${arms.nades[id]}/${w.max}` : "" };
    if (w) { const a = arms[w.slot]; return { name: w.name, owned: !!a && a.id === id, price: w.price }; }
    if (id === "kit") return { name: it.name, owned: player.kit, price: 400, no: player.team !== "CT" };
    if (id === "kevlar") return { name: it.name, owned: player.armor >= 100, price: 650 };
    if (player.armor >= 100 && player.helmet) return { name: it.name, owned: true, price: 1000 };
    return { name: it.name, owned: false, price: player.armor >= 100 ? 350 : 1000 };   // just the helmet if the vest is full
  }
  function render() {
    cash.textContent = `$${player.money.toLocaleString("en-US")}`;
    list.replaceChildren(...BUY_ITEMS.map((it, i) => {
      const s = state(it), row = document.createElement("div");
      row.className = "buy-row" + (s.no ? " no" : s.owned ? " owned" : player.money < s.price ? " poor" : "");
      row.innerHTML = `<kbd></kbd><span class="n"></span><span class="k"></span><span class="p"></span>`;
      row.children[0].textContent = (i + 1) % 10;
      row.children[1].textContent = s.name + (s.tag ? `  (${s.tag})` : "");
      row.children[2].textContent = it.kind;
      row.children[3].textContent = s.no ? "–" : s.owned ? "Owned" : `$${s.price.toLocaleString("en-US")}`;
      return row;
    }));
  }
  const B = {
    open: false,
    canBuy() {
      return player.alive && inBuyZone(player.team, player.pos) &&
        (Game.state === "freeze" || (Game.state === "live" && Game.roundClock < BUY_TIME));
    },
    toggle() { B.open ? B.close() : B.show(); },
    show() {
      if (!B.canBuy()) { HUD.hint(`Buy in your spawn zone during the first ${BUY_TIME} seconds of a round`, 2200); Sound.buy(false); return; }
      B.open = true; mouseDown = false; render();
      document.body.classList.add("buying");
    },
    close() { B.open = false; document.body.classList.remove("buying"); },
    choose(n) {
      const it = BUY_ITEMS[n - 1];
      if (!it) return;
      const s = state(it), id = realId(it);
      if (s.no || s.owned || player.money < s.price) { Sound.buy(false); return; }
      player.money -= s.price;
      const w = WEAPONS[id];
      if (w && w.nade) giveNade(id);
      else if (w) giveWeapon(id);
      else if (id === "kit") player.kit = true;
      else { player.armor = 100; if (id === "helmet") player.helmet = true; }
      Sound.buy(true);
      HUD.money(-s.price, `Bought the ${s.name}`); HUD.ammo(); HUD.vitals(true);
      render();
    },
    tick() { if (B.open && !B.canBuy()) B.close(); }
  };
  return B;
})();
