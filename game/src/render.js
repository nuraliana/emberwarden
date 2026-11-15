// Emberwarden — everything the eye sees, and nothing else.
// Canvas 2D, drawn in the 960x600 field space: the arena, every creature, the
// HUD, and the title / upgrade / pause / game-over / victory screens.
import { FIELD, PALETTE, viewFor } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function flame(ctx, x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 0.2, x + s * 0.5, y + s * 0.6, x, y + s * 0.7);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x - s * 0.7, y - s * 0.2, x, y - s);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return dpr;
  }

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.bg1);
    g.addColorStop(1, PALETTE.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Soft nebula blobs for depth: violet, teal and ember, barely there.
    const nebulae = [
      { x: 170, y: 130, r: 220, c: 'rgba(107, 79, 216, 0.13)' },
      { x: 820, y: 460, r: 260, c: 'rgba(45, 140, 160, 0.10)' },
      { x: 760, y: 110, r: 180, c: 'rgba(255, 179, 71, 0.07)' },
    ];
    for (const n of nebulae) {
      const ng = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
      ng.addColorStop(0, n.c);
      ng.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ng;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    // Distant embers drifting up.
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 26; i += 1) {
      const x = ((i * 173.3 + state.time * 12) % (FIELD.width + 40)) - 20;
      const y = FIELD.height - ((i * 97.7 + state.time * 26) % (FIELD.height + 40));
      ctx.fillStyle = i % 3 === 0 ? PALETTE.lantern : PALETTE.arenaGlow;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Arena border.
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, FIELD.width - 8, FIELD.height - 8);
    ctx.strokeStyle = PALETTE.arenaGlow;
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(state.time * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, 10, FIELD.width - 20, FIELD.height - 20);
    ctx.globalAlpha = 1;
  }

  function drawLanternGlow(x, y, radius, alpha) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, radius);
    g.addColorStop(0, 'rgba(255, 207, 110, ' + alpha + ')');
    g.addColorStop(1, 'rgba(255, 207, 110, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function drawPlayer(p, time) {
    drawLanternGlow(p.x, p.y, 110, 0.35);
    const blink = p.invuln > 0 && Math.floor(time * 16) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;
    // Cloak.
    ctx.fillStyle = '#2c2350';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.r - 4);
    ctx.quadraticCurveTo(p.x + p.r + 4, p.y, p.x + p.r * 0.7, p.y + p.r);
    ctx.quadraticCurveTo(p.x, p.y + p.r * 0.7, p.x - p.r * 0.7, p.y + p.r);
    ctx.quadraticCurveTo(p.x - p.r - 4, p.y, p.x, p.y - p.r - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.lantern;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Hood + face glow.
    ctx.fillStyle = '#1b1538';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 3, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 3, 3.5, 0, TAU);
    ctx.fill();
    // Lantern held toward the aim.
    const lx = p.x + Math.cos(p.aimAngle) * (p.r + 6);
    const ly = p.y + Math.sin(p.aimAngle) * (p.r + 6);
    ctx.fillStyle = PALETTE.lantern;
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(lx, ly, 2.4, 0, TAU);
    ctx.fill();
    // Shield ring.
    if (p.shieldUntil > 0) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 8, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawEnemy(e, time) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    if (e.kind === 'mote') {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + e.t;
        const r = i % 2 === 0 ? e.r : e.r * 0.62;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1b1030';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.4, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'wisp') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.7, 2);
      ctx.quadraticCurveTo(0, e.r * 1.8 + Math.sin(e.t * 6) * 4, e.r * 0.7, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#06121f';
      ctx.beginPath();
      ctx.arc(-3.5, -2, 2, 0, TAU);
      ctx.arc(3.5, -2, 2, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      ctx.rotate(Math.sin(e.t * 2) * 0.2);
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b0a1e';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.42, 0, TAU);
      ctx.fill();
      if (e.telegraph > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 6, 0, TAU);
        ctx.stroke();
      }
    } else if (e.kind === 'brute') {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + 0.3;
        const x = Math.cos(a) * e.r;
        const y = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3d0f08';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.5, -e.r * 0.2);
      ctx.lineTo(0, e.r * 0.2);
      ctx.lineTo(e.r * 0.5, -e.r * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(-e.r * 0.3, -e.r * 0.25, 3, 0, TAU);
      ctx.arc(e.r * 0.3, -e.r * 0.25, 3, 0, TAU);
      ctx.fill();
    } else {
      // Bosses: crowned dark orb with orbiting embers.
      const pulse = 1 + Math.sin(time * 3) * 0.04;
      ctx.scale(pulse, pulse);
      drawLanternGlow(0, 0, e.r * 2.2, 0.22);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      if (flash) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#2b0a1e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.78, 0, TAU);
      ctx.stroke();
      // Crown spikes.
      ctx.fillStyle = PALETTE.gold;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * e.r * 0.3 - 7, -e.r * 0.72);
        ctx.lineTo(i * e.r * 0.3, -e.r * 1.12 - Math.abs(i) * -4);
        ctx.lineTo(i * e.r * 0.3 + 7, -e.r * 0.72);
        ctx.closePath();
        ctx.fill();
      }
      // Eyes.
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(-e.r * 0.28, -e.r * 0.1, 6, 0, TAU);
      ctx.arc(e.r * 0.28, -e.r * 0.1, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2b0a1e';
      ctx.beginPath();
      ctx.arc(-e.r * 0.28, -e.r * 0.1, 2.5, 0, TAU);
      ctx.arc(e.r * 0.28, -e.r * 0.1, 2.5, 0, TAU);
      ctx.fill();
      // Orbiting embers.
      for (let i = 0; i < 3; i += 1) {
        const a = time * 1.4 + (i / 3) * TAU;
        ctx.fillStyle = PALETTE.lantern;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (e.r + 16), Math.sin(a) * (e.r + 16), 4, 0, TAU);
        ctx.fill();
      }
      // Boss health arc.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, e.hp / e.maxHp));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullets(state) {
    for (const b of state.bullets) {
      ctx.fillStyle = PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 1.5, 0, TAU);
      ctx.fill();
    }
    for (const b of state.ebullets) {
      ctx.fillStyle = PALETTE.ebullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd7e8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 2, 0, TAU);
      ctx.fill();
    }
  }

  function drawPickups(state, time) {
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 4 + pk.x) * 2;
      const blink = pk.life < 3 && Math.floor(time * 6) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'shard') {
        ctx.fillStyle = PALETTE.shard;
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillStyle = '#e8fbff';
        ctx.fillRect(-2.5, -2.5, 5, 5);
      } else if (pk.kind === 'heart') {
        flame(ctx, 0, 0, 8, PALETTE.heart);
      } else {
        ctx.strokeStyle = PALETTE.shield;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = PALETTE.shield;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 0.5);
      }
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    const p = state.player;
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.fillText(String(state.score).padStart(6, '0'), 24, 42);
    ctx.font = '13px "Trebuchet MS", sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('BEST ' + String(Math.max(best, state.score)).padStart(6, '0'), 24, 62);
    // Combo.
    if (state.combo > 1) {
      ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('x' + state.combo + ' COMBO', 24, 88);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
      ctx.fillRect(24, 94, 90 * Math.max(0, state.comboTimer / 4), 4);
    }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText(state.wave > 0 ? 'WAVE ' + state.wave : 'EMBERWARDEN', FIELD.width / 2, 38);
    // Boss bar.
    if (state.boss) {
      const name = state.boss.kind === 'matriarch' ? 'THE GLOOM MATRIARCH' : 'THE HOLLOW KING';
      ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
      ctx.fillStyle = PALETTE.boss;
      ctx.fillText(name, FIELD.width / 2, 62);
      const bw = 340;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      rr(ctx, FIELD.width / 2 - bw / 2, 70, bw, 10, 5);
      ctx.fill();
      ctx.fillStyle = PALETTE.boss;
      rr(ctx, FIELD.width / 2 - bw / 2, 70, bw * Math.max(0, state.boss.hp / state.boss.maxHp), 10, 5);
      ctx.fill();
    }
    // Flames (HP), top right.
    for (let i = 0; i < p.maxHp; i += 1) {
      const x = FIELD.width - 30 - i * 26;
      if (i < p.hp) flame(ctx, x, 34, 10, PALETTE.player);
      else {
        ctx.globalAlpha = 0.25;
        flame(ctx, x, 34, 10, PALETTE.dim);
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'right';
    ctx.font = '13px "Trebuchet MS", sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('KILLS ' + state.kills, FIELD.width - 24, 62);
    ctx.fillText(muted ? 'MUTED (M)' : 'SOUND ON (M)', FIELD.width - 24, 80);
    // Dash cooldown, bottom left.
    const ready = p.dashTimer <= 0;
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.fillStyle = ready ? PALETTE.lantern : PALETTE.dim;
    ctx.fillText(ready ? 'DASH READY  [Shift]' : 'DASH …', 24, FIELD.height - 22);
    if (!ready) {
      ctx.fillStyle = 'rgba(255, 207, 110, 0.35)';
      ctx.fillRect(24, FIELD.height - 16, 70 * (1 - p.dashTimer / p.dashCooldown), 4);
    }
    if (p.shieldUntil > state.time) {
      ctx.fillStyle = PALETTE.shield;
      ctx.fillText('SHIELD ' + Math.ceil(p.shieldUntil - state.time) + 's', 24, FIELD.height - 44);
    }
    // Wave banner.
    if (state.phase === 'banner') {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, state.bannerTimer);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText(state.bannerText, FIELD.width / 2, FIELD.height / 2 - 10);
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.boss ? 'Defeat the boss to break the Gloom' : 'The Gloom stirs…', FIELD.width / 2, FIELD.height / 2 + 24);
      ctx.globalAlpha = 1;
    }
  }

  function overlay(alpha) {
    ctx.fillStyle = 'rgba(6, 6, 20, ' + alpha + ')';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function centeredTitle(text, y, size, color) {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold ' + size + 'px Georgia, serif';
    ctx.fillText(text, FIELD.width / 2, y);
  }

  function centeredLine(text, y, size, color, bold) {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = (bold ? 'bold ' : '') + size + 'px "Trebuchet MS", sans-serif';
    ctx.fillText(text, FIELD.width / 2, y);
  }

  function drawTitle(state, best) {
    overlay(0.55);
    drawLanternGlow(FIELD.width / 2, 150, 220, 0.25);
    centeredTitle('EMBERWARDEN', 168, 64, PALETTE.lantern);
    centeredLine('The last ember-keeper defends the Lantern of Dawn.', 206, 18, PALETTE.text);
    centeredLine('Hold the light. Break the Gloom. Survive ten waves.', 232, 15, PALETTE.dim);
    if (best > 0) centeredLine('BEST SCORE  ' + best, 268, 16, PALETTE.gold, true);
    centeredLine('WASD / Arrows — move      Mouse — aim      Click / Space — fire', 330, 16, PALETTE.text);
    centeredLine('Shift — dash      P — pause      M — mute', 356, 16, PALETTE.text);
    centeredLine('Clear a wave, choose an ember, face the boss on waves 5 and 10.', 382, 15, PALETTE.dim);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(state.time * 3);
    centeredLine('—  PRESS ENTER OR CLICK TO BEGIN  —', 440, 18, PALETTE.gold, true);
    ctx.globalAlpha = 1;
  }

  function drawUpgrade(state, ui) {
    overlay(0.72);
    centeredTitle('THE WAVE BREAKS', 110, 40, PALETTE.gold);
    centeredLine('Choose an ember to carry into the dark — click a card or press 1 / 2 / 3.', 142, 16, PALETTE.text);
    const cardW = 240;
    const cardH = 220;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const x0 = (FIELD.width - total) / 2;
    const y0 = 190;
    state.choices.forEach((choice, i) => {
      const x = x0 + i * (cardW + gap);
      const hover = ui && ui.mouseX >= x && ui.mouseX <= x + cardW && ui.mouseY >= y0 && ui.mouseY <= y0 + cardH;
      ctx.save();
      if (hover) {
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 24;
      }
      ctx.fillStyle = hover ? '#241d4d' : '#171233';
      rr(ctx, x, y0, cardW, cardH, 14);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = hover ? PALETTE.gold : PALETTE.arenaEdge;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      rr(ctx, x, y0, cardW, cardH, 14);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '44px Georgia, serif';
      ctx.fillText(choice.icon, x + cardW / 2, y0 + 70);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
      ctx.fillText(choice.name, x + cardW / 2, y0 + 112);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '15px "Trebuchet MS", sans-serif';
      ctx.fillText(choice.blurb, x + cardW / 2, y0 + 142);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.fillText('[ ' + (i + 1) + ' ]', x + cardW / 2, y0 + 188);
    });
    centeredLine('Score ' + state.score + '   ·   Wave ' + state.wave + ' cleared   ·   Kills ' + state.kills, 470, 15, PALETTE.dim);
  }

  function drawPaused() {
    overlay(0.6);
    centeredTitle('PAUSED', 280, 52, PALETTE.text);
    centeredLine('Press P or Escape to return to the fight.', 322, 16, PALETTE.dim);
  }

  function drawStats(state, best, y) {
    const acc = state.shotsFired > 0 ? Math.round((100 * state.hitsLanded) / state.shotsFired) : 0;
    centeredLine('SCORE  ' + state.score, y, 22, PALETTE.gold, true);
    centeredLine('Wave reached ' + Math.max(1, state.wave) + '    ·    Kills ' + state.kills + '    ·    Accuracy ' + acc + '%', y + 36, 16, PALETTE.text);
    centeredLine('Best ' + Math.max(best, state.score), y + 62, 16, PALETTE.dim);
  }

  function drawOver(state, best) {
    overlay(0.68);
    centeredTitle('THE LIGHT GOES OUT', 210, 48, PALETTE.heart);
    centeredLine('The Gloom takes the lantern… this time.', 252, 17, PALETTE.text);
    drawStats(state, best, 310);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(state.time * 3);
    centeredLine('—  PRESS ENTER TO TRY AGAIN  —', 430, 18, PALETTE.gold, true);
    ctx.globalAlpha = 1;
  }

  function drawVictory(state, best) {
    overlay(0.6);
    drawLanternGlow(FIELD.width / 2, 200, 260, 0.3);
    centeredTitle('DAWN BREAKS', 200, 56, PALETTE.gold);
    centeredLine('The Hollow King falls. The Lantern burns on.', 244, 18, PALETTE.text);
    drawStats(state, best, 300);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(state.time * 3);
    centeredLine('—  PRESS ENTER TO KEEP FIGHTING (ENDLESS)  —', 420, 18, PALETTE.gold, true);
    ctx.globalAlpha = 1;
    centeredLine('or press R to start a fresh run', 448, 14, PALETTE.dim);
  }

  function draw(state, screen, best, muted, ui) {
    const dpr = resize();
    const view = viewFor(canvas.clientWidth, canvas.clientHeight);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * (view.ox + shakeX * view.scale), dpr * (view.oy + shakeY * view.scale));
    drawBackground(state);
    drawPickups(state, state.time);
    for (const e of state.enemies) drawEnemy(e, state.time);
    drawBullets(state);
    if (screen !== SCREEN_TITLE) drawPlayer(state.player, state.time);
    else drawPlayer(state.player, state.time);
    drawParticles(state);
    // Aim reticle.
    if (screen === SCREEN_PLAY && ui && ui.aimSeen) {
      ctx.strokeStyle = 'rgba(255, 217, 122, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ui.mouseX, ui.mouseY, 10, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ui.mouseX - 14, ui.mouseY);
      ctx.lineTo(ui.mouseX - 6, ui.mouseY);
      ctx.moveTo(ui.mouseX + 6, ui.mouseY);
      ctx.lineTo(ui.mouseX + 14, ui.mouseY);
      ctx.moveTo(ui.mouseX, ui.mouseY - 14);
      ctx.lineTo(ui.mouseX, ui.mouseY - 6);
      ctx.moveTo(ui.mouseX, ui.mouseY + 6);
      ctx.lineTo(ui.mouseX, ui.mouseY + 14);
      ctx.stroke();
    }
    if (screen !== SCREEN_TITLE) drawHud(state, best, muted);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state, ui);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_VICTORY) drawVictory(state, best);
    // Damage vignette.
    if (state.player.invuln > 0.6 && state.player.hp > 0 && screen === SCREEN_PLAY) {
      ctx.strokeStyle = 'rgba(255, 60, 80, 0.5)';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, FIELD.width - 14, FIELD.height - 14);
    }
  }

  return { draw };
}
