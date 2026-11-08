// Ядро игры «Копирка»: игрок, боты, оружие, режимы (командный бой, каждый за себя, флаг, выживание).
import * as THREE from 'three';
import { createWorld } from './world.js';
import { getEnvironment, addStudioLights } from './stage.js';
import { buildCharacter, attachWeapon, updateRig, kickRig } from './models/characters.js';
import { buildWeapon, buildViewmodel, VIEW_POSE } from './models/weapons.js';
import { buildFlag, waveFlag, buildMedkit, buildAmmoBox, buildPet, updatePet, buildStickerSprite, EFFECT_STYLE } from './models/props.js';
import { WEAPONS, SKINS, MODES, MAPS, BOT_NAMES, TEAM_COLORS } from './data.js';
import { rayBox, raycastWorld, groundAt, volumeClear } from './physics.js';
import { Sfx } from './audio.js';

const R = 0.9, H = 5.2, EYE = 4.6, STEP = 1.3, GRAV = 150, JUMP = 47, WALK = 16, SPRINT = 22;
const W = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const PREF = { pistol: 22, shotgun: 11, rifle: 26, sniper: 55, knife: 1.5 };
const MODE_TIME = { tdm: 300, ffa: 300, ctf: 420, survival: 0 };
const GOALS = { tdm: 30, ffa: 25, ctf: 3 };

// ───────────── частицы ─────────────
export class Particles {
  constructor(scene, n = 700) {
    this.n = n; this.i = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: false }), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.p = Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.2, g: 30 }));
    const m = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color('#fff');
    for (let k = 0; k < n; k++) { this.mesh.setMatrixAt(k, m); this.mesh.setColorAt(k, c); }
    scene.add(this.mesh); this.dummy = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.pos = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.col = new THREE.Color();
  }
  emit(x, y, z, vx, vy, vz, life, size, color, g = 30) {
    const k = this.i; this.i = (this.i + 1) % this.n; const p = this.p[k];
    p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.size = size; p.g = g;
    this.mesh.setColorAt(k, this.col.set(color)); this.mesh.instanceColor.needsUpdate = true;
  }
  burst(x, y, z, count, speed, colors, life = 0.6, size = 0.25, g = 30, up = 0) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * rnd(0.4, 1);
      this.emit(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + up, Math.sin(a) * Math.cos(b) * s, life * rnd(0.6, 1.2), size * rnd(0.6, 1.3), colors[(Math.random() * colors.length) | 0], g);
    }
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      const p = this.p[k];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.mesh.setMatrixAt(k, this.dummy.makeScale(0, 0, 0)); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const s = p.size * Math.min(1, p.life / p.max * 2.2);
      this.pos.set(p.x, p.y, p.z); this.sc.set(s, s, s);
      this.mesh.setMatrixAt(k, this.dummy.compose(this.pos, this.q, this.sc));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class Tracers {
  constructor(scene, n = 48) {
    this.items = [];
    const geo = new THREE.BoxGeometry(0.07, 0.07, 1);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, fog: false }));
      m.visible = false; scene.add(m); this.items.push({ m, life: 0 });
    }
    this.i = 0;
  }
  emit(a, b, color = '#ffe9a0') {
    const t = this.items[this.i]; this.i = (this.i + 1) % this.items.length;
    const len = a.distanceTo(b); if (len < 0.5) return;
    t.m.position.copy(a).lerp(b, 0.5); t.m.lookAt(b); t.m.scale.set(1, 1, len); t.m.material.color.set(color); t.m.material.opacity = 0.9; t.m.visible = true; t.life = 0.09;
  }
  update(dt) { for (const t of this.items) { if (t.life <= 0) continue; t.life -= dt; if (t.life <= 0) t.m.visible = false; else t.m.material.opacity = t.life / 0.09; } }
}

function makeNameTag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.font = 'bold 34px "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(name, 128, 32); g.fillStyle = color; g.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(5, 1.25, 1); return s;
}

