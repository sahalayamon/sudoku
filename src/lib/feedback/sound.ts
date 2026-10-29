/**
 * Tiny synthesized sound effects. No audio files, nothing is downloaded, and the
 * AudioContext is only created after a user gesture has already happened (every
 * call site is an input handler). Volumes are deliberately very low.
 */

export type SoundName = "select" | "place" | "erase" | "error" | "hint" | "complete" | "undo";

interface Tone {
  freq: number;
  /** Seconds from now. */
  at: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  /** Optional pitch glide target. */
  to?: number;
}

const SOUNDS: Record<SoundName, Tone[]> = {
  select: [{ freq: 880, at: 0, duration: 0.03, gain: 0.012, type: "sine" }],
  place: [{ freq: 520, at: 0, duration: 0.09, gain: 0.04, type: "triangle", to: 600 }],
  erase: [{ freq: 300, at: 0, duration: 0.06, gain: 0.03, type: "sine", to: 220 }],
  undo: [{ freq: 400, at: 0, duration: 0.05, gain: 0.025, type: "sine", to: 340 }],
  error: [{ freq: 170, at: 0, duration: 0.16, gain: 0.05, type: "sine", to: 130 }],
  hint: [
    { freq: 660, at: 0, duration: 0.1, gain: 0.03, type: "sine" },
    { freq: 880, at: 0.09, duration: 0.14, gain: 0.03, type: "sine" },
  ],
  complete: [
    { freq: 523.25, at: 0, duration: 0.5, gain: 0.04, type: "sine" },
    { freq: 659.25, at: 0.12, duration: 0.5, gain: 0.04, type: "sine" },
    { freq: 783.99, at: 0.24, duration: 0.6, gain: 0.04, type: "sine" },
    { freq: 1046.5, at: 0.38, duration: 0.9, gain: 0.035, type: "sine" },
  ],
};

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

export function playSound(name: SoundName): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  const now = ctx.currentTime;
  for (const tone of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.freq, now + tone.at);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.at + tone.duration);
    gain.gain.setValueAtTime(0.0001, now + tone.at);
    gain.gain.exponentialRampToValueAtTime(tone.gain, now + tone.at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + tone.at);
    osc.stop(now + tone.at + tone.duration + 0.02);
  }
}
