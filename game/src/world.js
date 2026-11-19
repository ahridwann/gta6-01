// world.js — builds Porto Solmar: ground, sea and beach, road grid, instanced
// low-poly buildings, palm trees, street lamps, docks, and the objective beacon.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const PALETTE = [0xff8a5c, 0xffc46b, 0x7fd4c1, 0x8aa8ff, 0xff6b9d, 0xf2e6c9, 0x9d7bff, 0x6be08a];

export function buildCity(scene, rng) {
  const half = CONFIG.citySize / 2;
  const group = new THREE.Group();
  group.name = 'city';

  // Warm sunset sky, fog, sun and hemisphere light.
  scene.background = new THREE.Color(CONFIG.colors.sky);
  scene.fog = new THREE.Fog(CONFIG.colors.fog, 180, 620);
  const sun = new THREE.DirectionalLight(CONFIG.colors.sun, 1.6);
  sun.position.set(-140, 90, -180);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x4a3a5e, 0.9));

  // Ground slab, sea strip on the west edge, and a sand beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.citySize + 260, CONFIG.citySize + 260),
    new THREE.MeshLambertMaterial({ color: CONFIG.colors.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(180, CONFIG.citySize + 260),
    new THREE.MeshLambertMaterial({ color: CONFIG.colors.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-half - 90, 0.05, 0);
  group.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(26, CONFIG.citySize + 260),
    new THREE.MeshLambertMaterial({ color: CONFIG.colors.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-half - 4, 0.06, 0);
  group.add(sand);

  // Road grid: dark strips with dashed centre lines, plus sidewalks.
  const roads = [];
  const pitch = CONFIG.blockSize;
  const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  for (let i = -3; i <= 3; i++) {
    const c = i * pitch;
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.citySize), roadMat);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(c, 0.08, 0); group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.citySize, CONFIG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.08, c); group.add(hRoad);
    roads.push({ axis: 'z', at: c }, { axis: 'x', at: c });
    for (let d = -half; d < half; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 5), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.1, d); group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.6), lineMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.1, c); group.add(dash2);
    }
  }
  // Sidewalk slabs: block interiors sit BETWEEN roads, at half-pitch centres.
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      const cx = (bx + 0.5) * pitch, cz = (bz + 0.5) * pitch;
      if (Math.abs(cx) > half - 10 || Math.abs(cz) > half - 10) continue;
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(pitch - 16, pitch - 16), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.07, cz);
      group.add(walk);
    }
  }

  // Central plaza: fountain disc + neon sign posts.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 1, 24),
    new THREE.MeshLambertMaterial({ color: 0x37a8c8 }));
  plaza.position.set(0, 0.5, 0); group.add(plaza);
  const signMat = new THREE.MeshBasicMaterial({ color: 0xff5ad0 });
  for (const [sx, sz] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2b2836 }));
    pole.position.set(sx, 4.5, sz); group.add(pole);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.3), signMat);
    sign.position.set(sx, 8.5, sz); group.add(sign);
  }

  // Buildings: one InstancedMesh of boxes with per-instance colour, heights vary.
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const bMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const buildings = new THREE.InstancedMesh(bGeo, bMat, CONFIG.buildingCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < CONFIG.buildingCount && guard < 900) {
    guard++;
    // Block interiors only: half-pitch centres, never on a road centreline.
    const bx = (rng.int(-4, 3) + 0.5) * pitch + rng.range(-7, 7);
    const bz = (rng.int(-4, 3) + 0.5) * pitch + rng.range(-7, 7);
    if (Math.abs(bx) > half - 18 || Math.abs(bz) > half - 18) continue;
    const w = rng.range(14, 22), d = rng.range(14, 22), h = rng.range(12, 58);
    dummy.position.set(bx, h / 2, bz);
    dummy.scale.set(w, h, d);
    dummy.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    dummy.updateMatrix();
    buildings.setMatrixAt(placed, dummy.matrix);
    buildings.setColorAt(placed, color.setHex(rng.pick(PALETTE)));
    placed++;
  }
  buildings.count = placed;
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  group.add(buildings);

  // Rooftop neon strips: a few glowing boxes on top of tall blocks.
  const neonMat = new THREE.MeshBasicMaterial({ color: 0x37e0c8 });
  for (let i = 0; i < 10; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(rng.range(6, 14), 0.8, 0.8), neonMat);
    strip.position.set(rng.range(-half + 30, half - 30), rng.range(20, 50), rng.range(-half + 30, half - 30));
    group.add(strip);
  }

  // Palm trees along the beach and plaza (trunk + 3 frond cones).
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  for (let i = 0; i < 26; i++) {
    const px = i < 13 ? -half + 8 : rng.range(-half + 20, half - 20);
    const pz = i < 13 ? -half + 20 + i * 32 : rng.range(-half + 20, half - 20);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.y = 3.5; tree.add(trunk);
    for (let f = 0; f < 4; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 4), frondMat);
      frond.position.y = 7.6;
      frond.rotation.z = 1.1; frond.rotation.y = (f * Math.PI) / 2;
      tree.add(frond);
    }
    tree.position.set(px, 0, pz);
    group.add(tree);
  }

  // Street lamps: pole + glowing bulb, instanced as two meshes per lamp is too
  // many draws, so lamps are simple merged pairs, 24 of them along main roads.
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x22202e });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 24; i++) {
    const along = -half + 20 + i * 18;
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), lampPoleMat);
    pole.position.y = 3; lamp.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampGlowMat);
    bulb.position.y = 6.2; lamp.add(bulb);
    lamp.position.set(i % 2 === 0 ? -8.5 : 8.5, 0, along);
    group.add(lamp);
  }

  // Docks: wooden pier jutting into the sea on the west edge + a moored boat.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1.2, 12), pierMat);
  pier.position.set(-half - 32, 0.8, 60); group.add(pier);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const boat = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 4), boatMat);
  boat.position.set(-half - 52, 0.6, 60); group.add(boat);
  const boatTop = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3),
    new THREE.MeshLambertMaterial({ color: 0xff5a3c }));
  boatTop.position.set(-half - 52, 2.6, 60); group.add(boatTop);

  scene.add(group);

  // Objective beacon: gold cylinder of light + floating diamond marker.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  beam.position.y = 30; beacon.add(beam);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(2.2),
    new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  diamond.position.y = 12; beacon.add(diamond);
  beacon.visible = false;
  scene.add(beacon);

  return {
    group, roads, half,
    beacon,
    spawn: new THREE.Vector3(0, 0, 30),
    diner: new THREE.Vector3(-40, 0, 40),
    dropOff: new THREE.Vector3(half - 30, 0, -165),
    pierEnd: new THREE.Vector3(-half - 32, 0, 60),
    boatPos: new THREE.Vector3(-half - 52, 0, 60),
    plaza: new THREE.Vector3(0, 0, 0),
  };
}
