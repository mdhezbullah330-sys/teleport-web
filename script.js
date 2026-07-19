import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';

/* ============================================================================
   THRESHOLD — a small teleportation cinematic
   Structure:
   1. Renderer / scene / camera boot
   2. Procedural texture helpers (canvas-generated, no external images)
   3. Room builders (Talha's room / Tahmina's room)
   4. Teleport machine + particle swirl builder
   5. Character builders (stylised realistic humanoid placeholders)
   6. Camera rig + tween helpers
   7. The scripted sequence (Act I / II / III)
   8. Render loop
============================================================================ */

/* ---------------------------------------------------------------------------
   1. BOOT
--------------------------------------------------------------------------- */

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x03040a, 0.024);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
const cameraTarget = new THREE.Vector3(0, 1.5, 0); // what the camera looks at, tweened alongside position
camera.position.set(0, 1.6, 7.2);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------------------------------------------------------------------
   2. PROCEDURAL TEXTURES  (canvas -> CanvasTexture, zero external files)
--------------------------------------------------------------------------- */

function makeCanvas(w, h, painter) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  painter(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// subtle fibrous wall plaster
function wallTexture(base = '#171b21', hi = '#20262f') {
  const tex = makeCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? hi : base;
      ctx.globalAlpha = Math.random() * 0.06;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// wood-ish plank floor
function floorTexture(base = '#141110', plank = '#1b1613') {
  const tex = makeCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const plankH = 42;
    for (let y = 0; y < h; y += plankH) {
      ctx.fillStyle = plank;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y + 2, w, plankH - 4);
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.random() * w, y + Math.random() * plankH, 30, 1);
      }
    }
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#000';
    for (let y = 0; y <= h; y += plankH) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// soft carpet weave for Tahmina's room
function carpetTexture(base = '#241621', hi = '#2f1c2b') {
  const tex = makeCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? hi : base;
      ctx.globalAlpha = Math.random() * 0.08;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// glowing window: distant city skyline (Talha's room, cool tones)
function cityWindowTexture() {
  return makeCanvas(512, 320, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#050d16');
    grad.addColorStop(1, '#0b1c26');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const bw = 14 + Math.random() * 30;
      const bh = 60 + Math.random() * 200;
      const bx = Math.random() * w;
      ctx.fillStyle = '#020608';
      ctx.fillRect(bx, h - bh, bw, bh);
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 7) {
        for (let wy = h - bh + 6; wy < h - 6; wy += 10) {
          if (Math.random() > 0.6) {
            ctx.fillStyle = Math.random() > 0.5 ? '#7fe9e0' : '#3a5568';
            ctx.globalAlpha = 0.6 + Math.random() * 0.4;
            ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  });
}

// glowing window: dusk sky for Tahmina's room, warm/rose tones
function duskWindowTexture() {
  return makeCanvas(512, 320, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a1330');
    grad.addColorStop(0.55, '#7a3a5a');
    grad.addColorStop(1, '#e6a08f');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = Math.random() * 0.7;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h * 0.5, Math.random() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

// soft round sprite used for particle swirls
function sparkTexture() {
  return makeCanvas(64, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  });
}

const sparkTex = sparkTexture();

/* ---------------------------------------------------------------------------
   3. LIGHTING RIG (shared, softly retargeted per act)
--------------------------------------------------------------------------- */

const hemi = new THREE.HemisphereLight(0x4a5d7a, 0x14100c, 0.85);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xd7e4f0, 1.25);
keyLight.position.set(3.5, 5.5, 2.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.bias = -0.0015;
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x66e0d9, 3.2, 14, 2.2);
rimLight.position.set(-2.5, 2.2, -2.5);
scene.add(rimLight);

// soft overhead fill lights so each room reads clearly instead of falling into shadow
const talhaFill = new THREE.PointLight(0x5c7a92, 1.1, 12, 2);
talhaFill.position.set(-14, 3.4, 1.5);
scene.add(talhaFill);

const tahminaFill = new THREE.PointLight(0xc98aa8, 1.1, 12, 2);
tahminaFill.position.set(14, 3.4, 1.5);
scene.add(tahminaFill);

/* ---------------------------------------------------------------------------
   4. ROOM BUILDER  (shared shell, themed materials)
--------------------------------------------------------------------------- */

function buildRoom({ width = 8, depth = 8, height = 4.2, wallTex, floorTex, windowTex, wallTint = 0xffffff, glowColor = 0x3fe0d8 }) {
  const group = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 1 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: wallTint, roughness: 0.95, metalness: 0.0 });

  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  back.position.set(0, height / 2, -depth / 2);
  back.receiveShadow = true;
  group.add(back);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
  left.position.set(-width / 2, height / 2, 0);
  left.rotation.y = Math.PI / 2;
  left.receiveShadow = true;
  group.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat.clone());
  right.position.set(width / 2, height / 2, 0);
  right.rotation.y = -Math.PI / 2;
  right.receiveShadow = true;
  group.add(right);

  // window: glowing emissive plane set into the back wall
  const winMat = new THREE.MeshStandardMaterial({
    map: windowTex, emissive: 0xffffff, emissiveMap: windowTex, emissiveIntensity: 1.4, roughness: 0.4
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), winMat);
  win.position.set(width / 2 - 2.3, height / 2 + 0.3, -depth / 2 + 0.01);
  group.add(win);
  const winFrame = new THREE.Mesh(new THREE.RingGeometry(0, 0, 1, 1)); // placeholder disposed below
  winFrame.geometry.dispose();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6, metalness: 0.3 });
  const frameGeo = new THREE.BoxGeometry(2.75, 1.75, 0.08);
  const frameEdges = new THREE.Mesh(frameGeo, frameMat);
  frameEdges.position.copy(win.position);
  frameEdges.position.z -= 0.02;
  group.add(frameEdges);

  const windowLight = new THREE.PointLight(glowColor, 1.4, 8, 2);
  windowLight.position.copy(win.position);
  windowLight.position.z += 0.6;
  group.add(windowLight);

  group.userData.bounds = { width, depth, height };
  return group;
}

