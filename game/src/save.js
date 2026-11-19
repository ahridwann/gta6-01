// save.js — localStorage save/load, wrapped so a blocked or full store can
// never break the game.
const KEY = 'neon-harbor-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      rankIndex: state.rankIndex,
      missionIndex: state.missions.index,
      completed: state.missions.completed,
      health: state.player.health,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
