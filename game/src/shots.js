// shots.js — deterministic screenshot modes (?shot=cover|street|chase|mission).
// Each mode stages the world from a fresh seeded state, runs a fixed number of
// simulation steps, then freezes the simulation so the render is reproducible.
// Real gameplay code only: the same state a player would reach by playing.
import * as THREE from 'three';
import { setWanted, ensurePoliceCars } from './police.js';
import { startMission } from './missions.js';

export const SHOT_NAMES = ['cover', 'street', 'chase', 'mission'];

function placeCarNear(state, x, z, yaw) {
  const car = state.parkedCars[0];
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = yaw;
  car.speed = 0;
  return car;
}

function parkPoliceBehind(state, count, startBack = 10, gap = 9) {
  // Place police cars directly behind the player's car along its heading,
  // so they stay on the same road and in frame.
  const car = state.player.inCar;
  const px = car ? car.mesh.position : state.player.mesh.position;
  const yaw = car ? car.mesh.rotation.y : 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const cars = ensurePoliceCars(state.scene, state.police, count, px, state.rng);
  state.policeOffsets = [];
  for (let i = 0; i < count; i++) {
    const spot = cars[i];
    if (!spot) break;
    const back = startBack + i * gap;
    const side = i % 2 === 0 ? -3 : 3;
    state.policeOffsets.push({ back, side });
    spot.mesh.position.set(px.x - fx * back - fz * side, 0, px.z - fz * back + fx * side);
    spot.mesh.rotation.y = yaw;
    spot.speed = 12;
  }
}

export function applyShot(state, world, name) {
  const rng = state.rng;
  state.shotMode = name;
  state.mode = 'playing';
  state.player.health = 100;
  state.money = name === 'mission' ? 1250 : 850;
  state.rankIndex = name === 'mission' ? 2 : 1;

  if (name === 'cover') {
    // Driving down the main avenue: HUD, minimap, wanted stars, police behind,
    // traffic ahead, pedestrians on the sidewalk, mission beacon in the distance.
    const car = placeCarNear(state, 0, 60, Math.PI);
    state.player.inCar = car;
    state.player.mesh.visible = false;
    car.speed = 26;
    setWanted(state, 2);
    state.missions.active = null;
    state.objectiveText = '';
    startMission(state, world); // Mission 1: beacon visible on the east docks road
    state.camYaw = Math.PI; state.camPitch = 0.22;
    state.camDist = 20;
    parkPoliceBehind(state, 2, 7, 6);
    state.freezeAfterSteps = 30;
  } else if (name === 'street') {
    // On foot at the plaza edge, looking down the main avenue: pedestrians
    // strolling, traffic cruising past, lamps and towers on both sides.
    state.player.mesh.position.set(4, 0, 30);
    state.player.mesh.rotation.y = Math.PI * 0.75;
    state.player.inCar = null;
    state.player.mesh.visible = true;
    setWanted(state, 0);
    state.missions.active = null;
    state.objectiveText = '';
    world.beacon.visible = false;
    state.camYaw = Math.PI; state.camPitch = 0.16;
    // Stage three pedestrians strolling near the player so the street reads.
    const nearSpots = [[10, 16], [-8, 44], [12, 58]];
    for (let i = 0; i < Math.min(3, state.peds.length); i++) {
      const ped = state.peds[i];
      ped.mesh.position.set(nearSpots[i][0], 0, nearSpots[i][1]);
      ped.target.set(nearSpots[i][0] + 6, 0, nearSpots[i][1] - 20);
    }
    state.freezeAfterSteps = 40;
  } else if (name === 'chase') {
    // Full pursuit on the south ring road: 4 stars, three police cars closing
    // in behind the player.
    const car = placeCarNear(state, 100, -55, Math.PI / 2);
    state.player.inCar = car;
    state.player.mesh.visible = false;
    car.speed = 34;
    setWanted(state, 4);
    state.missions.active = null;
    state.objectiveText = '';
    world.beacon.visible = false;
    state.camYaw = Math.PI / 2; state.camPitch = 0.25;
    state.camDist = 24;
    parkPoliceBehind(state, 3, 7, 7);
    state.freezeAfterSteps = 20;
  } else if (name === 'mission') {
    // Mission 1 in progress: gold beacon ahead on the east docks road,
    // objective text and distance on the HUD.
    const car = placeCarNear(state, 120, -165, Math.PI / 2);
    state.player.inCar = car;
    state.player.mesh.visible = false;
    car.speed = 20;
    setWanted(state, 1);
    startMission(state, world);
    state.camYaw = Math.PI / 2; state.camPitch = 0.2;
    state.camDist = 18;
    parkPoliceBehind(state, 1, 7, 7);
    state.freezeAfterSteps = 30;
  }
  // Camera focus point follows the player; main.js positions the camera.
  state.shotStepsRun = 0;
  return name;
}

// Called each frame in shot mode: run the sim for a fixed step count, then stop.
export function shotStep(state) {
  if (state.freezeAfterSteps == null) return false;
  state.shotStepsRun += 1;
  return state.shotStepsRun < state.freezeAfterSteps;
}

export function parseShotQuery(search) {
  const params = new URLSearchParams(search || '');
  return params.get('shot');
}