/* ---- simple furniture helpers (stylised boxes/cylinders, no external assets) ---- */

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.75, metalness: opts.metalness ?? 0.05 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rTop, rBot, h, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.1 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, opts.seg ?? 24), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------------------------------------------------------------------------
   TALHA'S ROOM — cool, moody, tech-cluttered bedroom
--------------------------------------------------------------------------- */

const talhaRoom = buildRoom({
  wallTex: wallTexture('#121620', '#1b2230'),
  floorTex: floorTexture('#100d0c', '#181310'),
  windowTex: cityWindowTexture(),
  glowColor: 0x3fe0d8
});
talhaRoom.position.set(-14, 0, 0);

// desk + monitor
const desk = box(1.9, 0.08, 0.8, 0x1b140f, { roughness: 0.5 });
desk.position.set(-2.6, 0.78, -3.4);
talhaRoom.add(desk);
const deskLeg1 = box(0.06, 0.78, 0.06, 0x0d0a08); deskLeg1.position.set(-3.4, 0.39, -3.7); talhaRoom.add(deskLeg1);
const deskLeg2 = box(0.06, 0.78, 0.06, 0x0d0a08); deskLeg2.position.set(-1.85, 0.39, -3.7); talhaRoom.add(deskLeg2);

const monitor = box(0.9, 0.55, 0.04, 0x05070a, { roughness: 0.3, metalness: 0.4 });
monitor.position.set(-2.6, 1.18, -3.68);
talhaRoom.add(monitor);
const monitorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46), new THREE.MeshStandardMaterial({ color: 0x0a2a2c, emissive: 0x3fe0d8, emissiveIntensity: 1.6, roughness: 0.4 }));
monitorGlow.position.set(-2.6, 1.18, -3.655);
talhaRoom.add(monitorGlow);
const monitorLight = new THREE.PointLight(0x3fe0d8, 0.9, 3, 2); monitorLight.position.set(-2.6, 1.2, -3.4); talhaRoom.add(monitorLight);

