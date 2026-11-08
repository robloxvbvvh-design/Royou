// 3D-витрина для меню: вращающийся персонаж / оружие / питомец на постаменте.
import * as THREE from 'three';
import { getEnvironment, addStudioLights } from './stage.js';
import { buildCharacter, attachWeapon, updateRig } from './models/characters.js';
import { buildWeapon } from './models/weapons.js';
import { buildPet, updatePet, buildStickerSprite, buildCoin, buildGem, buildGift, buildCrown, EFFECT_STYLE } from './models/props.js';
import { Particles } from './game.js';

export class Showcase {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#0a1022'); this.scene.fog = new THREE.Fog('#0a1022', 40, 120);
    this.scene.environment = getEnvironment(renderer); this.scene.environmentIntensity = 0.8;
    addStudioLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 300);
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 0.5, 40), new THREE.MeshStandardMaterial({ color: '#1b2646', roughness: 0.6, metalness: 0.3 })); ped.position.y = -0.25; this.stage.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.09, 8, 60), new THREE.MeshStandardMaterial({ color: '#46a8ff', emissive: '#46a8ff', emissiveIntensity: 1.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; this.stage.add(ring);
    // фоновые кубики
    this.cubes = []; const cols = ['#ff4d6d', '#3d8bff', '#ffd23f', '#41d36a', '#c64dff', '#ff8a2a'];
    for (let i = 0; i < 40; i++) {
      const s = 0.8 + Math.random() * 2.2, m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.5, transparent: true, opacity: 0.55 }));
      m.position.set((Math.random() - 0.5) * 70, Math.random() * 22 - 3, -12 - Math.random() * 30); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); m.userData.v = 0.1 + Math.random() * 0.3; this.scene.add(m); this.cubes.push(m);
    }
    this.particles = new Particles(this.scene, 300);
    this.rotY = 0; this.auto = true; this.shift = 0; this.t = 0; this.w = 1600; this.h = 900; this.cur = null; this.burstT = 0;
  }

  resize(w, h) { this.w = w; this.h = h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.applyShift(); }
  setShift(f) { this.shift = f; this.applyShift(); }
  applyShift() { if (this.shift) this.camera.setViewOffset(this.w, this.h, -this.shift * this.w, 0, this.w, this.h); else this.camera.clearViewOffset(); }
  drag(dx) { this.rotY += dx * 0.012; this.auto = false; clearTimeout(this._at); this._at = setTimeout(() => { this.auto = true; }, 2500); }

  clear() { while (this.holder.children.length) this.holder.remove(this.holder.children[0]); this.rig = null; this.pet = null; this.cur = null; }

  // kind: 'menu' | 'skin' | 'weapon' | 'wskin' | 'pet' | 'sticker' | 'effect' | 'emote' | 'coin' | 'gem' | 'gift'
  show(kind, id, ctx = {}) {
    this.clear(); this.kind = kind; this.id = id; this.ctx = ctx; this.stage.visible = true; this.emote = null; this.effect = null;
    const weaponObj = () => buildWeapon(ctx.weapon || 'pistol', ctx.wskin || 'regular');
    let faceFront = Math.PI + 0.45, scale = 1;
    const makeChar = (skin, armed = true) => { const r = buildCharacter(skin); if (armed) attachWeapon(r, weaponObj()); this.rig = r; this.hold = armed; this.holder.add(r.root); };
    switch (kind) {
      case 'menu': makeChar(ctx.skin || 'standard'); this.stage.visible = true;
        if (ctx.pet) { const p = buildPet(ctx.pet); p.root.position.set(-4.4, 0, 1.2); p.root.rotation.y = 0.5; this.pet = p; this.holder.add(p.root); }
        break;
      case 'skin': makeChar(id, false); break;
      case 'emote': makeChar(ctx.skin || 'standard', false); this.emote = id; break;
      case 'effect': makeChar(ctx.skin || 'standard'); this.effect = id; break;
      case 'pet': { const p = buildPet(id); p.root.scale.setScalar(1.9); this.pet = p; this.holder.add(p.root); faceFront = Math.PI - 0.7; break; }
      case 'weapon': case 'wskin': { const o = buildWeapon(kind === 'weapon' ? id : (ctx.weapon || 'rifle'), kind === 'weapon' ? (ctx.wskin || 'regular') : id); o.position.y = 3; this.holder.add(o); faceFront = -Math.PI / 2 + 0.5; this.stage.visible = false; this.floatY = true; break; }
      case 'sticker': { const s = buildStickerSprite(id); s.scale.set(6, 6, 1); s.position.y = 3; this.holder.add(s); this.stage.visible = false; faceFront = 0; break; }
      case 'coin': { const o = buildCoin(); o.scale.setScalar(2.4); o.position.y = 3; this.holder.add(o); this.stage.visible = false; faceFront = 0.4; break; }
      case 'gem': { const o = buildGem(); o.scale.setScalar(2.2); o.position.y = 3; this.holder.add(o); this.stage.visible = false; faceFront = 0.4; break; }
      case 'gift': { const o = buildGift(); o.scale.setScalar(1.6); this.holder.add(o); faceFront = 0.4; break; }
    }
    if (kind === 'menu') faceFront = -Math.PI / 2 - 0.6; this.holder.rotation.y = faceFront; this.rotY = faceFront; this.cur = kind;
    this.fit();
  }

  fit() {
    this.holder.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(this.holder), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    let d = Math.max(size.y / 2 / tan, Math.max(size.x, size.z) / 2 / (tan * Math.min(1.6, this.camera.aspect))) * 1.85 + 3;
    if (this.kind === 'menu') d = 27;
    if (this.kind === 'weapon' || this.kind === 'wskin') d = Math.max(d, 16);
    this.camera.position.set(0, c.y + d * 0.12, d); this.camera.lookAt(0, c.y, 0);
    this.target = new THREE.Vector3(0, c.y, 0);
  }

  update(dt) {
    this.t += dt;
    if (this.auto) this.rotY += dt * (this.kind === 'menu' ? 0.0 : 0.7);
    if (this.kind === 'menu') this.rotY = -Math.PI / 2 - 0.6 + Math.sin(this.t * 0.5) * 0.3;
    this.holder.rotation.y += (this.rotY - this.holder.rotation.y) * Math.min(1, 10 * dt);
    if (this.rig) {
      let emote = this.emote;
      if (this.kind === 'menu') { const c = this.t % 9; emote = c > 6.5 && c < 8.8 ? 'wave' : null; }
      updateRig(this.rig, dt, { holding: this.hold && !emote, pitch: 0.04, emote });
    }
    if (this.pet) updatePet(this.pet, this.t, false);
    if (this.floatY) this.holder.position.y = Math.sin(this.t * 1.6) * 0.25; else this.holder.position.y = 0;
    if (this.effect) {
      this.burstT -= dt; const st = EFFECT_STYLE[this.effect];
      if (st && this.burstT <= 0) { this.burstT = 1.4; this.particles.burst(0, 3.2, 0, st.count, st.speed, st.colors, 1.2, st.size, st.gravity, 6); }
    }
    for (const c of this.cubes) { c.rotation.x += c.userData.v * dt; c.rotation.y += c.userData.v * dt * 0.7; c.position.y += c.userData.v * dt * 0.8; if (c.position.y > 22) c.position.y = -4; }
    this.particles.update(dt);
  }

  render() { this.renderer.autoClear = true; this.renderer.render(this.scene, this.camera); }
}
