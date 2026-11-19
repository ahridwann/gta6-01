// combat.js — melee punch and pistol shooting, plus skid marks and hit
// particles. All hits are distance checks against pedestrians and police cars.
import * as THREE from 'three';

const particles = [];

// Spawn a small burst of coloured sparks at a point.
export function spawnBurst(scene, pos, colorHex, count = 10) {
  const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      mesh: m, life: 0.6,
      vel: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 2, (Math.random() - 0.5) * 8),
    });
  }
}

export function updateParticles(scene, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
  }
}

// Punch: short-range arc in front of the player; knocks a pedestrian down
// (they flee) and counts as a crime.
export function tryPunch(state, scene) {
  const player = state.player;
  if (player.punchTimer > 0 || player.inCar) return null;
  player.punchTimer = 0.45;
  player.arm.rotation.x = -1.6;
  setTimeout(() => { player.arm.rotation.x = 0; }, 180);
  const origin = player.mesh.position;
  const fwd = new THREE.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
  let hit = false;
  for (const ped of state.peds) {
    const to = new THREE.Vector3().subVectors(ped.mesh.position, origin); to.y = 0;
    if (to.length() < 2.6 && to.normalize().dot(fwd) > 0.4) {
      ped.panic = 4;
      spawnBurst(scene, ped.mesh.position.clone().setY(1.4), 0xffd76a, 8);
      hit = true;
    }
  }
  if (hit) {
    state.wanted = Math.min(5, state.wanted + 1);
    state.wantedTimer = 0;
    return 'punch-hit';
  }
  return 'punch';
}

// Pistol shot: hits the nearest pedestrian or police car within 40 m in the
// camera's forward cone. Firing in public raises the wanted level.
export function tryShoot(state, scene, camera) {
  const player = state.player;
  if (player.shootCooldown > 0 || player.inCar) return null;
  player.shootCooldown = 0.35;
  const origin = player.mesh.position.clone().setY(1.6);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  let best = null; let bestD = 40;
  const consider = (pos) => {
    const to = new THREE.Vector3().subVectors(pos, origin); to.y = 0;
    const d = to.length();
    if (d < bestD && to.normalize().dot(dir) > 0.85) { bestD = d; best = pos; }
  };
  for (const ped of state.peds) consider(ped.mesh.position);
  for (const cop of state.police.cars) consider(cop.mesh.position);
  if (best) {
    spawnBurst(scene, best.clone().setY(1.2), 0xff5a3c, 12);
    for (const ped of state.peds) {
      if (ped.mesh.position.distanceTo(best) < 1) ped.panic = 5;
    }
    state.wanted = Math.min(5, state.wanted + 1);
    state.wantedTimer = 0;
    return 'shoot-hit';
  }
  return 'shoot';
}

// Skid marks: dark flat quads left behind a fast-turning car, fading with time.
const skids = [];
export function addSkid(scene, car) {
  if (Math.abs(car.speed) < 15 || Math.abs(car.steer) < 0.5) return;
  const geo = new THREE.PlaneGeometry(0.5, 1.2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x0c0a12, transparent: true, opacity: 0.7 });
  const mark = new THREE.Mesh(geo, mat);
  mark.rotation.x = -Math.PI / 2;
  mark.rotation.z = car.mesh.rotation.y;
  mark.position.copy(car.mesh.position).setY(0.12);
  scene.add(mark);
  skids.push({ mesh: mark, life: 6 });
  if (skids.length > 60) {
    const old = skids.shift();
    scene.remove(old.mesh);
  }
}

export function updateSkids(scene, dt) {
  for (let i = skids.length - 1; i >= 0; i--) {
    const s = skids[i];
    s.life -= dt;
    if (s.life <= 0) { scene.remove(s.mesh); skids.splice(i, 1); }
  }
}
