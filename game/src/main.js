// main.js — Neon Harbor game loop: boot, input, menus, driving, missions,
// wanted/police, combat, HUD, audio, save, and deterministic screenshot mode.
import * as THREE from 'three';
import { CONFIG, CONTROLS } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './world.js';
import { makeCar, driveCar, nearestCar } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPlayer, updatePlayerOnFoot, updateCamera } from './player.js';
import { createPoliceFleet, updatePolice, decayWanted, addWanted } from './police.js';
import { createMissionState, startMission, updateMissions, nextMission } from './missions.js';
import { tryPunch, tryShoot, updateParticles, addSkid, updateSkids } from './combat.js';
import { initHud, showHud, updateHud, drawMinimap, showToast } from './hud.js';
import { SoundEngine } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { applyShot, shotStep, parseShotQuery, SHOT_NAMES } from './shots.js';
import { MISSIONS } from './config.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const rng = makeRng(CONFIG.seed);
const world = buildCity(scene, rng);
const player = createPlayer(scene);
const police = createPoliceFleet(scene);
const traffic = createTraffic(scene, rng, world.roads);
const peds = createPedestrians(scene, rng);

// Parked cars the player can steal, lined up along the main roads.
const parkedCars = [];
const parkSpots = [
  [8, 40], [8, -20], [-8, 90], [8, -80], [-63, 8], [63, -8],
  [-118, 8], [118, -8], [8, 140], [-8, -140], [173, 8], [-173, -8],
];
for (const [x, z] of parkSpots) parkedCars.push(makeCar(scene, rng, x, z));

const sound = new SoundEngine();

const state = {
  mode: 'menu', // menu | playing | paused | gameover
  scene, rng, player, parkedCars, traffic, peds, police,
  missions: createMissionState(),
  money: 0, rankIndex: 0, wanted: 0, wantedTimer: 0,
  speedKmh: 0, objectiveText: '', damageFlash: 0,
  camYaw: Math.PI, camPitch: 0.2, camDist: 13,
  shotMode: null, freezeAfterSteps: null, shotStepsRun: 0,
  time: 0,
};

