# Dustline: work log + plan for the next chat

## How to resume (read this first)
The user uploads `dustline.html` into a new chat. This note is embedded at the very end of that file.
1. Split it into editable parts: recreate `split.py` (below), run `python3 split.py dustline.html src`.
2. Edit the modules in `src/`, then rebuild with `build.sh` (below) into `dustline.html`.
3. The user writes Hinglish. Reply in short Hinglish.
4. Image rule from the user: **at most 6 images per chat** (more than 8 breaks the chat). Check results with text tests.
   Combine screenshots into one contact sheet. When the budget runs out, update this note, rebuild, hand over
   dustline.html and ask the user to start a new chat.

Markers in dustline.html (one per line, before each part): `/*@@BLOB b_fonts.css*/`, `/*@@BLOB ui.html*/`,
`<!- -@@BLOB c_three.html- ->`, `<!- -@@BLOB d_script_start.js- ->`, `//@@BLOB e_tex.js`, `//@@MODULE gXX.js`,
and this note between `<!- -@@NOTES PROGRESS.md` and `@@END NOTES- ->`. Everything before the first marker is blobs/a_head.html.
In this copy, every double hyphen was written as "- -" (it has to live inside an HTML comment).

split.py:
```
import sys, os, re
src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, "blobs"), exist_ok=True)
pat = re.compile(r'^(?:/\*@@BLOB (\S+)\*/|<!- -@@BLOB (\S+)- ->|//@@BLOB (\S+)|//@@MODULE (\S+)|<!- -@@NOTES (\S+))$')
name, buf = "blobs/a_head.html", []
def flush():
    if name: open(os.path.join(out, name), "w").write("".join(buf))
for line in open(src, encoding="utf-8"):
    m = pat.match(line.rstrip("\n"))
    if m:
        flush(); buf = []
        n = [x for x in m.groups() if x][0]
        name = n if (m.group(4) or m.group(5) or n == "ui.html") else "blobs/" + n
        continue
    if line.startswith("@@END NOTES- ->"): continue
    buf.append(line)
flush()
```
(In the regex and the END line, write the "- -" as two real hyphens.)

build.sh (run from src/):
```
OUT=${1:-../dustline.html}
{ cat blobs/a_head.html; echo "/*@@BLOB b_fonts.css*/"; cat blobs/b_fonts.css
  echo "/*@@BLOB ui.html*/"; cat ui.html
  echo "<!- -@@BLOB c_three.html- ->"; cat blobs/c_three.html
  echo "<!- -@@BLOB d_script_start.js- ->"; cat blobs/d_script_start.js
  echo "//@@BLOB e_tex.js"; cat blobs/e_tex.js
  for f in $(LC_ALL=C ls g[0-9][0-9]*.js); do echo "//@@MODULE $f"; cat "$f"; done
  echo "<!- -@@NOTES PROGRESS.md"; sed 's/- -/- -/g' PROGRESS.md; echo "@@END NOTES- ->"; } > "$OUT"
```
(Again: real double hyphens. The sed turns every double hyphen into "- -".)

