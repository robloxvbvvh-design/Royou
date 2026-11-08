// Сборка 3D-мира из карты: небо, туман, свет, тени.
import * as THREE from 'three';
import { buildMap, makeSky } from './maps.js';
import { getEnvironment, snapshot } from './stage.js';

export function createWorld(renderer, mapId, { shadows = true } = {}) {
  const map = buildMap(mapId);
  const scene = new THREE.Scene();
  scene.environment = getEnvironment(renderer);
  scene.environmentIntensity = map.indoor ? 0.45 : 0.55;
  scene.fog = new THREE.Fog(map.fog[0], map.fog[1], map.fog[2]);
  scene.background = new THREE.Color(map.fog[0]);
  let sky = null;
  if (!map.noSky) { sky = makeSky(map.sky[0], map.sky[1]); scene.add(sky); }
  scene.add(new THREE.HemisphereLight(map.hemi[0], map.hemi[1], map.hemi[2]));
  const sun = new THREE.DirectionalLight(map.sun.color, map.sun.intensity);
  sun.position.set(...map.sun.pos); sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = c.bottom = -60; c.right = c.top = 60; c.near = 10; c.far = 320;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
  scene.add(sun); scene.add(sun.target);
  const sunOffset = new THREE.Vector3(...map.sun.pos);
  for (const l of map.lights.slice(0, 4)) { const p = new THREE.PointLight(l.color, l.i, l.d, 1.6); p.position.set(l.x, l.y, l.z); scene.add(p); }
  scene.add(map.group);
  return {
    map, scene, sun, sky,
    follow(pos) { sun.target.position.copy(pos); sun.position.copy(pos).add(sunOffset); if (sky) sky.position.copy(pos); },
  };
}

export function mapThumbnail(renderer, mapId) {
  const w = createWorld(renderer, mapId, { shadows: false });
  const b = w.map.bounds;
  const cam = new THREE.PerspectiveCamera(52, 16 / 9, 1, 2000);
  w.map.group.children.forEach(o => { if (o.userData.ceiling) o.visible = false; });
  if (w.map.indoor) cam.position.set(b.x * 0.6, 22, b.z * 0.98); else if (mapId === 'castle') cam.position.set(30, 78, 78); else cam.position.set(b.x * 0.75, 62, b.z * 1.05);
  cam.lookAt(0, w.map.indoor ? 2 : 0, w.map.indoor ? 0 : -6);
  w.map.update(1);
  const url = snapshot(renderer, w.scene, cam, 480, 270);
  w.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  return url;
}
