// police.js — the wanted system (0–5 stars) and harbor police cars that chase,
// ram, and arrest. Stars rise with crimes and decay when you lay low.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createCarMesh } from './vehicles.js';

export function createPoliceFleet(scene) {
  return { cars: [], spawnTimer: 0 };
}

export function spawnPoliceCar(scene, fleet, nearPos, rng) {
  const mesh = createCarMesh(0x1a1a2e);
  // White doors + light bar: a white box stripe and red/blue beacons.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.6),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  stripe.position.y = 0.6; mesh.add(stripe);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  red.position.set(-0.4, 1.6, 0); mesh.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
  blue.position.set(0.4, 1.6, 0); mesh.add(blue);
  const angle = rng.range(0, Math.PI * 2);
  mesh.position.set(
    THREE.MathUtils.clamp(nearPos.x + Math.sin(angle) * 45, -200, 200), 0,
    THREE.MathUtils.clamp(nearPos.z + Math.cos(angle) * 45, -200, 200));
  scene.add(mesh);
  const car = { mesh, speed: 0, red, blue, arrestTimer: 0 };
  fleet.cars.push(car);
  return car;
}

// Make sure at least `count` police cars exist near a point (used by ?shot=).
export function ensurePoliceCars(scene, fleet, count, nearPos, rng) {
  while (fleet.cars.length < count) spawnPoliceCar(scene, fleet, nearPos, rng);
  return fleet.cars;
}

export function setWanted(state, stars) {
  state.wanted = THREE.MathUtils.clamp(Math.round(stars), 0, 5);
}

export function addWanted(state, stars) {
  setWanted(state, state.wanted + stars);
}

// Chase logic: police steer toward the player, ram at speed, and arrest a slow
// on-foot player they stay close to. Returns 'busted' when the arrest lands.
export function updatePolice(scene, fleet, state, dt, time, rng) {
  const wanted = state.wanted;
  const target = state.player.inCar ? state.player.inCar.mesh.position : state.player.mesh.position;
  const playerSpeed = state.player.inCar ? Math.abs(state.player.inCar.speed) : state.player.speed;

  // Spawn up to `wanted` police cars, one at a time.
  if (wanted > 0 && fleet.cars.length < Math.min(wanted, CONFIG.maxPolice)) {
    fleet.spawnTimer -= dt;
    if (fleet.spawnTimer <= 0) {
      spawnPoliceCar(scene, fleet, target, rng);
      fleet.spawnTimer = 2.5;
    }
  }
  // Stand down when the heat is off.
  if (wanted === 0 && fleet.cars.length > 0) {
    for (const car of fleet.cars) scene.remove(car.mesh);
    fleet.cars.length = 0;
  }

  let busted = false;
  for (const car of fleet.cars) {
    const p = car.mesh.position;
    const to = new THREE.Vector3().subVectors(target, p); to.y = 0;
    const dist = to.length();
    const desired = Math.atan2(to.x, to.z);
    let dy = desired - car.mesh.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.mesh.rotation.y += THREE.MathUtils.clamp(dy, -2.2 * dt, 2.2 * dt);
    const chaseSpeed = Math.min(46, 24 + wanted * 4);
    car.speed += ((dist > 6 ? chaseSpeed : 8) - car.speed) * Math.min(1, dt * 1.5);
    p.x += Math.sin(car.mesh.rotation.y) * car.speed * dt;
    p.z += Math.cos(car.mesh.rotation.y) * car.speed * dt;
    // Flash the light bar.
    const phase = Math.floor(time * 6) % 2 === 0;
    car.red.material.color.setHex(phase ? 0xff2a2a : 0x551111);
    car.blue.material.color.setHex(phase ? 0x112255 : 0x2a6bff);
    // Ram: damage the player when a police car slams into them.
    if (dist < 3.2) {
      if (state.player.inCar) {
        state.player.inCar.speed *= 0.55;
        state.damageFlash = 0.35;
      } else if (playerSpeed < 3) {
        car.arrestTimer += dt;
        if (car.arrestTimer > 2) busted = true;
      } else {
        state.player.health -= 25 * dt;
      }
    } else {
      car.arrestTimer = 0;
    }
  }
  return busted ? 'busted' : null;
}

// Wanted decay: lay low (no crime, slow, far from police) and stars fade.
export function decayWanted(state, dt, nearestPoliceDist) {
  if (state.wanted === 0) return;
  if (state.mission && state.mission.id === 2 && state.mission.active) return; // Hot Pursuit holds 3 stars
  state.wantedTimer = (state.wantedTimer || 0) + dt;
  if (state.wantedTimer > 12 && nearestPoliceDist > 60) {
    state.wanted -= 1;
    state.wantedTimer = 0;
  }
}
