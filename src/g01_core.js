const MAX_ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy());
const texLoader = new THREE.TextureLoader();
let texPending = 0;
const texReady = [];
function loadTex(key, color = false, repeat = 1, onLoad) {
  texPending++;
  const t = texLoader.load(TEXDATA[key], () => {
    if (onLoad) onLoad(t);
    if (--texPending === 0) texReady.splice(0).forEach((f) => f());
  });
  if (color) t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = MAX_ANISO;
  return t;
}
// a PBR set: albedo + normal + roughness
function pbr(name, opts = {}) {
  const r = opts.repeat || 1;
  return new THREE.MeshStandardMaterial(Object.assign({
    map: loadTex(name + "_d", true, r),
    normalMap: loadTex(name + "_n", false, r),
    roughnessMap: TEXDATA[name + "_r"] ? loadTex(name + "_r", false, r) : null,
    roughness: 1, metalness: 0
  }, opts.mat || {}));
}

/* ---------- light: afternoon sun, matched to the sun in the sky photo ---------- */
const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x9a7a52, 0.32);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 2.15);
sun.position.set(-33.7, 42.4, 25.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 5, far: 150 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);

// viewmodel lighting: the weapon scene follows the camera, so its sun is re-aimed every frame
wScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a6a48, 0.35));
const wSun = new THREE.DirectionalLight(0xfff1d8, 1.5);
wScene.add(wSun, wSun.target);
const SUN_DIR = sun.position.clone().normalize();

/* ---------- sky photo as background + image-based lighting ---------- */
scene.background = new THREE.Color(0xb0b6c0);
scene.fog = new THREE.Fog(0xc9c2b4, 45, 170);
loadTex("sky", true, 1, (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  scene.background = t;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(t).texture;
  scene.environment = env;
  wScene.environment = env;
  pm.dispose();
});

