// missions.js — three story jobs for Dario "D" Cruz, with briefing text,
// a gold beacon objective, stage tracking, and cash + rank rewards.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { setWanted } from './police.js';

export function createMissionState() {
  return {
    index: 0,            // next mission to offer (0-based)
    active: null,        // active mission record or null
    timer: 0,
    completed: [],
  };
}

export function nextMission(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

export function startMission(state, world) {
  const def = nextMission(state.missions);
  if (!def || state.missions.active) return null;
  const m = { id: def.id, def, stage: 0, timer: 0, active: true };
  state.missions.active = m;
  if (def.id === 1) {
    moveBeacon(state, world, world.dropOff);
    state.objectiveText = 'Drive the package to the gold beacon on the east docks road.';
  } else if (def.id === 2) {
    setWanted(state, 3);
    m.timer = 60;
    world.beacon.visible = false;
    state.objectiveText = 'Survive 60 seconds at 3 stars — keep moving, lose the police!';
  } else if (def.id === 3) {
    moveBeacon(state, world, world.pierEnd);
    state.objectiveText = 'Steal a car and reach the west pier beacon.';
  }
  return m;
}

export function moveBeacon(state, world, pos) {
  world.beacon.visible = true;
  world.beacon.position.set(pos.x, 0, pos.z);
}

export function hideBeacon(world) {
  world.beacon.visible = false;
}

// Per-frame mission progress. Returns a completion message or null.
export function updateMissions(state, world, dt) {
  const m = state.missions.active;
  if (!m) return null;
  const playerPos = state.player.inCar
    ? state.player.inCar.mesh.position
    : state.player.mesh.position;

  if (m.id === 1) {
    if (playerPos.distanceTo(world.dropOff) < 7) return completeMission(state, world, m);
  } else if (m.id === 2) {
    m.timer -= dt;
    state.objectiveText = `Survive the pursuit! ${Math.max(0, Math.ceil(m.timer))}s left — wanted 3 stars.`;
    if (m.timer <= 0) return completeMission(state, world, m);
  } else if (m.id === 3) {
    if (m.stage === 0) {
      if (!state.player.inCar) {
        state.objectiveText = 'Steal a car first! Press E near any car.';
      } else if (playerPos.distanceTo(world.pierEnd) < 9) {
        m.stage = 1;
        moveBeacon(state, world, world.boatPos);
        state.objectiveText = 'Pier reached! Now get to the escape boat at the end of the docks.';
      } else {
        state.objectiveText = 'Drive to the pier beacon on the west docks.';
      }
    } else if (playerPos.distanceTo(world.boatPos) < 9) {
      return completeMission(state, world, m);
    }
  }
  return null;
}

function completeMission(state, world, m) {
  state.missions.active = null;
  state.missions.completed.push(m.id);
  state.missions.index += 1;
  state.money += m.def.reward;
  state.rankIndex = Math.min(4, state.missions.completed.length + 1);
  hideBeacon(world);
  if (m.id === 2) setWanted(state, 0);
  state.objectiveText = '';
  return `MISSION COMPLETE — ${m.def.name}! +$${m.def.reward}`;
}

export function missionObjectiveLabel(state) {
  const m = state.missions.active;
  if (m) return `<b>MISSION ${m.id}: ${m.def.name}</b> — ${state.objectiveText}`;
  const next = nextMission(state.missions);
  if (next) return `Free roam — press <b>M</b> to start Mission ${next.id}: ${next.name} ($${next.reward})`;
  return 'All missions complete — Harbor Legend! Free roam, Porto Solmar is yours.';
}

// Distance (metres) from the player to the current objective, for the HUD.
export function objectiveDistance(state, world) {
  const m = state.missions.active;
  if (!m) return null;
  const playerPos = state.player.inCar
    ? state.player.inCar.mesh.position
    : state.player.mesh.position;
  const target = m.id === 1 ? world.dropOff
    : m.id === 2 ? null
    : m.stage === 0 ? world.pierEnd : world.boatPos;
  if (!target) return null;
  return Math.round(playerPos.distanceTo(target));
}
