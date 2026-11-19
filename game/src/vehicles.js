// vehicles.js — low-poly car meshes and arcade driving physics.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const CAR_COLORS = [0xff5a3c, 0xffd76a, 0x37e0c8, 0x8aa8ff, 0xf2e6c9, 0x9d7bff, 0x6be08a, 0x333340];

// Build one car from boxes: body, cabin, wheels, headlights, taillights.
export function createCarMesh(colorHex) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2436 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.55; car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glass);
  cabin.position.set(0, 1.2, -0.2); car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const wheels = [];
  for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    car.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    lamp.position.set(lx, 0.6, 2.22); car.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const lx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    lamp.position.set(lx, 0.6, -2.22); car.add(lamp);
  }
  car.userData.wheels = wheels;
  return car;
}

// A drivable / stealable car record.
export function makeCar(scene, rng, x, z, colorHex) {
  const mesh = createCarMesh(colorHex ?? rng.pick(CAR_COLORS));
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  scene.add(mesh);
  return {
    mesh, speed: 0, steer: 0, stolen: false, isPolice: false,
    skid: 0, // skid-mark timer
  };
}

// Arcade driving: accelerate, brake/reverse, steering scales with speed.
export function driveCar(car, input, dt) {
  const top = CONFIG.carTopSpeed;
  if (input.forward) car.speed += CONFIG.carAccel * dt;
  if (input.back) car.speed -= (car.speed > 0.5 ? CONFIG.carBrake : CONFIG.carAccel * 0.6) * dt;
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * 8 * dt;
  car.speed = THREE.MathUtils.clamp(car.speed, -12, top);
  if (Math.abs(car.speed) < 0.05) car.speed = 0;
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const dir = car.speed >= 0 ? 1 : -1;
  car.mesh.rotation.y += car.steer * CONFIG.carTurn * dir * Math.min(1, Math.abs(car.speed) / 10) * dt;
  const yaw = car.mesh.rotation.y;
  car.mesh.position.x += Math.sin(yaw) * car.speed * dt;
  car.mesh.position.z += Math.cos(yaw) * car.speed * dt;
  // Spin the wheels to match speed.
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 1.4;
  // Keep inside the city; bounce softly off the edge.
  const half = CONFIG.citySize / 2;
  car.mesh.position.x = THREE.MathUtils.clamp(car.mesh.position.x, -half - 40, half);
  car.mesh.position.z = THREE.MathUtils.clamp(car.mesh.position.z, -half, half);
  return Math.abs(car.speed) * 3.6; // km/h
}

export function nearestCar(cars, pos, maxDist) {
  let best = null; let bestD = maxDist;
  for (const car of cars) {
    const d = car.mesh.position.distanceTo(pos);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
