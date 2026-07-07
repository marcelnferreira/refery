import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConta, useSalvarLigacao } from '@/hooks/useRefery';
import { useReferyTranscription } from '@/hooks/useReferyTranscription';
import { startRingback, stopRingback, playConnected, playHangup, disposeSounds } from '@/lib/callSounds';
import { toast } from 'sonner';
import {
  Phone, PhoneOff, Mic, MicOff, Loader2,
  CheckCircle2, X, MessageSquareText, PhoneMissed, PhoneCall,
} from 'lucide-react';

interface Props {
  contatoId: string;
  contatoTipo: 'cliente' | 'indicacao';
  contatoNome: string;
  contatoTelefone: string;
  onClose: () => void;
}

const toE164BR = (phone: string): string => {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d}`;
};

const fmtDuracao = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

type Fase = 'idle' | 'iniciando' | 'chamando' | 'em_chamada' | 'analisando' | 'resumo';
type StatusChamada = 'realizada' | 'nao_atendeu' | 'ocupado';

export default function LigacaoModal({ contatoId, contatoTipo, contatoNome, contatoTelefone, onClose }: Props) {
  const { data: conta } = useConta();
  const salvarLigacao = useSalvarLigacao();
  const { segmentos, transcrevendo, iniciarTranscricao, pararTranscricao, getTextoFinal } = useReferyTranscription();

  const [fase, setFase] = useState<Fase>('idle');
  const [duracao, setDuracao] = useState(0);
  const [mutado, setMutado] = useState(false);
  const [analise, setAnalise] = useState<any>(null);
  const [statusFinal, setStatusFinal] = useState<StatusChamada>('realizada');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const duracaoRef = useRef(0);

  // Auto-scroll transcrição
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segmentos]);

  const iniciarTimer = useCallback(() => {
    setDuracao(0);
    duracaoRef.current = 0;
    timerRef.current = setInterval(() => {
      duracaoRef.current += 1;
      setDuracao(duracaoRef.current);
    }, 1000);
  }, []);

  const pararTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      pararTimer();
      pararTranscricao();
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      disposeSounds();
    };
  }, [pararTimer, pararTranscricao]);

  const finalizar = useCallback(async (status: StatusChamada) => {
    playHangup();
    pararTimer();
    pararTranscricao();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    setIframeUrl(null);
    setFase('analisando');

    const textoTranscricao = getTextoFinal();
    let analiseResult = null;

    if (status === 'realizada' && textoTranscricao.trim()) {
      try {
        const res = await fetch('/api/analyze-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcricao: textoTranscricao,
            contato_nome: contatoNome,
            contato_tipo: contatoTipo,
          }),
        });
        if (res.ok) analiseResult = await res.json();
      } catch {}
    }

    await salvarLigacao.mutateAsync({
      contato_id: contatoId,
      contato_tipo: contatoTipo,
      contato_nome: contatoNome,
      contato_telefone: contatoTelefone,
      status,
      duracao_segundos: duracaoRef.current,
      transcricao: textoTranscricao || null,
      resumo_ia: analiseResult?.resumo ?? null,
      pontos_chave: analiseResult?.pontos_chave ?? [],
      proxima_acao: analiseResult?.proxima_acao ?? null,
    });

    setStatusFinal(status);
    setAnalise(analiseResult);
    setFase('resumo');
  }, [pararTimer, pararTranscricao, getTextoFinal, contatoId, contatoTipo, contatoNome, contatoTelefone, salvarLigacao]);

  const iniciarChamada = async () => {
    if (!conta?.wavoip_token) {
      toast.error('Token WaVoIP não configurado. Configure em Configurações → Telefonia.');
      return;
    }

    setFase('iniciando');

    // Captura microfone para a transcrição
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = micStream;
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Permissão de microfone negada. Permita o acesso nas configurações do navegador.'
        : 'Não foi possível acessar o microfone.';
      toast.error(msg);
      setFase('idle');
      return;
    }

    // Monta a URL da chamada embutida
    const phone = toE164BR(contatoTelefone);
    const params = new URLSearchParams({
      token: conta.wavoip_token,
      phone,
      start_if_ready: 'true',
      available_after_call: 'false',
      close_after_call: 'false',
      name: contatoNome,
    });
    setIframeUrl(`https://app.wavoip.com/call?${params}`);
    setFase('chamando');
    startRingback();

    // Transcrição em tempo real (Soniox)
    if (conta.soniox_api_key) {
      await iniciarTranscricao(micStream, conta.soniox_api_key, contatoNome);
    }
  };

  const marcarAtendida = () => {
    playConnected();
    iniciarTimer();
    setFase('em_chamada');
  };

  const toggleMute = () => {
    if (!micStreamRef.current) return;
    const track = micStreamRef.current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMutado(!track.enabled);
  };

  const finaisCount = segmentos.filter(s => s.is_final).length;
  const parciais = segmentos.filter(s => !s.is_final);
  const emLigacao = fase === 'chamando' || fase === 'em_chamada';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col transition-all ${
        emLigacao ? 'max-w-4xl' : 'max-w-md'
      }`}>

        {/* Header */}
        <div className={`px-5 py-3.5 flex items-center justify-between flex-shrink-0 transition-colors ${
          fase === 'em_chamada' ? 'bg-green-600 text-white' :
          fase === 'chamando' ? 'bg-amber-500 text-white' :
          fase === 'analisando' ? 'bg-blue-600 text-white' :
          'bg-gray-900 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {contatoNome.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold leading-tight">{contatoNome}</p>
              <p className="text-xs opacity-80">{contatoTelefone}</p>
            </div>
            {fase === 'chamando' && (
              <span className="ml-2 flex items-center gap-1.5 text-xs bg-white/20 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Chamando...
              </span>
            )}
            {fase === 'em_chamada' && (
              <span className="ml-2 flex items-center gap-1.5 text-xs bg-white/20 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Em chamada
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {fase === 'em_chamada' && (
              <span className="text-xl font-mono font-bold tabular-nums">{fmtDuracao(duracao)}</span>
            )}
            {['idle', 'resumo'].includes(fase) && (
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ===== IDLE ===== */}
        {fase === 'idle' && (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Phone className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Ligar para {contatoNome}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Chamada, transcrição e análise por IA em um só lugar.
              </p>
            </div>
            {!conta?.wavoip_token && (
              <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Token WaVoIP não configurado. Configure em Configurações → Telefonia.
              </div>
            )}
            {!conta?.soniox_api_key && (
              <div className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Sem chave Soniox — a ligação funciona, mas sem transcrição.
              </div>
            )}
            <Button
              onClick={iniciarChamada}
              disabled={!conta?.wavoip_token}
              className="bg-green-600 hover:bg-green-700 w-full"
              size="lg"
            >
              <Phone className="h-4 w-4 mr-2" />
              Iniciar chamada
            </Button>
          </div>
        )}

        {/* ===== INICIANDO ===== */}
        {fase === 'iniciando' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
            <p className="text-sm text-muted-foreground">Preparando microfone e conectando...</p>
          </div>
        )}

        {/* ===== EM LIGAÇÃO (chamando ou em chamada) ===== */}
        {emLigacao && (
          <div className="flex flex-col md:flex-row">

            {/* Painel esquerdo: chamada WaVoIP embutida */}
            <div className="md:w-[340px] flex-shrink-0 bg-gray-950 relative">
              {iframeUrl && (
                <iframe
                  src={iframeUrl}
                  allow="microphone; autoplay; speaker-selection"
                  className="w-full h-[280px] md:h-[520px] border-0"
                  title="Chamada WaVoIP"
                />
              )}
            </div>

            {/* Painel direito: transcrição + controles */}
            <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">

              {/* Transcrição */}
              <div className="border rounded-xl overflow-hidden flex-1 flex flex-col min-h-[220px]">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Transcrição em tempo real</span>
                  {transcrevendo && (
                    <span className="flex items-center gap-1 text-xs text-green-600 ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      ativa
                    </span>
                  )}
                  {finaisCount > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{finaisCount} trechos</Badge>
                  )}
                </div>
                <ScrollArea className="flex-1 h-[300px]">
                  <div ref={scrollRef} className="p-3 space-y-1.5 text-sm">
                    {segmentos.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center italic py-6">
                        {transcrevendo ? 'Aguardando fala...' : 'Soniox não configurado — transcrição indisponível'}
                      </p>
                    )}
                    {segmentos.filter(s => s.is_final).map(s => (
                      <div key={s.id} className="flex gap-2">
                        <span className="font-semibold text-xs text-primary shrink-0 mt-0.5">{s.speaker}:</span>
                        <span className="text-gray-800">{s.text}</span>
                      </div>
                    ))}
                    {parciais.map(s => (
                      <div key={`p-${s.id}`} className="flex gap-2 opacity-50 italic">
                        <span className="font-semibold text-xs text-primary shrink-0 mt-0.5">{s.speaker}:</span>
                        <span className="text-gray-600">{s.text}...</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Controles: fase chamando */}
              {fase === 'chamando' && (
                <div className="space-y-2 flex-shrink-0">
                  <p className="text-xs text-muted-foreground text-center">Quando o contato atender, toque em Atendeu</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={marcarAtendida}
                      className="bg-green-600 hover:bg-green-700 h-12"
                    >
                      <PhoneCall className="h-4 w-4 mr-1.5" />
                      Atendeu
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => finalizar('nao_atendeu')}
                    >
                      <PhoneMissed className="h-4 w-4 mr-1.5" />
                      Não atendeu
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => finalizar('ocupado')}
                    >
                      <PhoneOff className="h-4 w-4 mr-1.5" />
                      Ocupado
                    </Button>
                  </div>
                </div>
              )}

              {/* Controles: fase em chamada */}
              {fase === 'em_chamada' && (
                <div className="flex gap-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full flex-shrink-0"
                    onClick={toggleMute}
                    disabled={!transcrevendo}
                    title={mutado ? 'Reativar transcrição' : 'Pausar transcrição'}
                  >
                    {mutado ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 h-12"
                    onClick={() => finalizar('realizada')}
                  >
                    <PhoneOff className="h-5 w-5 mr-2" />
                    Encerrar e analisar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== ANALISANDO ===== */}
        {fase === 'analisando' && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="font-medium">Analisando com IA...</p>
            <p className="text-sm text-muted-foreground">Gerando resumo da conversa</p>
          </div>
        )}

        {/* ===== RESUMO ===== */}
        {fase === 'resumo' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Ligação salva
              {statusFinal === 'realizada' && ` · ${fmtDuracao(duracao)}`}
              {statusFinal === 'nao_atendeu' && ' · Não atendeu'}
              {statusFinal === 'ocupado' && ' · Ocupado'}
            </div>

            {analise ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo</p>
                  <p className="text-sm text-gray-800">{analise.resumo}</p>
                </div>
                {analise.pontos_chave?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pontos-chave</p>
                    <ul className="space-y-0.5">
                      {analise.pontos_chave.map((p: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                          <span className="text-blue-500 mt-0.5">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analise.proxima_acao && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Próxima ação</p>
                    <p className="text-sm text-blue-800 mt-0.5">{analise.proxima_acao}</p>
                  </div>
                )}
                {analise.agendamento_detectado && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700">Agendamento detectado</p>
                    <p className="text-sm text-amber-800 mt-0.5">
                      {analise.data_agendamento}{analise.hora_agendamento ? ` às ${analise.hora_agendamento}` : ''}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {analise.interesse && (
                    <Badge variant="secondary" className={`text-xs ${
                      analise.interesse === 'alto' ? 'bg-green-100 text-green-700' :
                      analise.interesse === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-600'
                    }`}>
                      Interesse {analise.interesse}
                    </Badge>
                  )}
                  {analise.sentimento && (
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                      {analise.sentimento}
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground bg-gray-50 rounded-lg px-3 py-3">
                {statusFinal === 'realizada'
                  ? (getTextoFinal() ? 'Análise não disponível — verifique a chave Gemini.' : 'Nenhuma transcrição capturada.')
                  : 'Ligação registrada no histórico.'}
              </div>
            )}

            <Button onClick={onClose} className="w-full">Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
