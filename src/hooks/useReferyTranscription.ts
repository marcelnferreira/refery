import { useState, useRef, useCallback } from 'react';

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const SAMPLE_RATE = 16000;

export interface TranscricaoSegmento {
  id: number;
  text: string;
  speaker: string;
  is_final: boolean;
  timestamp: number;
}

interface ChannelRefs {
  ws: WebSocket | null;
  audioContext: AudioContext | null;
  processor: ScriptProcessorNode | null;
  source: MediaStreamAudioSourceNode | null;
}

const float32ToInt16 = (data: Float32Array): ArrayBuffer => {
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm.buffer;
};

export function useReferyTranscription() {
  const [segmentos, setSegmentos] = useState<TranscricaoSegmento[]>([]);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const segmentosRef = useRef<TranscricaoSegmento[]>([]);
  const micRef = useRef<ChannelRefs>({ ws: null, audioContext: null, processor: null, source: null });
  const idRef = useRef(0);

  const addSegmento = useCallback((seg: TranscricaoSegmento) => {
    setSegmentos(prev => {
      const sem = prev.filter(t => t.is_final || t.speaker !== seg.speaker);
      const updated = [...sem, seg];
      segmentosRef.current = updated;
      return updated;
    });
  }, []);

  const startChannel = useCallback((
    stream: MediaStream,
    speakerLabel: string,
    apiKey: string,
    refs: React.MutableRefObject<ChannelRefs>,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let tokenBuffer: string[] = [];
      const ws = new WebSocket(SONIOX_WS_URL);
      ws.binaryType = 'arraybuffer';
      refs.current.ws = ws;

      ws.onopen = async () => {
        ws.send(JSON.stringify({
          api_key: apiKey,
          model: 'stt-rt-v5',
          audio_format: 'pcm_s16le',
          sample_rate: SAMPLE_RATE,
          num_channels: 1,
          language_hints: ['pt'],
        }));

        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        refs.current.audioContext = audioContext;
        // Autoplay policy: garante que o contexto está rodando (senão nenhum áudio é processado)
        if (audioContext.state === 'suspended') {
          try { await audioContext.resume(); } catch {}
        }
        const source = audioContext.createMediaStreamSource(stream);
        refs.current.source = source;
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        refs.current.processor = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(float32ToInt16(e.inputBuffer.getChannelData(0)));
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error_code) {
            console.error('[Soniox] erro:', data.error_code, data.error_message);
            setErro(`Soniox: ${data.error_message ?? data.error_code}`);
            return;
          }
          if (!data.tokens?.length) return;

          // Ignora tokens especiais de controle (ex: <end>, <fin>)
          const tokens = data.tokens.filter((t: any) => t.text && !t.text.startsWith('<'));
          const finals = tokens.filter((t: any) => t.is_final).map((t: any) => t.text);
          const nonFinals = tokens.filter((t: any) => !t.is_final).map((t: any) => t.text);

          if (finals.length > 0) {
            tokenBuffer.push(...finals);
            const text = tokenBuffer.join('').trim();
            if (text) {
              addSegmento({ id: idRef.current++, text, speaker: speakerLabel, is_final: true, timestamp: Date.now() });
              tokenBuffer = [];
            }
          }

          if (nonFinals.length > 0) {
            const preview = [...tokenBuffer, ...nonFinals].join('').trim();
            if (preview) {
              addSegmento({ id: idRef.current++, text: preview, speaker: speakerLabel, is_final: false, timestamp: Date.now() });
            }
          }
        } catch {}
      };

      ws.onerror = () => reject(new Error('Erro WebSocket Soniox'));
      ws.onclose = (e) => {
        if (e.code !== 1000) console.warn('[Soniox] conexão fechada:', e.code, e.reason);
      };
    });
  }, [addSegmento]);

  const iniciarTranscricao = useCallback(async (micStream: MediaStream, sonioxApiKey: string, nomePeer?: string) => {
    setErro(null);
    setSegmentos([]);
    segmentosRef.current = [];
    idRef.current = 0;

    if (!sonioxApiKey) {
      setErro('Chave Soniox não configurada. Configure em Configurações.');
      return;
    }

    try {
      await startChannel(micStream, 'Você', sonioxApiKey, micRef);
      setTranscrevendo(true);
    } catch (err: any) {
      setErro(err.message);
      pararTranscricao();
    }
  }, [startChannel]);

  const pararTranscricao = useCallback(() => {
    const cleanup = (refs: React.MutableRefObject<ChannelRefs>) => {
      refs.current.ws?.close();
      refs.current.processor?.disconnect();
      refs.current.source?.disconnect();
      refs.current.audioContext?.close().catch(() => {});
      refs.current = { ws: null, audioContext: null, processor: null, source: null };
    };
    cleanup(micRef);
    setTranscrevendo(false);
  }, []);

  const getTextoFinal = useCallback(() => {
    return segmentosRef.current
      .filter(s => s.is_final)
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n');
  }, []);

  return { segmentos, transcrevendo, erro, iniciarTranscricao, pararTranscricao, getTextoFinal };
}