// ---- input ----
const input = { forward: false, back: false, left: false, right: false, sprint: false };
const keyMap = {
  [CONTROLS.forward]: 'forward', [CONTROLS.back]: 'back',
  [CONTROLS.left]: 'left', [CONTROLS.right]: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code] != null) { input[keyMap[e.code]] = true; e.preventDefault(); }
  if (e.code === CONTROLS.enter && state.mode === 'playing') tryEnterCar();
  if (e.code === CONTROLS.punch && state.mode === 'playing') doPunch();
  if (e.code === CONTROLS.mission && state.mode === 'playing') openBriefing();
  if (e.code === CONTROLS.pause && (state.mode === 'playing' || state.mode === 'paused')) togglePause();
  if (e.code === CONTROLS.restart && state.mode === 'gameover') restartGame();
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code] != null) input[keyMap[e.code]] = false;
});
canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'playing') return;
  sound.unlock();
  if (e.button === 0) doShoot();
  drag.on = true; drag.x = e.clientX; drag.y = e.clientY;
});
window.addEventListener('mouseup', () => { drag.on = false; });
const drag = { on: false, x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
  if (!drag.on || state.mode !== 'playing') return;
  state.camYaw -= (e.clientX - drag.x) * 0.005;
  state.camPitch = THREE.MathUtils.clamp(state.camPitch + (e.clientY - drag.y) * 0.003, -0.1, 0.7);
  drag.x = e.clientX; drag.y = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- car enter / exit ----
function tryEnterCar() {
  if (player.inCar) {
    const car = player.inCar;
    car.speed = 0;
    player.inCar = null;
    player.mesh.visible = true;
    player.mesh.position.copy(car.mesh.position).add(new THREE.Vector3(2.5, 0, 0));
    player.mesh.rotation.y = car.mesh.rotation.y;
    showToast('Out of the car.');
    sound.blip(440, 0.08);
    return;
  }
  const car = nearestCar(parkedCars, player.mesh.position, 5);
  if (!car) { showToast('No car nearby — get closer and press E.'); return; }
  player.inCar = car;
  player.mesh.visible = false;
  if (!car.stolen) {
    car.stolen = true;
    addWanted(state, 1);
    showToast('Car stolen! The harbor police are on you — 1 star.');
    sound.blip(330, 0.15, 'square', 0.1);
  } else {
    showToast('Back in the car.');
  }
  sound.unlock();
}

function doPunch() {
  const result = tryPunch(state, scene);
  if (result) { sound.punch(); if (result === 'punch-hit') showToast('You decked a pedestrian! Wanted up.'); }
}

function doShoot() {
  const result = tryShoot(state, scene, camera);
  if (result) {
    sound.shoot();
    if (result === 'shoot-hit') showToast('Hit! Wanted level up.');
  }
}

// ---- menus / missions ----
const menuEl = document.getElementById('menu');
const briefEl = document.getElementById('brief');
function startPlaying() {
  menuEl.classList.add('hidden');
  briefEl.style.display = 'none';
  state.mode = 'playing';
  showHud(true);
  sound.unlock();
  updateHud(state, world);
}
document.getElementById('btnPlay').addEventListener('click', startPlaying);
document.getElementById('btnMission').addEventListener('click', () => {
  startPlaying();
  openBriefing();
});
document.getElementById('btnContinue').addEventListener('click', () => {
  const save = loadGame();
  if (save) {
    state.money = save.money;
    state.rankIndex = save.rankIndex;
    state.missions.index = save.missionIndex;
    state.missions.completed = save.completed || [];
    player.health = save.health || 100;
    showToast('Save loaded — welcome back, D.');
  } else {
    showToast('No save found — starting fresh.');
  }
  startPlaying();
});
function openBriefing() {
  const def = nextMission(state.missions);
  if (!def) { showToast('All missions complete — Harbor Legend!'); return; }
  document.getElementById('briefTitle').textContent = `Mission ${def.id}: ${def.name} — $${def.reward}`;
  document.getElementById('briefText').textContent = def.brief;
  briefEl.style.display = 'flex';
  state.mode = 'paused';
}
document.getElementById('btnAccept').addEventListener('click', () => {
  briefEl.style.display = 'none';
  const m = startMission(state, world);
  if (m) {
    state.mode = 'playing';
    showToast(`Mission ${m.id}: ${m.def.name} — ${m.def.startHint}`);
    sound.cash();
  }
});
document.getElementById('btnDecline').addEventListener('click', () => {
  briefEl.style.display = 'none';
  state.mode = 'playing';
});
function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    menuEl.classList.remove('hidden');
    document.querySelector('#menu h1').textContent = 'PAUSED';
    showToast('Paused — press P to resume.');
  } else if (state.mode === 'paused' && briefEl.style.display !== 'flex') {
    menuEl.classList.add('hidden');
    document.querySelector('#menu h1').textContent = 'NEON HARBOR';
    state.mode = 'playing';
  }
}
function gameOver(reason) {
  state.mode = 'gameover';
  menuEl.classList.remove('hidden');
  document.querySelector('#menu h1').textContent = reason === 'busted' ? 'BUSTED!' : 'WASTED!';
  document.querySelector('#menu h2').textContent =
    reason === 'busted'
      ? 'The harbor police caught Dario. Pay the fine, lay low — press R to try again.'
      : 'Dario is down. The harbor never sleeps — press R to try again.';
  document.getElementById('btnPlay').textContent = 'TRY AGAIN';
  sound.busted();
  sound.setSiren(false);
}
function restartGame() {
  player.health = 100;
  player.mesh.position.set(0, 0, 30);
  player.mesh.visible = true;
  player.inCar = null;
  state.wanted = 0;
  state.missions.active = null;
  world.beacon.visible = false;
  document.querySelector('#menu h1').textContent = 'NEON HARBOR';
  document.getElementById('btnPlay').textContent = 'PLAY';
  startPlaying();
}

