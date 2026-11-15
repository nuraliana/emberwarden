// Emberwarden — tuning constants and the shared palette.
// One job: every number and colour the rest of the game agrees on, in one place.
export const STEP = 1 / 60;
export const FIELD = { width: 960, height: 600 };
export const BEST_KEY = 'emberwarden.best';
export const VICTORY_WAVE = 10;

/** Letterbox a 960x600 field inside a window of the given size. */
export function viewFor(width, height) {
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  return {
    scale,
    ox: (width - FIELD.width * scale) / 2,
    oy: (height - FIELD.height * scale) / 2,
  };
}

export const PALETTE = {
  bg0: '#0a0a18',
  bg1: '#141232',
  arenaEdge: '#3b2f6e',
  arenaGlow: '#6b4fd8',
  player: '#ffb347',
  playerCore: '#fff3d6',
  lantern: '#ffcf6e',
  bullet: '#ffd97a',
  shard: '#7fe7ff',
  heart: '#ff6b81',
  shield: '#8ef0c1',
  mote: '#b388ff',
  wisp: '#7dd7ff',
  spitter: '#ff9de2',
  brute: '#ff7a59',
  boss: '#e33e6e',
  ebullet: '#ff5d8f',
  text: '#f4efff',
  dim: '#9d94c9',
  gold: '#ffd166',
};

export const PLAYER = {
  radius: 16,
  speed: 250,
  maxHp: 5,
  fireInterval: 0.16,
  bulletSpeed: 620,
  bulletDamage: 12,
  bulletRadius: 5,
  bulletLife: 0.9,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 2.4,
  invulnTime: 1.0,
  pickupRadius: 70,
};

/** Enemy kinds: hp, speed, radius, score, contact damage. */
export const ENEMIES = {
  mote: { hp: 18, speed: 95, radius: 13, score: 50, touch: 1, color: PALETTE.mote },
  wisp: { hp: 14, speed: 150, radius: 11, score: 80, touch: 1, color: PALETTE.wisp },
  spitter: { hp: 34, speed: 70, radius: 15, score: 120, touch: 1, color: PALETTE.spitter },
  brute: { hp: 120, speed: 46, radius: 26, score: 250, touch: 1, color: PALETTE.brute },
  matriarch: { hp: 950, speed: 42, radius: 46, score: 5000, touch: 2, color: PALETTE.boss },
  hollowking: { hp: 1600, speed: 58, radius: 52, score: 10000, touch: 2, color: PALETTE.boss },
};

export const COMBO_WINDOW = 4; // seconds without a kill before the combo resets
export const COMBO_CAP = 8;