/* ---------- sound: everything synthesised with Web Audio ---------- */
const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, rev = null, drive = null;
  // volume settings: master plus four buses (guns, footsteps, effects, menus/UI), 0..1
  const VOL = { master: 1, gun: 1, step: 1, fx: 1, ui: 1 }, MASTER = 0.5;

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    setup(new AC());
  }
  // the mix: everything -> master -> limiter -> speakers, plus a shared reverb
  // (also run on an OfflineAudioContext by the tests). The limiter (a hard
  // compressor) keeps a spray plus a grenade from clipping now that the guns are loud.
  function setup(c) {
    ctx = c;
    master = ctx.createGain();
    master.gain.value = MASTER * VOL.master;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15;
    // and a soft clip after it: Chrome's limiter can overshoot a little when a lot lands at once
    const sc = ctx.createWaveShaper(), cv = new Float32Array(1025);
    for (let i = 0; i < cv.length; i++) { const x = i / 512 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
    sc.curve = cv;
    master.connect(lim).connect(sc).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rev = ctx.createConvolver();
    rev.buffer = makeIR();
    const rg = ctx.createGain(); rg.gain.value = 0.85;
    rev.connect(rg).connect(master);
    // soft clipping curve: gives the gunshots their grit
    drive = new Float32Array(2048);
    for (let i = 0; i < drive.length; i++) { const x = i / (drive.length - 1) * 2 - 1; drive[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
  }
  // the map's "room": a generated impulse response. Dust is a dry desert town with
  // a sharp slapback off the walls; Harbor rings longer between the containers;
  // Frostbite is bright and crisp.
  function makeIR() {
    const P = { dust: [1.4, 0.24, 5000, [0.085, 0.16, 0.27]], harbor: [2.0, 0.34, 3400, [0.12, 0.2, 0.33]], frost: [1.6, 0.28, 6500, [0.07, 0.13, 0.22]] };
    const [len, tau, bright, echoes] = P[MAP_ID] || P.dust;
    const sr = ctx.sampleRate, n = Math.floor(sr * len), buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, fc = bright * Math.exp(-t * 1.8) + 220;     // the tail gets darker as it dies
        lp += (1 - Math.exp(-6.283 * fc / sr)) * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.exp(-t / tau) * Math.min(1, t / 0.015);
      }
      // early reflections, a little later in the right ear so the echo feels wide
      echoes.forEach((e, k) => {
        const at = Math.floor((e + ch * 0.007 * (k + 1)) * sr), m = Math.floor(sr * 0.02);
        for (let j = 0; j < m && at + j < n; j++) d[at + j] += (Math.random() * 2 - 1) * Math.exp(-j / (sr * 0.004)) * 0.35 * Math.pow(0.6, k);
      });
    }
    return buf;
  }

  // wet: how much goes to the reverb, relative to the dry level; bus: which volume slider
  function out(vol = 1, pan = 0, cutoff = 12000, wet = 0, bus = "fx") {
    const g = ctx.createGain();
    g.gain.value = vol * (VOL[bus] ?? 1);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = cutoff;
    lp.connect(g);
    let o = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      o = g.connect(p);
    }
    o.connect(master);
    // the echo is sent after the panner so it still tells you which side the sound came from
    if (wet > 0 && rev) { const s = ctx.createGain(); s.gain.value = wet; o.connect(s).connect(rev); }
    return lp;
  }
  // a soft clipper in front of dest; k is how hard it is pushed
  function grit(dest, k) {
    const pre = ctx.createGain(); pre.gain.value = k;
    const ws = ctx.createWaveShaper(); ws.curve = drive; ws.oversample = "2x";
    const post = ctx.createGain(); post.gain.value = 1 / Math.sqrt(k);
    pre.connect(ws).connect(post).connect(dest);
    return pre;
  }
  function env(dest, peak, t, a, d) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  function burst(dest, t, type, freq, q, peak, a, d, rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f).connect(env(dest, peak, t, a, d));
    s.start(t, Math.random() * 0.5, a + d + 0.05);
  }
  // noise through a filter that glides from f0 to f1
  function sweep(dest, t, type, f0, f1, q, peak, a, d, rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    s.connect(f).connect(env(dest, peak, t, a, d));
    s.start(t, Math.random() * 0.5, a + d + 0.05);
  }
  // attack, hold, then a natural exponential decay with time constant tau
  // (an exponential ramp to silence dies far too fast for a gunshot body)
  function env2(dest, peak, t, a, h, tau) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + h);
    g.gain.setTargetAtTime(0, t + a + h, tau);
    g.connect(dest);
    return g;
  }
  function nz(dest, t, type, freq, q, peak, a, h, tau, rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f).connect(env2(dest, peak, t, a, h, tau));
    s.start(t, Math.random() * 0.5); s.stop(t + a + h + tau * 7);
    return f;
  }
  function osc(dest, t, type, f0, f1, glide, peak, a, h, tau) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    o.connect(env2(dest, peak, t, a, h, tau));
    o.start(t); o.stop(t + a + h + tau * 7);
  }
  function tone(dest, t, type, f0, f1, peak, a, d) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    o.connect(env(dest, peak, t, a, d));
    o.start(t); o.stop(t + a + d + 0.05);
  }

  /* ---------- small mechanical pieces used by guns and foley ---------- */
  function click(o, t, f, peak) {                 // a catch or button snapping
    burst(o, t, "bandpass", f, 3, peak, 0.0006, 0.014);
    tone(o, t, "triangle", f * 1.8, f * 1.75, peak * 0.18, 0.0005, 0.02);
  }
  function clack(o, t, f, peak) {                 // metal parts slamming home
    burst(o, t, "bandpass", f, 1.5, peak, 0.0008, 0.035);
    burst(o, t, "highpass", 4200, 0.8, peak * 0.45, 0.0005, 0.012);
    tone(o, t, "triangle", f * 0.5, f * 0.44, peak * 0.3, 0.001, 0.05);
    tone(o, t, "sine", f * 2.7, f * 2.68, peak * 0.07, 0.001, 0.07);
  }
  function cloth(o, t, len, peak) {               // hands and sleeves moving
    burst(o, t, "bandpass", 1000, 0.6, peak, len * 0.4, len * 0.6, 0.5);
  }
  function bolt(o, t0) {                          // AWP: up, back, forward, down
    click(o, t0 + 0.1, 2400, 0.4);
    sweep(o, t0 + 0.18, "bandpass", 1500, 2500, 3, 0.16, 0.01, 0.17);
    clack(o, t0 + 0.37, 1600, 0.55);
    sweep(o, t0 + 0.45, "bandpass", 2500, 1500, 3, 0.16, 0.01, 0.16);
    clack(o, t0 + 0.64, 1900, 0.65);
    click(o, t0 + 0.8, 2100, 0.5);
  }

  /* ---------- gunshots ----------
     Voiced against reference recordings (levels and spectra only; nothing sampled).
     A shot is: a very short crack; the bang, where a broadband blast, a mid "bark",
     a falling thump and a sub-bass push are driven into a soft clipper together
     (that is what makes it dense and loud); the action cycling up close; and the
     tail rolling off the walls into the map's reverb.
     crack [Hz, level]; blast [lowpass Hz, level]; bark [bandpass Hz, level];
     hold/tau = how long the bang holds and decays; th = thump [from Hz, to Hz, glide s, level];
     sub [Hz, level, decay]; ring = the body ringing on [Hz, level, decay];
     tail [lowpass Hz, decay, level] */
  const GUN = {
    ak47:   { crack: [2800, 0.5], blast: [1300, 1], bark: [520, 1.6], hold: 0.06, tau: 0.05, th: [140, 50, 0.16, 0.8], sub: [55, 0.3, 0.06], ring: [600, 0.6, 0.12], tail: [1200, 0.5, 1.6], air: 0.2, mech: 2100, loud: 0.9, drive: 3.5, wet: 0.5 },
    m4a4:   { crack: [3400, 0.5], blast: [1800, 1], bark: [700, 1.6], hold: 0.022, tau: 0.035, th: [160, 60, 0.12, 0.4], sub: [60, 0.1, 0.05], ring: [750, 0.35, 0.08], tail: [1500, 0.35, 0.6], air: 0.4, mech: 3000, loud: 0.8, drive: 3, wet: 0.45 },
    awp:    { crack: [2400, 0.6], blast: [1500, 1], bark: [450, 1.2], hold: 0.04, tau: 0.08, th: [110, 38, 0.2, 0.8], sub: [48, 0.8, 0.07], ring: [520, 0.25, 0.25], tail: [2200, 0.7, 1.3], air: 0.4, mech: 1700, loud: 1.5, drive: 4.5, wet: 0.7 },
    deagle: { crack: [5000, 0.9], blast: [1600, 1], bark: [480, 0.9], hold: 0.085, tau: 0.06, th: [100, 42, 0.22, 0.7], sub: [50, 1, 0.07], ring: [560, 0.35, 0.12], tail: [1700, 0.5, 1.6], air: 0.6, mech: 2500, loud: 1, drive: 4, wet: 0.55 },
    glock:  { crack: [5000, 0.8], blast: [2400, 1], bark: [900, 1.5], hold: 0.065, tau: 0.04, th: [200, 80, 0.07, 1.2], sub: [70, 0.6, 0.02], ring: [1000, 0.5, 0.09], tail: [1800, 0.25, 1.4], air: 0.6, mech: 3600, loud: 0.6, drive: 2.2, wet: 0.35 }
  };

  /* ---------- footsteps: each surface has its own sound ---------- */
  function grains(o, t, n, len, f, q, peak, j) {  // lots of tiny crunches
    for (let i = 0; i < n; i++) burst(o, t + Math.random() * len, "bandpass", f * rand(0.75, 1.3) * j, q, peak * rand(0.5, 1), 0.0008, rand(0.006, 0.016), rand(0.8, 1.3));
  }
  const STEP = {
    sand(o, t, j) {          // grit crunching under the boot
      tone(o, t, "sine", 85 * j, 48, 0.35, 0.003, 0.06);
      burst(o, t, "lowpass", 700 * j, 0.6, 0.35, 0.004, 0.05);
      grains(o, t + 0.005, 6, 0.07, 2600, 1.4, 0.3, j);
    },
    concrete(o, t, j) {      // hard heel click, then the sole slaps down
      burst(o, t, "highpass", 2400 * j, 0.8, 0.45, 0.0008, 0.014);
      burst(o, t + 0.004, "bandpass", 950 * j, 1.1, 0.5, 0.002, 0.045);
      tone(o, t, "sine", 115 * j, 60, 0.35, 0.002, 0.05);
      burst(o, t + 0.055, "bandpass", 1500 * j, 1.2, 0.22, 0.002, 0.03);
    },
    snow(o, t, j) {          // packed snow squeaks and crunches as it compresses
      burst(o, t, "lowpass", 500 * j, 0.6, 0.3, 0.008, 0.07);
      grains(o, t + 0.01, 9, 0.11, 3200, 1.1, 0.22, j);
      grains(o, t + 0.02, 4, 0.08, 1300, 1.6, 0.18, j);
    },
    wood(o, t, j) {          // hollow knock off a crate lid
      burst(o, t, "bandpass", 2000 * j, 1, 0.3, 0.0008, 0.012);
      tone(o, t, "triangle", 190 * j, 150, 0.45, 0.002, 0.09);
      burst(o, t, "bandpass", 520 * j, 3, 0.45, 0.002, 0.08);
      tone(o, t + 0.05, "triangle", 230 * j, 180, 0.15, 0.002, 0.05);
    },
    metal(o, t, j) {         // container roof: a boomy clang with a ring
      burst(o, t, "highpass", 3000 * j, 0.8, 0.35, 0.0008, 0.012);
      tone(o, t, "sine", 105 * j, 85, 0.5, 0.002, 0.18);
      for (const [f, a, d] of [[430, 0.16, 0.22], [1170, 0.09, 0.16], [2330, 0.05, 0.1]]) tone(o, t, "sine", f * j, f * j * 0.99, a, 0.001, d);
      burst(o, t + 0.05, "bandpass", 1800 * j, 2, 0.15, 0.002, 0.04);
    }
  };
  const STEP_GAIN = { sand: 1.6, concrete: 1, snow: 5, wood: 1.4, metal: 1 };
  const myFloor = () => (typeof player !== "undefined" && typeof surfaceAt === "function" ? surfaceAt(player.pos.x, player.pos.z, player.pos.y) : "concrete");

  return {
    init,
    surfaces: Object.keys(STEP),
    vol: VOL,
    _gun: GUN,
    setVol(k, v) {
      if (!(k in VOL)) return;
      VOL[k] = clamp(+v || 0, 0, 1);
      if (k === "master" && master) master.gain.value = MASTER * VOL.master;
    },
    // dist in metres (0 = your own gun), pan -1..1, occluded = a wall is in the way.
    // Far shots are quieter and duller and more of what you hear is the echo.
    shot(kind, dist = 0, pan = 0, occluded = false) {
      if (!ctx) return;
      const G = GUN[kind] || GUN.ak47, t = ctx.currentTime + 0.002, j = 1 + rand(-0.035, 0.035);   // no two shots alike
      const far = dist > 0.5;
      let vol = G.loud * (far ? 1.1 / (1 + dist * 0.14) : 1);
      let cut = far ? clamp(16000 / (1 + dist * 0.09), 1000, 16000) : 16000;   // air soaks up the highs
      let wet = G.wet * (far ? Math.min(1.5, 1 + dist * 0.015) : 1);
      if (occluded) { cut = Math.min(cut, 950); vol *= 0.65; wet *= 1.2; }
      const o = out(vol, pan, cut, wet, "gun");
      const ck = far ? Math.exp(-dist / 22) : 1;                // the snap is the first thing lost with distance
      // 1. crack
      nz(o, t, "highpass", G.crack[0] * j, 0.7, G.crack[1] * ck + 0.03, 0.0005, 0.002, 0.006);
      // 2. the bang: blast, bark, thump and sub through the clipper together
      const gr = grit(o, G.drive);
      nz(gr, t, "lowpass", G.blast[0] * j, 0.7, G.blast[1], 0.001, G.hold, G.tau);
      nz(gr, t, "bandpass", G.bark[0] * j, 0.9, G.bark[1], 0.002, G.hold, G.tau * 1.4);
      osc(gr, t, "sine", G.th[0] * j, G.th[1], G.th[2], G.th[3], 0.002, 0.01, G.th[2] * 0.4);
      osc(gr, t, "sine", G.sub[0] * j, G.sub[0] * 0.8 * j, G.sub[2] * 3, G.sub[1], 0.004, 0.02, G.sub[2]);
      // the air in the blast (kept out of the clipper so it stays clean)
      nz(o, t, "highpass", 6500, 0.7, (G.air ?? 0.3) * ck, 0.001, G.hold * 0.5, G.tau * 0.6);
      // the body of the sound ringing on after the blast
      nz(o, t + 0.01, "bandpass", G.ring[0] * j, 0.7, G.ring[1], 0.01, G.hold, G.ring[2]);
      // 3. the action cycling: you only hear it up close
      if (dist < 5) {
        burst(o, t + 0.016, "bandpass", G.mech * j, 4, 0.2, 0.0008, 0.022);
        tone(o, t + 0.018, "triangle", G.mech * 1.62 * j, G.mech * 1.55, 0.05, 0.0005, 0.04);
        if (kind !== "awp") burst(o, t + 0.055, "bandpass", G.mech * 1.3, 5, 0.08, 0.0008, 0.018);
      }
      // 4. tail: rolls away and darkens
      const tf = nz(o, t + 0.025, "lowpass", G.tail[0], 0.5, G.tail[2], 0.03, G.hold, G.tail[1]);
      tf.frequency.setValueAtTime(G.tail[0], t + 0.025); tf.frequency.exponentialRampToValueAtTime(200, t + 0.07 + G.tail[1] * 5);
      // a long way off a shot is mostly a dull boom
      if (dist > 22) osc(o, t, "sine", 95, 38, 0.3, 0.5 * Math.min(1, (dist - 22) / 20), 0.004, 0.02, 0.12);
      if (kind === "awp" && far && dist < 15) bolt(o, t + 0.3);
    },
    // AWP bolt for your own gun, after delay seconds
    bolt(delay = 0) {
      if (!ctx) return;
      bolt(out(0.4, 0, 12000, 0.1, "gun"), ctx.currentTime + delay);
    },
    // a bullet passing close by you: the crack, then a short whistle
    whiz(pan = 0) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.5, pan * 0.8, 12000, 0.05, "gun");
      burst(o, t, "highpass", 3500, 0.7, 0.6, 0.0005, 0.012);
      sweep(o, t, "bandpass", 3000, 900, 2.5, 0.35, 0.03, 0.12);
    },
    // pulling out a weapon
    draw(kind) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(kind === "knife" ? 1.1 : 0.5, 0, 12000, 0.08), w = WEAPONS[kind] || {};
      if (kind === "knife") {
        // blade out of the sheath: a rising metallic swish and a ring
        sweep(o, t, "bandpass", 2500, 6500, 6, 0.3, 0.03, 0.2, 1.2);
        tone(o, t + 0.2, "sine", 4100, 4060, 0.06, 0.002, 0.35);
        tone(o, t + 0.2, "sine", 6230, 6200, 0.035, 0.002, 0.25);
      } else if (w.nade) {
        cloth(o, t, 0.16, 0.22); click(o, t + 0.1, 3000, 0.12);
      } else {
        const pistol = w.slot === "secondary", awp = kind === "awp";
        cloth(o, t, pistol ? 0.14 : 0.22, 0.28);
        click(o, t + (pistol ? 0.12 : 0.2), 2600, 0.3);
        clack(o, t + (pistol ? 0.26 : awp ? 0.55 : 0.38), pistol ? 2300 : 1700, 0.5);   // slide / charging handle
      }
    },
    // handling noises: a gun dropped, picked up, or landing on the ground
    foley(kind, dist = 0, pan = 0) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (kind === "land") {
        const o = out(0.8 / (1 + dist * 0.15), pan, 6000, 0.1);
        burst(o, t, "bandpass", 1500, 2.5, 0.8, 0.001, 0.05);
        tone(o, t, "triangle", 900, 700, 0.25, 0.001, 0.06);
        burst(o, t + 0.09, "bandpass", 2100, 3, 0.35, 0.001, 0.04);
      } else if (kind === "pickup") {
        const o = out(0.7);
        cloth(o, t, 0.1, 0.25);
        burst(o, t, "bandpass", 1300, 2, 0.6, 0.002, 0.06);
        click(o, t + 0.12, 2600, 0.5);
      } else {
        const o = out(0.55);
        burst(o, t, "bandpass", 700, 1.2, 0.6, 0.01, 0.12);
      }
    },
    // spent cases hitting the floor: they ring on hard ground and vanish in snow
    brass(surf) {
      if (!ctx) return;
      const s = surf || myFloor(), t = ctx.currentTime + rand(0.25, 0.4), o = out(0.2);
      if (s === "snow") { burst(o, t, "lowpass", 900, 0.7, 0.3, 0.002, 0.03); return; }
      if (s === "sand") { burst(o, t, "bandpass", 3200, 2, 0.3, 0.001, 0.02); tone(o, t, "sine", 5200, 5100, 0.12, 0.001, 0.03); return; }
      const ring = s === "wood" ? 0.5 : 1;
      tone(o, t, "sine", 5200, 5100, 0.4, 0.001, 0.06 * ring);
      tone(o, t + 0.07, "sine", 4700, 4650, 0.25, 0.001, 0.05 * ring);
      tone(o, t + 0.13, "sine", 4900, 4850, 0.12, 0.001, 0.04 * ring);
    },
    buy(ok) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.7, 0, 12000, 0, "ui");
      if (ok) { burst(o, t, "bandpass", 2600, 4, 0.6, 0.001, 0.04); tone(o, t + 0.05, "triangle", 1320, 1320, 0.25, 0.005, 0.12); }
      else tone(o, t, "square", 180, 150, 0.2, 0.005, 0.18);
    },
    zoom() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.35);
      burst(o, t, "bandpass", 3000, 5, 0.6, 0.001, 0.03);
    },
    // headshot: a hard "tok" off the helmet, a thump, a bright crunch with bits of
    // debris after it, and the helmet ringing (close partials that beat together)
    dink() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.4, 0, 14000, 0.15);
      nz(o, t, "bandpass", 720, 1.6, 6, 0.001, 0.04, 0.03);
      nz(o, t, "bandpass", 1250, 1.4, 3.5, 0.001, 0.025, 0.02);
      osc(o, t + 0.045, "sine", 95, 60, 0.12, 0.6, 0.003, 0.08, 0.1);
      osc(o, t + 0.045, "sine", 185, 170, 0.08, 0.25, 0.003, 0.01, 0.04);
      nz(o, t + 0.05, "bandpass", 5500, 0.8, 1.4, 0.001, 0.02, 0.03);
      nz(o, t + 0.04, "bandpass", 1000, 0.7, 1.3, 0.01, 0.15, 0.08);
      for (let i = 0; i < 16; i++) {
        const f = [700, 1100, 1400, 2500, 5200][i % 5] * rand(0.9, 1.1);
        nz(o, t + 0.08 + Math.random() * 0.3, "bandpass", f, 1.4, rand(1.4, 2.6), 0.001, 0.006, rand(0.01, 0.025));
      }
      osc(o, t + 0.15, "sine", 90, 70, 0.05, 0.35, 0.004, 0.03, 0.05);
      [[1742, 0.5], [2358, 0.45], [2466, 0.7], [2492, 0.55], [2586, 0.6], [2632, 0.5], [2886, 0.35], [3150, 0.25]].forEach(([f, a], i) =>
        osc(o, t + 0.002, "sine", f, f * 0.998, 0.4, a * 0.26, 0.001, 0.08, 0.15 + (i % 3) * 0.05));
    },
    hit() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.5);
      burst(o, t, "bandpass", 900, 1.4, 0.6, 0.002, 0.06);
      tone(o, t, "sine", 320, 180, 0.4, 0.002, 0.06);
    },
    hurt() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.5, 0, 1400);
      tone(o, t, "sine", 120, 55, 0.9, 0.003, 0.18);
      burst(o, t, "lowpass", 800, 0.7, 0.6, 0.003, 0.12);
    },
    impact(dist = 2) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.6 / (1 + dist * 0.05));
      burst(o, t, "bandpass", 2400, 1.2, 0.5, 0.001, 0.05, 1.3);
    },
    click() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.22);
      burst(o, t, "highpass", 3800, 1, 0.5, 0.001, 0.03);
    },
    // reloading, timed to the viewmodel animation (fractions of the reload time)
    reload(dur, kind = "ak47", empty = false) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(1, 0, 12000, 0.08), at = (f) => t + dur * f;
      const pistol = kind === "glock" || kind === "deagle";
      cloth(o, t, 0.14, 0.22);
      click(o, at(0.12), pistol ? 3400 : 2600, 0.45);                                   // mag release
      sweep(o, at(0.13), "bandpass", 1400, 2600, 2, 0.2, 0.02, dur * 0.17);              // old mag slides out
      if (!pistol) { burst(o, at(0.38), "bandpass", 900, 1.5, 0.16, 0.001, 0.05); burst(o, at(0.41), "bandpass", 1300, 2, 0.09, 0.001, 0.04); }
      cloth(o, at(0.3), 0.15, 0.18);                                                     // new mag from the pouch
      sweep(o, at(0.5), "bandpass", 1800, 1100, 2, 0.18, 0.02, dur * 0.18);              // in it goes
      clack(o, at(0.7), pistol ? 1800 : 1250, 0.32);                                     // seated
      if (empty) {
        const oe = out(0.35, 0, 12000, 0.08);
        if (kind === "awp") bolt(oe, t + dur - 0.95);
        else if (pistol) clack(oe, t + dur - 0.15, 2600, 0.8);                           // slide release
        else { click(oe, at(0.82), 2200, 0.45); clack(oe, at(0.9), 2000, 0.9); }         // charging handle
      }
      cloth(o, at(0.86), 0.1, 0.14);
    },
    // footstep on a surface (sand, concrete, snow, wood, metal); dist 0 = yours
    step(dist = 0, pan = 0, vol = 1, surf) {
      if (!ctx) return;
      const t = ctx.currentTime, j = rand(0.9, 1.1);
      const s = STEP[surf] ? surf : myFloor();
      const o = out(STEP_GAIN[s] * vol * 0.42 / (1 + dist * 0.16), pan, dist > 0 ? clamp(7000 / (1 + dist * 0.12), 1200, 7000) : 9000, dist > 0 ? 0.12 : 0.04, "step");
      (STEP[s] || STEP.sand)(o, t, j);
      if (Math.random() < 0.35) burst(o, t + rand(0.02, 0.07), "bandpass", rand(4200, 6000), 6, 0.06, 0.001, 0.03);   // kit rattle
    },
    // landing from a jump or a drop: both feet and the kit
    land(hard = 0, surf) {
      if (!ctx) return;
      const s = STEP[surf] ? surf : myFloor(), F = STEP[s] || STEP.sand, t = ctx.currentTime;
      const o = out((0.09 + hard * 0.15) * (STEP_GAIN[s] || 1), 0, 9000, 0.05, "step");
      F(o, t, 0.93); F(o, t + 0.025, 1.04);
      tone(o, t, "sine", 70, 40, 0.3 + hard * 0.4, 0.003, 0.12);
      burst(o, t + 0.03, "bandpass", 5200, 5, 0.1 + hard * 0.12, 0.001, 0.05);
    },
    cue(kind) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.32, 0, 12000, 0, "ui");
      const notes = kind === "win" ? [392, 523, 659] : kind === "lose" ? [392, 330, 262] : kind === "match" ? [392, 523, 659, 784] : [523, 523];
      notes.forEach((f, i) => tone(o, t + i * 0.13, "triangle", f, f, 0.5, 0.01, 0.22));
    },
    /* ---------- knife, grenades and the bomb ---------- */
    swing(heavy) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(heavy ? 1 : 0.8);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.6;
      f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(heavy ? 2600 : 3400, t + 0.16);
      s.connect(f).connect(env(o, 0.8, t, 0.05, heavy ? 0.2 : 0.13));
      s.start(t, Math.random() * 0.5, 0.35);
    },
    stab(flesh) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.6);
      if (flesh) { burst(o, t, "lowpass", 700, 0.8, 0.9, 0.002, 0.12); tone(o, t, "sine", 160, 70, 0.6, 0.002, 0.1); }
      else { tone(o, t, "triangle", 2400, 2300, 0.35, 0.001, 0.12); burst(o, t, "highpass", 3500, 1, 0.5, 0.001, 0.04); }
    },
    pin() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.4);
      burst(o, t, "bandpass", 3200, 4, 0.6, 0.001, 0.03);
      tone(o, t + 0.05, "sine", 2900, 2700, 0.2, 0.001, 0.08);
    },
    bounce(dist = 2, pan = 0) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.6 / (1 + dist * 0.12), pan);
      tone(o, t, "triangle", rand(1500, 2100), 1200, 0.5, 0.001, 0.05);
      burst(o, t, "bandpass", 2200, 2, 0.4, 0.001, 0.03);
    },
    boom(dist = 0, pan = 0, big = false) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out((big ? 2.2 : 1.5) / (1 + dist * 0.06), pan, clamp(9000 - dist * 160, 600, 9000), big ? 0.9 : 0.6);
      tone(o, t, "sine", big ? 90 : 120, 28, 1.2, 0.004, big ? 1.2 : 0.7);
      burst(o, t, "lowpass", 1400, 0.6, 1.2, 0.003, big ? 1.6 : 0.9, 0.6);
      burst(o, t, "bandpass", 700, 0.7, 0.9, 0.002, 0.3);
      burst(o, t + 0.08, "lowpass", 380, 0.5, 0.5, 0.05, big ? 2.4 : 1.4, 0.4);
    },
    pop(dist = 0, pan = 0) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(1.1 / (1 + dist * 0.08), pan);
      burst(o, t, "highpass", 1800, 0.7, 1.1, 0.001, 0.12);
      tone(o, t, "sine", 260, 90, 0.7, 0.002, 0.12);
    },
    // flashbang ringing: a pure tone that dies away over the blind time
    ring(dur) {
      if (!ctx || dur < 0.6) return;
      const t = ctx.currentTime, o = out(0.12);
      tone(o, t, "sine", 3150, 3100, 0.7, 0.05, dur);
    },
    hiss(dist = 0, pan = 0) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.25 / (1 + dist * 0.1), pan);
      burst(o, t, "highpass", 2500, 0.5, 0.8, 0.05, 1.6, 0.7);
      burst(o, t + 0.4, "bandpass", 1200, 0.5, 0.4, 0.3, 2.2, 0.5);
    },
    beep(urgent) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(urgent ? 0.85 : 0.65);
      tone(o, t, "square", 1960, 1960, 0.18, 0.002, 0.06);
    },
    plantTick() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.6);
      tone(o, t, "square", 1250 + rand(-60, 60), 1250, 0.12, 0.002, 0.04);
    },
    defuseTick() {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.6);
      burst(o, t, "bandpass", 2800, 3, 0.4, 0.001, 0.03);
    },
    announce(kind) {
      if (!ctx) return;
      const t = ctx.currentTime, o = out(0.32, 0, 12000, 0, "ui");
      const notes = kind === "planted" ? [660, 660, 880] : kind === "defused" ? [523, 659, 784, 1046] : [440, 440];
      notes.forEach((f, i) => tone(o, t + i * 0.11, "square", f, f, 0.18, 0.005, 0.12));
    },
    // tests: render fn()'s sounds offline and measure them (peak, loudness, length, brightness)
    async _render(secs, fn, raw = false) {
      const keep = [ctx, master, noiseBuf, rev];
      // the sound starts after a short warm-up so the compressors are settled, as in the game
      const pre = 0.256, oc = new OfflineAudioContext(2, Math.ceil(44100 * (secs + pre)), 44100);
      let buf;
      try {
        setup(oc);
        oc.suspend(pre).then(() => { fn(); oc.resume(); });
        buf = await oc.startRendering();
      } finally { [ctx, master, noiseBuf, rev] = keep; }
      const skip = Math.round(pre * 44100);
      const L = buf.getChannelData(0).subarray(skip), R = buf.getChannelData(1).subarray(skip), win = 2205, env = [];
      let peak = 0, sum = 0, bad = 0, zc = 0, last = 0, sumL = 0, sumR = 0;
      for (let i = 0; i < L.length; i++) {
        const v = L[i];
        if (!isFinite(v) || !isFinite(R[i])) { bad++; continue; }
        peak = Math.max(peak, Math.abs(v), Math.abs(R[i])); sum += v * v; sumL += v * v; sumR += R[i] * R[i];
        if ((v > 0) !== (last > 0) && Math.abs(v) > 1e-4) zc++;
        last = v;
        if (i % win === win - 1) { env.push(+Math.sqrt(sum / win).toFixed(4)); sum = 0; }
      }
      const thr = Math.max(...env) * 0.03;
      let tail = env.length - 1; while (tail > 0 && env[tail] < thr) tail--;
      const res = { peak: +peak.toFixed(3), bad, len: +((tail + 1) * win / 44100).toFixed(2), zcr: Math.round(zc / secs), env, lr: +(Math.sqrt(sumL) / (Math.sqrt(sumR) || 1e-9)).toFixed(2) };
      if (raw) {     // interleaved stereo float32 as base64, for offline analysis
        const I = new Float32Array(L.length * 2);
        for (let i = 0; i < L.length; i++) { I[2 * i] = L[i]; I[2 * i + 1] = R[i]; }
        const u8 = new Uint8Array(I.buffer); let bin = "";
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        res.raw = btoa(bin);
      }
      return res;
    }
  };
})();

