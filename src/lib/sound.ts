// Synthesized sound effects (no audio files needed)
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

/** Glass marble clicking on wood */
export function playClick() {
  tone(2400 + Math.random() * 600, 0, 0.06, 'sine', 0.25);
  tone(1200, 0.005, 0.05, 'triangle', 0.12);
}

/** Marble dropping into a hole */
export function playDrop() {
  tone(900, 0, 0.08, 'sine', 0.2);
  tone(600, 0.06, 0.1, 'sine', 0.15);
  tone(2600, 0.12, 0.05, 'sine', 0.1);
}

export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, 'triangle', 0.18));
}

export function playFanfare() {
  const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, i * 0.14, i === notes.length - 1 ? 0.9 : 0.18, 'square', 0.08));
  notes.forEach((f, i) => tone(f / 2, i * 0.14, 0.2, 'triangle', 0.1));
}
