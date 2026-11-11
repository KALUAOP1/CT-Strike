/* ============================================================
   World: photo-textured map, colliders, navigation
   ============================================================ */
// small canvas textures for effects (flash, bullet holes, smoke)
function canvasTex(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// Photo-scanned PBR materials. Box UVs are in world units (see boxGeo), so repeat stays 1.
const MAT = {
  sand: pbr("sand", { repeat: 160 / 3.2, mat: { vertexColors: true, color: 0xf2e8d8 } }),
  stone: pbr("stone", { mat: { color: 0xf4ece0 } }),
  plaster: pbr("plaster"),
  crate: pbr("crate", { mat: { map: crateMap() } }),
  trim: null, distant: null, glassDark: null, frameWood: null
};
MAT.trim = MAT.stone.clone();
MAT.trim.color = new THREE.Color(0xe9dcc6);
MAT.distant = MAT.plaster.clone();
MAT.distant.color = new THREE.Color(0xe8dccb);
MAT.glassDark = new THREE.MeshStandardMaterial({ color: 0x14110d, roughness: 0.9 });
MAT.frameWood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85, normalMap: MAT.crate.normalMap });

// Crate faces: the plank photo plus a darker frame and a diagonal brace, composited once loaded.
function crateMap() {
  const s = 1024, c = document.createElement("canvas");
  c.width = c.height = s;
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = MAX_ANISO;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext("2d"), b = 112;
    g.drawImage(img, 0, 0, s, s);
    g.fillStyle = "rgba(255,236,200,.08)"; g.fillRect(0, 0, s, s);
    const board = (x, y, w, h, angle) => {
      g.save();
      g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.translate(x + w / 2, y + h / 2); g.rotate(angle);
      g.drawImage(img, -s / 2, -s / 2, s, s);
      g.fillStyle = "rgba(48,30,14,.32)"; g.fillRect(-s, -s, s * 2, s * 2);
      g.restore();
    };
    // diagonal brace first, frame on top
    g.save();
    g.translate(s / 2, s / 2); g.rotate(-Math.PI / 4);
    g.beginPath(); g.rect(-s * 0.72, -b / 2, s * 1.44, b); g.clip();
    g.rotate(Math.PI / 2); g.drawImage(img, -s / 2, -s / 2, s, s);
    g.fillStyle = "rgba(48,30,14,.26)"; g.fillRect(-s, -s, s * 2, s * 2);
    g.restore();
    g.strokeStyle = "rgba(20,12,5,.45)"; g.lineWidth = 6;
    g.save(); g.translate(s / 2, s / 2); g.rotate(-Math.PI / 4); g.strokeRect(-s * 0.72, -b / 2, s * 1.44, b); g.restore();
    board(0, 0, s, b, Math.PI / 2); board(0, s - b, s, b, Math.PI / 2);
    board(0, 0, b, s, 0); board(s - b, 0, b, s, 0);
    // shadow line inside the frame + nail heads
    g.strokeStyle = "rgba(20,12,5,.55)"; g.lineWidth = 8;
    g.strokeRect(b + 4, b + 4, s - 2 * b - 8, s - 2 * b - 8);
    g.strokeStyle = "rgba(255,230,190,.12)"; g.lineWidth = 3;
    g.strokeRect(2, 2, s - 4, s - 4);
    g.fillStyle = "#2a2118";
    for (const [x, y] of [[b / 2, b / 2], [s - b / 2, b / 2], [b / 2, s - b / 2], [s - b / 2, s - b / 2], [s / 2, b / 2], [s / 2, s - b / 2], [b / 2, s / 2], [s - b / 2, s / 2]]) {
      for (const d of [-18, 18]) { g.beginPath(); g.arc(x + d, y, 5, 0, Math.PI * 2); g.fill(); }
    }
    t.needsUpdate = true;
  };
  img.src = TEXDATA.crate_d;
  return t;
}

// Box with texture density in world units, so blocks stay the same size on every wall.
function boxGeo(w, h, d, unit) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (unit) {
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / unit, uv.getY(k) * dims[f][1] / unit);
    }
  }
  return g;
}