const chairSeat = cyl(0.28, 0.3, 0.08, 0x1c1c1c); chairSeat.position.set(-2.6, 0.46, -2.7); talhaRoom.add(chairSeat);
const chairBack = box(0.5, 0.55, 0.06, 0x1a1a1a); chairBack.position.set(-2.6, 0.78, -2.45); talhaRoom.add(chairBack);
const chairPole = cyl(0.04, 0.04, 0.42, 0x2a2a2a); chairPole.position.set(-2.6, 0.24, -2.7); talhaRoom.add(chairPole);

// bed
const bedFrame = box(1.7, 0.32, 2.5, 0x14100e); bedFrame.position.set(2.6, 0.16, -2.2); talhaRoom.add(bedFrame);
const mattress = box(1.6, 0.22, 2.4, 0x232b33, { roughness: 0.9 }); mattress.position.set(2.6, 0.42, -2.2); talhaRoom.add(mattress);
const pillow = box(0.55, 0.14, 0.4, 0x2f3844, { roughness: 0.95 }); pillow.position.set(2.6, 0.58, -3.15); pillow.rotation.z = 0.05; talhaRoom.add(pillow);

// shelf
const shelf = box(1.2, 0.05, 0.28, 0x1a140f); shelf.position.set(-3.55, 2.1, -1.2); shelf.rotation.y = Math.PI / 2; talhaRoom.add(shelf);
for (let i = 0; i < 5; i++) {
  const bk = box(0.06, 0.32 + Math.random() * 0.1, 0.2, [0x40372c, 0x2c1f1a, 0x33301f, 0x1a2430][i % 4]);
  bk.position.set(-3.55, 2.28, -1.6 + i * 0.16);
  bk.rotation.y = Math.PI / 2;
  talhaRoom.add(bk);
}

// small floor lamp (warm accent against the cool room)
const lampPole = cyl(0.02, 0.02, 1.4, 0x2a2a2a); lampPole.position.set(3.4, 0.7, -0.2); talhaRoom.add(lampPole);
const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xd7b98a, emissive: 0xffb15c, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.6 }));
lampShade.position.set(3.4, 1.5, -0.2); talhaRoom.add(lampShade);
const lampLight = new THREE.PointLight(0xffb15c, 1.1, 4, 2); lampLight.position.set(3.4, 1.35, -0.2); talhaRoom.add(lampLight);

scene.add(talhaRoom);

/* ---------------------------------------------------------------------------
   TAHMINA'S ROOM — warm, romantic, softly lit
--------------------------------------------------------------------------- */

const tahminaRoom = buildRoom({
  wallTex: wallTexture('#241823', '#301f2c'),
  floorTex: carpetTexture(),
  windowTex: duskWindowTexture(),
  glowColor: 0xe79bd0
});
tahminaRoom.position.set(14, 0, 0);

// vanity + mirror
const vanity = box(1.3, 0.72, 0.5, 0x2a1a22, { roughness: 0.5 });
vanity.position.set(-2.8, 0.36, -3.4);
tahminaRoom.add(vanity);
const mirrorFrame = box(0.7, 0.9, 0.05, 0xcaa86a, { metalness: 0.6, roughness: 0.35 });
mirrorFrame.position.set(-2.8, 1.35, -3.66); tahminaRoom.add(mirrorFrame);
const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.78), new THREE.MeshStandardMaterial({ color: 0x0d1013, metalness: 1, roughness: 0.08, emissive: 0x1a2530, emissiveIntensity: 0.3 }));
mirrorGlass.position.set(-2.8, 1.35, -3.635); tahminaRoom.add(mirrorGlass);

// bed
const bedFrame2 = box(1.9, 0.32, 2.6, 0x2a1c22); bedFrame2.position.set(2.5, 0.16, -2.2); tahminaRoom.add(bedFrame2);
const mattress2 = box(1.8, 0.24, 2.5, 0xdcc3cf, { roughness: 0.85 }); mattress2.position.set(2.5, 0.44, -2.2); tahminaRoom.add(mattress2);
const pillow2a = box(0.5, 0.14, 0.36, 0xf1e2e8, { roughness: 0.9 }); pillow2a.position.set(2.2, 0.61, -3.2); pillow2a.rotation.z = 0.06; tahminaRoom.add(pillow2a);
const pillow2b = box(0.5, 0.14, 0.36, 0xe7b6cf, { roughness: 0.9 }); pillow2b.position.set(2.8, 0.61, -3.2); pillow2b.rotation.z = -0.05; tahminaRoom.add(pillow2b);
const throwBlanket = box(1.8, 0.06, 0.7, 0xb46a86, { roughness: 0.9 }); throwBlanket.position.set(2.5, 0.58, -1.15); tahminaRoom.add(throwBlanket);