## What the game is now (all DONE and tested, 2026-11-11)
A single-file three.js CS2-style shooter, about 2.9 MB, fully offline. It contains inlined three.js r149 UMD,
Barlow fonts, Poly Haven JPEGs in TEXDATA, and Web Audio synthesised sound.
Modules (LC_ALL=C order):
- g01_core: renderer, loadTex/pbr, sun + hemi lights, sky/IBL, Sound (see "Sound" below).
- g02_world: MAT, boxGeo, addBlock(x,z,w,d,h,mat,y,{solid,shadow,unit,cap}), house, windowAt, crate, SITES={}, siteAt, SPAWN, inBuyZone, siteDecal.
- g02b_maps: MAP_LIST/MAP_ID/MAP (?map=dust|harbor|frost), groundPlane, perimeter, buildDust/buildHarbor/buildFrost, menu map picker.
- g02c_nav: collideCircle, lineClear, surfaceAt(x,z,y) (sand/concrete/snow/wood/metal from the collider's `mat`), NAV (1 m grid, A*, string pull).
- g03_guns: WEAPONS, gun models (Kit/prof helpers), GM materials.
- g03b_knife_nades: knife and grenades for the player.
- g04_player, g05_viewmodel, g06_shoot (tryFire raycasts solidMeshes + Bots.hitMeshes).
- g07_ents: DIFFICULTY, hurt, killEnt.
- g07a_models: Soldiers (CT = SAS gas mask + plate carrier, T = balaclava + plaid + soft vest; invisible hit proxies).
  Rig: group (feet, yaw) > hips > upper (waist pivot y 0.92) > torso (offset -0.92: body, arms, helmet, guns, head/body proxies);
  hips > legs[i] (hip at x ±0.105, y 0.92) > shins[i] (knee at 0,-0.44,-0.012). Thigh 0.44, shin 0.465.
  Arm sets in the torso: rifleArms, pistolArms (also used for planting), limpArms (dead).
- g07b_bots: bots, Brain objective AI, buying, eco rounds, fetching better guns from the floor.
- g07c_drops: Drops (world guns: spawn, onDeath, playerDrop, use (E), botGoal/botTake with claims, floorAt).
- g07d_anim: BotAnim (reset, pose(b,dt,now,{kneel,crouch,pitch,typing}) returns true on footfall, die, dead).
- g08_nades, g09_bomb (plant/defuse, C4), g10_economy, g11_game (rounds, halftime, menus, show(id)), g12_hud (radar, feed, board),
  g12b_settings (Settings screen + fitScreens + fps counter), g13_loop (frame, `#test` hook).
  NOTE: g13_loop ends with `})();</script></body></html>`, so any new module must sort BEFORE g13 (e.g. g12c_*.js).

Settings (Upgrade 3b): SET_KEY/SET_DEFAULT/SETTINGS + pixelRatio() live in d_script_start.js (before the renderer,
because antialias can only be chosen when the renderer is made; the AA change says "reload the page to apply").
Saved in localStorage "dustline.settings.v1" (try/catch, falls back to defaults). g12b_settings.js: presets
low/medium/high/ultra set res (pixel ratio %), shadows off/low 1024 PCF/high 2048 PCFSoft/ultra 4096 (materials get
needsUpdate when the shadow type flips), aa. Changing res/shadows/aa by hand turns the preset into "custom" (no radio).
Also FOV (SCOPE_FOV[0], used by g04 look and g05 setScope), brightness (toneMappingExposure), FPS counter,
5 volume sliders (squared, then Sound.setVol bus), mouse/scoped sensitivity + invert (g04 applyLook), crosshair
colour (- -xhair) and size (- -xs; g12 uses SETTINGS.xsize for the arm offsets). Esc or Back returns to menu/pause.
Menu fit: every .screen panel is CSS-zoomed by fitScreens() (min(1, avail/size)); #menu and #settings also try a
one-column `.stack` layout and keep the bigger one. Runs on resize, show(), fonts.ready and a rAF size watch.
Menu = 2 columns (left: logo, tagline, pickers, Deploy + Settings; right: Controls box).

Rules: 5v5 (4 bot teammates), first to 7 rounds, sides swap after round 6.
Keys: 1/2/3/4 weapons/knife/nades, E plant/defuse/swap gun, G drop gun (bomb when on knife/nade), M big map, B buy, Tab scoreboard, F inspect.

Movement (g04, Source-like): friction 5.2, accelerate 5.5, stopspeed 2.0 (only with no key held), air accelerate 12,
air wish speed 0.8, re-press Space to jump again. Measured: AK full speed in 0.5 s, glide stop 0.32 s,
counter-strafe stop 0.12 s, walk 2.34, crouch 1.8, jump air time 0.58 s.

Sound (g01, all synthesised, no game files):
- setup(ctx): master (MASTER 0.5 x VOL.master) -> ONE limiter (thr -10, knee 8, ratio 12, att 2 ms) -> soft clip
  WaveShaper (linear to 0.8, tanh above) -> out; plus a shared ConvolverNode reverb; makeIR() makes a per-map impulse
  response (dust: dry + slapback, harbor: long, frost: bright). out(vol, pan, cutoff, wet, bus) sends to it after the
  panner; bus = "gun" | "step" | "fx" | "ui" scales by VOL[bus]. Sound.setVol(bus|"master", 0..1), Sound.vol.
- Envelope helpers: env2 (linear attack, hold, setTargetAtTime tau decay; exp ramps died too fast),
  nz(dest,t,filterType,freq,q,peak,a,h,tau) noise layer, osc(dest,t,type,f0,f1,glide,peak,a,h,tau).
  Narrow bandpass noise is ~20 dB quieter than a sine at the same gain, so noise layers use big gains.
- shot(kind, dist, pan, occluded): layers crack (hp noise), blast (lp noise) + bark (bp noise) + thump + sub (all through
  the tanh grit clipper, G.drive), air (hp 6.5k), ring (bp), mech click (close), tail (lp noise with falling cutoff).
  Per-gun numbers in GUN{} (Sound._gun), tuned against the user's CS2 clips (Upgrade 3b, numbers only, never the audio):
  window RMS targets in dB rel. 10-50 ms, e.g. AK 0/+1.4/-6.8/-6.7/-17, Deagle 0/+1.9/-1.2/-6.9/-15.2,
  AWP 0/-3/-5.7/-8.6/-11.3 (windows 50-150/150-300/300-600/600-1200 ms). Peaks now: ak .67, m4 .45, awp .83,
  de .74, glock .54, far 30 m .21, 8 AWPs + boom + dink pile .95 (soft clip), steps ~.07-.1, dink .64.
  Air absorption lowpass and quieter dry with distance; occluded (bots use lineClear chest -> camera) = lowpass 950.
- dink() = the headshot sound, modelled on ONE headshot from the user's clip (user: "not 4 only 1"): wooden tok
  720 Hz + 1250 Hz, low thump at +45 ms, crunch at +50 ms, debris grains, short helmet ring.
- bolt(delay) (AWP, synced to the viewmodel bolt), whiz(pan) (near miss), draw(kind), reload(dur, kind, empty) timed to
  the reload animation (mag out 0.12, seat 0.7, charging handle / slide release when empty), foley(land|pickup|drop).
- step(dist, pan, vol, surf) and land(hard, surf): surface-specific footsteps; surf defaults to what the player stands on.
- brass() rings on hard floors, is muffled in snow.
- Sound._render(secs, fn, raw) renders offline and returns {peak, len, zcr, env, lr} for tests. It warms up 0.256 s
  first (oc.suspend) because Chrome's compressor fades in at context start, which made old level numbers wrong.

All maps share one frame: 64x64 m, CT spawn in the south (z = +30), T spawn in the north, site A in the west, B in the east.
Per-map data: SITES (entrances, stages, optional smoke), MAP.midHold, theme, optional MAP.tick(dt, camera).

Bot balance: all bot timers use Game.time.
- Defender bonus (CT before the plant, T after): hit x1.2, react x0.85.
- Anchor (holding still): react x0.5, hit x1.4 for 2.5 s.
- Shooting while moving: hit x0.82.
- Eco rounds.
Bot-only 4v4 runs have big variance, so judge balance over several runs.

## Test harness (sandbox)
- Use Playwright with the FULL chromium (~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome), not headless-shell (it segfaults).
- Launch args: `- -use-gl=angle - -use-angle=swiftshader - -enable-unsafe-swiftshader`.
- Chromium needs a stub libXdamage.so.1. Compile it with gcc: XDamageQueryExtension, QueryVersion, Create, Destroy, Subtract and Add, all returning 0. Put it on LD_LIBRARY_PATH and set TMPDIR=/tmp.
- /tmp can be wiped by VM restarts, so keep test scripts in the outputs folder.
- Do not run more than 2 browsers at once.
- run.py (keep in outputs/harness): wraps the test script as `async (out) => {...}`, catches errors into out.ERROR,
  prints the returned JSON (so end scripts with `return out;`), then console errors/warnings. Usage:
  `python3 run.py page.html script.js "?query" shot.png`. For screenshots set Game.paused = true (it still renders),
  place the camera, wait 2.5 s; hide VM.root for third-person shots.
- `#test` hook `window.__dl`:
  - objects: Game, player, Bots, Bomb, Nades, Economy, SITES, SPAWN, NAV, MAP, colliders, camera, solidMeshes, WEAPONS
  - functions: sim(sec, onTick), shootAt(bot, part), setSide, forceLock, giveWeapon, hurt, lineClear, equip, startReload
  - also: Drops, BotAnim, C4VM, Sound, HUD, VM, arms, keys, surfaceAt
- Useful tests to rewrite:
  - spawn-to-spawn sightlines with lineClear (should be under 4%);
  - NAV.path from both spawns to every site, stage and entrance;
  - stuck bots;
  - 4v4 bot-only balance (bench one enemy bot, skip the player);
  - hit proxies with shootAt;
  - the map picker reload (?map=&diff=&side=).
- Kept in outputs/harness (Upgrade 3b): smoke.js, move.js, sndall.js (every Sound method: peak/len, bus test),
  sndrt.js, t_set.js (all settings), fit.py (DOM boxes of menu/settings/pause/over at many window sizes,
  SIZES=1366x768,800x600 env; the tool call limit is ~3 min so test 3-4 sizes per call),
  prof2.py/rall.py/tune.sh (sound profiling: window RMS + 5-band tilt against reference clips decoded to aud/*.f32).
- CSS gotcha: `.screen p` (margin 0 0 24px) beats a plain `.tagline` rule; use `.screen .tagline`.

## NEXT: Phase 2 (multiplayer) in a new chat. Then Phase 3 (visuals).
## The user's request (decided 2026-11-11)
User's words: "expand map and build some house i can go in, pick other players gun, animation when someone die,
animation of bomb planting, key for open map, good menu like cs2 to buy guns with images of guns, skins of guns,
more improved characters textures and guns textures more realistic, realistic movement for players,
sound for guns like cs2, make it multiplayer".

User's choices:
- Multiplayer: **online with a room code** (PeerJS public broker + WebRTC; host runs the game).
- Sounds: "like cs2" (synthesise them; don't copy game audio files).
- Do it all in new chats.

Suggested order, so each chat stays within 6 images:

**Phase 1: gameplay: DONE (Upgrade 3, 2026-11-11)**
- [x] **Weapon drops.** Guns fall from the dead with physics and lie on the floor (floorAt). Walk over to pick up into an
  empty slot, E swaps, G drops yours. Bots fetch better guns (claims expire after 0.5 s; unreachable drops are skipped
  for 6 s). Drops are cleared at round start.
- [x] **Death animation.** die(b) picks the fall from the killer's angle: back (shot from the front), front (from
  behind), side, or crumple (60% of headshots, always falls sideways). Legs buckle, the body tips with an ease-in, a
  small bounce, limp arms. The player's death cam falls, rolls and turns toward the killer.
- [x] **Bomb plant animation.** First person: C4VM (C4 in both hands, finger tapping the keypad with each beep).
  Third person: the bot kneels and types; the C4 leaves its back and is laid 0.55 m in front (plantSpot) after 0.55 s.
- [x] **Full map key.** M toggles #bigmap (canvas 1000 px drawn from colliders, cached layer): sites, spawns, drops,
  bomb (CTs only see it once planted), teammates with view cones, spotted enemies, dead crosses.
- [x] **Realistic movement.** Source-like player physics (numbers above), head bob, landing dip, viewmodel roll/bob.
  Bots: walk/run cycle from real ground speed, strafing, foot shuffle when turning, crouch when spraying, aim pitch,
  footsteps on footfalls.
- [x] **CS2-like gun sounds.** Layered synthesis, reverb per map, distance + occlusion, bolt/draw/reload foley,
  near-miss whiz, surface footsteps (sand, concrete, snow, wood, metal). No suppressed gun exists yet, so no
  suppressed variant (add one with skins/new guns if wanted).

**Phase 2: multiplayer (online room code)**
- [ ] **Library.** Vendor the PeerJS UMD build (npm `peerjs`) inline. Use the public broker 0.peerjs.com and Google STUN.
- [ ] **Room codes.** The menu has "Host game", which shows a short code (the peer id is a prefix plus 5 characters), and "Join game", where you enter the code and pick a team.
- [ ] **Host-authoritative.** The host runs the full simulation: bots, bomb, economy, rounds and damage.
  - Clients send input and pose about 30 times a second, plus fire, buy and plant events.
  - The host sends snapshots about 20 times a second (players, bots, bomb, round state, kill feed).
  - Clients interpolate other players about 100 ms behind.
- [ ] **Bots and disconnects.** Bots fill the empty slots, up to 5v5. If a client disconnects, a bot takes their place.
- [ ] **Remote players.** Draw them with Soldiers models and their own guns.
- [ ] **Testing.** Put the network behind a transport interface. Tests can then run two pages locally over BroadcastChannel, so you don't depend on the internet.
- [ ] **Tell the user** that some strict networks need TURN, which is not included.

**Phase 3: visuals**
- [ ] **Bigger maps.** Expand the arena (for example MAP_HALF 48; the NAV grid scales with it) and add houses you can enter:
  - door openings at least 2.4 m wide so NAV works;
  - rooms and windows;
  - roofs as colliders above 2 m, which NAV and the radar ignore (radar filter: minY < 2).
  - A second floor needs stairs and step-up physics, so only do it if time allows.
- [ ] **CS2-style buy menu.** Categories: pistols, mid-tier, rifles, gear, grenades. Each card shows a rendered gun image. Render the real 3D gun models to thumbnails at load with an offscreen renderer. Cards show the price and kill reward, and work with click or number keys.
- [ ] **Gun skins.** Original canvas-generated patterns, not real CS skin art: a red line pattern, an orange/white sci-fi look, a fade gradient, a dragon-like design, camo, carbon. Add a loadout/skin picker in the menu. Skins show on the viewmodel, in inspect, and on world guns.
- [ ] **Better textures.**
  - Characters: fabric detail, seams, wear and dirt; generated normal and roughness maps.
  - Guns: worn metal edges, anodised finish, wood grain, rubber grips.

## History
- Upgrade 1 (2026-11-11): grenades + knife, 5v5 with bot teammates, bomb plant/defuse, economy, halftime, map fixes.
- Upgrade 2 (2026-11-11): 3D CT/T models from the user's reference pictures; maps Harbor (containers, covered B, cranes) and Frostbite (cabins, pines, snow); map picker; balance rework; sim clock fix.
- Upgrade 3 (2026-11-11): Phase 1 gameplay: weapon drops + pickup, bot body animation (walk, crouch, kneel), death falls
  and death cam, C4 plant animations, M big map, Source-like movement, new synthesised gun sounds with reverb,
  occlusion, foley and surface footsteps.
- Upgrade 3b (2026-11-11): user said the sound "volume galat" and sent CS2 clips (Deagle, AK, M4A4, AWP, Glock, headshots).
  Guns re-voiced and re-levelled from numbers measured off those clips; volume buses + limiter + soft clip; one new
  headshot sound; Settings screen (graphics, sound, controls, saved); menu text always fits the window.
- Upgrade 4 (2026-11-11): graphics/performance pass, no gameplay changes. (a) mergeStatic() in g02_world fuses the
  static map into one mesh per material at the end of map build (called from g02b_maps: `const MERGE_INFO = mergeStatic();`);
  bakes world transforms into the geometry, groups by (material uuid, castShadow, receiveShadow, renderOrder), rebuilds
  solidMeshes to point at the merged meshes (bullet raycasts + face normals unchanged; merged meshes sit at the origin
  so face normals are world space), disposes originals, removes empty groups. Skips multi-material, invisible
  (MeshBasicMaterial visible:false hit proxies), transparent, vertex-coloured or index-less geometry and
  InstancedMesh (frost trees) and dynamic MAP.tick things (frost snow). CAREFUL: when removing a mesh from
  solidMeshes use indexOf + `if (at >= 0) splice(at, 1)` — splice(-1, 1) eats the wrong entry (this bug zeroed
  solidMeshes once). (b) Radar static layer cached: H.radarLayer offscreen canvas in g12_hud (map bg, sites,
  collider rects, ring lines) drawn once; per frame only dots/bomb/letters/player arrow. (c) Texture anisotropy
  8 -> 16 (MAX_ANISO in g01_core, canvasTex in g02_world). (d) Bot LOD distance cull: small decorative soldier
  parts tagged `userData.detail` in g07a_models (DETAIL key set: cuff, patch, patchP, web, tan, chrome, lens, ring,
  harness, holster, plastic, velcro, tab, brass, pouch, panel, bind, belt), collected per bot into bot.detail in
  attach(); g07b_bots.update toggles their visibility every frame by distance to camera (>24 m hidden, squared
  check 576), runs for dead bots too, saves ~34 draw calls per far bot in main + shadow pass. Numbers measured in
  browser via #test hook (renderer.info with autoReset=false, one manual render — the count includes the shadow
  pass; renderer.info.shadowMap does not exist in r149): live round start 811 -> 443 calls (186k -> 175k tris),
  static map ~198 meshes -> a handful; one bot = 66 calls / 89 parts before the cull. Visual check: near bots identical,
  far bots lose only sub-pixel straps (screenshots in shots/). Verified: shootAt damage through merged geometry
  (100 -> 87 hp), raycast world hit + world-space normal, all three maps build with no console errors
  (dust 5 solid meshes, harbor 11, frost 15).
