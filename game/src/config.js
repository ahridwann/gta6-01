// config.js — every tunable number for Neon Harbor in one place.
export const CONFIG = {
  seed: 1337,
  citySize: 440,          // playable square, metres
  blockSize: 55,          // city block pitch
  roadWidth: 14,
  buildingCount: 64,
  trafficCount: 14,
  pedestrianCount: 22,
  maxPolice: 5,
  playerSpeed: 9,
  playerSprint: 14,
  carTopSpeed: 42,
  carAccel: 16,
  carBrake: 30,
  carTurn: 1.9,
  gravity: 30,
  colors: {
    sky: 0xff9a5c,        // warm sunset sky
    fog: 0xffb37a,
    ground: 0x3d3a4d,
    road: 0x2b2836,
    sidewalk: 0x8a8398,
    sea: 0x2a6f8f,
    sand: 0xe8c98a,
    sun: 0xffd76a,
  },
  ranks: ['Wheelman', 'Courier', 'Wheelman Pro', 'Harbor Runner', 'Harbor Legend'],
};

export const MISSIONS = [
  {
    id: 1, name: 'First Fare',
    brief: 'Mara at the Solmar Diner needs a package across town before sunset. Grab any car, follow the gold beacon to the drop-off on the east docks road, and do not smash the goods. Reward: $500.',
    reward: 500,
    startHint: 'Get in a car (E) and drive to the gold beacon.',
  },
  {
    id: 2, name: 'Hot Pursuit',
    brief: 'The harbor police are onto you, D. Three stars, full sirens. Survive 60 seconds without getting busted and lose them in the streets. Reward: $800.',
    reward: 800,
    startHint: 'Survive 60 seconds at 3 stars. Keep moving!',
  },
  {
    id: 3, name: 'The Harbor Job',
    brief: 'One last job. Steal a fast car, reach the west pier, then take the escape boat at the end of the docks. The whole harbor force will be on you. Reward: $1,500.',
    reward: 1500,
    startHint: 'Steal a car, reach the pier beacon, then the boat.',
  },
];

export const CONTROLS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  enter: 'KeyE', punch: 'KeyF', mission: 'KeyM', pause: 'KeyP', restart: 'KeyR',
};
