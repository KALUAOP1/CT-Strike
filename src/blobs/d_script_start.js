<script>
(() => {
"use strict";
// Treat hex colours as sRGB so dark materials stay dark after tone mapping.
if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
/* ============================================================
   Dustline: core setup, helpers and synthesised sound
   ============================================================ */
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- player settings, saved in this browser (the screen is in g12b_settings.js) ---------- */
const SET_KEY = "dustline.settings.v1";
const SET_DEFAULT = { preset: "high", res: 100, shadows: "high", aa: 1, fov: 74, bright: 100, fps: 0,
  vMaster: 100, vGun: 100, vStep: 100, vFx: 100, vUi: 100, sens: 1, zsens: 1, invert: 0, xcol: "#6dff7a", xsize: 100 };
const SETTINGS = Object.assign({}, SET_DEFAULT);
try {
  const saved = JSON.parse(localStorage.getItem(SET_KEY) || "{}");
  for (const k in SET_DEFAULT) if (k in saved && typeof saved[k] === typeof SET_DEFAULT[k]) SETTINGS[k] = saved[k];
} catch (e) { /* storage blocked (private mode, file:// rules): just use the defaults */ }
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, SETTINGS.preset === "ultra" ? 2 : 1.5) * SETTINGS.res / 100;

/* ---------- renderer, scenes, cameras ---------- */
const canvas = $("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !!SETTINGS.aa, powerPreference: "high-performance" });
renderer.setPixelRatio(pixelRatio());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 400);
camera.rotation.order = "YXZ";
scene.add(camera);

// The gun is drawn in its own scene so it never clips into walls.
const wScene = new THREE.Scene();
const wCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = wCamera.aspect = w / h;
  camera.updateProjectionMatrix();
  wCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

/* ---------- photo textures (CC0, Poly Haven), inlined as data URIs by build.py ---------- */
const TEXDATA = {
