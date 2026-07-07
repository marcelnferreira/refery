// Gravação de chamadas via MediaRecorder. Usado tanto para ligações de saída
// (grava apenas o áudio local, já que o WaVoIP roda em iframe de outra origem
// e o navegador bloqueia acesso a esse áudio por segurança) quanto para
// ligações recebidas via SDK (grava os dois lados, local + remoto, misturando
// os AnalyserNodes expostos pelo SDK num MediaStreamDestination).

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export function startRecording(stream: MediaStream): MediaRecorder | null {
  if (typeof MediaRecorder === 'undefined') return null;
  try {
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    (recorder as any)._chunks = chunks;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(1000);
    return recorder;
  } catch (err) {
    console.warn('[callRecorder] não foi possível iniciar gravação:', err);
    return null;
  }
}

export function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve) => {
    const chunks: BlobPart[] = (recorder as any)._chunks ?? [];
    const finish = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    if (recorder.state === 'inactive') { finish(); return; }
    recorder.addEventListener('stop', finish, { once: true });
    try { recorder.stop(); } catch { finish(); }
  });
}

// Mistura dois AnalyserNode (ex.: audioAnalyserIn/audioAnalyserOut do SDK WaVoIP)
// num único MediaStream gravável, sem interromper as conexões de áudio já existentes.
export function criarMixGravacao(nodes: Array<AnalyserNode | null | undefined>): MediaStream | null {
  const validos = nodes.filter((n): n is AnalyserNode => !!n);
  if (validos.length === 0) return null;
  const ctx = validos[0].context;
  const dest = ctx.createMediaStreamDestination();
  validos.forEach(n => n.connect(dest));
  return dest.stream;
}
