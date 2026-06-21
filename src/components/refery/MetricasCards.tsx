import { useMetricas } from '@/hooks/useRefery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Target, AlertTriangle, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function MetricasCards() {
  const { data: m, isLoading } = useMetricas();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!m) return null;

  const cards = [
    {
      title: 'Total de Indicações',
      value: m.total,
      sub: `+${m.novos} esta semana`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Taxa de Conversão',
      value: `${m.taxaConversao}%`,
      sub: `${m.convertidos} convertidos`,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Em Andamento',
      value: m.emAndamento,
      sub: `${m.perdidos} perdidos`,
      icon: Target,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Clientes sem contato',
      value: m.clientesSemIndicacaoRecente,
      sub: 'há mais de 30 dias',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.title} className="border-0 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{c.title}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
                </div>
                <div className={`p-2 rounded-lg ${c.bg}`}>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funil visual */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Funil de Indicações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: 'Novo', value: m.porStatus.novo, color: 'bg-blue-500' },
              { label: 'Contato Agendado', value: m.porStatus.contato_agendado, color: 'bg-yellow-500' },
              { label: 'Reunião Realizada', value: m.porStatus.reuniao_realizada, color: 'bg-purple-500' },
              { label: 'Proposta Enviada', value: m.porStatus.proposta_enviada, color: 'bg-orange-500' },
              { label: 'Convertido', value: m.porStatus.convertido, color: 'bg-green-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-36 shrink-0">{item.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${item.color}`}
                    style={{ width: m.total > 0 ? `${(item.value / m.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-medium w-6 text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top clientes */}
      {m.topClientes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Top Clientes por Indicações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {m.topClientes.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone}</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{c.total_indicacoes}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