// fairy lights: a soft curve of tiny emissive spheres along the back wall
const fairyGroup = new THREE.Group();
const fairyMat = new THREE.MeshStandardMaterial({ color: 0xffe3c2, emissive: 0xffcf9e, emissiveIntensity: 2.2, roughness: 0.4 });
for (let i = 0; i < 26; i++) {
  const t = i / 25;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), fairyMat);
  bulb.position.set(-3.9 + t * 7.8, 3.6 + Math.sin(t * Math.PI * 3) * 0.12, -3.9);
  fairyGroup.add(bulb);
}
tahminaRoom.add(fairyGroup);
const fairyLight = new THREE.PointLight(0xffcf9e, 0.6, 6, 2); fairyLight.position.set(0, 3.4, -3.6); tahminaRoom.add(fairyLight);

// soft rug accent
const rug = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshStandardMaterial({ color: 0x6e3350, roughness: 1 }));
rug.rotation.x = -Math.PI / 2; rug.position.set(1.6, 0.011, 0.4);
tahminaRoom.add(rug);

scene.add(tahminaRoom);

/* ---------------------------------------------------------------------------
   5. TELEPORT MACHINE  (base + glowing rings + light beam + particle swirl)
--------------------------------------------------------------------------- */

function buildTeleportMachine(color) {
  const group = new THREE.Group();

  const base = cyl(0.95, 1.05, 0.16, 0x111318, { metalness: 0.85, roughness: 0.28 });
  base.position.y = 0.08;
  group.add(base);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.9, roughness: 0.25, emissive: color, emissiveIntensity: 0.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.045, 16, 64), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.17;
  group.add(rim);

  // vertical glowing rings that will spin during activation
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x030405, emissive: color, emissiveIntensity: 2.4,
      roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.85
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 - i * 0.02, 0.018, 12, 48), ringMat);
    ring.position.y = 0.9 + i * 0.55;
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
    rings.push(ring);
  }

  // three support struts
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const strut = cyl(0.035, 0.035, 2.1, 0x15171c, { metalness: 0.8, roughness: 0.35 });
    strut.position.set(Math.cos(a) * 0.78, 1.15, Math.sin(a) * 0.78);
    group.add(strut);
  }

  // central light beam (additive, mostly invisible until activated)
  const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 2.6, 24, 1, true), beamMat);
  beam.position.y = 1.4;
  group.add(beam);

  const coreLight = new THREE.PointLight(color, 1.6, 6, 2);
  coreLight.position.y = 1.0;
  group.add(coreLight);

  // particle swirl
  const COUNT = 220;
  const positions = new Float32Array(COUNT * 3);
  const radii = new Float32Array(COUNT);
  const speeds = new Float32Array(COUNT);
  const heights = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 0.4 + Math.random() * 0.65;
    const a = Math.random() * Math.PI * 2;
    radii[i] = r; speeds[i] = 0.4 + Math.random() * 0.9; heights[i] = Math.random() * 2.2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = heights[i];
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    map: sparkTex, size: 0.05, color, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  const particles = new THREE.Points(pGeo, pMat);
  group.add(particles);

  group.userData.animate = (t, activation) => {
    rings.forEach((ring, i) => {
      ring.rotation.z = t * (0.6 + i * 0.25);
      ring.material.emissiveIntensity = 1.8 + Math.sin(t * 3 + i) * 0.5 + activation * 4;
    });
    coreLight.intensity = 1.2 + Math.sin(t * 4) * 0.3 + activation * 9;
    beam.material.opacity = Math.min(0.55, activation * 0.7);
    beam.scale.y = 1 + activation * 0.4;

    const pos = pGeo.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      const a = t * speeds[i] * (1 + activation * 3) + i;
      const r = radii[i] * (1 - activation * 0.35);
      pos.setX(i, Math.cos(a) * r);
      pos.setZ(i, Math.sin(a) * r);
      let h = (heights[i] + t * (0.3 + activation * 2.2)) % 2.3;
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    pMat.opacity = 0.7 + activation * 0.3;
    pMat.size = 0.05 + activation * 0.05;
  };

  group.userData.rings = rings;
  return group;
}

