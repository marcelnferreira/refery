import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConta, useSalvarLigacao } from '@/hooks/useRefery';
import { useReferyWavoip } from '@/hooks/useReferyWavoip';
import { useReferyTranscription } from '@/hooks/useReferyTranscription';
import { toast } from 'sonner';
import {
  Phone, PhoneOff, Mic, MicOff, Loader2,
  FileText, CheckCircle2, AlertCircle, X, Sparkles,
} from 'lucide-react';

interface Props {
  contatoId: string;
  contatoTipo: 'cliente' | 'indicacao';
  contatoNome: string;
  contatoTelefone: string;
  onClose: () => void;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

export default function LigacaoModal({ contatoId, contatoTipo, contatoNome, contatoTelefone, onClose }: Props) {
  const { data: conta } = useConta();
  const wavoip = useReferyWavoip();
  const transcricao = useReferyTranscription();
  const salvarLigacao = useSalvarLigacao();

  const [fase, setFase] = useState<'idle' | 'chamando' | 'conectado' | 'encerrado' | 'analisando' | 'resumo'>('idle');
  const [analise, setAnalise] = useState<any>(null);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [duracaoFinal, setDuracaoFinal] = useState(0);

  const micStreamRef = useRef<MediaStream | null>(null);
  const transcricaoRef = useRef(transcricao);
  transcricaoRef.current = transcricao;

  // Detecta mudanças de status do WaVoIP
  useEffect(() => {
    if (wavoip.status === 'connected' && fase === 'chamando') {
      setFase('conectado');
      // Inicia transcrição com microfone
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        micStreamRef.current = stream;
        const sonioxKey = conta?.soniox_api_key ?? '';
        transcricao.iniciarTranscricao(stream, sonioxKey, contatoNome);
      }).catch(() => {
        toast.error('Não foi possível acessar o microfone para transcrição.');
      });
    }

    if (wavoip.status === 'ended' && fase === 'conectado') {
      handleCallEnded();
    }

    if (['rejected', 'unanswered', 'error'].includes(wavoip.status) && fase === 'chamando') {
      setFase('idle');
    }
  }, [wavoip.status]);

  const handleCallEnded = async () => {
    setDuracaoFinal(wavoip.callDuration);
    transcricaoRef.current.pararTranscricao();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    const textoFinal = transcricaoRef.current.getTextoFinal();

    // Salva no Firestore sem análise primeiro
    setFase('analisando');

    let analiseResult = null;
    try {
      if (textoFinal.trim()) {
        const res = await fetch('/api/analyze-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcricao: textoFinal,
            contato_nome: contatoNome,
            contato_tipo: contatoTipo,
          }),
        });
        if (res.ok) analiseResult = await res.json();
        else setErroAnalise('Não foi possível gerar análise.');
      }
    } catch {
      setErroAnalise('Erro ao conectar com a IA.');
    }

    setAnalise(analiseResult);

    // Salva ligação no Firestore
    await salvarLigacao.mutateAsync({
      contato_id: contatoId,
      contato_tipo: contatoTipo,
      contato_nome: contatoNome,
      contato_telefone: contatoTelefone,
      status: 'realizada',
      duracao_segundos: wavoip.callDuration,
      transcricao: textoFinal || null,
      resumo_ia: analiseResult?.resumo ?? null,
      pontos_chave: analiseResult?.pontos_chave ?? [],
      proxima_acao: analiseResult?.proxima_acao ?? null,
    });

    setFase('resumo');
  };

  const iniciarChamada = () => {
    if (!conta?.wavoip_token) {
      toast.error('Token WaVoIP não configurado. Configure em Configurações → Telefonia.');
      return;
    }
    setFase('chamando');
    wavoip.startCall(contatoTelefone, conta.wavoip_token);
  };

  const encerrarChamada = async () => {
    await wavoip.endCall();
  };

  const segmentosFinais = transcricao.segmentos.filter(s => s.is_final);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${
          fase === 'conectado' ? 'bg-green-600 text-white' :
          fase === 'chamando' ? 'bg-yellow-500 text-white' :
          fase === 'analisando' ? 'bg-blue-600 text-white' :
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
          <div className="flex items-center gap-3">
            {fase === 'conectado' && (
              <span className="text-sm font-mono bg-white/20 px-2 py-0.5 rounded">
                {formatDuration(wavoip.callDuration)}
              </span>
            )}
            {['idle', 'resumo'].includes(fase) && (
              <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* IDLE */}
          {fase === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Phone className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Ligar para {contatoNome}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  A ligação será gravada e analisada pela IA automaticamente.
                </p>
              </div>
              {!conta?.wavoip_token && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Token WaVoIP não configurado. Vá em Configurações → Telefonia.
                </div>
              )}
              {!conta?.soniox_api_key && (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Soniox não configurado. Transcrição não estará disponível.
                </div>
              )}
              <Button onClick={iniciarChamada} className="bg-green-600 hover:bg-green-700 w-full" size="lg">
                <Phone className="h-4 w-4 mr-2" />
                Iniciar ligação
              </Button>
            </div>
          )}

          {/* CHAMANDO */}
          {fase === 'chamando' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
                <Loader2 className="h-8 w-8 text-yellow-600 animate-spin" />
              </div>
              <p className="text-gray-600">
                {wavoip.status === 'connecting' ? 'Conectando...' : 'Chamando...'}
              </p>
              <Button variant="destructive" onClick={encerrarChamada} className="w-full">
                <PhoneOff className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          )}

          {/* CONECTADO */}
          {fase === 'conectado' && (
            <div className="space-y-3">
              {/* Transcrição em tempo real */}
              <div className="bg-gray-50 rounded-xl p-3 min-h-[140px] max-h-[200px] overflow-y-auto space-y-1.5">
                {segmentosFinais.length === 0 && !transcricao.transcrevendo ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {conta?.soniox_api_key ? 'Iniciando transcrição...' : 'Soniox não configurado — transcrição indisponível.'}
                  </p>
                ) : segmentosFinais.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 animate-pulse">
                    Ouvindo...
                  </p>
                ) : (
                  segmentosFinais.map(s => (
                    <p key={s.id} className="text-xs">
                      <span className="font-semibold text-gray-600">{s.speaker}: </span>
                      <span className="text-gray-800">{s.text}</span>
                    </p>
                  ))
                )}
              </div>

              {/* Controles */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={wavoip.toggleMute}
                  className={`flex-1 ${wavoip.isMuted ? 'border-red-300 text-red-600' : ''}`}
                >
                  {wavoip.isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {wavoip.isMuted ? 'Mudo' : 'Microfone'}
                </Button>
                <Button variant="destructive" onClick={encerrarChamada} className="flex-1">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              </div>
            </div>
          )}

          {/* ANALISANDO */}
          {fase === 'analisando' && (
            <div className="text-center space-y-3 py-6">
              <Sparkles className="h-10 w-10 text-blue-500 mx-auto animate-pulse" />
              <p className="font-medium text-gray-900">Analisando a ligação...</p>
              <p className="text-sm text-muted-foreground">A IA está gerando o resumo e pontos-chave.</p>
            </div>
          )}

          {/* RESUMO */}
          {fase === 'resumo' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Ligação de {formatDuration(duracaoFinal)} salva no histórico.
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
                        {analise.data_agendamento && `Data: ${analise.data_agendamento}`}
                        {analise.hora_agendamento && ` às ${analise.hora_agendamento}`}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${
                      analise.interesse === 'alto' ? 'bg-green-100 text-green-700' :
                      analise.interesse === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                      analise.interesse === 'baixo' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      Interesse {analise.interesse ?? 'não avaliado'}
                    </Badge>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground bg-gray-50 rounded-lg px-3 py-3">
                  {erroAnalise ?? 'Nenhuma transcrição disponível — ligação salva sem análise de IA.'}
                </div>
              )}

              <Button onClick={onClose} className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
