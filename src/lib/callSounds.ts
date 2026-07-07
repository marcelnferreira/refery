// Efeitos sonoros de telefonia gerados via Web Audio API (sem arquivos de áudio).
// Padrão Anatel: ringback 425 Hz (1s tocando / 4s silêncio), ocupado 425 Hz (0.25s/0.25s).

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const tone = (
  freq: number,
  startAt: number,
  duration: number,
  gainValue = 0.07,
  type: OscillatorType = 'sine',
) => {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Envelope suave para evitar cliques
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainValue, startAt + 0.015);
  gain.gain.setValueAtTime(gainValue, startAt + duration - 0.02);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
  return osc;
};

// ---- Ringback (chamando): loop 1s on / 4s off ----
let ringbackTimer: ReturnType<typeof setInterval> | null = null;

export function startRingback() {
  stopRingback();
  const play = () => {
    const ac = getCtx();
    tone(425, ac.currentTime, 1.0);
  };
  play();
  ringbackTimer = setInterval(play, 5000);
}

export function stopRingback() {
  if (ringbackTimer) { clearInterval(ringbackTimer); ringbackTimer = null; }
}

// ---- Atendeu: dois toques ascendentes curtos e agradáveis ----
export function playConnected() {
  stopRingback();
  const ac = getCtx();
  const t = ac.currentTime;
  tone(600, t, 0.09, 0.09);
  tone(900, t + 0.11, 0.12, 0.09);
}

// ---- Desligou / caiu: tom de ocupado (3 ciclos) ----
export function playHangup() {
  stopRingback();
  const ac = getCtx();
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    tone(425, t + i * 0.5, 0.25, 0.08);
  }
}

// Libera o AudioContext (chamar ao desmontar o modal)
export function disposeSounds() {
  stopRingback();
  if (ctx && ctx.state !== 'closed') { ctx.close().catch(() => {}); ctx = null; }
}