const talhaMachine = buildTeleportMachine(0x3fe0d8);
talhaMachine.position.set(0.2, 0, 1.6);
talhaRoom.add(talhaMachine);

const tahminaMachine = buildTeleportMachine(0xe79bd0);
tahminaMachine.position.set(-0.6, 0, 2.0);
tahminaRoom.add(tahminaMachine);

/* ---------------------------------------------------------------------------
   6. CHARACTERS  (stylised realistic humanoid placeholders)
--------------------------------------------------------------------------- */

function buildCharacter({ skin = 0xc79a78, outfit = 0x2a3542, hair = 0x1b1512, height = 1.72, build = 1, feminine = false }) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55, metalness: 0.02 });
  const outfitMat = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.8, metalness: 0.03 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.4, metalness: 0.1 });

  const torsoH = height * 0.34;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19 * build, torsoH, 6, 12), outfitMat);
  torso.position.y = height * 0.62;
  torso.castShadow = true;
  g.add(torso);

  const hipsGeo = feminine ? new THREE.ConeGeometry(0.24 * build, 0.42, 16, 1, true) : new THREE.CapsuleGeometry(0.17 * build, 0.18, 4, 10);
  const hipsMat = feminine ? new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.85, side: THREE.DoubleSide }) : outfitMat;
  const hips = new THREE.Mesh(hipsGeo, hipsMat);
  hips.position.y = feminine ? height * 0.36 : height * 0.42;
  hips.castShadow = true;
  g.add(hips);

  const headGeo = new THREE.SphereGeometry(0.115, 20, 20);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = height * 0.92;
  head.castShadow = true;
  g.add(head);

  const hairMesh = new THREE.Mesh(
    feminine ? new THREE.ConeGeometry(0.13, 0.55, 16, 1, true) : new THREE.SphereGeometry(0.122, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hairMesh.position.y = feminine ? height * 0.78 : height * 0.965;
  if (feminine) hairMesh.rotation.x = Math.PI;
  hairMesh.material.side = THREE.DoubleSide;
  g.add(hairMesh);

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.075 * build, height * 0.36, 4, 8);
  const legL = new THREE.Mesh(legGeo, outfitMat); legL.position.set(-0.1, height * 0.22, 0); legL.castShadow = true; g.add(legL);
  const legR = new THREE.Mesh(legGeo, outfitMat.clone()); legR.position.set(0.1, height * 0.22, 0); legR.castShadow = true; g.add(legR);

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.055 * build, height * 0.3, 4, 8);
  const armL = new THREE.Mesh(armGeo, skinMat.clone());
  armL.position.set(-0.28 * build, height * 0.6, 0); armL.rotation.z = 0.18; armL.castShadow = true; g.add(armL);
  const armR = new THREE.Mesh(armGeo, skinMat.clone());
  armR.position.set(0.28 * build, height * 0.6, 0); armR.rotation.z = -0.18; armR.castShadow = true; g.add(armR);

  g.userData.parts = { torso, head, armL, armR, legL, legR };
  return g;
}

const talha = buildCharacter({ skin: 0xc79a78, outfit: 0x24303c, hair: 0x171310, height: 1.75, build: 1.05, feminine: false });
talha.position.set(0.2, 0, -0.4);
talha.rotation.y = Math.PI;
talhaRoom.add(talha);

const tahmina = buildCharacter({ skin: 0xd9ad8d, outfit: 0xb2547f, hair: 0x2a1710, height: 1.62, build: 0.9, feminine: true });
tahmina.position.set(-1.1, 0, -3.0);
tahminaRoom.add(tahmina);

/* ---------------------------------------------------------------------------
   7. UI HELPERS
--------------------------------------------------------------------------- */

