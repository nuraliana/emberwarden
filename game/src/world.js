// Emberwarden — the world: one state, one step, no drawing, no sound.
// It owns the warden, the Gloom, bullets, pickups, waves and bosses, and tells
// the caller what happened through event flags and a queue of sound names.
import { COMBO_CAP, COMBO_WINDOW, ENEMIES, FIELD, PALETTE, PLAYER, STEP, VICTORY_WAVE } from './config.js';
import { bossKindFor, endlessScale, spawnPoint, waveComp } from './enemies.js';
import { UPGRADES, drawUpgradeChoices } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;
export const EVENT_BOSS = 16;
export const EVENT_UPGRADE = 32;

const TAU = Math.PI * 2;

function freshPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    r: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    damage: PLAYER.bulletDamage,
    projectiles: 1,
    pierce: 0,
    bulletSpeed: PLAYER.bulletSpeed,
    pickupRadius: PLAYER.pickupRadius,
    dashCooldown: PLAYER.dashCooldown,
    dashTimer: 0,
    dashTime: 0,
    dashDir: [1, 0],
    invuln: 0,
    shieldUntil: 0,
    fireTimer: 0,
    aimAngle: -Math.PI / 2,
    nova: 0,
    novaTimer: 6,
    thorns: 0,
  };
}

