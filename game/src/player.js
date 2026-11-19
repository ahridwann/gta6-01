// player.js — Dario "D" Cruz on foot: capsule body, WASD movement relative to
// the camera yaw, sprint, and a third-person follow camera.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createPlayer(scene) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22202e });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.95, 10), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.8; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xffd76a }));
  cap.position.y = 2.02; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), pants);
  legL.position.set(-0.15, 0.31, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), jacket);
  arm.position.set(0.48, 1.05, 0.1); g.add(arm);
  g.position.set(0, 0, 30);
  scene.add(g);
  return {
    mesh: g, legL, legR, arm,
    yaw: Math.PI, speed: 0, inCar: null, health: 100,
    punchTimer: 0, shootCooldown: 0,
  };
}

// Move on foot. Returns km/h for the HUD.
export function updatePlayerOnFoot(player, input, camYaw, dt, time) {
  const sprint = input.sprint ? CONFIG.playerSprint : CONFIG.playerSpeed;
  let fx = 0, fz = 0;
  if (input.forward) fz -= 1;
  if (input.back) fz += 1;
  if (input.left) fx -= 1;
  if (input.right) fx += 1;
  const len = Math.hypot(fx, fz);
  let kmh = 0;
  if (len > 0) {
    fx /= len; fz /= len;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const wx = fx * cos - fz * sin;
    const wz = fx * sin + fz * cos;
    player.mesh.position.x += wx * sprint * dt;
    player.mesh.position.z += wz * sprint * dt;
    player.mesh.rotation.y = Math.atan2(wx, wz);
    player.speed = sprint;
    kmh = sprint * 3.6;
  } else {
    player.speed = 0;
  }
  const swing = Math.sin(time * 10) * (len > 0 ? 0.7 : 0);
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  const half = CONFIG.citySize / 2;
  player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, -half - 50, half);
  player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, -half, half);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  return kmh;
}

// Third-person camera: behind and above the focus point, looking at it.
export function updateCamera(camera, focusPos, camYaw, camPitch, dist, height) {
  const cx = focusPos.x - Math.sin(camYaw) * dist * Math.cos(camPitch);
  const cz = focusPos.z - Math.cos(camYaw) * dist * Math.cos(camPitch);
  const cy = focusPos.y + height + Math.sin(camPitch) * dist;
  camera.position.set(cx, Math.max(1.2, cy), cz);
  camera.lookAt(focusPos.x, focusPos.y + 1.6, focusPos.z);
}
