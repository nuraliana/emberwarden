// Emberwarden — the screenshot scenes behind ?shot=start|play|boss|end.
// Each one plays the real rules forward from a fresh world, steered by a simple
// autopilot (flee what is close, chase the nearest foe, fire at it), so the frame
// is what a real game looks like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const BOSS_SECONDS = 8;
const END_LIMIT_SECONDS = 600;

/** Steer the warden: run from close danger, close in on the nearest foe, fire. */
function autopilot(state, skill) {
  const p = state.player;
  if (skill === 'helpless') {
    // A doomed stand: rooted to the spot, no fire, so the Gloom catches up.
    return {
      dx: 0,
      dy: 0,
      aimX: FIELD.width / 2,
      aimY: FIELD.height / 2,
      aimSeen: true,
      firing: false,
      dash: false,
    };
  }
  let moveX = 0;
  let moveY = 0;
  let nearest = null;
  let nearestDist = Infinity;
  for (const e of state.enemies) {
    if (e.decorative) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
    // Flee anything about to touch us, and enemy orbs.
    if (d < 110) {
      moveX += (p.x - e.x) / (d || 1);
      moveY += (p.y - e.y) / (d || 1);
    }
  }
  for (const b of state.ebullets) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < 90) {
      moveX += (p.x - b.x) / (d || 1) * 1.4;
      moveY += (p.y - b.y) / (d || 1) * 1.4;
    }
  }
  if (nearest) {
    // Skilled play keeps a firing distance; a hurried one walks into trouble.
    const want = skill === 'careful' ? 260 : 150;
    if (nearestDist > want + 40) {
      moveX += (nearest.x - p.x) / nearestDist;
      moveY += (nearest.y - p.y) / nearestDist;
    } else if (nearestDist < want - 60) {
      moveX -= (nearest.x - p.x) / nearestDist;
      moveY -= (nearest.y - p.y) / nearestDist;
    }
    // Strafe sideways so the scene shows movement, not a turret.
    moveX += -((nearest.y - p.y) / nearestDist) * 0.4;
    moveY += ((nearest.x - p.x) / nearestDist) * 0.4;
  }
  // Keep the warden out of the corners (and off the HUD): the edges push back.
  const EDGE = 150;
  if (p.x < EDGE) moveX += (EDGE - p.x) / EDGE;
  if (p.x > FIELD.width - EDGE) moveX -= (p.x - (FIELD.width - EDGE)) / EDGE;
  if (p.y < EDGE) moveY += (EDGE - p.y) / EDGE;
  if (p.y > FIELD.height - EDGE) moveY -= (p.y - (FIELD.height - EDGE)) / EDGE;
  const len = Math.hypot(moveX, moveY) || 1;
  const aim = nearest
    ? { x: nearest.x, y: nearest.y }
    : { x: FIELD.width / 2, y: FIELD.height / 2 };
  return {
    dx: moveX / len,
    dy: moveY / len,
    aimX: aim.x,
    aimY: aim.y,
    aimSeen: true,
    firing: skill !== 'helpless',
    dash: false,
  };
}

/** Run the world forward for `seconds` under the autopilot; stop early on game over. */
function simulate(world, seconds, skill) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilot(world.state, skill);
    world.step(STEP, input, true);
    if (world.state.phase === 'over') return true;
    if (world.state.phase === 'upgrade') {
      // Take the first card and keep playing.
      world.applyUpgrade(world.state.choices[0].id);
    }
  }
  return world.state.phase === 'over';
}

/**
 * Set `world` to the named scene and return the screen to draw over it
 * and the best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, autopilot(world.state, 'careful'), true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boss') {
    world.jumpToWave(5, []);
    let sawBoss = false;
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 'careful'), true);
      if (world.state.boss) sawBoss = true;
      if (world.state.phase === 'over') break;
      if (world.state.phase === 'upgrade') world.applyUpgrade(world.state.choices[0].id);
      // Stop while the boss is still standing, bloodied but alive.
      if (world.state.boss && world.state.boss.hp < world.state.boss.maxHp * 0.7) break;
      if (sawBoss && !world.state.boss && world.state.phase === 'fight') break;
    }
    const over = world.state.phase === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.jumpToWave(3, []);
    const over = simulate(world, END_LIMIT_SECONDS, 'helpless');
    void over;
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // play: a mid-fight frame, stopped the moment the arena is busy (six foes
  // on screen) so the shot shows the fight at its fullest, not its tail.
  world.startRun();
  for (let i = 0; i < 20 / STEP; i += 1) {
    world.step(STEP, autopilot(world.state, 'careful'), true);
    if (world.state.phase === 'over') break;
    if (world.state.phase === 'upgrade') world.applyUpgrade(world.state.choices[0].id);
    if (world.state.phase === 'fight' && world.state.enemies.length >= 5) break;
  }
  const over = world.state.phase === 'over';
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
