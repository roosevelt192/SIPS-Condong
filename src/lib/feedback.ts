// Helper Web Audio API & Vibration Haptic Feedback
export function playScanSound(type: "success" | "error" | "warning") {
  if (typeof window === "undefined") return;

  // 1. Haptic Vibration Feedback (pada perangkat HP)
  if ("vibrate" in navigator) {
    if (type === "success") {
      navigator.vibrate(80); // getar singkat
    } else if (type === "warning") {
      navigator.vibrate([100, 50, 100]);
    } else {
      navigator.vibrate([150, 80, 150]); // getar ganda error
    }
  }

  // 2. Synthesized Audio Beep via Web Audio API
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Suara Beep Tinggi (880Hz -> 1760Hz) nada positif
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === "warning") {
      // Suara Beep Ganda Sedang
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } else {
      // Suara Beep Rendah (220Hz) nada penolakan / terlambat
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Fallback silent jika autoplay diblokir browser
  }
}