const flashLayer = document.getElementById('flash-layer');
const subtitleEl = document.getElementById('subtitle');
const actLabel = document.getElementById('act-label');
const actNumber = document.getElementById('act-number');
const actTitle = document.getElementById('act-title');

function setAct(num, title) {
  actLabel.classList.remove('visible');
  setTimeout(() => {
    actNumber.textContent = num;
    actTitle.textContent = title;
    actLabel.classList.add('visible');
  }, 350);
}

function showSubtitle(text, duration = 3200) {
  return new Promise((resolve) => {
    subtitleEl.textContent = text;
    subtitleEl.classList.add('visible');
    setTimeout(() => {
      subtitleEl.classList.remove('visible');
      setTimeout(resolve, 600);
    }, duration);
  });
}

function flash(peakOpacity = 1, holdMs = 90) {
  return new Promise((resolve) => {
    flashLayer.classList.add('active');
    setTimeout(() => {
      flashLayer.classList.remove('active');
      resolve();
    }, holdMs);
  });
}

let shakeTime = 0, shakeDuration = 0, shakeStrength = 0;
function cameraShake(strength = 0.06, duration = 500) {
  shakeStrength = strength;
  shakeDuration = duration;
  shakeTime = performance.now();
}

/* tween helper: animates camera position + look-at target together */
function tweenCamera({ pos, look, duration = 2200, easing = TWEEN.Easing.Quadratic.InOut, delay = 0 }) {
  return new Promise((resolve) => {
    const startPos = camera.position.clone();
    const startLook = cameraTarget.clone();
    const state = { t: 0 };
    new TWEEN.Tween(state)
      .to({ t: 1 }, duration)
      .delay(delay)
      .easing(easing)
      .onUpdate(() => {
        camera.position.lerpVectors(startPos, pos, state.t);
        cameraTarget.lerpVectors(startLook, look, state.t);
      })
      .onComplete(resolve)
      .start();
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------------------------------------------------------------------------
   8. THE SCRIPTED SEQUENCE
--------------------------------------------------------------------------- */

const introOverlay = document.getElementById('intro-overlay');
const finaleOverlay = document.getElementById('finale-overlay');
const startBtn = document.getElementById('start-btn');
const replayBtn = document.getElementById('replay-btn');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');

let activation = { talha: 0, tahmina: 0 };

// room origins in world space — every camera / character coordinate below is
// expressed as ROOM_ORIGIN + local offset, so the camera always actually
// ends up inside the room it's supposed to be showing.
const TA = talhaRoom.position.clone();   // (-14, 0, 0)
const T = tahminaRoom.position.clone();  // (14, 0, 0)

/* "materialize" pop: a character scales up from nothing in sync with a light burst,
   used for the Act III return so both figures visibly arrive together. */
function materialize(character, { delay = 0, duration = 900 } = {}) {
  character.visible = true;
  character.scale.set(0.001, 0.001, 0.001);
  return new Promise((resolve) => {
    new TWEEN.Tween(character.scale)
      .to({ x: 1, y: 1, z: 1 }, duration)
      .delay(delay)
      .easing(TWEEN.Easing.Back.Out)
      .onComplete(resolve)
      .start();
  });
}

async function playSequence() {
  introOverlay.classList.add('hidden');
  await wait(600);

  /* ================= ACT I : TALHA'S ROOM ================= */
  setAct('ACT I', "TALHA'S ROOM");

  // wide establishing shot — see the whole room before we get close to anything
  camera.position.copy(TA).add(new THREE.Vector3(3.6, 2.7, 4.9));
  cameraTarget.copy(TA).add(new THREE.Vector3(0, 1.3, -0.8));
  await showSubtitle('Talha has spent three years building a door that shouldn\u2019t exist.', 3400);

  await tweenCamera({
    pos: TA.clone().add(new THREE.Vector3(1.9, 1.7, 0.6)),
    look: TA.clone().add(new THREE.Vector3(0.2, 1.1, 1.6)),
    duration: 2600
  });
  await showSubtitle('Tonight, for the first time, he\u2019s certain it works.', 2800);

  // guide camera toward the machine, following behind Talha
  await Promise.all([
    tweenCamera({
      pos: TA.clone().add(new THREE.Vector3(0.5, 1.9, 3.4)),
      look: TA.clone().add(new THREE.Vector3(0.2, 1.0, 1.6)),
      duration: 2600
    }),
    (async () => {
      await new Promise((res) => new TWEEN.Tween(talha.position).to({ x: 0.2, z: 1.3 }, 2400).easing(TWEEN.Easing.Sinusoidal.InOut).onComplete(res).start());
    })()
  ]);

  await tweenCamera({
    pos: TA.clone().add(new THREE.Vector3(0.2, 1.75, 2.0)),
    look: TA.clone().add(new THREE.Vector3(0.2, 1.3, 1.6)),
    duration: 1500
  });
  await showSubtitle('He steps inside the chamber.', 1800);

  // activation ramp-up on Talha's machine
  await rampActivation('talha', 1, 1400);
  cameraShake(0.05, 700);
  await wait(700);
  await flash(1, 130);
  cameraShake(0.14, 250);
  await rampActivation('talha', 0, 200);
  talha.visible = false;

  /* ================= ACT II : TAHMINA'S ROOM ================= */
  setAct('ACT II', "TAHMINA'S ROOM");

  // wide establishing shot of Tahmina's room
  camera.position.copy(T).add(new THREE.Vector3(-3.4, 2.7, 4.9));
  cameraTarget.copy(T).add(new THREE.Vector3(0.3, 1.3, -0.8));
  await flash(1, 160);
  await rampActivation('tahmina', 1, 10);
  await rampActivation('tahmina', 0, 900);
  await showSubtitle('The chamber on the other side hums to life.', 2800);

  await tweenCamera({
    pos: T.clone().add(new THREE.Vector3(-2.0, 1.7, -1.6)),
    look: T.clone().add(new THREE.Vector3(-1.1, 1.3, -3.0)),
    duration: 2600
  });
  await showSubtitle('Tahmina doesn\u2019t hear the light behind her.', 2600);

  await tweenCamera({
    pos: T.clone().add(new THREE.Vector3(-1.5, 1.6, -1.9)),
    look: T.clone().add(new THREE.Vector3(-1.1, 1.35, -2.6)),
    duration: 1800
  });
  await showSubtitle('One step \u2014 and the room isn\u2019t hers anymore.', 2200);

  // "capture": Tahmina moves toward the machine, camera follows close
  await Promise.all([
    new Promise((res) => new TWEEN.Tween(tahmina.position)
      .to({ x: -0.6, z: 2.0 }, 2200)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .onComplete(res).start()),
    tweenCamera({
      pos: T.clone().add(new THREE.Vector3(0.7, 1.9, 3.3)),
      look: T.clone().add(new THREE.Vector3(-0.6, 1.1, 2.0)),
      duration: 2200
    })
  ]);

  await tweenCamera({
    pos: T.clone().add(new THREE.Vector3(-0.6, 1.75, 3.0)),
    look: T.clone().add(new THREE.Vector3(-0.6, 1.3, 1.9)),
    duration: 1300
  });
  await showSubtitle('He reaches through, and pulls her back with him.', 2200);

  await rampActivation('tahmina', 1, 1300);
  cameraShake(0.07, 600);
  await wait(600);
  await flash(1, 140);
  cameraShake(0.16, 260);
  await rampActivation('tahmina', 0, 200);
  tahmina.visible = false;

  /* ================= ACT III : THE RETURN ================= */
  setAct('ACT III', 'THE RETURN');

  // frame the machine itself, close and centered, so the arrival reads clearly
  camera.position.copy(TA).add(new THREE.Vector3(0.2, 1.55, 3.1));
  cameraTarget.copy(TA).add(new THREE.Vector3(0.2, 1.15, 1.6));
  await flash(1, 160);

  // both characters materialize together, inside the chamber, at the same moment
  talha.position.set(0.2, 0, 1.5);
  talha.rotation.y = Math.PI * 0.05;
  tahmina.position.set(-0.35, 0, 1.7);
  tahmina.rotation.y = -Math.PI * 0.15;

  await rampActivation('talha', 1, 500);
  await Promise.all([
    materialize(talha, { duration: 1000 }),
    materialize(tahmina, { delay: 120, duration: 1000 })
  ]);
  cameraShake(0.05, 500);
  await rampActivation('talha', 0, 900);
  await showSubtitle('Together, the chamber lets them go.', 2400);

  // pull back to a wide reveal so the room, the machine, and both figures read at once
  await tweenCamera({
    pos: TA.clone().add(new THREE.Vector3(3.2, 2.4, 4.6)),
    look: TA.clone().add(new THREE.Vector3(0, 1.3, 0.6)),
    duration: 2800
  });
  await showSubtitle('Two rooms. One door. She\u2019s standing in his, now.', 3000);

  // settle into the reunion close-up
  talha.position.set(-0.35, 0, 1.2);
  tahmina.position.set(0.55, 0, 1.2);
  await tweenCamera({
    pos: TA.clone().add(new THREE.Vector3(0.1, 1.55, 2.9)),
    look: TA.clone().add(new THREE.Vector3(0.1, 1.2, 1.2)),
    duration: 2400
  });
  await showSubtitle('Talha finally lets himself breathe.', 2600);

  await wait(800);
  finaleOverlay.classList.add('visible');
}

async function rampActivation(who, target, duration) {
  return new Promise((resolve) => {
    new TWEEN.Tween(activation)
      .to({ [who]: target }, duration)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onComplete(resolve)
      .start();
  });
}

startBtn.addEventListener('click', () => playSequence());
replayBtn.addEventListener('click', () => window.location.reload());

/* ---------------------------------------------------------------------------
   9. LOADER (fake calibration bar while textures/geometry settle)
--------------------------------------------------------------------------- */

let loadProgress = 0;
const loadTimer = setInterval(() => {
  loadProgress += 4 + Math.random() * 10;
  if (loadProgress >= 100) {
    loadProgress = 100;
    clearInterval(loadTimer);
    loaderText.textContent = 'READY';
    setTimeout(() => loader.classList.add('hidden'), 320);
  }
  loaderFill.style.width = loadProgress + '%';
}, 110);

/* ---------------------------------------------------------------------------
   10. IDLE AMBIENT CAMERA (plays behind the intro screen)
--------------------------------------------------------------------------- */

let idleT = 0;

/* ---------------------------------------------------------------------------
   11. RENDER LOOP
--------------------------------------------------------------------------- */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  TWEEN.update();

  talhaMachine.userData.animate(t, activation.talha);
  tahminaMachine.userData.animate(t + 31, activation.tahmina);

  fairyGroup.children.forEach((bulb, i) => {
    bulb.material.emissiveIntensity = 1.8 + Math.sin(t * 2 + i * 0.6) * 0.5;
  });

  // idle ambient drift before the sequence starts — a slow drift across
  // Talha's room so the room itself is the first thing the person sees
  if (!introOverlay.classList.contains('hidden')) {
    idleT += dt;
    camera.position.x = TA.x + 2.8 + Math.sin(idleT * 0.1) * 1.2;
    camera.position.y = TA.y + 2.1 + Math.sin(idleT * 0.15) * 0.15;
    camera.position.z = TA.z + 4.2;
    cameraTarget.set(TA.x, TA.y + 1.3, TA.z - 0.5);
  }

  // camera shake overlay
  let shakeOffset = new THREE.Vector3();
  if (shakeDuration > 0) {
    const elapsed = performance.now() - shakeTime;
    if (elapsed < shakeDuration) {
      const decay = 1 - elapsed / shakeDuration;
      shakeOffset.set(
        (Math.random() - 0.5) * shakeStrength * decay,
        (Math.random() - 0.5) * shakeStrength * decay,
        (Math.random() - 0.5) * shakeStrength * decay
      );
    } else {
      shakeDuration = 0;
    }
  }

  camera.position.add(shakeOffset);
  camera.lookAt(cameraTarget);
  camera.position.sub(shakeOffset);

  rimLight.position.x = Math.sin(t * 0.3) * 2.4 - 2.5;

  renderer.render(scene, camera);
}

animate();
