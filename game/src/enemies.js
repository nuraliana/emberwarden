// Emberwarden — who the Gloom sends, and when.
// One job: wave composition and the two bosses' attack patterns, so the world
// never has to know what a "wave 7" means.
import { FIELD } from './config.js';

/** Spawn list for a wave: entries of { kind, count } released over the wave. */
export function waveComp(wave) {
  const comp = [];
  const motes = 6 + wave * 2;
  comp.push({ kind: 'mote', count: motes });
  if (wave >= 2) comp.push({ kind: 'wisp', count: 2 + wave });
  if (wave >= 3) comp.push({ kind: 'spitter', count: Math.floor(wave / 2) + 1 });
  if (wave >= 4) comp.push({ kind: 'brute', count: Math.floor((wave - 2) / 2) });
  if (wave === 5) return [{ kind: 'matriarch', count: 1 }, { kind: 'mote', count: 6 }];
  if (wave === 10) return [{ kind: 'hollowking', count: 1 }, { kind: 'spitter', count: 2 }];
  if (wave > 10) {
    comp.push({ kind: 'brute', count: Math.floor(wave / 3) });
    comp.push({ kind: 'wisp', count: wave });
  }
  return comp;
}

/** Boss of a wave, or null. Wave 5: the Matriarch. Wave 10: the Hollow King. */
export function bossKindFor(wave) {
  if (wave === 5) return 'matriarch';
  if (wave === 10) return 'hollowking';
  return null;
}

/** Endless waves scale enemy health and speed a little, so the game never goes soft. */
export function endlessScale(wave) {
  if (wave <= 10) return { hp: 1, speed: 1 };
  const over = wave - 10;
  return { hp: 1 + over * 0.12, speed: 1 + Math.min(0.3, over * 0.02) };
}

/** A spawn point on the arena edge, far from the player. */
export function spawnPoint(random, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const side = random.int(0, 3);
    const margin = 30;
    let x;
    let y;
    if (side === 0) {
      x = random.range(margin, FIELD.width - margin);
      y = margin;
    } else if (side === 1) {
      x = random.range(margin, FIELD.width - margin);
      y = FIELD.height - margin;
    } else if (side === 2) {
      x = margin;
      y = random.range(margin, FIELD.height - margin);
    } else {
      x = FIELD.width - margin;
      y = random.range(margin, FIELD.height - margin);
    }
    if (Math.hypot(x - player.x, y - player.y) > 240) return { x, y };
  }
  return { x: FIELD.width / 2, y: 40 };
}
