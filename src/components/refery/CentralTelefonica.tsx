import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  useConta, useClientesAtivos, useIndicacoes, useSalvarLigacao,
} from '@/hooks/useRefery';
import type { ClienteAtivo, Indicacao } from '@/types/refery';
import { toast } from 'sonner';
import {
  Phone, PhoneIncoming, ChevronDown, Loader2, CheckCircle2,
  Search, User, Sparkles,
} from 'lucide-react';

type ContatoEncontrado =
  | { tipo: 'cliente'; dado: ClienteAtivo }
  | { tipo: 'indicacao'; dado: Indicacao };

type StatusRecebida = 'realizada' | 'nao_atendeu';

const soDigitos = (s: string) => s.replace(/\D/g, '');

export function CentralTelefonica() {
  const { data: conta } = useConta();
  const { data: clientes = [] } = useClientesAtivos(false);
  const { data: indicacoes = [] } = useIndicacoes();
  const salvarLigacao = useSalvarLigacao();

  const [expandido, setExpandido] = useState(false);

  // Registro manual da ligação recebida (não temos como capturar o número
  // automaticamente pois a chamada roda dentro do app do WaVoIP, em outra origem)
  const [buscaContato, setBuscaContato] = useState('');
  const [contatoSelecionado, setContatoSelecionado] = useState<ContatoEncontrado | null>(null);
  const [telefoneManual, setTelefoneManual] = useState('');
  const [nomeManual, setNomeManual] = useState('');
  const [statusRecebida, setStatusRecebida] = useState<StatusRecebida>('realizada');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const resultadosBusca = useMemo(() => {
    const termo = buscaContato.trim().toLowerCase();
    if (!termo) return [];
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
  }, [buscaContato, clientes, indicacoes]);

  if (!conta?.wavoip_token) return null;

  const selecionarContato = (c: ContatoEncontrado) => {
    setContatoSelecionado(c);
    setBuscaContato(c.dado.nome);
    setNomeManual(c.dado.nome);
    setTelefoneManual(c.dado.telefone);
  };

  const limparRegistro = () => {
    setBuscaContato('');
    setContatoSelecionado(null);
    setTelefoneManual('');
    setNomeManual('');
    setStatusRecebida('realizada');
    setObservacoes('');
    setSalvo(false);
  };

  const podeSalvar = (contatoSelecionado || (nomeManual.trim() && telefoneManual.trim()));

  const salvarChamadaRecebida = async () => {
    if (!podeSalvar) { toast.error('Informe ao menos nome e telefone do contato.'); return; }
    setSalvando(true);

    const contatoId = contatoSelecionado?.dado.id ?? `manual-${soDigitos(telefoneManual)}`;
    const contatoTipo = contatoSelecionado?.tipo ?? 'indicacao';
    const contatoNome = contatoSelecionado?.dado.nome ?? nomeManual.trim();
    const contatoTelefone = contatoSelecionado?.dado.telefone ?? telefoneManual.trim();

    let analiseResult: any = null;
    if (statusRecebida === 'realizada' && observacoes.trim()) {
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

    try {
      await salvarLigacao.mutateAsync({
        contato_id: contatoId,
        contato_tipo: contatoTipo,
        contato_nome: contatoNome,
        contato_telefone: contatoTelefone,
        status: statusRecebida,
        duracao_segundos: 0,
        transcricao: observacoes.trim() || null,
        resumo_ia: analiseResult?.resumo ?? null,
        pontos_chave: analiseResult?.pontos_chave ?? [],
        proxima_acao: analiseResult?.proxima_acao ?? null,
      });
      setSalvo(true);
      setTimeout(limparRegistro, 2000);
    } finally {
      setSalvando(false);
    }
  };

  const listenUrl = `https://app.wavoip.com/call?${new URLSearchParams({
    token: conta.wavoip_token,
    available_after_call: 'true',
  })}`;

  return (
    <>
      {/* Bolha flutuante (estado minimizado) */}
      {!expandido && (
        <button
          onClick={() => setExpandido(true)}
          title="Central Telefônica — receber ligações"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        >
          <PhoneIncoming className="h-6 w-6" />
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Painel expandido */}
      <div
        className={`fixed z-40 bottom-5 right-5 w-[380px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          expandido ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-y-2'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4 text-green-400" />
            <span className="font-semibold text-sm">Central Telefônica</span>
            <span className="flex items-center gap-1 text-xs bg-white/10 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              online
            </span>
          </div>
          <button onClick={() => setExpandido(false)} className="p-1 rounded-full hover:bg-white/10">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* iframe do WaVoIP: sempre montado (mesmo quando o painel está minimizado)
            para manter o dispositivo online e tocar o toque de chamada recebida */}
        <iframe
          src={listenUrl}
          allow="microphone; autoplay; speaker-selection"
          className="w-full h-[260px] border-0 bg-gray-950 flex-shrink-0"
          title="WaVoIP — chamadas"
        />

        <div className="p-3 text-xs text-muted-foreground bg-amber-50 border-y flex items-start gap-1.5">
          <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
          Quando uma ligação chegar, atenda aqui em cima. Depois registre abaixo para salvar no histórico e gerar a análise por IA.
        </div>

        {/* Registro manual da ligação recebida */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {salvo ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-3 text-sm justify-center">
              <CheckCircle2 className="h-4 w-4" />
              Ligação registrada!
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Quem ligou?</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Buscar por nome ou telefone..."
                    value={buscaContato}
                    onChange={e => {
                      setBuscaContato(e.target.value);
                      setContatoSelecionado(null);
                      setNomeManual(e.target.value);
                    }}
                  />
                </div>
                {resultadosBusca.length > 0 && !contatoSelecionado && (
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
                    <button onClick={() => { setContatoSelecionado(null); setBuscaContato(''); }} className="ml-auto underline">
                      trocar
                    </button>
                  </div>
                )}
              </div>

              {!contatoSelecionado && buscaContato.trim() && resultadosBusca.length === 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Telefone (contato não encontrado)</label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="(71) 99999-9999"
                    value={telefoneManual}
                    onChange={e => setTelefoneManual(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Resultado</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatusRecebida('realizada')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      statusRecebida === 'realizada'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    Atendida
                  </button>
                  <button
                    onClick={() => setStatusRecebida('nao_atendeu')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      statusRecebida === 'nao_atendeu'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    Perdida
                  </button>
                </div>
              </div>

              {statusRecebida === 'realizada' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Resumo da conversa (opcional)
                  </label>
                  <Textarea
                    placeholder="Anote o que foi falado — a IA gera a análise automaticamente..."
                    rows={3}
                    className="text-sm"
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                  />
                </div>
              )}

              <Button
                onClick={salvarChamadaRecebida}
                disabled={!podeSalvar || salvando}
                className="w-full"
              >
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Registrar ligação
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
