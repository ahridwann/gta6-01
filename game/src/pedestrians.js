// pedestrians.js — sidewalk walkers: capsule people with a coloured shirt,
// a head, and a simple leg-swing walk cycle. They stroll block to block and
// scatter (run away) when a car or a gunshot comes near.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const SHIRTS = [0xff6b9d, 0x37e0c8, 0xffd76a, 0x8aa8ff, 0xf2e6c9, 0x6be08a, 0xff8a5c];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0];

export function makePedestrian(scene, rng, x, z) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2836 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8), shirt);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.75; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), pants);
  legL.position.set(-0.14, 0.3, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  g.position.set(x, 0, z);
  scene.add(g);
  return {
    mesh: g, legL, legR,
    target: randomSidewalkPoint(rng),
    speed: rng.range(1.2, 2.2),
    panic: 0, phase: rng.range(0, Math.PI * 2),
  };
}

export function randomSidewalkPoint(rng) {
  const pitch = CONFIG.blockSize;
  const half = CONFIG.citySize / 2;
  const bx = (rng.int(-4, 3) + 0.5) * pitch + rng.range(-14, 14);
  const bz = (rng.int(-4, 3) + 0.5) * pitch + rng.range(-14, 14);
  return new THREE.Vector3(
    THREE.MathUtils.clamp(bx, -half + 10, half - 10), 0,
    THREE.MathUtils.clamp(bz, -half + 10, half - 10));
}

export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < CONFIG.pedestrianCount; i++) {
    const pt = randomSidewalkPoint(rng);
    peds.push(makePedestrian(scene, rng, pt.x, pt.z));
  }
  return peds;
}

export function updatePedestrians(peds, dt, dangerPos, dangerRadius, rng, time) {
  for (const ped of peds) {
    const p = ped.mesh.position;
    const dDanger = dangerPos ? p.distanceTo(dangerPos) : 999;
    if (dDanger < dangerRadius) ped.panic = 2.5;
    if (ped.panic > 0) {
      ped.panic -= dt;
      // Flee directly away from the danger (or straight ahead when the
      // danger has no position, e.g. a punch on foot with no car involved).
      const away = dangerPos
        ? new THREE.Vector3().subVectors(p, dangerPos).setY(0).normalize()
        : new THREE.Vector3(Math.sin(ped.mesh.rotation.y), 0, Math.cos(ped.mesh.rotation.y));
      p.addScaledVector(away, 4.5 * dt);
      ped.mesh.rotation.y = Math.atan2(away.x, away.z);
    } else {
      const to = new THREE.Vector3().subVectors(ped.target, p); to.y = 0;
      if (to.length() < 1.5) ped.target = randomSidewalkPoint(rng);
      else {
        to.normalize();
        p.addScaledVector(to, ped.speed * dt);
        ped.mesh.rotation.y = Math.atan2(to.x, to.z);
      }
    }
    // Walk-cycle leg swing.
    const swing = Math.sin(time * 8 + ped.phase) * (ped.panic > 0 ? 0.9 : 0.5);
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    // Keep inside the city.
    const half = CONFIG.citySize / 2;
    p.x = THREE.MathUtils.clamp(p.x, -half, half);
    p.z = THREE.MathUtils.clamp(p.z, -half, half);
  }
}