/* ---------- merge the static map into a few meshes (one draw call per material) ----------
   The map is built from hundreds of small boxes and window frames; each one is its own
   draw call, twice a frame (main pass + shadow pass). Once the map is built nothing in it
   moves, so bake every mesh's transform into its geometry and fuse the meshes that share
   a material into one. Colliders (movement, bot vision) and the raycast list stay intact:
   solidMeshes is rebuilt to point at the merged meshes, and a bullet hit's face normal is
   already in world space because the merged mesh sits at the origin. Dynamic things added
   later (bots, drops, holes, tracers) are not touched. */
function mergeStatic() {
  scene.updateMatrixWorld(true);
  const groups = new Map(), mergedFrom = new Set();
  const collect = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const m = o.material;
    // skip what cannot (or should not) be fused: multi-materials, invisible raycast
    // boxes, transparent decals, the tinted ground, anything without UVs or an index
    if (Array.isArray(m) || !m || m.visible === false || m.transparent) return;
    const g = o.geometry;
    if (!g || !g.attributes.position || g.attributes.color || !g.attributes.uv || !g.index) return;
    collect.push(o);
  });
  for (const mesh of collect) {
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder].join("|");
    if (!groups.has(key)) groups.set(key, { mat: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder, solid: false, parts: [] });
    const G = groups.get(key);
    G.parts.push(mesh);
    if (solidMeshes.includes(mesh)) G.solid = true;
  }
  const _nm = new THREE.Matrix3(), _p = new THREE.Vector3(), _n = new THREE.Vector3();
  for (const G of groups.values()) {
    let vCount = 0, iCount = 0;
    for (const mesh of G.parts) { vCount += mesh.geometry.attributes.position.count; iCount += mesh.geometry.index.count; }
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
    const idx = new Uint32Array(iCount);
    let vOff = 0, iOff = 0;
    for (const mesh of G.parts) {
      const g = mesh.geometry, srcP = g.attributes.position, srcN = g.attributes.normal, srcU = g.attributes.uv, srcI = g.index;
      _nm.getNormalMatrix(mesh.matrixWorld);
      for (let i = 0; i < srcP.count; i++) {
        _p.fromBufferAttribute(srcP, i).applyMatrix4(mesh.matrixWorld);
        pos[(vOff + i) * 3] = _p.x; pos[(vOff + i) * 3 + 1] = _p.y; pos[(vOff + i) * 3 + 2] = _p.z;
        if (srcN) {
          _n.fromBufferAttribute(srcN, i).applyMatrix3(_nm).normalize();
          nor[(vOff + i) * 3] = _n.x; nor[(vOff + i) * 3 + 1] = _n.y; nor[(vOff + i) * 3 + 2] = _n.z;
        }
        if (srcU) { uv[(vOff + i) * 2] = srcU.getX(i); uv[(vOff + i) * 2 + 1] = srcU.getY(i); }
      }
      for (let i = 0; i < srcI.count; i++) idx[iOff + i] = srcI.getX(i) + vOff;
      vOff += srcP.count; iOff += srcI.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere(); out.computeBoundingBox();
    const m = new THREE.Mesh(out, G.mat);
    m.castShadow = G.cast; m.receiveShadow = G.receive; m.renderOrder = G.order;
    scene.add(m);
    if (G.solid) solidMeshes.push(m);
    for (const mesh of G.parts) {
      mergedFrom.add(mesh);
      const at = solidMeshes.indexOf(mesh);
      if (at >= 0) solidMeshes.splice(at, 1);   // never splice(-1): that eats the wrong entry
      mesh.parent && mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    }
  }
  // empty window-frame groups left behind by the merge
  const dead = [];
  scene.traverse((o) => { if (o.type === "Group" && o.children.length === 0 && o !== scene) dead.push(o); });
  for (const o of dead) o.parent && o.parent.remove(o);
  return { groups: groups.size, merged: mergedFrom.size };
}

/* ---------- map layout (metres; north is -z) ---------- */
const MAP_HALF = 32;
const colliders = [];     // {minX,maxX,minY,maxY,minZ,maxZ}
const solidMeshes = [];   // for bullet raycasts

