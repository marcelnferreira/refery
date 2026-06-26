import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useConta, useSalvarLigacao } from '@/hooks/useRefery';
import { toast } from 'sonner';
import { Phone, Loader2, CheckCircle2, X, ExternalLink } from 'lucide-react';

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

type Fase = 'idle' | 'ligando' | 'resumo';
type Resultado = 'realizada' | 'nao_atendeu' | 'ocupado';

export default function LigacaoModal({ contatoId, contatoTipo, contatoNome, contatoTelefone, onClose }: Props) {
  const { data: conta } = useConta();
  const salvarLigacao = useSalvarLigacao();

  const [fase, setFase] = useState<Fase>('idle');
  const [resultado, setResultado] = useState<Resultado>('realizada');
  const [observacoes, setObservacoes] = useState('');
  const [duracao, setDuracao] = useState('');
  const [analise, setAnalise] = useState<any>(null);
  const [analisando, setAnalisando] = useState(false);

  const abrirChamada = () => {
    if (!conta?.wavoip_token) {
      toast.error('Token WaVoIP não configurado. Configure em Configurações → Telefonia.');
      return;
    }

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
      return;
    }

    win.focus();
    setFase('ligando');
  };

  const registrarResultado = async () => {
    const duracaoSeg = duracao ? parseInt(duracao) * 60 : 0;
    setAnalisando(true);

    let analiseResult = null;
    if (resultado === 'realizada' && observacoes.trim()) {
      try {
        const res = await fetch('/api/analyze-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcricao: observacoes,
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
      status: resultado,
      duracao_segundos: duracaoSeg,
      transcricao: observacoes || null,
      resumo_ia: analiseResult?.resumo ?? null,
      pontos_chave: analiseResult?.pontos_chave ?? [],
      proxima_acao: analiseResult?.proxima_acao ?? null,
    });

    setAnalise(analiseResult);
    setAnalisando(false);
    setFase('resumo');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${
          fase === 'ligando' ? 'bg-yellow-500 text-white' :
          fase === 'resumo' ? 'bg-green-600 text-white' :
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
          {['idle', 'resumo'].includes(fase) && (
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

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
                  Abre a chamada WaVoIP em uma janela separada.
                </p>
              </div>
              {!conta?.wavoip_token && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Token WaVoIP não configurado. Configure em Configurações → Telefonia.
                </div>
              )}
              <Button onClick={abrirChamada} className="bg-green-600 hover:bg-green-700 w-full" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir chamada WaVoIP
              </Button>
            </div>
          )}

          {/* LIGANDO → aguarda o usuário registrar */}
          {fase === 'ligando' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Chamada aberta na janela WaVoIP. Quando terminar, registre o resultado abaixo.
              </div>

              {/* Resultado */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Resultado da ligação</p>
                <div className="flex gap-2">
                  {(['realizada', 'nao_atendeu', 'ocupado'] as Resultado[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setResultado(r)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        resultado === r
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

              {resultado === 'realizada' && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Duração (minutos)</p>
                    <input
                      type="number"
                      min="0"
                      className="w-full border rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Ex: 5"
                      value={duracao}
                      onChange={e => setDuracao(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Observações da conversa</p>
                    <Textarea
                      placeholder="Resuma o que foi conversado — a IA vai gerar análise com base nisso..."
                      rows={4}
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button
                onClick={registrarResultado}
                disabled={analisando}
                className="w-full"
              >
                {analisando ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando com IA...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Salvar ligação</>
                )}
              </Button>
            </div>
          )}

          {/* RESUMO */}
          {fase === 'resumo' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Ligação salva no histórico.
              </div>

              {analise ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo IA</p>
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
                        {analise.data_agendamento} {analise.hora_agendamento && `às ${analise.hora_agendamento}`}
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
                  Ligação registrada sem análise de IA.
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
