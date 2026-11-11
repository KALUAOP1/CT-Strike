/* ============================================================
   Settings screen (graphics, sound, controls) and fitting the
   menu screens inside the window
   ============================================================ */

// Every screen panel keeps its natural layout; if it does not fit the window it is
// zoomed down as a whole, so no line of text is ever cut off. The menu and settings
// also try a one-column layout and keep whichever ends up bigger.
function fitScreens() {
  for (const sec of document.querySelectorAll(".screen.on")) {
    const p = sec.firstElementChild;
    if (!p) continue;
    const cs = getComputedStyle(sec);
    const aw = sec.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = sec.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = () => { p.style.zoom = 1; return Math.min(1, aw / p.offsetWidth, ah / p.offsetHeight); };
    const canStack = sec.id === "settings";
    if (canStack) sec.classList.remove("stack");
    let z = fit();
    if (canStack) {
      sec.classList.add("stack");
      const z2 = fit();
      if (z2 > z + 0.02) z = z2;
      else { sec.classList.remove("stack"); z = fit(); }
    }
    p.style.zoom = z;
  }
}
window.addEventListener("resize", fitScreens);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitScreens);
window.addEventListener("load", fitScreens);

const Settings = (() => {
  const PRESETS = {
    low:    { res: 60, shadows: "off", aa: 0 },
    medium: { res: 80, shadows: "low", aa: 1 },
    high:   { res: 100, shadows: "high", aa: 1 },
    ultra:  { res: 100, shadows: "ultra", aa: 1 }
  };
  const SHADOW = { off: 0, low: 1024, high: 2048, ultra: 4096 };
  const pct = (v) => Math.round(v) + "%";
  const RANGE = {
    res: pct, fov: (v) => v + "°", bright: pct,
    vMaster: pct, vGun: pct, vStep: pct, vFx: pct, vUi: pct,
    sens: (v) => (+v).toFixed(2), zsens: (v) => (+v).toFixed(2), xsize: pct
  };
  const SEG = ["preset", "shadows", "aa", "fps", "invert", "xcol"];
  const BUS = { vMaster: "master", vGun: "gun", vStep: "step", vFx: "fx", vUi: "ui" };
  let back = "menu", aaAtStart = SETTINGS.aa;

  const save = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* not saved, still applied */ } };
  const matchPreset = () => Object.keys(PRESETS).find((n) => Object.keys(PRESETS[n]).every((k) => SETTINGS[k] === PRESETS[n][k])) || "custom";

  // materials have to be rebuilt when the shadow setup changes
  function refreshMaterials() {
    for (const sc of [scene, wScene]) sc.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  function apply() {
    // graphics
    renderer.setPixelRatio(pixelRatio());
    resize();
    const size = SHADOW[SETTINGS.shadows] || 0, on = size > 0;
    const type = SETTINGS.shadows === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (renderer.shadowMap.enabled !== on || renderer.shadowMap.type !== type) {
      renderer.shadowMap.enabled = on; renderer.shadowMap.type = type;
      refreshMaterials();
    }
    if (on && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    renderer.toneMappingExposure = SETTINGS.bright / 100;
    SCOPE_FOV[0] = SETTINGS.fov;
    if (!arms.scope && camera.fov !== SETTINGS.fov) { camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
    document.body.classList.toggle("showfps", !!SETTINGS.fps);
    // sound: sliders are squared so the bottom half of the slider is still usable
    for (const k in BUS) Sound.setVol(BUS[k], Math.pow(SETTINGS[k] / 100, 2));
    // crosshair
    document.documentElement.style.setProperty("--xhair", SETTINGS.xcol);
    document.documentElement.style.setProperty("--xs", SETTINGS.xsize / 100);
  }
  // settings -> controls
  function sync() {
    for (const k in RANGE) { $("s-" + k).value = SETTINGS[k]; $("o-" + k).textContent = RANGE[k](SETTINGS[k]); }
    for (const k of SEG) for (const r of document.getElementsByName("s-" + k)) r.checked = r.value === String(SETTINGS[k]);
    $("l-aa").lastElementChild.textContent = SETTINGS.aa !== aaAtStart ? "(reload the page to apply)" : "(after restart)";
  }
  function set(k, v) {
    SETTINGS[k] = typeof SET_DEFAULT[k] === "number" ? +v : v;
    if (k === "preset") Object.assign(SETTINGS, PRESETS[v]);
    else if (k === "res" || k === "shadows" || k === "aa") SETTINGS.preset = matchPreset();
    apply(); sync(); save();
  }
  for (const k in RANGE) $("s-" + k).addEventListener("input", (e) => set(k, e.target.value));
  for (const k of SEG) for (const r of document.getElementsByName("s-" + k)) r.addEventListener("change", (e) => set(k, e.target.value));

  // Settings and Controls open from the menu or the pause screen and go back to where they came from
  let screen = "settings";
  function open(from, id = "settings") { back = from; screen = id; if (id === "settings") sync(); show(id); }
  function close() { show(back); }
  $("open-set").addEventListener("click", () => open("menu"));
  $("pause-set").addEventListener("click", () => open("pause"));
  $("open-ctl").addEventListener("click", () => open("menu", "controls"));
  $("pause-ctl").addEventListener("click", () => open("pause", "controls"));
  $("set-back").addEventListener("click", close);
  $("ctl-back").addEventListener("click", close);
  $("set-reset").addEventListener("click", () => { Object.assign(SETTINGS, SET_DEFAULT); apply(); sync(); save(); });
  $("s-test").addEventListener("click", () => {
    Sound.init();
    Sound.shot("ak47");
    setTimeout(() => Sound.step(0, 0, 0.55), 600);
    setTimeout(() => Sound.reload(1.2, "glock"), 900);
    setTimeout(() => Sound.buy(true), 2300);
  });
  document.addEventListener("keydown", (e) => { if (e.code === "Escape" && $(screen).classList.contains("on")) close(); });

  apply();
  sync();
  fitScreens();
  return { apply, open, close, sync };
})();

/* ---------- fps counter (and a cheap watch on the window size, so the screens refit
   even when a resize event comes late or not at all, e.g. zooming the browser) ---------- */
const FPS = { n: 0, t: performance.now(), el: $("fps"), fit: "" };
(function countFps(now) {
  requestAnimationFrame(countFps);
  const key = innerWidth + "x" + innerHeight + (document.querySelector(".screen.on") || {}).id;
  if (key !== FPS.fit) { FPS.fit = key; fitScreens(); }
  FPS.n++;
  if (now - FPS.t >= 500) {
    if (SETTINGS.fps) FPS.el.textContent = Math.round(FPS.n * 1000 / (now - FPS.t)) + " FPS";
    FPS.n = 0; FPS.t = now;
  }
})(performance.now());
