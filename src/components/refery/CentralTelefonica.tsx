import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useConta, useClientesAtivos, useIndicacoes, useSalvarLigacao, useUploadGravacao,
} from '@/hooks/useRefery';
import { useReferyTranscription } from '@/hooks/useReferyTranscription';
import {
  startIncomingRing, stopIncomingRing, playConnected, playHangup, disposeSounds,
} from '@/lib/callSounds';
import { startRecording, stopRecording, criarMixGravacao } from '@/lib/callRecorder';
import type { ClienteAtivo, Indicacao } from '@/types/refery';
import { toast } from 'sonner';
import {
  Phone, PhoneIncoming, PhoneOff, ChevronDown, Loader2, CheckCircle2,
  Search, User, Sparkles, Mic, MicOff, MessageSquareText,
} from 'lucide-react';

type ContatoEncontrado =
  | { tipo: 'cliente'; dado: ClienteAtivo }
  | { tipo: 'indicacao'; dado: Indicacao };

type StatusRecebida = 'realizada' | 'nao_atendeu';
type Fase = 'ocioso' | 'tocando' | 'em_chamada' | 'registrar' | 'salvo';

const soDigitos = (s: string) => s.replace(/\D/g, '');

const fmtDuracao = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function CentralTelefonica() {
  const { data: conta } = useConta();
  const { data: clientes = [] } = useClientesAtivos(false);
  const { data: indicacoes = [] } = useIndicacoes();
  const salvarLigacao = useSalvarLigacao();
  const uploadGravacao = useUploadGravacao();
  const { segmentos, transcrevendo, erro: erroTranscricao, iniciarTranscricao, pararTranscricao, getTextoFinal } = useReferyTranscription();

  const [expandido, setExpandido] = useState(false);
  const [fase, setFase] = useState<Fase>('ocioso');
  const [deviceStatus, setDeviceStatus] = useState<string>('conectando');
  const [peerInfo, setPeerInfo] = useState<{ nome: string | null; telefone: string }>({ nome: null, telefone: '' });
  const [duracao, setDuracao] = useState(0);
  const [mutado, setMutado] = useState(false);

  // Registro pós-chamada
  const [buscaContato, setBuscaContato] = useState('');
  const [contatoSelecionado, setContatoSelecionado] = useState<ContatoEncontrado | null>(null);
  const [telefoneManual, setTelefoneManual] = useState('');
  const [nomeManual, setNomeManual] = useState('');
  const [statusRecebida, setStatusRecebida] = useState<StatusRecebida>('realizada');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [gravacaoUrlPronta, setGravacaoUrlPronta] = useState<string | null>(null);

  const wavoipRef = useRef<any>(null);
  const offerRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const duracaoRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const gravacaoUploadRef = useRef<Promise<string | null> | null>(null);

  const token = conta?.wavoip_token;
  const sonioxKey = conta?.soniox_api_key;

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

  const tentarCasarContato = useCallback((telefone: string): ContatoEncontrado | null => {
    const digitos = soDigitos(telefone);
    if (digitos.length < 8) return null;
    const sufixo = digitos.slice(-8);
    const cliente = clientes.find(c => soDigitos(c.telefone).endsWith(sufixo));
    if (cliente) return { tipo: 'cliente', dado: cliente };
    const indicacao = indicacoes.find(i => soDigitos(i.telefone).endsWith(sufixo));
    if (indicacao) return { tipo: 'indicacao', dado: indicacao };
    return null;
  }, [clientes, indicacoes]);

  // Inicializa o SDK WaVoIP uma única vez (persiste entre navegações de página)
  useEffect(() => {
    if (!token || initRef.current) return;
    initRef.current = true;

    let statusInterval: NodeJS.Timeout | null = null;

    (async () => {
      try {
        const { Wavoip } = await import('@wavoip/wavoip-api');
        const wavoip = new Wavoip({ tokens: [token] });
        wavoipRef.current = wavoip;

        const checkStatus = () => {
          const devices = (wavoip as any).devices ?? [];
          if (devices.length > 0) setDeviceStatus(devices[0].status ?? 'desconhecido');
        };
        statusInterval = setInterval(checkStatus, 4000);
        setTimeout(checkStatus, 1500);

        wavoip.onOffer((offer: any) => {
          offerRef.current = offer;
          const telefone = offer?.peer?.phone ?? '';
          const nome = offer?.peer?.displayName ?? null;
          setPeerInfo({ nome, telefone });
          setFase('tocando');
          setExpandido(true);
          startIncomingRing();

          offer.on('ended', () => {
            if (offerRef.current === offer) {
              stopIncomingRing();
              setFase('ocioso');
            }
          });
          offer.on('rejectedElsewhere', () => {
            if (offerRef.current === offer) {
              stopIncomingRing();
              setFase('ocioso');
            }
          });
        });
      } catch (err) {
        console.error('[CentralTelefonica] erro ao iniciar SDK:', err);
        setDeviceStatus('erro');
      }
    })();

    return () => {
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [token]);

  // Cleanup geral ao desmontar (fecha o app inteiro)
  useEffect(() => {
    return () => {
      pararTimer();
      pararTranscricao();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      disposeSounds();
    };
  }, [pararTimer, pararTranscricao]);

  const prepararRegistro = useCallback((telefone: string, nome: string | null) => {
    const match = tentarCasarContato(telefone);
    if (match) {
      setContatoSelecionado(match);
      setBuscaContato(match.dado.nome);
      setNomeManual(match.dado.nome);
      setTelefoneManual(match.dado.telefone);
    } else {
      setContatoSelecionado(null);
      setBuscaContato(nome ?? '');
      setNomeManual(nome ?? '');
      setTelefoneManual(telefone);
    }
  }, [tentarCasarContato]);

  const finalizarChamada = useCallback(async (status: StatusRecebida) => {
    playHangup();
    pararTimer();
    pararTranscricao();

    // Encerra a gravação (mix local + remoto) antes de soltar o microfone
    let gravacaoBlob: Blob | null = null;
    if (recorderRef.current) {
      try { gravacaoBlob = await stopRecording(recorderRef.current); } catch {}
      recorderRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    activeCallRef.current = null;

    setGravacaoUrlPronta(null);
    if (gravacaoBlob && gravacaoBlob.size > 0) {
      const promise = uploadGravacao.mutateAsync(gravacaoBlob)
        .then(url => { setGravacaoUrlPronta(url); return url; })
        .catch(() => null);
      gravacaoUploadRef.current = promise;
    } else {
      gravacaoUploadRef.current = null;
    }

    prepararRegistro(peerInfo.telefone, peerInfo.nome);
    setStatusRecebida(status);
    setFase('registrar');
  }, [pararTimer, pararTranscricao, peerInfo, prepararRegistro, uploadGravacao]);

  const atender = async () => {
    const offer = offerRef.current;
    if (!offer) return;
    stopIncomingRing();

    try {
      const { call, err } = await offer.accept();
      if (err || !call) {
        toast.error('Não foi possível atender: ' + (err ?? 'erro desconhecido'));
        setFase('ocioso');
        return;
      }
      activeCallRef.current = call;
      playConnected();
      iniciarTimer();
      setFase('em_chamada');

      // Grava a ligação completa (local + remoto) misturando os AnalyserNodes
      // que o SDK do WaVoIP expõe no objeto da chamada ativa
      try {
        const mixStream = criarMixGravacao([call.audioAnalyserIn, call.audioAnalyserOut]);
        if (mixStream) recorderRef.current = startRecording(mixStream);
      } catch {
        // Sem gravação se o navegador não suportar — a ligação continua normalmente
      }

      // Captura mic separado para transcrição (independente do áudio da própria chamada)
      if (sonioxKey) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          micStreamRef.current = micStream;
          await iniciarTranscricao(micStream, sonioxKey, peerInfo.nome ?? peerInfo.telefone);
        } catch {
          // Sem transcrição se o microfone falhar — a ligação continua normalmente
        }
      }

      call.on('ended', () => finalizarChamada('realizada'));
      call.onError?.(() => finalizarChamada('realizada'));
    } catch (e: any) {
      toast.error('Erro ao atender: ' + (e?.message ?? 'desconhecido'));
      setFase('ocioso');
    }
  };

  const recusar = async () => {
    const offer = offerRef.current;
    stopIncomingRing();
    try { await offer?.reject(); } catch {}
    prepararRegistro(peerInfo.telefone, peerInfo.nome);
    setStatusRecebida('nao_atendeu');
    setFase('registrar');
  };

  const encerrarManual = () => {
    try { activeCallRef.current?.end?.(); } catch {}
    finalizarChamada('realizada');
  };

  const toggleMute = () => {
    if (!micStreamRef.current) return;
    const track = micStreamRef.current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMutado(!track.enabled);
  };

  const resultadosBusca = useMemo(() => {
    const termo = buscaContato.trim().toLowerCase();
    if (!termo || contatoSelecionado) return [];
    const termoDigitos = soDigitos(termo);
    const todos: ContatoEncontrado[] = [
      ...clientes.map(c => ({ tipo: 'cliente' as const, dado: c })),
      ...indicacoes.map(i => ({ tipo: 'indicacao' as const, dado: i })),
    ];
    return todos.filter(c => {
      const nomeMatch = c.dado.nome.toLowerCase().includes(termo);
      const telMatch = termoDigitos.length >= 3 && soDigitos(c.dado.telefone).includes(termoDigitos);
      return nomeMatch || telMatch;
    }).slice(0, 6);
  }, [buscaContato, contatoSelecionado, clientes, indicacoes]);

  const selecionarContato = (c: ContatoEncontrado) => {
    setContatoSelecionado(c);
    setBuscaContato(c.dado.nome);
    setNomeManual(c.dado.nome);
    setTelefoneManual(c.dado.telefone);
  };

  const limparTudo = () => {
    setBuscaContato(''); setContatoSelecionado(null); setTelefoneManual('');
    setNomeManual(''); setStatusRecebida('realizada'); setObservacoes('');
    setFase('ocioso'); setPeerInfo({ nome: null, telefone: '' }); setGravacaoUrlPronta(null);
  };

  const podeSalvar = !!(contatoSelecionado || (nomeManual.trim() && telefoneManual.trim()));

  const salvarRegistro = async () => {
    if (!podeSalvar) { toast.error('Informe ao menos nome e telefone do contato.'); return; }
    setSalvando(true);

    const contatoId = contatoSelecionado?.dado.id ?? `manual-${soDigitos(telefoneManual)}`;
    const contatoTipo = contatoSelecionado?.tipo ?? 'indicacao';
    const contatoNome = contatoSelecionado?.dado.nome ?? nomeManual.trim();
    const contatoTelefone = contatoSelecionado?.dado.telefone ?? telefoneManual.trim();
    const textoTranscricao = getTextoFinal();

    let analiseResult: any = null;
    const textoParaAnalise = observacoes.trim() || textoTranscricao;
    if (statusRecebida === 'realizada' && textoParaAnalise.trim()) {
      try {
        const res = await fetch('/api/analyze-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcricao: textoParaAnalise,
            contato_nome: contatoNome,
            contato_tipo: contatoTipo,
          }),
        });
        if (res.ok) analiseResult = await res.json();
      } catch {}
    }

    const gravacaoUrl = gravacaoUrlPronta ?? (gravacaoUploadRef.current ? await gravacaoUploadRef.current : null);

    try {
      await salvarLigacao.mutateAsync({
        contato_id: contatoId,
        contato_tipo: contatoTipo,
        contato_nome: contatoNome,
        contato_telefone: contatoTelefone,
        status: statusRecebida,
        duracao_segundos: duracaoRef.current,
        transcricao: (observacoes.trim() ? `${observacoes.trim()}\n\n${textoTranscricao}` : textoTranscricao) || null,
        gravacao_url: gravacaoUrl,
        resumo_ia: analiseResult?.resumo ?? null,
        pontos_chave: analiseResult?.pontos_chave ?? [],
        proxima_acao: analiseResult?.proxima_acao ?? null,
      });
      setFase('salvo');
      setTimeout(limparTudo, 2000);
    } finally {
      setSalvando(false);
    }
  };

  if (!token) return null;

  const finaisCount = segmentos.filter(s => s.is_final).length;
  const parciais = segmentos.filter(s => !s.is_final);
  const statusCor = deviceStatus === 'open' ? 'bg-emerald-400' : deviceStatus === 'erro' ? 'bg-red-400' : 'bg-amber-400';
  const statusLabel = deviceStatus === 'open' ? 'online' : deviceStatus === 'erro' ? 'erro' : 'conectando';

  return (
    <>
      {/* Bolha flutuante */}
      {!expandido && (
        <button
          onClick={() => setExpandido(true)}
          title="Central Telefônica — receber ligações"
          className={`fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 ${
            fase === 'tocando' ? 'bg-green-600 animate-bounce' : 'bg-gray-800'
          }`}
        >
          <PhoneIncoming className="h-6 w-6" />
          <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusCor} ${fase === 'tocando' ? 'animate-ping' : 'animate-pulse'}`} />
        </button>
      )}

      {/* Painel expandido */}
      <div
        className={`fixed z-40 bottom-5 right-5 w-[380px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          expandido ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-y-2'
        }`}
      >
        {/* Header */}
        <div className={`px-4 py-3 text-white flex items-center justify-between flex-shrink-0 transition-colors ${
          fase === 'tocando' ? 'bg-green-600' : fase === 'em_chamada' ? 'bg-green-700' : 'bg-gray-900'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <PhoneIncoming className="h-4 w-4 shrink-0" />
            <span className="font-semibold text-sm truncate">
              {fase === 'tocando' ? (peerInfo.nome || peerInfo.telefone || 'Chamando...')
                : fase === 'em_chamada' ? (peerInfo.nome || peerInfo.telefone)
                : 'Central Telefônica'}
            </span>
            {fase === 'ocioso' && (
              <span className="flex items-center gap-1 text-xs bg-white/10 rounded-full px-2 py-0.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${statusCor} animate-pulse`} />
                {statusLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fase === 'em_chamada' && <span className="text-sm font-mono font-bold">{fmtDuracao(duracao)}</span>}
            {['ocioso', 'registrar', 'salvo'].includes(fase) && (
              <button onClick={() => setExpandido(false)} className="p-1 rounded-full hover:bg-white/10">
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto">

          {/* ---- OCIOSO ---- */}
          {fase === 'ocioso' && (
            <div className="p-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <Phone className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                Aguardando ligações. Deixe esta janela aberta para ouvir o toque quando alguém ligar.
              </p>
            </div>
          )}

          {/* ---- TOCANDO ---- */}
          {fase === 'tocando' && (
            <div className="p-5 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto animate-pulse">
                <PhoneIncoming className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{peerInfo.nome || 'Número desconhecido'}</p>
                <p className="text-sm text-muted-foreground">{peerInfo.telefone}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 text-red-600 border-red-200 hover:bg-red-50" onClick={recusar}>
                  <PhoneOff className="h-4 w-4 mr-1.5" />
                  Recusar
                </Button>
                <Button className="h-12 bg-green-600 hover:bg-green-700" onClick={atender}>
                  <Phone className="h-4 w-4 mr-1.5" />
                  Atender
                </Button>
              </div>
            </div>
          )}

          {/* ---- EM CHAMADA ---- */}
          {fase === 'em_chamada' && (
            <div className="p-4 space-y-3">
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Transcrição em tempo real</span>
                  {transcrevendo && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />}
                  {finaisCount > 0 && <Badge variant="secondary" className="ml-auto text-xs">{finaisCount} trechos</Badge>}
                </div>
                <ScrollArea className="h-40">
                  <div ref={scrollRef} className="p-3 space-y-1.5 text-sm">
                    {erroTranscricao && (
                      <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 mb-1.5">
                        {erroTranscricao}
                      </p>
                    )}
                    {segmentos.length === 0 && !erroTranscricao && (
                      <p className="text-xs text-muted-foreground text-center italic py-6">
                        {transcrevendo ? 'Aguardando fala...' : sonioxKey ? 'Conectando à transcrição...' : 'Chave Soniox não configurada'}
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
              <div className="flex gap-3">
                <Button
                  variant="outline" size="icon" className="h-11 w-11 rounded-full flex-shrink-0"
                  onClick={toggleMute} disabled={!transcrevendo}
                >
                  {mutado ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button variant="destructive" className="flex-1 h-11" onClick={encerrarManual}>
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Encerrar e analisar
                </Button>
              </div>
            </div>
          )}

          {/* ---- REGISTRAR ---- */}
          {fase === 'registrar' && (
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2">
                Confirme o contato e registre o resultado da ligação recebida.
              </div>

              {statusRecebida === 'realizada' && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {gravacaoUrlPronta ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Gravação da ligação salva</>
                  ) : (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando gravação da ligação...</>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Quem ligou?</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Buscar por nome ou telefone..."
                    value={buscaContato}
                    onChange={e => { setBuscaContato(e.target.value); setContatoSelecionado(null); setNomeManual(e.target.value); }}
                  />
                </div>
                {resultadosBusca.length > 0 && (
                  <div className="border rounded-lg overflow-hidden divide-y">
                    {resultadosBusca.map(c => (
                      <button
                        key={`${c.tipo}-${c.dado.id}`}
                        onClick={() => selecionarContato(c)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{c.dado.nome}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{c.dado.telefone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {contatoSelecionado && (
                  <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {contatoSelecionado.dado.nome} · {contatoSelecionado.dado.telefone}
                    <button onClick={() => { setContatoSelecionado(null); setBuscaContato(''); }} className="ml-auto underline">trocar</button>
                  </div>
                )}
              </div>

              {!contatoSelecionado && buscaContato.trim() && resultadosBusca.length === 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Telefone</label>
                  <Input className="h-9 text-sm" placeholder="(71) 99999-9999" value={telefoneManual} onChange={e => setTelefoneManual(e.target.value)} />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Resultado</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatusRecebida('realizada')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusRecebida === 'realizada' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                  >
                    Atendida
                  </button>
                  <button
                    onClick={() => setStatusRecebida('nao_atendeu')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusRecebida === 'nao_atendeu' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                  >
                    Perdida
                  </button>
                </div>
              </div>

              {statusRecebida === 'realizada' && !getTextoFinal() && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Resumo da conversa (opcional)
                  </label>
                  <Textarea
                    placeholder="Anote o que foi falado — a IA gera a análise automaticamente..."
                    rows={3} className="text-sm" value={observacoes} onChange={e => setObservacoes(e.target.value)}
                  />
                </div>
              )}

              <Button onClick={salvarRegistro} disabled={!podeSalvar || salvando} className="w-full">
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Registrar ligação
              </Button>
            </div>
          )}

          {/* ---- SALVO ---- */}
          {fase === 'salvo' && (
            <div className="p-6 text-center">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-3 text-sm justify-center">
                <CheckCircle2 className="h-4 w-4" />
                Ligação registrada!
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
