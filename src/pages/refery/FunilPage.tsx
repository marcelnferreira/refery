import { useIndicacoes } from '@/hooks/useRefery';
import { KANBAN_COLUMNS, INDICACAO_STATUS_LABELS } from '@/types/refery';
import { TrendingDown, TrendingUp, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const ETAPAS_FUNIL = [
  'novo',
  'contato_agendado',
  'reuniao_realizada',
  'proposta_enviada',
  'convertido',
] as const;

const CORES: Record<string, { bg: string; text: string; bar: string }> = {
  novo:              { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500' },
  contato_agendado:  { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500' },
  reuniao_realizada: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500' },
  proposta_enviada:  { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
  convertido:        { bg: 'bg-green-50',  text: 'text-green-700',  bar: 'bg-green-500' },
};

export default function FunilPage() {
  const { data: indicacoes = [] } = useIndicacoes();

  const totalGeral = indicacoes.length;
  const perdidos = indicacoes.filter(i => i.status === 'perdido').length;

  const contagem: Record<string, number> = {};
  for (const etapa of ETAPAS_FUNIL) {
    contagem[etapa] = indicacoes.filter(i => i.status === etapa).length;
  }

  // Conta acumulada: cada etapa inclui os que passaram por ela (os convertidos passaram por todas)
  const acumulado: Record<string, number> = {};
  for (let i = 0; i < ETAPAS_FUNIL.length; i++) {
    acumulado[ETAPAS_FUNIL[i]] = ETAPAS_FUNIL.slice(i).reduce((sum, s) => sum + contagem[s], 0);
  }

  const top = acumulado['novo'] || 1;

  const taxaConversaoGeral =
    totalGeral > 0 ? ((contagem['convertido'] / totalGeral) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Funil de Conversão</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Acompanhe quantos leads avançam em cada etapa do seu processo
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" />
              Total de leads
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalGeral}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Convertidos
            </div>
            <p className="text-2xl font-bold text-green-600">{contagem['convertido']}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-500 text-xs mb-1">
              <XCircle className="h-3.5 w-3.5" />
              Perdidos
            </div>
            <p className="text-2xl font-bold text-red-500">{perdidos}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Taxa de conversão
            </div>
            <p className="text-2xl font-bold text-blue-600">{taxaConversaoGeral}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Funil */}
      <Card className="border shadow-sm">
        <CardContent className="pt-6 pb-8">
          <div className="max-w-2xl mx-auto space-y-1">
            {ETAPAS_FUNIL.map((etapa, idx) => {
              const qtd = acumulado[etapa];
              const largura = top > 0 ? Math.max((qtd / top) * 100, 8) : 8;
              const cor = CORES[etapa];
              const proximaEtapa = ETAPAS_FUNIL[idx + 1];
              const proxQtd = proximaEtapa ? acumulado[proximaEtapa] : null;
              const taxaAvanco =
                proxQtd !== null && qtd > 0
                  ? ((proxQtd / qtd) * 100).toFixed(0)
                  : null;
              const dropoff =
                proxQtd !== null && qtd > 0 ? qtd - proxQtd : null;

              return (
                <div key={etapa}>
                  {/* Barra do funil */}
                  <div className="flex items-center gap-4">
                    {/* Label esquerda */}
                    <div className="w-36 text-right shrink-0">
                      <span className="text-xs font-medium text-gray-600">
                        {INDICACAO_STATUS_LABELS[etapa]}
                      </span>
                    </div>

                    {/* Trapézio */}
                    <div className="flex-1 flex justify-center">
                      <div
                        className={`${cor.bar} rounded-md h-10 flex items-center justify-center transition-all duration-500`}
                        style={{ width: `${largura}%`, minWidth: 60 }}
                      >
                        <span className="text-white text-sm font-bold drop-shadow-sm">
                          {qtd}
                        </span>
                      </div>
                    </div>

                    {/* Percentual direita */}
                    <div className="w-16 shrink-0">
                      <span className={`text-xs font-semibold ${cor.text}`}>
                        {top > 0 ? ((qtd / top) * 100).toFixed(0) : 0}%
                      </span>
                      <span className="text-xs text-muted-foreground"> do total</span>
                    </div>
                  </div>

                  {/* Seta de conversão entre etapas */}
                  {taxaAvanco !== null && (
                    <div className="flex items-center gap-4 my-0.5">
                      <div className="w-36" />
                      <div className="flex-1 flex justify-center">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                          {Number(taxaAvanco) >= 50 ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          )}
                          <span>
                            <span className={Number(taxaAvanco) >= 50 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                              {taxaAvanco}% avançaram
                            </span>
                            {dropoff !== null && dropoff > 0 && (
                              <span className="text-muted-foreground"> · {dropoff} saíram nesta etapa</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="w-16" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Etapa</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Leads ativos</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">No funil acumulado</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Avanço para próxima</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ETAPAS_FUNIL.map((etapa, idx) => {
                const proximaEtapa = ETAPAS_FUNIL[idx + 1];
                const proxQtd = proximaEtapa ? acumulado[proximaEtapa] : null;
                const qtdAtual = acumulado[etapa];
                const taxaAvanco =
                  proxQtd !== null && qtdAtual > 0
                    ? ((proxQtd / qtdAtual) * 100).toFixed(0) + '%'
                    : '—';
                const cor = CORES[etapa];

                return (
                  <tr key={etapa} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cor.bg} ${cor.text}`}>
                        <span className={`w-2 h-2 rounded-full ${cor.bar}`} />
                        {INDICACAO_STATUS_LABELS[etapa]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{contagem[etapa]}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{qtdAtual}</td>
                    <td className="px-4 py-3 text-center">
                      {proximaEtapa ? (
                        <span className={Number(taxaAvanco) >= 50 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                          {taxaAvanco}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">Fim do funil</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
