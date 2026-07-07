import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLigacoes } from '@/hooks/useRefery';
import { DetalheLigacaoModal } from '@/components/refery/DetalheLigacaoModal';
import type { Ligacao, LigacaoStatus } from '@/types/refery';
import {
  Phone, PhoneMissed, PhoneOff, Search, Clock,
  Sparkles, MessageSquareText, PhoneCall, Volume2,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_INFO: Record<LigacaoStatus, { label: string; icon: typeof Phone; cor: string }> = {
  realizada: { label: 'Atendida', icon: Phone, cor: 'bg-green-100 text-green-700 border-green-200' },
  nao_atendeu: { label: 'Não atendida', icon: PhoneMissed, cor: 'bg-red-100 text-red-600 border-red-200' },
  ocupado: { label: 'Ocupado', icon: PhoneOff, cor: 'bg-orange-100 text-orange-700 border-orange-200' },
  erro: { label: 'Erro', icon: PhoneOff, cor: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const fmtDuracao = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const fmtDataRelativa = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return `Hoje, ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Ontem, ${format(d, 'HH:mm')}`;
  return format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
};

type FiltroStatus = 'todas' | LigacaoStatus;

export default function CentralLigacoesPage() {
  const { data: ligacoes = [], isLoading } = useLigacoes();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [detalheAberto, setDetalheAberto] = useState<Ligacao | null>(null);

  const metricas = useMemo(() => {
    const total = ligacoes.length;
    const atendidas = ligacoes.filter(l => l.status === 'realizada').length;
    const naoAtendidas = ligacoes.filter(l => l.status === 'nao_atendeu').length;
    const comAnalise = ligacoes.filter(l => l.resumo_ia).length;
    const duracaoTotal = ligacoes.reduce((acc, l) => acc + (l.duracao_segundos || 0), 0);
    return { total, atendidas, naoAtendidas, comAnalise, duracaoTotal };
  }, [ligacoes]);

  const filtradas = ligacoes.filter(l => {
    const termo = busca.toLowerCase();
    const matchBusca = !termo ||
      l.contato_nome.toLowerCase().includes(termo) ||
      l.contato_telefone.includes(termo) ||
      l.resumo_ia?.toLowerCase().includes(termo);
    const matchStatus = filtroStatus === 'todas' || l.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <PhoneCall className="h-6 w-6 text-green-600" />
          Central Telefônica
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Histórico de ligações atendidas, recebidas e o que foi gravado por cada uma.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-gray-900">{metricas.total}</p>
            <p className="text-xs text-muted-foreground">Ligações no total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{metricas.atendidas}</p>
            <p className="text-xs text-muted-foreground">Atendidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-500">{metricas.naoAtendidas}</p>
            <p className="text-xs text-muted-foreground">Não atendidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{metricas.comAnalise}</p>
            <p className="text-xs text-muted-foreground">Com análise por IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou conteúdo da conversa..."
            className="pl-9"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {(['todas', 'realizada', 'nao_atendeu', 'ocupado'] as FiltroStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                filtroStatus === f
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f === 'todas' ? 'Todas' : STATUS_INFO[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {ligacoes.length === 0
              ? 'Nenhuma ligação registrada ainda.'
              : 'Nenhuma ligação encontrada com esse filtro.'}
          </div>
        ) : (
          <div className="divide-y">
            {filtradas.map(l => {
              const info = STATUS_INFO[l.status] ?? STATUS_INFO.erro;
              const StatusIcon = info.icon;
              return (
                <button
                  key={l.id}
                  onClick={() => setDetalheAberto(l)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm text-gray-600 shrink-0">
                    {l.contato_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">{l.contato_nome}</span>
                      <Badge variant="outline" className={`${info.cor} text-xs shrink-0`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {info.label}
                      </Badge>
                      {l.resumo_ia && (
                        <span title="Analisado por IA" className="shrink-0">
                          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        </span>
                      )}
                      {l.gravacao_url && (
                        <span title="Gravação disponível" className="shrink-0">
                          <Volume2 className="h-3.5 w-3.5 text-green-600" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {l.resumo_ia || l.transcricao || l.contato_telefone}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">{fmtDataRelativa(l.created_at)}</p>
                    {l.duracao_segundos > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {fmtDuracao(l.duracao_segundos)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <DetalheLigacaoModal ligacao={detalheAberto} onClose={() => setDetalheAberto(null)} />
    </div>
  );
}
