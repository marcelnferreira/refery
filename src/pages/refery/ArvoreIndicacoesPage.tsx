import { ArvoreVisualizacao } from '@/components/refery/ArvoreVisualizacao';
import { useMetricas } from '@/hooks/useRefery';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, TrendingUp, Users, Award } from 'lucide-react';

export default function ArvoreIndicacoesPage() {
  const { data: m } = useMetricas();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Árvore de Indicações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualização interativa da cadeia completa de indicações. Arraste para mover, scroll para zoom.
        </p>
      </div>

      {m && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total de nós', value: m.total + (m.topClientes.length > 0 ? 0 : 0), icon: GitBranch, color: 'text-blue-600' },
            { label: 'Convertidos', value: m.porStatus.convertido, icon: Award, color: 'text-green-600' },
            { label: 'Em andamento', value: m.emAndamento, icon: TrendingUp, color: 'text-purple-600' },
            { label: 'Clientes geradores', value: m.topClientes.length, icon: Users, color: 'text-orange-600' },
          ].map(c => (
            <Card key={c.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                  <div>
                    <p className="text-xl font-bold">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ArvoreVisualizacao />

      <div className="text-xs text-muted-foreground text-center">
        <span className="inline-flex items-center gap-4">
          <span>Azul = Cliente ativo (pode gerar indicações)</span>
          <span>Branco = Indicação em andamento</span>
          <span>Verde = Convertido em cliente</span>
          <span>Cinza = Perdido</span>
        </span>
      </div>
    </div>
  );
}
