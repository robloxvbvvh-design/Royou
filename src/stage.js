// Общие настройки рендера: окружение (блики на металле), свет и превью моделей в картинки.
import * as THREE from 'three';

export function createRenderer(canvas, { shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

let envCache = null;
export function getEnvironment(renderer) {
  if (envCache) return envCache;
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(60, 32, 16);
  const pos = geo.attributes.position, cols = [];
  const top = new THREE.Color('#9fd0ff'), mid = new THREE.Color('#ffffff'), bot = new THREE.Color('#6a7a5a');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 60;
    const c = y > 0 ? mid.clone().lerp(top, Math.pow(y, 0.7)) : mid.clone().lerp(bot, Math.pow(-y, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const soft = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) });
  for (const [x, y, z, w, h] of [[-30, 25, -20, 30, 14], [34, 18, 10, 18, 22], [0, 45, 25, 36, 10]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), soft); p.position.set(x, y, z); p.lookAt(0, 0, 0); s.add(p);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  envCache = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return envCache;
}

export function addStudioLights(scene, { shadow = false } = {}) {
  scene.add(new THREE.HemisphereLight('#dfeaff', '#4a4258', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(6, 12, 9); scene.add(key);
  const rim = new THREE.DirectionalLight('#8fb4ff', 1.0); rim.position.set(-8, 6, -8); scene.add(rim);
  if (shadow) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const c = key.shadow.camera; c.left = c.bottom = -8; c.right = c.top = 8; c.near = 1; c.far = 40; key.shadow.bias = -0.0005; }
  return key;
}

// ───────────── превью → dataURL ─────────────
let thumbRT = null, thumbScene = null, thumbCam = null;
const thumbCache = new Map();

function ensureThumbRig(renderer) {
  if (thumbScene) return;
  thumbScene = new THREE.Scene();
  thumbScene.environment = getEnvironment(renderer);
  thumbScene.environmentIntensity = 0.85;
  addStudioLights(thumbScene);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
  floor.rotation.x = -Math.PI / 2;
  thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
}

// opts: { w, h, yaw, pitch, bg, fit, key }
export function renderThumb(renderer, object, opts = {}) {
  const key = opts.key;
  if (key && thumbCache.has(key)) return thumbCache.get(key);
  ensureThumbRig(renderer);
  const w = opts.w || 256, h = opts.h || 256;
  const yaw = opts.yaw ?? 0.5, pitch = opts.pitch ?? 0.18;
  thumbScene.background = new THREE.Color(opts.bg || '#1a2238');
  thumbCam.aspect = w / h; thumbCam.updateProjectionMatrix();

  const holder = new THREE.Group(); holder.add(object); holder.rotation.y = yaw; thumbScene.add(holder);
  holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder);
  const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const rad = Math.max(size.x, size.y * (w / h), size.z * 0.6) * 0.5;
  const fovV = THREE.MathUtils.degToRad(thumbCam.fov);
  const dist = (Math.max(size.y * 0.5, rad / (w / h)) * (opts.fit || 1.25)) / Math.tan(fovV / 2) + size.z * 0.35;
  thumbCam.position.set(ctr.x, ctr.y + Math.sin(pitch) * dist, ctr.z + Math.cos(pitch) * dist);
  thumbCam.lookAt(ctr);

  const url = snapshot(renderer, thumbScene, thumbCam, w, h);
  thumbScene.remove(holder); holder.remove(object);
  if (key) thumbCache.set(key, url);
  return url;
}

// Рисует сцену в offscreen-цель и возвращает PNG dataURL
let snapRT = null;
export function snapshot(renderer, scene, camera, w, h) {
  if (!snapRT || snapRT.width !== w || snapRT.height !== h) {
    snapRT?.dispose();
    snapRT = new THREE.WebGLRenderTarget(w, h, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  }
  const prevRT = renderer.getRenderTarget();
  renderer.setRenderTarget(snapRT);
  renderer.render(scene, camera);
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(snapRT, 0, 0, w, h, buf);
  renderer.setRenderTarget(prevRT);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
