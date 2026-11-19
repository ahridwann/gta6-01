// hud.js — DOM HUD (cash, rank, wanted stars, health, speed, objective) and
// the 2D canvas minimap with roads, player, cars, police and the objective.
import { CONFIG } from './config.js';
import { missionObjectiveLabel, objectiveDistance } from './missions.js';

const el = {};
let minimapCtx = null;

export function initHud() {
  el.money = document.getElementById('money');
  el.rank = document.getElementById('rank');
  el.wanted = document.getElementById('wanted');
  el.healthfill = document.getElementById('healthfill');
  el.healthlbl = document.getElementById('healthlbl');
  el.speed = document.getElementById('speed');
  el.objective = document.getElementById('objective');
  el.toast = document.getElementById('toast');
  el.hud = document.getElementById('hud');
  const map = document.getElementById('minimap');
  minimapCtx = map ? map.getContext('2d') : null;
}

export function showHud(show) {
  if (el.hud) el.hud.style.display = show ? 'block' : 'none';
}

let toastTimer = null;
export function showToast(text, ms = 2600) {
  if (!el.toast) return;
  el.toast.textContent = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.textContent = ''; }, ms);
}

export function updateHud(state, world) {
  if (!el.money) return;
  el.money.firstChild.textContent = `$${state.money.toLocaleString('en-US')}`;
  el.rank.textContent = `Rank: ${CONFIG.ranks[state.rankIndex] || 'Harbor Legend'}  ·  Missions ${state.missions.completed.length}/3`;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
  el.wanted.innerHTML = stars;
  const hp = Math.max(0, Math.round(state.player.health));
  el.healthfill.style.width = `${hp}%`;
  el.healthlbl.textContent = `Health ${hp}${state.player.inCar ? '  ·  In car — E to exit' : '  ·  Press E near a car to steal it'}`;
  el.speed.firstChild.textContent = `${Math.round(state.speedKmh || 0)}`;
  const label = missionObjectiveLabel(state);
  const dist = objectiveDistance(state, world);
  el.objective.innerHTML = dist != null ? `${label} &nbsp;·&nbsp; <b>${dist}m</b>` : label;
}

export function drawMinimap(state, world) {
  if (!minimapCtx) return;
  const ctx = minimapCtx;
  const W = 180, H = 180;
  const half = CONFIG.citySize / 2;
  const toMap = (x, z) => [((x + half) / CONFIG.citySize) * W, ((z + half) / CONFIG.citySize) * H];
  ctx.fillStyle = '#241335';
  ctx.fillRect(0, 0, W, H);
  // Sea on the west edge.
  ctx.fillStyle = '#2a6f8f';
  ctx.fillRect(0, 0, 12, H);
  // Roads.
  ctx.strokeStyle = '#5a5470';
  ctx.lineWidth = 5;
  for (let i = -3; i <= 3; i++) {
    const c = i * CONFIG.blockSize;
    const [x] = toMap(c, 0); const [, y] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Docks pier.
  ctx.strokeStyle = '#8a5a2e';
  ctx.lineWidth = 4;
  const [bx, by] = toMap(world.pierEnd.x, world.pierEnd.z);
  ctx.beginPath(); ctx.moveTo(6, by); ctx.lineTo(bx, by); ctx.stroke();
  const dot = (x, z, color, r) => {
    const [mx, my] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
  };
  // Objective beacon.
  if (world.beacon.visible) dot(world.beacon.position.x, world.beacon.position.z, '#ffd76a', 6);
  for (const car of state.parkedCars) dot(car.mesh.position.x, car.mesh.position.z, '#9aa0b5', 2.5);
  for (const car of state.traffic) dot(car.mesh.position.x, car.mesh.position.z, '#d8d8e8', 2.5);
  for (const cop of state.police.cars) dot(cop.mesh.position.x, cop.mesh.position.z, '#ff2a2a', 3.5);
  const pp = state.player.inCar ? state.player.inCar.mesh.position : state.player.mesh.position;
  dot(pp.x, pp.z, '#37e08b', 4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  const [px, py] = toMap(pp.x, pp.z);
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
}