// ───────────── игра ─────────────
export class Game {
  constructor(renderer, hud, save) {
    this.renderer = renderer; this.hud = hud; this.save = save; this.canvas = renderer.domElement;
    this.cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1500);
    this.vmScene = new THREE.Scene(); this.vmScene.environment = getEnvironment(renderer); this.vmScene.environmentIntensity = 0.8;
    addStudioLights(this.vmScene); this.vmCam = new THREE.PerspectiveCamera(58, 1, 0.05, 60);
    this.active = false; this.paused = false; this.keys = new Set(); this.mouse = { dx: 0, dy: 0, down: false, right: false };
    this.fighters = []; this.time = 0; this.thirdPerson = false;
    this._bind();
  }

  resize(w, h) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.vmCam.aspect = w / h; this.vmCam.updateProjectionMatrix(); }

  _bind() {
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.paused || this.state === 'ended') return;
      const p = this.player; if (!p) return;
      if (e.code === 'KeyR') this.startReload(p);
      else if (e.code === 'KeyE') this.tryCopy();
      else if (e.code === 'KeyV') { this.thirdPerson = !this.thirdPerson; this.hud.toast(this.thirdPerson ? 'Вид от третьего лица' : 'Вид от первого лица'); }
      else if (/^Digit[1-5]$/.test(e.code)) { const w = WEAPONS.find(x => x.slot === +e.code.slice(5)); if (w) this.selectWeapon(w.id); }
      else if (e.code === 'KeyZ') this.emote('wave'); else if (e.code === 'KeyX') this.emote('dance'); else if (e.code === 'KeyC') this.emote('cheer'); else if (e.code === 'KeyB') this.emote('flex');
      else if (e.code === 'KeyQ') this.selectWeapon(p.lastWeapon);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    window.addEventListener('mousemove', e => { if (this.active && !this.paused && document.pointerLockElement === this.canvas) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    this.canvas.addEventListener('mousedown', e => {
      if (!this.active || this.paused) return;
      if (document.pointerLockElement !== this.canvas) { this.lockPointer(); }
      Sfx.init();
      if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => {
      if (!this.active || this.paused || !this.player) return;
      const owned = WEAPONS.filter(w => this.save.has('weapons', w.id)); const i = owned.findIndex(w => w.id === this.player.weaponId);
      this.selectWeapon(owned[(i + (e.deltaY > 0 ? 1 : -1) + owned.length) % owned.length].id);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      if (this.active && document.pointerLockElement !== this.canvas && this.state !== 'ended' && !this.paused && !this._noPause) this.pause(true);
    });
  }
  lockPointer() { try { const r = this.canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }

  pause(on) {
    if (!this.active || this.state === 'ended') return;
    this.paused = on; this.hud.pause(on);
    if (!on) { this.keys.clear(); this.lockPointer(); } else { this.mouse.down = false; this.mouse.right = false; if (document.pointerLockElement) document.exitPointerLock(); }
  }

  // ───────────── запуск матча ─────────────
  start({ mode, mapId }) {
    this.stop();
    const sv = this.save.data;
    this.mode = mode; this.mapId = mapId;
    this.world = createWorld(this.renderer, mapId, { shadows: sv.settings.shadows });
    this.map = this.world.map; this.scene = this.world.scene; this.cols = this.map.colliders;
    this.particles = new Particles(this.scene); this.tracers = new Tracers(this.scene);
    this.fighters = []; this.pickups = []; this.flags = null; this.state = 'countdown'; this.countT = 3.2; this.time = 0;
    this.paused = false; this.thirdPerson = false; this.kills = []; this.stats = { kills: 0, deaths: 0, headshots: 0, copies: 0, coins: 0 };
    this.score = { A: 0, B: 0 }; this.timeLeft = MODE_TIME[mode]; this.elapsed = 0; this.nameCounter = 0; this.endTimer = 0;
    this.usedNames = new Set(); this.hitFlash = 0; this.shake = 0; this.aiming = false; this._lastCount = 0;
    Sfx.setVolume(sv.settings.vol);

    // игрок
    const eq = sv.equipped;
    const team = mode === 'ffa' ? 'P' : 'A';
    this.player = this.makeFighter({ name: 'Вы', team, skin: eq.skin, weaponId: this.save.has('weapons', eq.weapon) ? eq.weapon : 'pistol', wskin: eq.wskin, isPlayer: true });
    const p = this.player;
    p.ammo = {}; for (const w of WEAPONS) p.ammo[w.id] = { mag: w.mag, reserve: w.reserve };
    p.lastWeapon = p.weaponId === 'pistol' ? 'knife' : 'pistol'; p.copyCd = 0; p.reloading = false; p.reloadT = 0; p.switchT = 0; p.fireLatch = false; p.emoteT = 0; p.emoteId = null; p.coinsEarned = 0;
    p.rig.root.visible = false;

    // боты
    if (mode === 'tdm') { for (let i = 0; i < 4; i++) this.addBot('A'); for (let i = 0; i < 5; i++) this.addBot('B'); }
    else if (mode === 'ffa') { for (let i = 0; i < 8; i++) this.addBot('F' + i); }
    else if (mode === 'ctf') { for (let i = 0; i < 3; i++) this.addBot('A', i); for (let i = 0; i < 4; i++) this.addBot('B', i); this.setupFlags(); }
    else if (mode === 'survival') { this.surv = { wave: 0, toSpawn: 0, spawnT: 0, breakT: 2.5, kills: 0 }; }
    for (const f of this.fighters) this.respawn(f, true);

    this.setupPickups();
    this.setupPet();
    this.rebuildViewmodel();
    this.world.follow(p.pos);
    this.active = true;
    this.hud.begin({ mode, mapName: MAPS.find(m => m.id === mapId)?.name, modeName: MODES.find(m => m.id === mode)?.name });
    this.hud.center('ПРИГОТОВЬТЕСЬ', 'Копируй. Выживай. Побеждай!');
    this.lockPointer();
  }

  stop() {
    this.active = false; this.state = 'none';
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.scene) { this.scene.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose?.(); }); }
    this.scene = null; this.world = null; this.fighters = []; this.player = null; this.vm = null;
    this.mouse.down = false; this.mouse.right = false; this.keys.clear();
    while (this.vmScene.children.length > 3) this.vmScene.remove(this.vmScene.children[this.vmScene.children.length - 1]);
  }

  // ───────────── бойцы ─────────────
  makeFighter({ name, team, skin, weaponId, wskin, isPlayer = false, clone = false }) {
    const rig = buildCharacter(skin);
    attachWeapon(rig, buildWeapon(weaponId, wskin));
    if (clone) rig.root.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); if (o.material.color) o.material.color.multiplyScalar(0.55); o.material.emissive?.set('#3a0000'); } });
    this.scene.add(rig.root);
    const col = team === 'A' || team === 'P' ? TEAM_COLORS.A : team === 'B' ? TEAM_COLORS.B : clone ? '#ff6a4a' : '#ffffff';
    const f = {
      id: ++this.nameCounter, name, team, skin, wskin, weaponId, rig, isPlayer, clone,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, launched: false,
      hp: 100, maxHp: 100, alive: false, respawnT: 0, kills: 0, deaths: 0, cd: 0, deadT: 0, hasFlag: null, protect: 0, speedMul: 1, dmgMul: 1,
      emote: null, hurtT: 0, spawnedAt: 0, near: [],
    };
    if (!isPlayer) {
      f.tag = makeNameTag(name, col); f.tag.position.set(0, 7, 0); rig.root.add(f.tag);
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#000000', transparent: true, opacity: 0.6, depthWrite: false, fog: false })); bg.scale.set(3.2, 0.34, 1); bg.position.set(0, 6.2, 0); rig.root.add(bg);
      const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#58e06a', depthWrite: false, fog: false })); fill.scale.set(3.0, 0.22, 1); fill.position.set(0, 6.2, 0.01); rig.root.add(fill);
      f.hpBar = fill; f.hpBg = bg;
      f.ai = { goal: null, goalT: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(0.6, 1.8), target: null, targetT: 0, los: false, react: 0, stuck: 0, stuckT: 0, lastX: 0, lastZ: 0, detourT: 0, burst: 0, burstT: 0, jumpT: rnd(2, 5), role: 'attack' };
    }
    this.fighters.push(f);
    return f;
  }

  addBot(team, idx = 0) {
    let name; do { name = BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0]; } while (this.usedNames.has(name) && this.usedNames.size < BOT_NAMES.length);
    this.usedNames.add(name);
    const skin = SKINS[(Math.random() * SKINS.length) | 0].id;
    const roll = Math.random(), weaponId = roll < 0.4 ? 'rifle' : roll < 0.62 ? 'pistol' : roll < 0.82 ? 'shotgun' : roll < 0.93 ? 'sniper' : 'knife';
    const wskin = ['regular', 'regular', 'neon', 'gold', 'ice', 'demonic'][(Math.random() * 6) | 0];
    const f = this.makeFighter({ name, team, skin, weaponId, wskin });
    f.ai.role = idx % 2 === 0 ? 'attack' : 'defend';
    return f;
  }

  enemies(f) { return this.fighters.filter(o => o.alive && o !== f && o.team !== f.team); }

  findSpot(zone, { minDist = 0, avoid = null, tries = 90 } = {}) {
    for (let i = 0; i < tries; i++) {
      const x = rnd(zone.x0, zone.x1), z = rnd(zone.z0, zone.z1);
      const g = groundAt(this.cols, x, z, 80, R);
      if (g.y === -Infinity || !g.col.walk || g.y < this.map.killY + 10) continue;
      if (!volumeClear(this.cols, x, g.y + 0.05, z, R + 0.5, H)) continue;
      if (minDist && avoid && avoid.some(o => o.alive && Math.hypot(o.pos.x - x, o.pos.z - z) < minDist)) continue;
      return new THREE.Vector3(x, g.y, z);
    }
    return new THREE.Vector3((zone.x0 + zone.x1) / 2, 6, (zone.z0 + zone.z1) / 2);
  }

  spawnZone(f) {
    const z = this.map.zones;
    if (this.mode === 'tdm' || this.mode === 'ctf') return z[f.team] || z.ALL;
    if (this.mode === 'survival') return f.isPlayer ? { x0: -14, x1: 14, z0: -14, z1: 14 } : z.ALL;
    return z.ALL;
  }

  respawn(f, first = false) {
    const others = this.fighters.filter(o => o !== f && o.alive);
    let enemiesOnly = others.filter(o => o.team !== f.team);
    if (this.mode === 'survival' && !f.isPlayer && this.player) enemiesOnly = [this.player];
    const pos = this.findSpot(this.spawnZone(f), { minDist: first ? 14 : 30, avoid: enemiesOnly });
    f.pos.copy(pos); f.vel.set(0, 0, 0);
    // смотрим к центру карты
    f.yaw = Math.atan2(-(0 - pos.x), -(0 - pos.z)); f.pitch = 0; f.hp = f.maxHp; f.alive = true; f.deadT = 0; f.protect = 2.2; f.cd = 0.3;
    if (!f.isPlayer) { f.ai.goal = null; f.ai.target = null; f.ai.react = 0.4; f.rig.root.visible = true; f.tag.visible = f.hpBar.visible = f.hpBg.visible = true; }
    if (f.isPlayer) { for (const w of WEAPONS) { f.ammo[w.id].mag = w.mag; f.ammo[w.id].reserve = w.reserve; } f.reloading = false; this.hud.dead(null); }
    f.rig.root.rotation.set(0, f.yaw, 0); f.rig.root.position.copy(f.pos);
    if (!f.isPlayer && !first && !f.clone) {
      // новая жизнь — новое оружие
      const roll = Math.random(); f.weaponId = roll < 0.4 ? 'rifle' : roll < 0.62 ? 'pistol' : roll < 0.82 ? 'shotgun' : roll < 0.93 ? 'sniper' : 'knife';
      attachWeapon(f.rig, buildWeapon(f.weaponId, f.wskin));
    }
  }

  setFighterSkin(f, skinId, wskin) {
    const old = f.rig; this.scene.remove(old.root);
    const rig = buildCharacter(skinId); attachWeapon(rig, buildWeapon(f.weaponId, wskin || f.wskin));
    rig.root.position.copy(f.pos); rig.root.rotation.y = f.yaw; this.scene.add(rig.root);
    if (f.tag) { rig.root.add(f.tag, f.hpBg, f.hpBar); }
    f.rig = rig; f.skin = skinId; if (wskin) f.wskin = wskin;
    if (f.isPlayer) rig.root.visible = this.thirdPerson;
  }

  // ───────────── питомец, предметы ─────────────
  setupPet() {
    const id = this.save.data.equipped.pet;
    this.pet = null;
    if (id) { const pet = buildPet(id); pet.root.scale.setScalar(0.85); pet.root.position.copy(this.player.pos).add(new THREE.Vector3(2, 0, 3)); this.scene.add(pet.root); this.pet = pet; }
    // наклейка над головой
    const st = this.save.data.equipped.sticker;
    if (st && st !== 'none') { const s = buildStickerSprite(st); s.position.set(0, 8, 0); this.player.rig.root.add(s); }
  }

  setupPickups() {
    const place = (type, n) => {
      for (let i = 0; i < n; i++) {
        const obj = type === 'health' ? buildMedkit() : buildAmmoBox();
        const pos = this.findSpot(this.map.zones.ALL, { tries: 60 });
        obj.position.copy(pos); this.scene.add(obj);
        this.pickups.push({ type, obj, pos, respawn: 0, base: pos.y });
      }
    };
    place('health', 4); place('ammo', 4);
  }

  updatePickups(dt) {
    for (const pk of this.pickups) {
      if (pk.respawn > 0) { pk.respawn -= dt; if (pk.respawn <= 0) { pk.obj.visible = true; } continue; }
      pk.obj.rotation.y += dt * 1.6; pk.obj.position.y = pk.base + 0.8 + Math.sin(this.time * 3 + pk.pos.x) * 0.25;
      for (const f of this.fighters) {
        if (!f.alive) continue;
        if (Math.abs(f.pos.x - pk.pos.x) > 2.2 || Math.abs(f.pos.z - pk.pos.z) > 2.2 || Math.abs(f.pos.y - pk.pos.y) > 3) continue;
        if (pk.type === 'health') { if (f.hp >= f.maxHp) continue; f.hp = Math.min(f.maxHp, f.hp + 50); }
        else { if (!f.isPlayer) continue; let ok = false; for (const w of WEAPONS) { if (w.melee) continue; const a = f.ammo[w.id]; if (a.reserve < w.reserve) { a.reserve = Math.min(w.reserve, a.reserve + w.mag * 2); ok = true; } } if (!ok) continue; }
        pk.obj.visible = false; pk.respawn = 25;
        if (f.isPlayer) { Sfx.play('pickup'); this.hud.toast(pk.type === 'health' ? '+50 здоровья' : 'Патроны пополнены'); }
        this.particles.burst(pk.pos.x, pk.pos.y + 1, pk.pos.z, 12, 8, pk.type === 'health' ? ['#ff4d6d', '#ffffff'] : ['#ffcc33', '#7cff6a'], 0.6, 0.25, 10);
        break;
      }
    }
  }

  // ───────────── флаги (CTF) ─────────────
  setupFlags() {
    this.flags = {};
    for (const t of ['A', 'B']) {
      const home = this.map.flags[t].clone(); const g = groundAt(this.cols, home.x, home.z, 60, 1); home.y = g.y === -Infinity ? 0 : g.y;
      const obj = buildFlag(TEAM_COLORS[t]); obj.position.copy(home); this.scene.add(obj);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 28), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[t], transparent: true, opacity: 0.35 })); ring.position.set(home.x, home.y + 0.1, home.z); this.scene.add(ring);
      this.flags[t] = { team: t, home, pos: home.clone(), obj, carrier: null, atHome: true, returnT: 0 };
    }
  }

  updateFlags(dt) {
    const E = { A: 'синих', B: 'красных' };
    for (const t of ['A', 'B']) {
      const F = this.flags[t];
      waveFlag(F.obj, this.time + (t === 'A' ? 0 : 1.3));
      if (F.carrier) {
        if (!F.carrier.alive) { this.dropFlag(F.carrier); }
        else { F.pos.copy(F.carrier.pos); F.obj.position.set(F.pos.x, F.pos.y + 1.4, F.pos.z + 0.0); F.obj.rotation.y = F.carrier.yaw; F.obj.scale.setScalar(0.55); continue; }
      }
      F.obj.scale.setScalar(1); F.obj.position.copy(F.pos); F.obj.rotation.y = 0;
      if (!F.atHome) { F.returnT -= dt; if (F.returnT <= 0) this.returnFlag(F, 'Флаг вернулся на базу'); }
    }
    for (const f of this.fighters) {
      if (!f.alive || this.state !== 'play') continue;
      for (const t of ['A', 'B']) {
        const F = this.flags[t];
        if (Math.hypot(f.pos.x - F.pos.x, f.pos.z - F.pos.z) > 3.2 || Math.abs(f.pos.y - F.pos.y) > 4) continue;
        if (F.team !== f.team && !F.carrier && !f.hasFlag) {
          F.carrier = f; f.hasFlag = F; F.atHome = false; F.returnT = 25; Sfx.play('flag');
          this.hud.toast(f.isPlayer ? 'Вы взяли флаг! Несите на базу!' : `${f.name} взял флаг ${E[F.team]}`, f.team === 'A' ? 'good' : 'bad');
        } else if (F.team === f.team && !F.atHome && !F.carrier) { this.returnFlag(F, `${f.name} вернул флаг`); }
        else if (F.team === f.team && f.hasFlag && F.atHome) {
          const taken = f.hasFlag; taken.carrier = null; f.hasFlag = null; taken.pos.copy(taken.home); taken.atHome = true;
          this.score[f.team]++; Sfx.play('flag');
          this.hud.toast(f.isPlayer ? 'Флаг захвачен! +50 монет' : `${f.name} захватил флаг!`, f.team === 'A' ? 'good' : 'bad');
          if (f.isPlayer) { this.addCoins(50); this.stats.captures = (this.stats.captures || 0) + 1; }
          this.checkWin();
        }
      }
    }
  }
  dropFlag(f) { const F = f.hasFlag; if (!F) return; F.carrier = null; f.hasFlag = null; F.pos.copy(f.pos); F.returnT = 18; this.hud.toast('Флаг упал!'); }
  returnFlag(F, msg) { F.carrier = null; F.pos.copy(F.home); F.atHome = true; this.hud.toast(msg); }

  // ───────────── оружие ─────────────
  selectWeapon(id) {
    const p = this.player; if (!p || !p.alive || id === p.weaponId) return;
    if (!this.save.has('weapons', id)) { this.hud.toast('Оружие не куплено — загляни в магазин', 'bad'); return; }
    p.lastWeapon = p.weaponId; p.weaponId = id; p.reloading = false; p.switchT = 0.35;
    attachWeapon(p.rig, buildWeapon(id, p.wskin)); this.rebuildViewmodel(true); Sfx.play('click');
  }

  startReload(f) {
    const w = W[f.weaponId], a = f.ammo[f.weaponId];
    if (w.melee || f.reloading || a.mag >= w.mag || a.reserve <= 0) return;
    f.reloading = true; f.reloadT = w.reload; Sfx.play('reload');
  }

  rebuildViewmodel(draw = false) {
    if (this.vm) this.vmScene.remove(this.vm.group);
    const p = this.player; const g = buildViewmodel(p.weaponId, p.wskin, p.skin);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
    const pose = VIEW_POSE[p.weaponId]; g.scale.setScalar(pose.scale); this.vmScene.add(g);
    // вспышка выстрела
    let flash = null;
    if (g.userData.muzzle) {
      flash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      flash.visible = false; g.userData.muzzle.add(flash);
      const f2 = flash.clone(); f2.rotation.z = Math.PI / 4; f2.scale.setScalar(0.7); flash.add(f2);
    }
    this.vm = { group: g, pose, flash, flashT: 0, kick: 0, sx: 0, sy: 0, bob: 0, draw: draw ? 1 : 0.6, swing: 0 };
  }

  aimDir(out) { return this.cam.getWorldDirection(out); }

  // общий выстрел. dir — нормализованный Vector3
  shoot(f, origin, dir, w, spreadMul = 1, dmgMul = 1) {
    const tmpDir = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), end = new THREE.Vector3();
    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    u.crossVectors(dir, up).normalize(); v.crossVectors(dir, u);
    const muzzle = f.isPlayer && !this.thirdPerson ? origin.clone().addScaledVector(u, 0.55).addScaledVector(v, -0.35).addScaledVector(dir, 1.6) : this.muzzlePos(f, origin);
    let hitAny = false, headAny = false, killedAny = false;
    for (let k = 0; k < w.pellets; k++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * w.spread * spreadMul;
      tmpDir.copy(dir).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr).normalize();
      let tw = raycastWorld(this.cols, origin.x, origin.y, origin.z, tmpDir.x, tmpDir.y, tmpDir.z, w.range); if (tw < 0) tw = w.range;
      let best = null, bt = tw, head = false;
      for (const o of this.fighters) {
        if (!o.alive || o === f || o.team === f.team || o.protect > 0) continue;
        if (Math.abs(o.pos.x - origin.x) > w.range + 2 && Math.abs(o.pos.z - origin.z) > w.range + 2) continue;
        const t = rayBox(origin.x, origin.y, origin.z, tmpDir.x, tmpDir.y, tmpDir.z, { minx: o.pos.x - 1, maxx: o.pos.x + 1, minz: o.pos.z - 1, maxz: o.pos.z + 1, miny: o.pos.y, maxy: o.pos.y + H }, bt);
        if (t >= 0 && t < bt) { bt = t; best = o; head = origin.y + tmpDir.y * t > o.pos.y + 3.95; }
      }
      end.copy(origin).addScaledVector(tmpDir, bt);
      if (!w.melee) this.tracers.emit(muzzle, end, f.isPlayer ? '#fff1a8' : '#ffb27a');
      if (best) {
        hitAny = true; if (head) headAny = true;
        const dmg = w.dmg * (head ? 2 : 1) * dmgMul * (f.dmgMul || 1);
        this.particles.burst(end.x, end.y, end.z, head ? 10 : 6, 9, head ? ['#ffe14a', '#ff7a1a'] : ['#ffb27a', '#ff6a4a', '#ffffff'], 0.4, 0.22, 20);
        if (this.damage(best, dmg, f, head, w.id)) killedAny = true;
      } else if (bt < w.range) {
        this.particles.burst(end.x, end.y, end.z, 5, 7, ['#d8d8d8', '#a8a8a8', '#ffe9a0'], 0.35, 0.18, 18);
      }
    }
    if (f.isPlayer && hitAny) { const kind = killedAny ? 'kill' : headAny ? 'head' : 'hit'; this.hud.hitmarker(kind); Sfx.play(killedAny ? 'kill' : headAny ? 'head' : 'hit'); }
  }

  muzzlePos(f, fallback) {
    const m = f.rig.weapon?.userData.muzzle; const v = new THREE.Vector3();
    if (m) { f.rig.root.updateMatrixWorld(); m.getWorldPosition(v); return v; }
    return fallback.clone();
  }

  // возвращает true если убит
  damage(victim, amount, attacker, head, weaponId) {
    if (!victim.alive || victim.protect > 0 || this.state === 'ended') return false;
    victim.hp -= amount; victim.hurtT = 0.2;
    if (victim.isPlayer) {
      Sfx.play('hurt'); const p = victim;
      const dx = attacker.pos.x - p.pos.x, dz = attacker.pos.z - p.pos.z;
      this.hud.damage(wrap(Math.atan2(-dx, -dz) - p.yaw)); this.shake = 0.25;
    }
    if (victim.hp > 0) return false;
    victim.hp = 0; victim.alive = false; victim.deaths++; victim.respawnT = victim.isPlayer ? 3 : 4.5; victim.cd = 0;
    if (victim.hasFlag) this.dropFlag(victim);
    attacker.kills++;
    if (this.mode === 'tdm' && attacker.team !== victim.team) this.score[attacker.team]++;
    const vc = victim.clone ? '#ff6a4a' : victim.team === 'B' ? TEAM_COLORS.B : victim.team === 'A' || victim.team === 'P' ? TEAM_COLORS.A : '#fff';
    const ac = attacker.team === 'B' ? TEAM_COLORS.B : attacker.team === 'A' || attacker.team === 'P' ? TEAM_COLORS.A : '#fff';
    this.hud.feed(`<b style="color:${ac}">${attacker.name}</b> <i>${head ? '🎯' : '✕'}</i> <b style="color:${vc}">${victim.name}</b>`);
    this.particles.burst(victim.pos.x, victim.pos.y + 2.5, victim.pos.z, 22, 12, SKINS.length ? [victim.rig.def.head, victim.rig.def.torso, '#ffffff'] : ['#fff'], 0.8, 0.35, 30, 6);
    if (attacker.isPlayer) {
      this.stats.kills++; if (head) this.stats.headshots++;
      this.addCoins(10 + (head ? 5 : 0));
      this.hud.toast(`Ты убил игрока! +${10 + (head ? 5 : 0)} монет${head ? ' (в голову!)' : ''}`, 'kill');
      this.playEffect(victim);
    }
    if (victim.isPlayer) {
      this.stats.deaths++; this.hud.dead(3, attacker.name);
      if (this.mode === 'survival') this.endMatch(false);
    }
    if (this.mode === 'survival' && victim.clone) this.surv.kills++;
    this.checkWin();
    return true;
  }

  playEffect(victim) {
    const id = this.save.data.equipped.effect; const st = EFFECT_STYLE[id]; if (!st) return;
    this.particles.burst(victim.pos.x, victim.pos.y + 3, victim.pos.z, st.count, st.speed, st.colors, 1.2, st.size, st.gravity, 6);
  }

  addCoins(n) { this.save.data.coins += n; this.stats.coins += n; this.player.coinsEarned += n; Sfx.play('coin', 0.5); }

  // копирование скина (E)
  tryCopy() {
    const p = this.player; if (!p.alive) return;
    if (p.copyCd > 0) { this.hud.toast(`Копирование через ${Math.ceil(p.copyCd)} с`); return; }
    const dir = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    let best = null, bd = 12;
    for (const o of this.fighters) {
      if (o === p || !o.alive) continue;
      const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(o.pos.y - p.pos.y) > 6) continue;
      if ((dx * dir.x + dz * dir.z) / Math.max(d, 0.001) < 0.55) continue;
      best = o; bd = d;
    }
    if (!best) { this.hud.toast('Подойди к игроку и посмотри на него, затем нажми E'); return; }
    this.setFighterSkin(p, best.skin, best.wskin); this.rebuildViewmodel(true);
    p.copyCd = 6; this.stats.copies++; Sfx.play('copy');
    this.addCoins(5);
    this.hud.toast(`Скопирован скин: ${SKINS.find(s => s.id === best.skin)?.name || ''} (${best.name}) +5 монет`, 'copy');
    this.particles.burst(p.pos.x, p.pos.y + 2.5, p.pos.z, 30, 10, ['#46c8ff', '#ffffff', '#7cf0ff'], 0.8, 0.28, -2, 3);
    this.particles.burst(best.pos.x, best.pos.y + 2.5, best.pos.z, 20, 8, ['#46c8ff', '#ffffff'], 0.7, 0.25, -2, 3);
  }

  emote(id) { const p = this.player; if (!p.alive || this.state !== 'play') return; p.emote = id; p.emoteT = 2.6; this.mouse.down = false; }

  // ───────────── движение ─────────────
  gather(f) {
    const m = 3 + Math.abs(f.vel.x) * 0.1 + Math.abs(f.vel.z) * 0.1 + Math.abs(f.vel.y) * 0.1; f.near.length = 0;
    const x0 = f.pos.x - R - m, x1 = f.pos.x + R + m, z0 = f.pos.z - R - m, z1 = f.pos.z + R + m, y0 = f.pos.y - 3 - Math.abs(f.vel.y) * 0.1, y1 = f.pos.y + H + 3 + Math.abs(f.vel.y) * 0.1;
    for (const c of this.cols) if (c.maxx > x0 && c.minx < x1 && c.maxz > z0 && c.minz < z1 && c.maxy > y0 && c.miny < y1) f.near.push(c);
  }

  moveFighter(f, dt, wx, wz, jump) {
    this.gather(f);
    const steps = Math.max(1, Math.ceil(dt / (1 / 90))); const h = dt / steps;
    for (let s = 0; s < steps; s++) this.step(f, h, wx, wz, jump && s === 0);
    // границы
    const b = this.map.bounds; f.pos.x = clamp(f.pos.x, -b.x, b.x); f.pos.z = clamp(f.pos.z, -b.z, b.z);
  }

  step(f, dt, wx, wz, jump) {
    const near = f.near, pos = f.pos, vel = f.vel;
    // горизонтальная скорость
    const k = f.onGround ? Math.min(1, 16 * dt) : f.launched ? Math.min(1, 0.2 * dt) : Math.min(1, 3.2 * dt);
    vel.x += (wx - vel.x) * k; vel.z += (wz - vel.z) * k;
    if (jump && f.onGround) { vel.y = JUMP; f.onGround = false; if (f.isPlayer) Sfx.play('jump', 0.6); }
    vel.y -= GRAV * dt; if (vel.y < -140) vel.y = -140;
    f.onGround = false;
    // X
    pos.x += vel.x * dt; this.resolve(f, near, 'x');
    pos.z += vel.z * dt; this.resolve(f, near, 'z');
    pos.y += vel.y * dt;
    for (const c of near) {
      if (pos.x + R > c.minx && pos.x - R < c.maxx && pos.z + R > c.minz && pos.z - R < c.maxz && pos.y < c.maxy && pos.y + H > c.miny) {
        if (vel.y <= 0 && pos.y - vel.y * dt >= c.maxy - 0.6) { pos.y = c.maxy; vel.y = 0; f.onGround = true; f.launched = false; }
        else if (vel.y > 0) { pos.y = c.miny - H - 0.001; vel.y = 0; }
      }
    }
    // прыжковые площадки
    if (f.onGround) for (const pd of this.map.pads) {
      if (Math.abs(f.pos.y - pd.y) < 1.5 && Math.hypot(f.pos.x - pd.x, f.pos.z - pd.z) < pd.r) { vel.set(pd.vx, pd.vy, pd.vz); f.onGround = false; f.launched = true; if (f.isPlayer) Sfx.play('pad'); }
    }
  }

  resolve(f, near, axis) {
    const pos = f.pos, vel = f.vel;
    for (const c of near) {
      if (pos.x + R <= c.minx || pos.x - R >= c.maxx || pos.z + R <= c.minz || pos.z - R >= c.maxz || pos.y >= c.maxy || pos.y + H <= c.miny) continue;
      const stepH = c.maxy - pos.y;
      if (stepH <= STEP && stepH > 0 && vel.y <= 0.5) {
        // ступенька: проверяем свободное место над ней
        let clear = true;
        for (const o of near) { if (o !== c && pos.x + R > o.minx && pos.x - R < o.maxx && pos.z + R > o.minz && pos.z - R < o.maxz && c.maxy + H > o.miny && c.maxy < o.maxy) { clear = false; break; } }
        if (clear) { pos.y = c.maxy; if (vel.y < 0) vel.y = 0; f.onGround = true; continue; }
      }
      if (axis === 'x') { if (vel.x > 0 || pos.x < (c.minx + c.maxx) / 2) pos.x = c.minx - R - 0.001; else pos.x = c.maxx + R + 0.001; vel.x = 0; }
      else { if (vel.z > 0 || pos.z < (c.minz + c.maxz) / 2) pos.z = c.minz - R - 0.001; else pos.z = c.maxz + R + 0.001; vel.z = 0; }
    }
  }

  // ───────────── игрок ─────────────
  updatePlayer(dt) {
    const p = this.player, K = this.keys, sv = this.save.data.settings;
    p.protect = Math.max(0, p.protect - dt); p.copyCd = Math.max(0, p.copyCd - dt); p.hurtT = Math.max(0, p.hurtT - dt);
    if (!p.alive) {
      p.deadT = Math.min(1, p.deadT + dt * 3);
      if (this.mode !== 'survival') { p.respawnT -= dt; this.hud.dead(Math.max(0, p.respawnT)); if (p.respawnT <= 0 && this.state !== 'ended') this.respawn(p); }
      return;
    }
    // обзор
    const sens = 0.0022 * sv.sens * (this.aiming ? 0.6 : 1);
    p.yaw -= this.mouse.dx * sens; p.pitch = clamp(p.pitch - this.mouse.dy * sens, -1.45, 1.45);
    this.vm.sx = clamp(this.vm.sx + this.mouse.dx * 0.0006, -0.06, 0.06); this.vm.sy = clamp(this.vm.sy + this.mouse.dy * 0.0006, -0.06, 0.06);
    this.mouse.dx = this.mouse.dy = 0;

    const w = W[p.weaponId], st = p.ammo[p.weaponId];
    this.aiming = this.mouse.right && !p.reloading && !p.emote;
    if (p.emote) { p.emoteT -= dt; if (p.emoteT <= 0 || K.has('KeyW') || K.has('KeyS') || K.has('KeyA') || K.has('KeyD') || K.has('Space') || this.mouse.down) p.emote = null; }

    const fwd = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    const str = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    let wx = -sin * fwd + cos * str, wz = -cos * fwd - sin * str; const l = Math.hypot(wx, wz);
    const sprint = (K.has('ShiftLeft') || K.has('ShiftRight')) && fwd > 0 && !this.aiming;
    const sp = (sprint ? SPRINT : WALK) * (this.aiming ? 0.62 : 1) * (p.reloading ? 0.92 : 1) * (this.state === 'play' ? 1 : 0);
    if (l > 0) { wx = wx / l * sp; wz = wz / l * sp; }
    this.moveFighter(p, dt, wx, wz, K.has('Space') && this.state === 'play');
    this.fall(p);

    // оружие
    p.cd = Math.max(0, p.cd - dt); p.switchT = Math.max(0, p.switchT - dt);
    if (p.reloading) { p.reloadT -= dt; if (p.reloadT <= 0) { const take = Math.min(w.mag - st.mag, st.reserve); st.mag += take; st.reserve -= take; p.reloading = false; } }
    if (!this.mouse.down) p.fireLatch = false;
    if (this.mouse.down && this.state === 'play' && p.cd <= 0 && !p.reloading && p.switchT <= 0 && !p.emote && (w.auto || !p.fireLatch)) {
      if (w.melee || st.mag > 0) this.playerFire(p, w, st);
      else if (st.reserve > 0) this.startReload(p); else if (!p.fireLatch) { Sfx.play('empty'); p.fireLatch = true; }
    }
    if (!w.melee && st.mag === 0 && st.reserve > 0 && !p.reloading && p.cd <= 0) this.startReload(p);

    // анимация модели
    const hs = Math.hypot(p.vel.x, p.vel.z);
    p.rig.root.position.copy(p.pos); p.rig.root.rotation.y = p.yaw;
    updateRig(p.rig, dt, { speed: hs / WALK, air: !p.onGround, pitch: p.pitch, holding: true, emote: p.emote, dead: 0 });
    p.rig.root.visible = this.thirdPerson || !!p.emote;
  }

  playerFire(p, w, st) {
    p.cd = 1 / w.rate; p.fireLatch = true;
    if (!w.melee) st.mag--;
    const origin = new THREE.Vector3(p.pos.x, p.pos.y + EYE, p.pos.z);
    const cp = Math.cos(p.pitch), dir = new THREE.Vector3(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp);
    if (this.thirdPerson || p.emote) { // луч из камеры → точка прицела → направление от глаз
      const co = this.cam.position, t = raycastWorld(this.cols, co.x, co.y, co.z, dir.x, dir.y, dir.z, 200); const pt = co.clone().addScaledVector(dir, t < 0 ? 200 : t); dir.copy(pt).sub(origin).normalize();
    }
    const moving = Math.hypot(p.vel.x, p.vel.z) > 3, spreadMul = (this.aiming ? 0.35 : 1) * (moving ? 1.6 : 1) * (p.onGround ? 1 : 2.5);
    this.shoot(p, origin, dir, w, spreadMul);
    Sfx.play(w.id); kickRig(p.rig);
    this.vm.kick = Math.min(1.6, this.vm.kick + w.recoil * 0.5); this.vm.flashT = 0.05; if (w.melee) this.vm.swing = 1;
    p.pitch = clamp(p.pitch + w.recoil * 0.006, -1.45, 1.45); p.yaw += rnd(-1, 1) * w.recoil * 0.0018;
    this.hud.crosshairKick(w.recoil);
  }

  fall(f) {
    if (f.pos.y >= this.map.killY || !f.alive) return;
    f.hp = 0; f.alive = false; f.deaths++; f.respawnT = 3; f.protect = 0;
    if (f.hasFlag) this.dropFlag(f);
    this.hud.feed(`<b>${f.name}</b> упал в бездну`);
    if (f.isPlayer) { this.stats.deaths++; this.hud.dead(3, 'бездна'); if (this.mode === 'survival') this.endMatch(false); }
    else { f.rig.root.visible = false; f.tag.visible = f.hpBar.visible = f.hpBg.visible = false; }
    if (this.mode === 'survival' && f.clone) this.surv.kills++;
  }

  // ───────────── боты ─────────────
  pickGoal(b) {
    const ai = b.ai; let g = null;
    const foes = this.enemies(b);
    if (this.mode === 'survival' && b.clone) g = this.player.alive ? this.player.pos.clone() : null;
    else if (this.mode === 'ctf' && this.flags) {
      const own = this.flags[b.team], foe = this.flags[b.team === 'A' ? 'B' : 'A'];
      if (b.hasFlag) g = own.home.clone();
      else if (!own.atHome && own.carrier) g = own.carrier.pos.clone();
      else if (!own.atHome) g = own.pos.clone();
      else if (ai.role === 'attack') g = (foe.carrier && foe.carrier.team === b.team) ? own.home.clone().add(new THREE.Vector3(rnd(-8, 8), 0, rnd(-8, 8))) : foe.pos.clone();
      else g = own.home.clone().add(new THREE.Vector3(rnd(-14, 14), 0, rnd(-14, 14)));
    }
    if (!g) {
      if (foes.length && Math.random() < 0.55) { const t = foes[(Math.random() * foes.length) | 0]; g = t.pos.clone().add(new THREE.Vector3(rnd(-12, 12), 0, rnd(-12, 12))); }
      else g = this.findSpot(this.map.zones.ALL, { tries: 25 });
    }
    if (this.map.floating && !this.pathOk(b.pos, g)) g = this.viaWaypoint(b.pos, g);
    if (this.map.floating && !this.pathOk(b.pos, g)) { g = this.findSpot({ x0: b.pos.x - 14, x1: b.pos.x + 14, z0: b.pos.z - 14, z1: b.pos.z + 14 }, { tries: 20 }); }
    ai.goal = g; ai.goalT = rnd(5, 9);
  }

  // есть ли под ногами земля на всём отрезке (для карт с пустотой)
  pathOk(a, g) {
    const dx = g.x - a.x, dz = g.z - a.z, d = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(d / 3));
    for (let i = 1; i <= n; i++) {
      const x = a.x + dx * i / n, z = a.z + dz * i / n, r = groundAt(this.cols, x, z, a.y + 9, 0.3);
      if (r.y === -Infinity || r.y < a.y - 9) return false;
    }
    return true;
  }
  viaWaypoint(a, g) {
    const wps = this.map.waypoints; if (!wps) return g;
    let best = null, bd = Infinity; const dg = Math.hypot(g.x - a.x, g.z - a.z);
    for (const w of wps) {
      const dw = Math.hypot(g.x - w.x, g.z - w.z); if (dw > dg - 4 || Math.hypot(w.x - a.x, w.z - a.z) < 3) continue;
      if (!this.pathOk(a, w)) continue; if (dw < bd) { bd = dw; best = w; }
    }
    return best ? new THREE.Vector3(best.x, a.y, best.z) : g;
  }

  los(b, t) {
    const ox = b.pos.x, oy = b.pos.y + EYE, oz = b.pos.z, tx = t.pos.x, ty = t.pos.y + 3.2, tz = t.pos.z;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, d = Math.hypot(dx, dy, dz); if (d < 0.01) return true;
    const hit = raycastWorld(this.cols, ox, oy, oz, dx / d, dy / d, dz / d, d);
    return hit < 0;
  }

  updateBot(b, dt) {
    const ai = b.ai;
    b.protect = Math.max(0, b.protect - dt); b.hurtT = Math.max(0, b.hurtT - dt);
    // полоска здоровья
    b.hpBar.scale.x = Math.max(0.001, 3.0 * b.hp / b.maxHp); b.hpBar.position.x = -1.5 + b.hpBar.scale.x / 2;
    b.hpBar.material.color.set(b.hp > 60 ? '#58e06a' : b.hp > 30 ? '#ffd23f' : '#ff4d4d');
    if (!b.alive) {
      b.deadT = Math.min(1, b.deadT + dt * 3.5); updateRig(b.rig, dt, { dead: b.deadT, holding: false });
      b.rig.root.position.copy(b.pos); b.tag.visible = b.hpBar.visible = b.hpBg.visible = false;
      b.respawnT -= dt;
      if (b.clone) { if (b.respawnT < 0.8) b.rig.root.visible = false; return; }
      if (b.respawnT <= 0 && this.state !== 'ended' && this.mode !== 'survival') this.respawn(b);
      return;
    }
    b.tag.visible = b.hpBar.visible = b.hpBg.visible = true;
    const w = W[b.weaponId]; b.cd = Math.max(0, b.cd - dt);
    ai.targetT -= dt; ai.goalT -= dt; ai.strafeT -= dt; ai.jumpT -= dt; ai.react = Math.max(0, ai.react - dt); ai.burstT = Math.max(0, ai.burstT - dt); ai.detourT = Math.max(0, ai.detourT - dt);
    if (ai.targetT <= 0) {
      ai.targetT = rnd(0.25, 0.5);
      let best = null, bd = b.weaponId === 'sniper' ? 140 : 95;
      for (const o of this.fighters) {
        if (!o.alive || o === b || o.team === b.team) continue;
        const d = Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z); if (d < bd && this.los(b, o)) { bd = d; best = o; }
      }
      if (best && best !== ai.target) ai.react = rnd(0.3, 0.7);
      ai.target = best; ai.los = !!best;
    }
    if (ai.target && !ai.target.alive) { ai.target = null; ai.los = false; }
    if (ai.strafeT <= 0) { ai.strafe = -ai.strafe; ai.strafeT = rnd(0.6, 1.9); }

    let wishF = 0, wishS = 0, desiredYaw = b.yaw, speed = WALK * 0.9 * b.speedMul, jump = false;
    const t = ai.target;
    if (t) {
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, d = Math.hypot(dx, dz), dy = t.pos.y + 3.2 - (b.pos.y + EYE);
      desiredYaw = Math.atan2(-dx, -dz); b.pitch = clamp(Math.atan2(dy, d), -1, 1);
      const pref = PREF[b.weaponId] || 20;
      if (w.melee) wishF = d > 1.8 ? 1 : 0; else wishF = d > pref * 1.25 ? 1 : d < pref * 0.55 ? -0.7 : 0;
      if (!w.melee && !b.clone) wishS = ai.strafe * 0.8;
      if (b.hasFlag) { wishF = 1; wishS = 0; }
      // стрельба
      const err = Math.abs(wrap(desiredYaw - b.yaw));
      if (!b.clone || w.melee === false) {
        if (ai.react <= 0 && b.cd <= 0 && err < 0.14 && d < w.range * 0.7 && this.state === 'play' && (ai.burstT <= 0)) this.botFire(b, t, w, d);
      }
      if (b.clone && w.melee && d < 2.6 && b.cd <= 0 && this.state === 'play') { b.cd = 1.1; kickRig(b.rig); this.damage(t, 7 + this.surv.wave, b, false, 'knife'); }
    } else {
      if (!ai.goal || ai.goalT <= 0 || Math.hypot(ai.goal.x - b.pos.x, ai.goal.z - b.pos.z) < 3) this.pickGoal(b);
      const dx = ai.goal.x - b.pos.x, dz = ai.goal.z - b.pos.z; desiredYaw = Math.atan2(-dx, -dz); wishF = 1; b.pitch *= 0.9;
      if (b.clone) speed = WALK * 0.95 * b.speedMul;
    }
    if (ai.detourT > 0) { wishS = ai.detourDir; wishF = 0.5; }
    // клоны в выживании бегут прямо к игроку, даже без прямой видимости
    if (b.clone && this.player.alive && !t) { /* цель — игрок через pickGoal */ }
    b.yaw += clamp(wrap(desiredYaw - b.yaw), -8 * dt, 8 * dt);
    const sin = Math.sin(b.yaw), cos = Math.cos(b.yaw);
    let wx = -sin * wishF + cos * wishS, wz = -cos * wishF - sin * wishS; const l = Math.hypot(wx, wz);
    if (l > 0) { wx = wx / l * speed; wz = wz / l * speed; }
    if (this.state !== 'play') { wx = wz = 0; }
    if (this.map.floating && b.onGround && !b.launched && (wx || wz)) { // не шагаем в пустоту
      const g = groundAt(this.cols, b.pos.x + wx * 0.3, b.pos.z + wz * 0.3, b.pos.y + 4, 0.3);
      if (g.y === -Infinity || g.y < b.pos.y - 3.5) { wx = wz = 0; ai.goal = null; ai.detourT = 0; ai.target = null; ai.targetT = 0.6; }
    }
    // застревание
    ai.stuckT += dt;
    if (ai.stuckT > 0.7) {
      const moved = Math.hypot(b.pos.x - ai.lastX, b.pos.z - ai.lastZ); ai.lastX = b.pos.x; ai.lastZ = b.pos.z; ai.stuckT = 0;
      if (l > 0 && moved < 1.0 && this.state === 'play') { ai.stuck++; ai.detourT = rnd(0.5, 1.0); ai.detourDir = Math.random() < 0.5 ? 1 : -1; jump = true; if (ai.stuck >= 3) { ai.goal = null; ai.stuck = 0; ai.target = t && Math.random() < 0.5 ? t : null; } } else ai.stuck = 0;
    }
    if (ai.jumpT <= 0) { ai.jumpT = rnd(2.5, 6); if (t && !w.melee) jump = true; }
    this.moveFighter(b, dt, wx, wz, jump);
    this.fall(b);
    b.rig.root.position.copy(b.pos); b.rig.root.rotation.y = b.yaw;
    updateRig(b.rig, dt, { speed: Math.hypot(b.vel.x, b.vel.z) / WALK, air: !b.onGround, pitch: b.pitch, holding: true, dead: 0 });
    if (b.protect > 0) b.rig.root.visible = Math.floor(this.time * 14) % 2 === 0 || b.protect < 0.2; else if (!b.clone || b.alive) b.rig.root.visible = true;
  }

  botFire(b, t, w, d) {
    const ai = b.ai;
    b.cd = 1 / w.rate * (w.auto ? 1 : rnd(1.1, 1.8));
    const origin = new THREE.Vector3(b.pos.x, b.pos.y + EYE, b.pos.z);
    const target = new THREE.Vector3(t.pos.x, t.pos.y + rnd(2.0, 3.8), t.pos.z);
    const dir = target.sub(origin).normalize();
    if (w.auto) { ai.burst = (ai.burst || 0) + 1; if (ai.burst >= (5 + (Math.random() * 5 | 0))) { ai.burst = 0; ai.burstT = rnd(0.35, 0.9); } }
    this.shoot(b, origin, dir, w, 2.4 + d / 38, w.melee ? 0.8 : 0.42);
    kickRig(b.rig);
    if (Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z) < 90) Sfx.play(w.id, clamp(1 - d / 160, 0.15, 0.6) * (1 - Math.min(0.7, Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z) / 130)));
    b.lastHitTarget = t;
  }

  // ───────────── выживание ─────────────
  updateSurvival(dt) {
    const s = this.surv;
    const alive = this.fighters.filter(f => f.clone && f.alive).length;
    if (s.toSpawn > 0) {
      s.spawnT -= dt;
      if (s.spawnT <= 0 && alive < 14) {
        s.spawnT = Math.max(0.7, 2.0 - s.wave * 0.1); s.toSpawn--;
        const f = this.makeFighter({ name: 'Копия', team: 'Z', skin: this.player.skin, weaponId: Math.random() < 0.25 && s.wave > 1 ? 'pistol' : 'knife', wskin: 'demonic', clone: true });
        f.maxHp = 40 + s.wave * 10; f.speedMul = Math.min(1.35, 0.55 + s.wave * 0.07 + Math.random() * 0.12); f.ai.role = 'attack';
        this.respawn(f, false);
        f.dmgMul = 0.9;
      }
    } else if (alive === 0) {
      s.breakT -= dt;
      if (s.breakT <= 0) {
        s.wave++; s.toSpawn = 2 + s.wave * 2; s.spawnT = 0; s.breakT = 4;
        if (s.wave > 1) { this.addCoins(25 * (s.wave - 1)); this.player.hp = Math.min(100, this.player.hp + 30); this.hud.center(`ВОЛНА ${s.wave}`, `Копий: ${s.toSpawn}`, 1800); } else this.hud.center('ВОЛНА 1', `Копий: ${s.toSpawn}`, 1800);
        Sfx.play('flag');
      }
    }
    // убираем мёртвые копии
    this.fighters = this.fighters.filter(f => { if (f.clone && !f.alive && f.respawnT < -0.1) { this.scene.remove(f.rig.root); return false; } return true; });
  }

  // ───────────── победа / итоги ─────────────
  checkWin() {
    if (this.state !== 'play') return;
    const g = GOALS[this.mode]; if (!g) return;
    if (this.mode === 'ffa') { const top = this.fighters.reduce((a, b) => (b.kills > a.kills ? b : a)); if (top.kills >= g) this.endMatch(top === this.player); }
    else if (this.score.A >= g) this.endMatch(true); else if (this.score.B >= g) this.endMatch(false);
  }

  endMatch(win, timeUp = false) {
    if (this.state === 'ended') return;
    if (timeUp && !win) {
      if (this.mode === 'ffa') win = this.rank() === 1; else win = this.score.A > this.score.B;
    }
    this.state = 'ended'; this.mouse.down = false; this.mouse.right = false;
    const p = this.player, st = this.stats, sv = this.save;
    const draw = timeUp && (this.mode === 'tdm' || this.mode === 'ctf') && this.score.A === this.score.B;
    if (draw) win = false;
    let bonus = win ? 100 : 30; if (this.mode === 'survival') { bonus = 20 * (this.surv.wave); win = this.surv.wave >= 3; }
    if (this.mode === 'ctf') bonus += 40 * (st.captures || 0);
    const xp = st.kills * 10 + (win ? 60 : 20) + (this.mode === 'survival' ? this.surv.wave * 15 : 0);
    sv.data.coins += bonus; sv.data.xp += xp; st.coins += bonus;
    sv.bump('kills', st.kills); sv.bump('deaths', st.deaths); sv.bump('headshots', st.headshots); sv.bump('copies', st.copies); sv.bump('matches', 1); if (win) sv.bump('wins', 1);
    const mp = sv.data.stats.modesPlayed; if (!mp.includes(this.mode)) mp.push(this.mode);
    const newAch = sv.checkAchievements(); sv.commit();
    const result = {
      mode: this.mode, mapId: this.mapId, win, draw, kills: st.kills, deaths: st.deaths, headshots: st.headshots, copies: st.copies, bonus, coinsTotal: st.coins, xp, wave: this.surv?.wave, captures: st.captures || 0,
      scoreA: this.score.A, scoreB: this.score.B, rank: this.rank(), newAch,
      board: this.fighters.filter(f => !f.clone).map(f => ({ name: f.name, team: f.team, kills: f.kills, deaths: f.deaths, me: f.isPlayer })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths),
    };
    Sfx.play(win ? 'win' : 'lose');
    this.hud.center(win ? 'ПОБЕДА!' : draw ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ', '', 4000);
    if (document.pointerLockElement) { this._noPause = true; document.exitPointerLock(); setTimeout(() => { this._noPause = false; }, 200); }
    setTimeout(() => { if (this.active) this.hud.results(result); }, 1800);
  }

  rank() { const s = [...this.fighters.filter(f => !f.clone)].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths); return s.indexOf(this.player) + 1; }

  // ───────────── главный цикл ─────────────
  frame(dt) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    if (!this.paused) this.sim(dt);
    this.renderFrame(dt);
  }

  sim(dt) {
    this.time += dt; const p = this.player;
    this.map.update(this.time);
    if (this.state === 'countdown') {
      this.countT -= dt; const n = Math.ceil(this.countT);
      if (n !== this._lastCount && n > 0) { this._lastCount = n; this.hud.center(String(n), '', 900); Sfx.play('beep'); }
      if (this.countT <= 0) { this.state = 'play'; this.hud.center('В БОЙ!', '', 900); Sfx.play('go'); }
    }
    if (this.state === 'play') {
      this.elapsed += dt;
      if (this.mode !== 'survival') { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMatch(false, true); } }
      if (this.mode === 'survival') this.updateSurvival(dt);
    }
    this.updatePlayer(dt);
    for (const f of this.fighters) { if (!f.isPlayer) this.updateBot(f, dt); }
    this.separate();
    if (this.flags) this.updateFlags(dt);
    this.updatePickups(dt);
    this.updatePet(dt);
    this.particles.update(dt); this.tracers.update(dt);
    this.world.follow(p.pos);
    this.hitFlash = Math.max(0, this.hitFlash - dt); this.shake = Math.max(0, this.shake - dt * 1.5);
    this.updateHud();
  }

  separate() {
    const fs = this.fighters; const minD = R * 2;
    for (let i = 0; i < fs.length; i++) { const a = fs[i]; if (!a.alive) continue;
      for (let j = i + 1; j < fs.length; j++) { const b = fs[j]; if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; if (Math.abs(dy(a, b)) > H - 1) continue;
        const d = Math.hypot(dx, dz); if (d < minD && d > 0.001) { const push = (minD - d) / 2; a.pos.x -= dx / d * push; a.pos.z -= dz / d * push; b.pos.x += dx / d * push; b.pos.z += dz / d * push; } }
    }
    function dy(a, b) { return a.pos.y - b.pos.y; }
  }

  updatePet(dt) {
    if (!this.pet) return; const p = this.player, pet = this.pet.root;
    const tx = p.pos.x + Math.cos(p.yaw) * 2.6 + Math.sin(p.yaw) * 3.4, tz = p.pos.z - Math.sin(p.yaw) * 2.6 + Math.cos(p.yaw) * 3.4;
    const dx = tx - pet.position.x, dz = tz - pet.position.z, d = Math.hypot(dx, dz);
    const moving = d > 0.8;
    if (d > 28) { pet.position.x = tx; pet.position.z = tz; }
    else if (moving) { const s = Math.min(d, (8 + d * 1.6) * dt); pet.position.x += dx / d * s; pet.position.z += dz / d * s; pet.rotation.y = Math.atan2(-dx, -dz); }
    const g = groundAt(this.cols, pet.position.x, pet.position.z, p.pos.y + 4, 0.4);
    const gy = g.y === -Infinity ? p.pos.y : g.y;
    pet.position.y += (gy + (moving ? Math.abs(Math.sin(this.time * 10)) * 0.4 : 0) - pet.position.y) * Math.min(1, 12 * dt);
    updatePet(this.pet, this.time, moving);
  }

  updateHud() {
    const p = this.player, w = W[p.weaponId], st = p.ammo[p.weaponId];
    let left = 0, right = 0, timer = '', info = '';
    if (this.mode === 'tdm' || this.mode === 'ctf') { left = this.score.A; right = this.score.B; }
    else if (this.mode === 'ffa') { left = p.kills; right = Math.max(0, ...this.fighters.filter(f => f !== p).map(f => f.kills)); }
    else { left = this.surv.wave; right = this.surv.kills; }
    if (this.mode === 'survival') { const t = Math.floor(this.elapsed); timer = `${String((t / 60) | 0).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
    else { const t = Math.ceil(this.timeLeft); timer = `${String((t / 60) | 0).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
    if (this.flags) {
      const own = this.flags.A, foe = this.flags.B;
      info = `<span class="fl a">Ваш флаг: ${own.atHome ? 'на базе' : own.carrier ? 'ВРАГ НЕСЁТ!' : 'упал'}</span><span class="fl b">Флаг врага: ${foe.atHome ? 'на базе' : foe.carrier === p ? 'у вас!' : foe.carrier ? 'у союзника' : 'упал'}</span>`;
    } else if (this.mode === 'survival') info = `<span class="fl">Волна ${this.surv.wave} · копий осталось: ${this.fighters.filter(f => f.clone && f.alive).length + this.surv.toSpawn}</span>`;
    else if (this.mode === 'ffa') info = `<span class="fl">Ваше место: ${this.rank()} из ${this.fighters.length}</span>`;
    this.hud.update({
      hp: p.hp, ammo: w.melee ? '∞' : st.mag, reserve: w.melee ? '' : st.reserve, reloading: p.reloading, weaponName: w.short || w.name, weaponId: w.id,
      slots: WEAPONS.map(x => ({ id: x.id, slot: x.slot, owned: this.save.has('weapons', x.id), active: x.id === p.weaponId, name: x.short || x.name })),
      left, right, timer, info, copy: p.copyCd, aim: this.aiming, scope: this.aiming && w.scope && !this.thirdPerson, mode: this.mode, rankBoard: null, protect: p.protect > 0,
    });
  }

  renderFrame(dt) {
    if (!this.scene) return;
    const p = this.player, cam = this.cam, sv = this.save.data.settings;
    const w = W[p.weaponId];
    const targetFov = this.aiming ? (w.scope ? w.zoomFov : sv.fov * 0.8) : sv.fov * (Math.hypot(p.vel.x, p.vel.z) > WALK * 1.2 ? 1.06 : 1);
    cam.fov += (targetFov - cam.fov) * Math.min(1, 14 * dt); cam.updateProjectionMatrix();
    const eye = new THREE.Vector3(p.pos.x, p.pos.y + EYE, p.pos.z);
    if (!p.alive && p.deadT > 0.2) {
      const t = this.time * 0.4; cam.position.set(p.pos.x + Math.sin(t) * 12, p.pos.y + 9, p.pos.z + Math.cos(t) * 12); cam.lookAt(p.pos.x, p.pos.y + 2, p.pos.z);
      p.rig.root.visible = true; p.rig.root.position.copy(p.pos); p.rig.root.rotation.y = p.yaw; updateRig(p.rig, dt, { dead: p.deadT, holding: false });
    } else {
      cam.rotation.order = 'YXZ'; cam.rotation.set(p.pitch, p.yaw, 0);
      if (this.thirdPerson || p.emote) {
        const view = new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
        const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
        const d = p.emote ? 9 : 8, want = eye.clone().addScaledVector(view, -d).addScaledVector(right, p.emote ? 0 : 1.6).add(new THREE.Vector3(0, 1.2, 0));
        const dirv = want.clone().sub(eye), len = dirv.length(); dirv.normalize();
        const t = raycastWorld(this.cols, eye.x, eye.y, eye.z, dirv.x, dirv.y, dirv.z, len); cam.position.copy(eye).addScaledVector(dirv, t >= 0 ? Math.max(1, t - 0.6) : len);
        if (p.emote) cam.lookAt(eye.x, eye.y - 0.4, eye.z);
      } else cam.position.copy(eye);
      if (this.shake > 0) cam.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(this.shake * 0.25));
    }
    // viewmodel
    const vm = this.vm, fp = p.alive && !this.thirdPerson && !p.emote && this.state !== 'none';
    if (vm) {
      vm.group.visible = fp && !(this.aiming && w.scope);
      const hs = Math.hypot(p.vel.x, p.vel.z) / WALK; vm.bob += dt * (4 + hs * 7) * (p.onGround ? 1 : 0.2);
      vm.kick = Math.max(0, vm.kick - dt * 8); vm.flashT = Math.max(0, vm.flashT - dt); vm.draw = Math.max(0, vm.draw - dt * 4); vm.swing = Math.max(0, vm.swing - dt * 5);
      vm.sx *= Math.pow(0.0005, dt); vm.sy *= Math.pow(0.0005, dt);
      const a = this.aiming ? 1 : 0; vm.aimK = (vm.aimK || 0) + (a - (vm.aimK || 0)) * Math.min(1, 14 * dt); const ak = vm.aimK;
      const bobX = Math.sin(vm.bob) * 0.05 * hs * (1 - ak), bobY = Math.abs(Math.cos(vm.bob)) * 0.06 * hs * (1 - ak) + Math.sin(this.time * 1.6) * 0.012;
      const rl = p.reloading ? Math.sin(Math.min(1, 1 - p.reloadT / Math.max(0.01, w.reload)) * Math.PI) : 0;
      const [bx, by, bz] = vm.pose.pos, [rx, ry, rz] = vm.pose.rot;
      vm.group.position.set(bx * (1 - ak * 0.55) + bobX - vm.sx * 6, by * (1 - ak * 0.3) + bobY + vm.sy * 6 - rl * 1.0 - vm.draw * 1.4, bz + vm.kick * 0.5 + (w.melee ? -vm.swing * 0.8 : 0));
      vm.group.rotation.set(rx + vm.kick * 0.1 + rl * 0.7 + vm.sy * 1.5 + (w.melee ? vm.swing * -1.1 : 0), ry + vm.sx * 1.5 + (w.melee ? vm.swing * 0.9 : 0), rz + (w.melee ? vm.swing * 0.8 : 0) + rl * 0.2);
      if (vm.flash) { vm.flash.visible = vm.flashT > 0; vm.flash.rotation.z = Math.random() * 3; }
    }
    this.renderer.autoClear = true; this.renderer.render(this.scene, cam);
    if (vm && vm.group.visible) { this.renderer.autoClear = false; this.renderer.clearDepth(); this.renderer.render(this.vmScene, this.vmCam); this.renderer.autoClear = true; }
  }
}
