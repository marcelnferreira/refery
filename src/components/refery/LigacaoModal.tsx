import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConta, useSalvarLigacao } from '@/hooks/useRefery';
import { useReferyTranscription } from '@/hooks/useReferyTranscription';
import { toast } from 'sonner';
import {
  Phone, PhoneOff, Mic, MicOff, Loader2,
  CheckCircle2, X, MessageSquareText, ExternalLink,
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

type Fase = 'idle' | 'iniciando' | 'ligando' | 'analisando' | 'resumo';
type StatusChamada = 'realizada' | 'nao_atendeu' | 'ocupado';

export default function LigacaoModal({ contatoId, contatoTipo, contatoNome, contatoTelefone, onClose }: Props) {
  const { data: conta } = useConta();
  const salvarLigacao = useSalvarLigacao();
  const { segmentos, transcrevendo, iniciarTranscricao, pararTranscricao, getTextoFinal } = useReferyTranscription();

  const [fase, setFase] = useState<Fase>('idle');
  const [duracao, setDuracao] = useState(0);
  const [mutado, setMutado] = useState(false);
  const [analise, setAnalise] = useState<any>(null);
  const [statusChamada, setStatusChamada] = useState<StatusChamada>('realizada');

  const popupRef = useRef<Window | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const duracaoRef = useRef(0);

  // Auto-scroll transcrição
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segmentos]);

  // Timer de duração
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
      if (pollRef.current) clearInterval(pollRef.current);
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      try { popupRef.current?.close(); } catch {}
    };
  }, [pararTimer, pararTranscricao]);

  const encerrarChamada = useCallback(async (duracaoFinal: number) => {
    pararTimer();
    pararTranscricao();
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    setFase('analisando');

    const textoTranscricao = getTextoFinal();
    let analiseResult = null;

    if (textoTranscricao.trim()) {
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
      status: statusChamada,
      duracao_segundos: duracaoFinal,
      transcricao: textoTranscricao || null,
      resumo_ia: analiseResult?.resumo ?? null,
      pontos_chave: analiseResult?.pontos_chave ?? [],
      proxima_acao: analiseResult?.proxima_acao ?? null,
    });

    setAnalise(analiseResult);
    setFase('resumo');
  }, [pararTimer, pararTranscricao, getTextoFinal, contatoId, contatoTipo, contatoNome, contatoTelefone, statusChamada, salvarLigacao]);

  const iniciarChamada = async () => {
    if (!conta?.wavoip_token) {
      toast.error('Token WaVoIP não configurado. Configure em Configurações → Telefonia.');
      return;
    }

    setFase('iniciando');

    // Captura microfone primeiro
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = micStream;
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Permissão de microfone negada. Permite o acesso nas configurações do navegador.'
        : 'Não foi possível acessar o microfone.';
      toast.error(msg);
      setFase('idle');
      return;
    }

    // Abre popup WaVoIP
    const phone = toE164BR(contatoTelefone);
    const params = new URLSearchParams({
      token: conta.wavoip_token,
      phone,
      start_if_ready: 'true',
      available_after_call: 'false',
      close_after_call: 'true',
      name: contatoNome,
    });
    const features = 'popup=yes,width=420,height=640,resizable=yes,scrollbars=no';
    const win = window.open(`https://app.wavoip.com/call?${params}`, 'wavoip_call', features);

    if (!win) {
      toast.error('Popup bloqueado. Permita popups para este site e tente novamente.');
      micStream.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      setFase('idle');
      return;
    }

    popupRef.current = win;
    win.focus();
    setFase('ligando');
    iniciarTimer();

    // Inicia transcrição local (Soniox)
    if (conta.soniox_api_key) {
      await iniciarTranscricao(micStream, conta.soniox_api_key, contatoNome);
    }

    // Poll: detecta quando popup fecha
    pollRef.current = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        encerrarChamada(duracaoRef.current);
      }
    }, 1000);
  };

  const encerrarManual = async () => {
    try { popupRef.current?.close(); } catch {}
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    encerrarChamada(duracaoRef.current);
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between flex-shrink-0 ${
          fase === 'ligando' ? 'bg-green-600 text-white' :
          fase === 'analisando' ? 'bg-blue-600 text-white' :
          fase === 'resumo' ? 'bg-gray-900 text-white' :
          'bg-gray-900 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {contatoNome.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{contatoNome}</p>
              <p className="text-xs opacity-80">{contatoTelefone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fase === 'ligando' && (
              <span className="text-lg font-mono font-bold">{fmtDuracao(duracao)}</span>
            )}
            {['idle', 'resumo'].includes(fase) && (
              <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* IDLE */}
          {fase === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Phone className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Ligar para {contatoNome}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  A chamada abre via WaVoIP. O REFERY captura a transcrição em tempo real.
                </p>
              </div>
              {!conta?.wavoip_token && (
                <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Token WaVoIP não configurado. Configure em Configurações → Telefonia.
                </div>
              )}
              {!conta?.soniox_api_key && (
                <div className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  Sem chave Soniox — transcrição não disponível, mas a ligação funciona.
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

          {/* INICIANDO */}
          {fase === 'iniciando' && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
              <p className="text-sm text-muted-foreground">Conectando microfone e abrindo chamada...</p>
            </div>
          )}

          {/* LIGANDO */}
          {fase === 'ligando' && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2 text-sm text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Chamada em andamento na janela WaVoIP
                {transcrevendo && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-blue-600">
                    <Mic className="h-3 w-3" />transcrição ativa
                  </span>
                )}
              </div>

              {/* Transcrição */}
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Transcrição em tempo real</span>
                  {finaisCount > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{finaisCount} trechos</Badge>
                  )}
                </div>
                <ScrollArea className="h-44">
                  <div ref={scrollRef} className="p-3 space-y-1.5 text-sm">
                    {segmentos.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center italic py-4">
                        {transcrevendo ? 'Aguardando fala...' : 'Soniox não configurado — transcrição indisponível'}
                      </p>
                    )}
                    {segmentos.filter(s => s.is_final).map(s => (
                      <div key={s.id} className="flex gap-2">
                        <span className="font-semibold text-xs text-primary shrink-0">{s.speaker}:</span>
                        <span className="text-gray-800">{s.text}</span>
                      </div>
                    ))}
                    {parciais.map(s => (
                      <div key={`p-${s.id}`} className="flex gap-2 opacity-50 italic">
                        <span className="font-semibold text-xs text-primary shrink-0">{s.speaker}:</span>
                        <span className="text-gray-600">{s.text}...</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Resultado antecipado */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Resultado (selecione antes de encerrar)</p>
                <div className="flex gap-2">
                  {(['realizada', 'nao_atendeu', 'ocupado'] as StatusChamada[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setStatusChamada(r)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        statusChamada === r
                          ? r === 'realizada' ? 'bg-green-600 text-white border-green-600'
                          : r === 'nao_atendeu' ? 'bg-red-500 text-white border-red-500'
                          : 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {r === 'realizada' ? 'Atendeu' : r === 'nao_atendeu' ? 'Não atendeu' : 'Ocupado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controles */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={toggleMute}
                  disabled={!transcrevendo}
                >
                  {mutado ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-12"
                  onClick={encerrarManual}
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  Encerrar e analisar
                </Button>
              </div>
            </div>
          )}

          {/* ANALISANDO */}
          {fase === 'analisando' && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="font-medium">Analisando com IA...</p>
              <p className="text-sm text-muted-foreground">Gerando resumo da conversa</p>
            </div>
          )}

          {/* RESUMO */}
          {fase === 'resumo' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Ligação salva · {fmtDuracao(duracao)}
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
                  {getTextoFinal() ? 'Análise não disponível — verifique a chave Gemini.' : 'Nenhuma transcrição capturada.'}
                </div>
              )}

              <Button onClick={onClose} className="w-full">Fechar</Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