// ---- screenshot mode ----
const shotName = parseShotQuery(window.location.search);
if (shotName && SHOT_NAMES.includes(shotName)) {
  initHud();
  menuEl.classList.add('hidden');
  applyShot(state, world, shotName);
  showHud(true);
  updateHud(state, world);
  drawMinimap(state, world);
} else {
  initHud();
}

// ---- main loop ----
const clock = new THREE.Clock();
let hudTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  // Shot mode uses a fixed timestep so repeated runs render identically.
  const dt = state.shotMode ? 1 / 60 : Math.min(rawDt, 0.05);
  state.time += dt;

  const frozen = state.shotMode && !shotStep(state);
  if (state.mode === 'playing' && !frozen) {
    // Player: drive or walk.
    if (player.inCar) {
      state.speedKmh = driveCar(player.inCar, input, dt);
      // Camera follows the car's heading.
      let dy = player.inCar.mesh.rotation.y - state.camYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      state.camYaw += dy * Math.min(1, dt * 2.5);
      addSkid(scene, player.inCar);
      sound.setEngine(state.speedKmh, true);
    } else {
      state.speedKmh = updatePlayerOnFoot(player, input, state.camYaw, dt, state.time);
      sound.setEngine(0, false);
    }
    // World life.
    const playerPos = player.inCar ? player.inCar.mesh.position : player.mesh.position;
    updateTraffic(traffic, dt, playerPos, rng);
    const danger = player.inCar ? player.inCar.mesh.position : null;
    updatePedestrians(peds, dt, danger, 6, rng, state.time);
    // Police + wanted. In shot mode the police hold their staged positions
    // (they are placed by shots.js) so the frame stays composed.
    const bust = state.shotMode ? null : updatePolice(scene, police, state, dt, state.time, rng);
    const nearestCop = police.cars.length
      ? Math.min(...police.cars.map((c) => c.mesh.position.distanceTo(playerPos)))
      : 999;
    if (!state.shotMode) decayWanted(state, dt, nearestCop);
    sound.setSiren(state.wanted > 0);
    // Missions.
    const doneMsg = updateMissions(state, world, dt);
    if (doneMsg) {
      showToast(doneMsg, 4000);
      sound.cash();
      saveGame(state);
    }
    // Beacon spin.
    if (world.beacon.visible) {
      world.beacon.children[1].rotation.y += dt * 2;
      world.beacon.children[1].position.y = 12 + Math.sin(state.time * 2) * 1.2;
    }
    updateParticles(scene, dt);
    updateSkids(scene, dt);
    // Health regen when calm, game over checks.
    if (state.wanted === 0 && player.health < 100) player.health = Math.min(100, player.health + 2 * dt);
    if (player.health <= 0) gameOver('wasted');
    if (bust === 'busted') gameOver('busted');
  }

  // Camera follows player or car.
  const focus = player.inCar ? player.inCar.mesh.position : player.mesh.position;
  // Shot mode: police hold formation behind the player's car so the chase
  // stays composed while the car coasts through its staged steps.
  if (state.shotMode && state.policeOffsets && player.inCar) {
    const yaw = player.inCar.mesh.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    state.policeOffsets.forEach((off, i) => {
      const cop = police.cars[i];
      if (!cop) return;
      cop.mesh.position.set(
        focus.x - fx * off.back - fz * off.side, 0,
        focus.z - fz * off.back + fx * off.side);
      cop.mesh.rotation.y = yaw;
    });
  }
  const camDist = state.camDist || (player.inCar ? 15 : 11);
  updateCamera(camera, focus, state.camYaw, state.camPitch, camDist, player.inCar ? 5 : 4.5);
  if (state.damageFlash > 0) state.damageFlash -= dt;

  hudTimer += dt;
  if (hudTimer > 0.12 && state.mode === 'playing') {
    hudTimer = 0;
    updateHud(state, world);
    drawMinimap(state, world);
  }
  renderer.render(scene, camera);
}
animate();

// Expose a tiny debug handle for play-testing (no network, no secrets).
window.__neonHarbor = { state, world, MISSIONS };
