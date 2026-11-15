// Emberwarden — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between six screens: title, play, upgrade, paused, game over
// and victory. ?seed=N fixes the run; ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, createInput } from './input.js';
import { EVENT_HIT, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR, createWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY, createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let lastSfx = [];

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function playSfx(names) {
    for (const name of names) {
      if (name === 'shoot') audio.shoot();
      else if (name === 'hit') audio.hit();
      else if (name === 'explode') audio.explode();
      else if (name === 'hurt') audio.hurt();
      else if (name === 'pickup') audio.pickup();
      else if (name === 'heal') audio.heal();
      else if (name === 'dash') audio.dash();
      else if (name === 'horn') audio.horn();
      else if (name === 'bossRoar') audio.bossRoar();
      else if (name === 'upgrade') audio.upgrade();
      else if (name === 'victory') audio.victory();
    }
  }

  function startRun() {
    world.startRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startDrone();
    announce('Playing. Five flames. Survive ten waves.');
  }

  function endRun() {
    screen = SCREEN_OVER;
    audio.stopDrone();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function step() {
    const aim = input.aim();
    const snap = {
      dx: 0,
      dy: 0,
      aimX: aim.x,
      aimY: aim.y,
      aimSeen: aim.seen,
      firing: input.firing(),
      dash: input.dashPressed(),
    };
    const dir = input.direction();
    snap.dx = dir[0];
    snap.dy = dir[1];
    const events = world.step(STEP, snap, false);
    playSfx(world.state.sfx);
    if (events & EVENT_OVER) endRun();
    else if (events & EVENT_VICTORY) {
      screen = SCREEN_VICTORY;
      audio.stopDrone();
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Victory! The Hollow King falls. Score ${world.state.score}.`);
    } else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_UPGRADE;
      announce('Wave cleared. Choose an ember.');
    } else if (events & EVENT_HIT) {
      announce(`Hit. ${world.state.player.hp} flames left.`);
    }
    void lastSfx;
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        startRun();
      }
    } else if (screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        world.continueEndless();
        screen = SCREEN_PLAY;
        audio.startDrone();
        announce('Endless night. Wave ' + world.state.wave + '.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      const pick = actions & ACTION_PICK_1 ? 0 : actions & ACTION_PICK_2 ? 1 : actions & ACTION_PICK_3 ? 2 : -1;
      if (pick >= 0 && world.state.choices[pick]) {
        audio.click();
        world.applyUpgrade(world.state.choices[pick].id);
        screen = SCREEN_PLAY;
        announce('Playing. Wave ' + world.state.wave + '.');
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleUpgradeClick(aim) {
    if (screen !== SCREEN_UPGRADE) return;
    const cardW = 240;
    const cardH = 220;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const x0 = (960 - total) / 2;
    const y0 = 190;
    for (let i = 0; i < 3; i += 1) {
      const x = x0 + i * (cardW + gap);
      if (aim.x >= x && aim.x <= x + cardW && aim.y >= y0 && aim.y <= y0 + cardH && world.state.choices[i]) {
        audio.click();
        world.applyUpgrade(world.state.choices[i].id);
        screen = SCREEN_PLAY;
        announce('Playing. Wave ' + world.state.wave + '.');
        return;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (input.anyGesture()) audio.unlock();
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_UPGRADE && input.firing()) handleUpgradeClick(input.aim());
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { dx: 0, dy: 0, aimX: 480, aimY: 300, aimSeen: false, firing: false, dash: false }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen !== SCREEN_PAUSED) {
      accumulator = 0;
      // Keep embers drifting behind the overlays (never while paused).
      world.step(STEP, { dx: 0, dy: 0, aimX: 480, aimY: 300, aimSeen: false, firing: false, dash: false }, true);
    } else {
      accumulator = 0;
    }
    const aim = input.aim();
    renderer.draw(world.state, screen, best, muted, { mouseX: aim.x, mouseY: aim.y, aimSeen: aim.seen });
  }

  // Leaving the tab pauses a running game rather than letting the Gloom feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR' && (screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      audio.click();
      startRun();
    }
  });

  announce('Emberwarden. Press Enter or click to begin.');
  // A small read-only handle for play-testing and debugging (no cheats: it
  // only exposes what the game already shows on screen).
  window.__emberwarden = {
    world,
    screen: () => screen,
    best: () => best,
  };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
