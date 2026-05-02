import { Platform } from "react-native";

/** Avoid double chime when notification + WebSocket overlay fire back-to-back. */
const DEBOUNCE_MS = 450;
let lastPlayAt = 0;

const STOCKS_DEBOUNCE_MS = 400;
let lastStocksPlayAt = 0;

/**
 * Short attention chime for pin alerts (web: Web Audio; native: rely on
 * {@link expo-notifications} `sound` on scheduled notifications).
 */
export function playPinnedAlertSound(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayAt < DEBOUNCE_MS) return;
  lastPlayAt = now;

  try {
    const g = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(784, t0);
    osc.frequency.setValueAtTime(988, t0 + 0.1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
    window.setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* already closed */
      }
    }, 400);
  } catch {
    /* autoplay / AudioContext blocked */
  }
}

/**
 * Watchlist quote refresh (web only). Short ascending triangle arpeggio —
 * distinct from pin reminders.
 */
export function playStocksUpdateSound(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastStocksPlayAt < STOCKS_DEBOUNCE_MS) return;
  lastStocksPlayAt = now;

  try {
    const g = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();

    const t0 = ctx.currentTime;
    const notes = [
      { hz: 587.33, at: 0, dur: 0.1, amp: 0.1 }, // D5
      { hz: 739.99, at: 0.1, dur: 0.1, amp: 0.09 }, // F#5
      { hz: 880.0, at: 0.2, dur: 0.14, amp: 0.085 }, // A5
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      const start = t0 + n.at;
      osc.frequency.setValueAtTime(n.hz, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(n.amp, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.02);
    }

    window.setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* already closed */
      }
    }, 500);
  } catch {
    /* autoplay / AudioContext blocked */
  }
}