export function createWorld(random) {
  const state = {
    phase: 'title', // title | banner | fight | upgrade | over | victory
    time: 0,
    wave: 0,
    score: 0,
    best: 0,
    combo: 1,
    comboTimer: 0,
    kills: 0,
    shotsFired: 0,
    hitsLanded: 0,
    player: freshPlayer(),
    bullets: [],
    enemies: [],
    ebullets: [],
    particles: [],
    pickups: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    bannerTimer: 0,
    bannerText: '',
    boss: null,
    bossSummoned: false,
    choices: [],
    owned: {},
    shake: 0,
    sfx: [],
    hitFlag: false,
  };

  function burst(x, y, color, count, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * TAU;
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: random.range(life * 0.5, life),
        maxLife: life,
        size: random.range(2, 5),
        color,
      });
    }
  }

  function addText(x, y, text, color) {
    if (state.texts.length > 24) state.texts.shift();
    state.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMIES[kind];
    const scale = endlessScale(state.wave);
    const enemy = {
      kind,
      x, y,
      r: def.radius,
      hp: def.hp * scale.hp,
      maxHp: def.hp * scale.hp,
      speed: def.speed * scale.speed,
      score: def.score,
      touch: def.touch,
      color: def.color,
      t: random.next() * TAU,
      fireTimer: random.range(1.5, 2.5),
      telegraph: 0,
      attackTimer: random.range(2.5, 3.5),
      summonTimer: 6,
      mode: 'chase',
      modeTimer: 3,
      chargeDir: [0, 1],
      flash: 0,
      decorative: false,
    };
    state.enemies.push(enemy);
    if (kind === 'matriarch' || kind === 'hollowking') {
      state.boss = enemy;
      state.sfx.push('bossRoar');
    }
    return enemy;
  }

  function dropPickup(x, y, kind, forced) {
    state.pickups.push({
      kind,
      x, y,
      vx: random.range(-40, 40),
      vy: random.range(-40, 40),
      life: 9,
    });
    void forced;
  }

  function maybeDrop(enemy) {
    const roll = random.next();
    if (enemy.kind === 'brute' || enemy.kind === 'matriarch' || enemy.kind === 'hollowking') {
      dropPickup(enemy.x, enemy.y, 'shard');
      if (random.chance(0.35)) dropPickup(enemy.x + 14, enemy.y, 'heart');
      if (enemy.kind !== 'brute') {
        for (let i = 0; i < 4; i += 1) dropPickup(enemy.x + random.range(-30, 30), enemy.y + random.range(-30, 30), 'shard');
      }
    } else if (roll < 0.1) {
      dropPickup(enemy.x, enemy.y, 'shard');
    } else if (roll < 0.125) {
      dropPickup(enemy.x, enemy.y, 'heart');
    } else if (roll < 0.14) {
      dropPickup(enemy.x, enemy.y, 'shield');
    }
  }

  function gainScore(base, x, y) {
    const gained = base * state.combo;
    state.score += gained;
    addText(x, y, `+${gained}`, PALETTE.gold);
    state.combo = Math.min(COMBO_CAP, state.combo + 1);
    state.comboTimer = COMBO_WINDOW;
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    gainScore(enemy.score, enemy.x, enemy.y);
    burst(enemy.x, enemy.y, enemy.color, enemy.kind === 'brute' ? 26 : 14, 220, 0.7);
    state.sfx.push('explode');
    state.shake = Math.max(state.shake, enemy.r > 30 ? 9 : 4);
    maybeDrop(enemy);
    if (enemy === state.boss) {
      state.boss = null;
      burst(enemy.x, enemy.y, PALETTE.gold, 60, 340, 1.2);
      state.shake = 14;
    }
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0 || p.dashTime > 0 || state.phase !== 'fight') return;
    if (state.time < p.shieldUntil) {
      p.shieldUntil = 0;
      state.sfx.push('hit');
      addText(p.x, p.y - 30, 'SHIELD!', PALETTE.shield);
      return;
    }
    p.hp -= amount;
    p.invuln = PLAYER.invulnTime;
    state.combo = 1;
    state.comboTimer = 0;
    state.hitFlag = true;
    state.shake = Math.max(state.shake, 10);
    burst(p.x, p.y, PALETTE.heart, 18, 260, 0.8);
    state.sfx.push('hurt');
    if (p.hp <= 0) {
      state.phase = 'over';
      burst(p.x, p.y, PALETTE.player, 70, 380, 1.4);
      state.sfx.push('explode');
    }
  }

  function fireBullet(angle, damage, speed) {
    const p = state.player;
    state.bullets.push({
      x: p.x + Math.cos(angle) * (p.r + 8),
      y: p.y + Math.sin(angle) * (p.r + 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      pierce: p.pierce,
      life: PLAYER.bulletLife,
      r: PLAYER.bulletRadius,
    });
    state.shotsFired += 1;
  }

  /** Gentle aim assist: nudge the shot toward the nearest foe inside a small cone. */
  function assistedAngle(angle) {
    let best = null;
    let bestDist = 420;
    for (const e of state.enemies) {
      if (e.decorative) continue;
      const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
      if (d >= bestDist) continue;
      let diff = Math.atan2(e.y - state.player.y, e.x - state.player.x) - angle;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      if (Math.abs(diff) < 0.28) {
        best = Math.atan2(e.y - state.player.y, e.x - state.player.x);
        bestDist = d;
      }
    }
    return best ?? angle;
  }

  function nearestEnemy(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const e of state.enemies) {
      if (e.decorative) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = [];
    const bossFirst = [];
    for (const entry of waveComp(n)) {
      for (let i = 0; i < entry.count; i += 1) {
        if (entry.kind === 'matriarch' || entry.kind === 'hollowking') bossFirst.push(entry.kind);
        else state.spawnQueue.push(entry.kind);
      }
    }
    // Shuffle the trickle so kinds arrive mixed, but the boss always leads.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    state.spawnQueue = [...bossFirst, ...state.spawnQueue];
    state.spawnTimer = 0.6;
    state.bannerTimer = 2.2;
    state.bossSummoned = false;
    state.phase = 'banner';
    const boss = bossKindFor(n);
    state.bannerText = boss ? (boss === 'matriarch' ? 'THE GLOOM MATRIARCH' : 'THE HOLLOW KING') : `WAVE ${n}`;
    state.sfx.push(boss ? 'bossRoar' : 'horn');
  }

  function openUpgradeDraft() {
    state.choices = drawUpgradeChoices(random, state.owned);
    state.phase = 'upgrade';
  }

  function applyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    def.apply(state.player);
    state.owned[id] = (state.owned[id] ?? 0) + 1;
    state.sfx.push('upgrade');
    burst(state.player.x, state.player.y, PALETTE.gold, 24, 200, 0.8);
    startWave(state.wave + 1);
    return true;
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    p.fireTimer -= dt;
    p.dashTimer -= dt;
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.nova > 0) {
      p.novaTimer -= dt;
      if (p.novaTimer <= 0) {
        p.novaTimer = 6;
        const count = 8 + 4 * p.nova;
        for (let i = 0; i < count; i += 1) fireBullet((i / count) * TAU, p.damage, p.bulletSpeed * 0.8);
        burst(p.x, p.y, PALETTE.lantern, 16, 180, 0.6);
        state.sfx.push('shoot');
      }
    }

    // Aim: mouse when it has moved, else the nearest foe.
    if (input.aimSeen) {
      p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    } else {
      const foe = nearestEnemy(p.x, p.y);
      if (foe) p.aimAngle = Math.atan2(foe.y - p.y, foe.x - p.x);
    }

    if (input.dash && p.dashTimer <= 0 && (input.dx !== 0 || input.dy !== 0)) {
      p.dashTime = PLAYER.dashTime;
      p.dashTimer = p.dashCooldown;
      p.dashDir = [input.dx, input.dy];
      p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.05);
      state.sfx.push('dash');
      burst(p.x, p.y, PALETTE.lantern, 10, 160, 0.4);
    }

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashDir[0] * PLAYER.dashSpeed * dt;
      p.y += p.dashDir[1] * PLAYER.dashSpeed * dt;
    } else {
      p.x += input.dx * p.speed * dt;
      p.y += input.dy * p.speed * dt;
    }
    p.x = Math.max(p.r + 6, Math.min(FIELD.width - p.r - 6, p.x));
    p.y = Math.max(p.r + 6, Math.min(FIELD.height - p.r - 6, p.y));

    if (input.firing && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      const base = assistedAngle(p.aimAngle);
      const n = p.projectiles;
      for (let i = 0; i < n; i += 1) {
        const spread = (i - (n - 1) / 2) * 0.12;
        fireBullet(base + spread, p.damage, p.bulletSpeed);
      }
      burst(p.x + Math.cos(base) * (p.r + 6), p.y + Math.sin(base) * (p.r + 6), PALETTE.bullet, 2, 90, 0.25);
      state.sfx.push('shoot');
    }
  }

  function updateEnemy(e, dt) {
    const p = state.player;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.kind === 'mote') {
      const wobble = Math.sin(e.t * 3) * 0.6;
      e.x += (nx * e.speed + -ny * wobble * 40) * dt;
      e.y += (ny * e.speed + nx * wobble * 40) * dt;
    } else if (e.kind === 'wisp') {
      const s = Math.sin(e.t * 5) * 90;
      e.x += (nx * e.speed + -ny * s) * dt;
      e.y += (ny * e.speed + nx * s) * dt;
    } else if (e.kind === 'spitter') {
      if (dist > 280) {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (dist < 200) {
        e.x -= nx * e.speed * dt;
        e.y -= ny * e.speed * dt;
      } else {
        e.x += -ny * e.speed * 0.6 * dt;
        e.y += nx * e.speed * 0.6 * dt;
      }
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = 2.4;
        e.telegraph = 0.35;
      }
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) {
          state.ebullets.push({
            x: e.x, y: e.y,
            vx: nx * 170, vy: ny * 170,
            r: 6, life: 6,
          });
          state.sfx.push('hit');
        }
      }
    } else if (e.kind === 'brute') {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    } else if (e.kind === 'matriarch') {
      // Hovers at mid-range, fires radial bursts, births motes.
      const want = 220;
      const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      e.x += nx * e.speed * toward * dt;
      e.y += ny * e.speed * toward * dt;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackTimer = 3.2;
        for (let i = 0; i < 10; i += 1) {
          const a = (i / 10) * TAU + e.t;
          state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 6, life: 7 });
        }
        state.sfx.push('bossRoar');
      }
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = 6;
        for (let i = 0; i < 3; i += 1) spawnEnemy('mote', e.x + random.range(-60, 60), e.y + random.range(-60, 60));
      }
    } else if (e.kind === 'hollowking') {
      e.modeTimer -= dt;
      if (e.mode === 'chase') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = 2.0;
          const base = e.t * 1.3;
          for (let i = 0; i < 8; i += 1) {
            const a = base + (i / 8) * TAU;
            state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 6, life: 7 });
          }
        }
        if (e.modeTimer <= 0) {
          e.mode = 'telegraph';
          e.modeTimer = 0.7;
          e.chargeDir = [nx, ny];
          e.flash = 0.7;
        }
      } else if (e.mode === 'telegraph') {
        if (e.modeTimer <= 0) {
          e.mode = 'charge';
          e.modeTimer = 0.5;
          state.sfx.push('dash');
        }
      } else if (e.mode === 'charge') {
        e.x += e.chargeDir[0] * 620 * dt;
        e.y += e.chargeDir[1] * 620 * dt;
        if (e.modeTimer <= 0) {
          e.mode = 'chase';
          e.modeTimer = 3;
          if (!state.bossSummoned && e.hp < e.maxHp * 0.5) {
            state.bossSummoned = true;
            spawnEnemy('spitter', e.x - 80, e.y);
            spawnEnemy('spitter', e.x + 80, e.y);
          }
        }
      }
    }
    e.x = Math.max(e.r, Math.min(FIELD.width - e.r, e.x));
    e.y = Math.max(e.r, Math.min(FIELD.height - e.r, e.y));
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (e.decorative) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
          e.hp -= b.damage;
          e.flash = 0.08;
          state.hitsLanded += 1;
          burst(b.x, b.y, e.color, 4, 140, 0.35);
          state.sfx.push('hit');
          if (e.hp <= 0) killEnemy(e, j);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            state.bullets.splice(i, 1);
          }
          break;
        }
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.ebullets.splice(i, 1);
      }
    }
  }

  function updateCollisions() {
    const p = state.player;
    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      const e = state.enemies[j];
      if (e.decorative) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < p.r + e.r) {
        if (p.thorns > 0) {
          e.hp -= p.thorns;
          burst(e.x, e.y, PALETTE.shield, 6, 160, 0.4);
          if (e.hp <= 0) {
            killEnemy(e, j);
            continue;
          }
        }
        const push = (p.r + e.r - d) || 1;
        const nx = (p.x - e.x) / (d || 1);
        const ny = (p.y - e.y) / (d || 1);
        p.x += nx * push * 0.5;
        p.y += ny * push * 0.5;
        e.x -= nx * push * 0.3;
        e.y -= ny * push * 0.3;
        damagePlayer(e.touch);
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r - 2) {
        state.ebullets.splice(i, 1);
        damagePlayer(1);
      }
    }
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= STEP;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (d < p.pickupRadius) {
        const pull = 320 * (1 - d / p.pickupRadius);
        pk.vx += ((p.x - pk.x) / (d || 1)) * pull * STEP * 8;
        pk.vy += ((p.y - pk.y) / (d || 1)) * pull * STEP * 8;
      }
      pk.x += pk.vx * STEP;
      pk.y += pk.vy * STEP;
      pk.vx *= 0.96;
      pk.vy *= 0.96;
      if (d < p.r + 14) {
        if (pk.kind === 'shard') {
          state.score += 25 * state.combo;
          state.sfx.push('pickup');
          addText(pk.x, pk.y, '+25', PALETTE.shard);
        } else if (pk.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 1);
          state.sfx.push('heal');
          addText(pk.x, pk.y, '+1 ♥', PALETTE.heart);
        } else {
          p.shieldUntil = state.time + 12;
          state.sfx.push('pickup');
          addText(pk.x, pk.y, 'SHIELD', PALETTE.shield);
        }
        burst(pk.x, pk.y, PALETTE.shard, 8, 140, 0.5);
        state.pickups.splice(i, 1);
      } else if (pk.life <= 0) {
        state.pickups.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.y -= 34 * dt;
      t.life -= dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 26);
  }

  function updateSpawning(dt) {
    if (state.spawnQueue.length === 0) return;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = 0.35;
      const kind = state.spawnQueue.shift();
      const at = spawnPoint(random, state.player);
      spawnEnemy(kind, at.x, at.y);
      burst(at.x, at.y, ENEMIES[kind].color, 8, 120, 0.5);
    }
  }

  function stepTitle(dt) {
    // Ambient scene behind the title: drifters wander, the warden idles and fires.
    if (state.enemies.length < 7 && random.chance(dt * 1.2)) {
      const e = spawnEnemy(random.pick(['mote', 'wisp', 'mote']), random.range(80, FIELD.width - 80), random.range(80, FIELD.height - 80));
      e.decorative = true;
    }
    for (const e of state.enemies) {
      e.t += dt;
      e.x += Math.sin(e.t * 0.7) * 24 * dt;
      e.y += Math.cos(e.t * 0.9) * 18 * dt;
    }
    const p = state.player;
    p.fireTimer -= dt;
    if (p.fireTimer <= 0 && state.enemies.length > 0) {
      p.fireTimer = 0.9;
      const foe = state.enemies[0];
      const a = Math.atan2(foe.y - p.y, foe.x - p.x);
      p.aimAngle = a;
      fireBullet(a, p.damage, p.bulletSpeed);
    }
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) state.bullets.splice(i, 1);
    }
    updateParticles(dt);
  }

  function step(dt, input, demo) {
    state.time += dt;
    state.sfx.length = 0;
    let events = 0;
    if (state.phase === 'title') {
      stepTitle(dt);
      return 0;
    }
    if (state.phase === 'banner') {
      state.bannerTimer -= dt;
      updateParticles(dt);
      if (state.bannerTimer <= 0) {
        state.phase = 'fight';
        if (state.boss) events |= EVENT_BOSS;
      }
      return events;
    }
    if (state.phase === 'upgrade' || state.phase === 'over' || state.phase === 'victory') {
      updateParticles(dt);
      return 0;
    }

    // Fight.
    updatePlayer(dt, input);
    updateSpawning(dt);
    for (const e of state.enemies) updateEnemy(e, dt);
    updateBullets(dt);
    updateCollisions();
    updateParticles(dt);

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (random.chance(dt * 6)) {
      state.particles.push({
        x: random.range(0, FIELD.width),
        y: FIELD.height + 4,
        vx: random.range(-8, 8),
        vy: random.range(-30, -12),
        life: random.range(2, 4),
        maxLife: 4,
        size: random.range(1, 2.5),
        color: PALETTE.lantern,
      });
    }

    if (state.phase === 'over') return EVENT_OVER | (state.hitFlag ? EVENT_HIT : 0);
    if (state.hitFlag) {
      events |= EVENT_HIT;
      state.hitFlag = false;
    }
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.wave === VICTORY_WAVE) {
        state.phase = 'victory';
        state.sfx.push('victory');
        return EVENT_VICTORY;
      }
      openUpgradeDraft();
      return EVENT_WAVE_CLEAR | EVENT_UPGRADE;
    }
    if (demo) return events;
    return events;
  }

  function reset() {
    state.phase = 'title';
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.hitsLanded = 0;
    state.player = freshPlayer();
    state.bullets = [];
    state.enemies = [];
    state.ebullets = [];
    state.particles = [];
    state.pickups = [];
    state.texts = [];
    state.spawnQueue = [];
    state.boss = null;
    state.choices = [];
    state.owned = {};
    state.shake = 0;
    state.sfx = [];
    state.hitFlag = false;
  }

  return {
    state,
    reset,
    step,
    startRun() {
      reset();
      startWave(1);
    },
    applyUpgrade,
    continueEndless() {
      startWave(state.wave + 1);
    },
    /** Screenshot/test helper: start a run already at wave `n` with a few upgrades. */
    jumpToWave(n, granted) {
      reset();
      for (const id of granted ?? ['split', 'rapid', 'heavy']) {
        const def = UPGRADES.find((u) => u.id === id);
        if (def) {
          def.apply(state.player);
          state.owned[id] = 1;
        }
      }
      state.score = 1240 + n * 320;
      state.kills = 18 + n * 9;
      startWave(n);
    },
  };
}
