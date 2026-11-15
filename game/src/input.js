// Emberwarden — keyboard and mouse, read once per frame.
// Movement is WASD or arrows; aim follows the mouse; hold click or Space to fire;
// Shift (or right click) dashes; P or Escape pauses; M mutes; 1/2/3 pick an upgrade.
import { viewFor } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_PICK_1 = 8;
export const ACTION_PICK_2 = 16;
export const ACTION_PICK_3 = 32;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, rightDown: false, seen: false };

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const view = viewFor(rect.width, rect.height);
    return {
      x: (clientX - rect.left - view.ox) / view.scale,
      y: (clientY - rect.top - view.oy) / view.scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.seen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.seen = true;
    pressed.add('MouseClick');
    if (event.button === 2) mouse.rightDown = true;
    else mouse.down = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 2) mouse.rightDown = false;
    else mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement direction from held keys, [0, 0] when none. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const len = Math.hypot(x, y);
      return [x / len, y / len];
    },
    firing() {
      return mouse.down || keys.has('Space');
    },
    /** True on the frame Shift or right-click goes down. */
    dashPressed() {
      return pressed.has('ShiftLeft') || pressed.has('ShiftRight') || mouse.rightDown;
    },
    aim() {
      return { x: mouse.x, y: mouse.y, seen: mouse.seen };
    },
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space') || pressed.has('MouseClick')) actions |= ACTION_CONFIRM;
      if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyM')) actions |= ACTION_MUTE;
      if (pressed.has('Digit1') || pressed.has('Numpad1')) actions |= ACTION_PICK_1;
      if (pressed.has('Digit2') || pressed.has('Numpad2')) actions |= ACTION_PICK_2;
      if (pressed.has('Digit3') || pressed.has('Numpad3')) actions |= ACTION_PICK_3;
      pressed.clear();
      return actions;
    },
    /** True while any key or click is held — used to wake audio on first gesture. */
    anyGesture() {
      return mouse.down || keys.size > 0;
    },
  };
}
