// Emberwarden — the upgrade draft offered after every cleared wave.
// Each upgrade is one clear job: a name, a one-line promise, and how it changes the warden.
// Picking one is the game's main strategic choice, so every option must feel different.
export const UPGRADES = [
  {
    id: 'split',
    name: 'Ember Split',
    blurb: '+1 ember bolt per shot',
    icon: '✦',
    max: 3,
    apply(stats) {
      stats.projectiles += 1;
    },
  },
  {
    id: 'rapid',
    name: 'Rapid Wick',
    blurb: 'Fire 18% faster',
    icon: '≫',
    max: 4,
    apply(stats) {
      stats.fireInterval *= 0.82;
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Ember',
    blurb: '+30% bolt damage',
    icon: '●',
    max: 4,
    apply(stats) {
      stats.damage *= 1.3;
    },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    blurb: '+12% move speed',
    icon: '»',
    max: 3,
    apply(stats) {
      stats.speed *= 1.12;
    },
  },
  {
    id: 'glass',
    name: 'Thick Glass',
    blurb: '+1 max flame, mend 1',
    icon: '♥',
    max: 3,
    apply(stats) {
      stats.maxHp += 1;
      stats.hp = Math.min(stats.maxHp, stats.hp + 1);
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    blurb: 'Bolts pierce +1 enemy',
    icon: '→',
    max: 2,
    apply(stats) {
      stats.pierce += 1;
    },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    blurb: 'Pickups fly to you',
    icon: '◎',
    max: 2,
    apply(stats) {
      stats.pickupRadius *= 1.8;
    },
  },
  {
    id: 'dash',
    name: 'Cinder Step',
    blurb: 'Dash recharges 30% faster',
    icon: '↯',
    max: 2,
    apply(stats) {
      stats.dashCooldown *= 0.7;
    },
  },
  {
    id: 'nova',
    name: 'Ember Nova',
    blurb: 'A burst of embers every 6s',
    icon: '✺',
    max: 2,
    apply(stats) {
      stats.nova = (stats.nova ?? 0) + 1;
    },
  },
  {
    id: 'thorns',
    name: 'Thorn Lantern',
    blurb: 'Touching foes take damage',
    icon: '✜',
    max: 2,
    apply(stats) {
      stats.thorns = (stats.thorns ?? 0) + 12;
    },
  },
];

/** Three distinct upgrades the warden has not maxed out yet, in display order. */
export function drawUpgradeChoices(random, owned) {
  const available = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max);
  const choices = [];
  while (choices.length < 3 && available.length > 0) {
    const index = Math.floor(random.next() * available.length);
    choices.push(available.splice(index, 1)[0]);
  }
  return choices;
}