function addBlock(x, z, w, d, h, mat, y = 0, opts = {}) {
  const unit = opts.unit !== undefined ? opts.unit : mat === "crate" ? 0 : mat === "stone" || mat === "trim" ? 2.4 : 3.2;
  const mesh = new THREE.Mesh(boxGeo(w, h, d, unit), MAT[mat]);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (opts.solid !== false) {
    solidMeshes.push(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y, maxY: y + h, mat });
  }
  // a capstone along the top of stone walls
  if (mat === "stone" && h > 2 && opts.cap !== false) addBlock(x, z, w + 0.14, d + 0.14, 0.16, "trim", y + h, { solid: false });
  return mesh;
}
// Plaster house: stone plinth, cornice, and dark window openings with wooden frames.
function house(x, z, w, d, h) {
  addBlock(x, z, w, d, h, "plaster");
  addBlock(x, z, w + 0.1, d + 0.1, 0.5, "trim", 0, { solid: false });
  addBlock(x, z, w + 0.3, d + 0.3, 0.24, "trim", h - 0.12, { solid: false });
  const faces = [[x + w / 2, z, d, Math.PI / 2], [x - w / 2, z, d, -Math.PI / 2], [x, z + d / 2, w, 0], [x, z - d / 2, w, Math.PI]];
  for (const [fx, fz, len, ry] of faces) {
    const n = len > 8 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (k ? 1 : -1) * len * 0.22;
      windowAt(fx + Math.cos(ry) * off, h * 0.56, fz - Math.sin(ry) * off, ry);
    }
  }
}
const winGeo = { hole: new THREE.PlaneGeometry(0.9, 1.15), side: new THREE.BoxGeometry(0.09, 1.31, 0.09), top: new THREE.BoxGeometry(1.08, 0.09, 0.09), sill: new THREE.BoxGeometry(1.25, 0.1, 0.2) };
function windowAt(x, y, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const at = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = geo !== winGeo.hole; m.receiveShadow = true; g.add(m); };
  at(winGeo.hole, MAT.glassDark, 0, 0, 0.012);
  at(winGeo.side, MAT.frameWood, -0.495, 0, 0.03);
  at(winGeo.side, MAT.frameWood, 0.495, 0, 0.03);
  at(winGeo.top, MAT.frameWood, 0, 0.62, 0.03);
  at(winGeo.sill, MAT.trim, 0, -0.63, 0.08);
  scene.add(g);
}
function crate(x, z, s = 1.4, y = 0, rot = 0) {
  const m = addBlock(x, z, s, s, s, "crate", y);
  if (rot) m.rotation.y = rot; // visual only; small rotations keep the box collider honest
  return m;
}

/* ---------- bomb sites and spawns ----------
   CTs spawn in the south and defend; Ts spawn in the north and attack.
   Sites are rectangles you can plant in. Entrances are where attackers
   come from (defenders face them). Stages are where Ts gather before
   they hit a site. */
const SITES = {};   // filled by the chosen map in g02b_maps.js
const siteAt = (x, z) => {
  for (const s of Object.values(SITES)) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) return s;
  return null;
};
const SPAWN = {
  CT: { z: 30.2, xs: [-8, -4, 0, 4, 8], yaw: 0 },
  T: { z: -29.5, xs: [-12, -6, 0, 6, 12], yaw: Math.PI }
};
const inBuyZone = (team, p) => Math.abs(p.x) < 15 && (team === "CT" ? p.z > 20 : p.z < -19);

function siteDecal(s) {
  const tex = canvasTex(256, (g, n) => {
    g.clearRect(0, 0, n, n);
    g.strokeStyle = "rgba(196,58,32,.85)"; g.lineWidth = 10;
    g.beginPath(); g.arc(n / 2, n / 2, n * 0.42, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(196,58,32,.9)";
    g.font = `700 ${n * 0.62}px Arial, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(s.id, n / 2, n / 2 + n * 0.03);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(s.x, 0.012, s.z);
  m.receiveShadow = true;
  scene.add(m);
}

