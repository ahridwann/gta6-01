// traffic.js — AI cars that cruise the road grid, stop for nothing, and honk
// (visually) when the player blocks them. Kept small: 14 cars, waypoint loops.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createCarMesh } from './vehicles.js';

export function createTraffic(scene, rng, roads) {
  const cars = [];
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const road = rng.pick(roads);
    const lane = rng.pick([-3.5, 3.5]);
    const along = rng.range(-CONFIG.citySize / 2 + 20, CONFIG.citySize / 2 - 20);
    const mesh = createCarMesh(rng.pick([0xd8d8e8, 0x4a6fa5, 0xc96f4a, 0x7fae7f, 0xe8c96a]));
    if (road.axis === 'z') {
      mesh.position.set(road.at + lane, 0, along);
      mesh.rotation.y = lane > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(along, 0, road.at + lane);
      mesh.rotation.y = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    scene.add(mesh);
    cars.push({
      mesh, road, lane, speed: rng.range(7, 12),
      turnAt: rng.range(-160, 160),
    });
  }
  return cars;
}

// Drive straight along the current road; at a random intersection, turn onto
// a crossing road. Cars slow down when the player is right in front of them.
export function updateTraffic(cars, dt, playerPos, rng) {
  const half = CONFIG.citySize / 2;
  for (const car of cars) {
    const p = car.mesh.position;
    const ahead = new THREE.Vector3(Math.sin(car.mesh.rotation.y), 0, Math.cos(car.mesh.rotation.y));
    const toPlayer = new THREE.Vector3().subVectors(playerPos, p);
    const dist = toPlayer.length();
    let speed = car.speed;
    if (dist < 9 && toPlayer.dot(ahead) > 0) speed = Math.max(0, car.speed - 20 * dt);
    p.x += Math.sin(car.mesh.rotation.y) * speed * dt;
    p.z += Math.cos(car.mesh.rotation.y) * speed * dt;
    const along = car.road.axis === 'z' ? p.z : p.x;
    if ((car.road.axis === 'z' && Math.abs(p.x) > half) || (car.road.axis === 'x' && Math.abs(p.z) > half)) {
      // U-turn at the city edge.
      car.mesh.rotation.y += Math.PI;
      car.lane = -car.lane;
    }
    if (Math.abs(along - car.turnAt) < 1.5) {
      // Turn onto a perpendicular road at this intersection.
      const crossing = car.road.axis === 'z'
        ? { axis: 'x', at: Math.round(p.z / CONFIG.blockSize) * CONFIG.blockSize }
        : { axis: 'z', at: Math.round(p.x / CONFIG.blockSize) * CONFIG.blockSize };
      car.road = crossing;
      car.mesh.rotation.y += (rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      car.turnAt = rng.range(-160, 160);
      // Snap onto the new road centre.
      if (crossing.axis === 'z') p.x = crossing.at + car.lane; else p.z = crossing.at + car.lane;
    }
  }
}
