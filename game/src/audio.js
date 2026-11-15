// Emberwarden — every sound is synthesized with WebAudio: no audio files ship.
// The engine stays silent until the player first interacts (browser autoplay rules),
// and every call is safe when audio is unavailable (headless screenshots).
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let drone = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // A sound that fails to play must never break the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    const ac = ensure();
    if (!ac || !noiseBuf) return;
    try {
      const t = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch {
      // As above: sound is garnish, never load-bearing.
    }
  }

  return {
    /** Call from the first user gesture so the context is allowed to start. */
    unlock() {
      const ac = ensure();
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.08, 340);
    },
    hit() {
      tone(220, 0.05, 'triangle', 0.1, 140);
    },
    explode() {
      noise(0.35, 0.25, 900);
      tone(90, 0.3, 'sine', 0.22, 40);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.16, 60);
      noise(0.15, 0.12, 500);
    },
    pickup() {
      tone(880, 0.08, 'sine', 0.12);
      window.setTimeout(() => tone(1320, 0.1, 'sine', 0.1), 60);
    },
    heal() {
      tone(523, 0.12, 'sine', 0.12);
      window.setTimeout(() => tone(784, 0.16, 'sine', 0.12), 90);
    },
    dash() {
      noise(0.12, 0.1, 2400);
    },
    horn() {
      tone(196, 0.5, 'sawtooth', 0.12, 196);
      tone(294, 0.5, 'sawtooth', 0.08, 294);
    },
    bossRoar() {
      tone(70, 0.7, 'sawtooth', 0.2, 45);
      noise(0.5, 0.14, 300);
    },
    upgrade() {
      [523, 659, 784].forEach((f, i) => window.setTimeout(() => tone(f, 0.14, 'triangle', 0.12), i * 80));
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => window.setTimeout(() => tone(f, 0.22, 'triangle', 0.13), i * 110));
    },
    click() {
      tone(600, 0.05, 'sine', 0.08);
    },
    /** A low two-note drone under play; quiet, so it never fights the effects. */
    startDrone() {
      const ac = ensure();
      if (!ac || drone) return;
      try {
        const g = ac.createGain();
        g.gain.value = 0.035;
        g.connect(master);
        const o1 = ac.createOscillator();
        o1.type = 'sine';
        o1.frequency.value = 55;
        const o2 = ac.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = 82.5;
        o1.connect(g);
        o2.connect(g);
        o1.start();
        o2.start();
        drone = { g, o1, o2 };
      } catch {
        drone = null;
      }
    },
    stopDrone() {
      if (!drone) return;
      try {
        drone.g.gain.setValueAtTime(0, ctx.currentTime);
        drone.o1.stop();
        drone.o2.stop();
      } catch {
        // Already stopped.
      }
      drone = null;
    },
  };
}
