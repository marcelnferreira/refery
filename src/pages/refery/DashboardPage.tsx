import { MetricasCards } from '@/components/refery/MetricasCards';
import { useConta } from '@/hooks/useRefery';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { format, nextFriday, isThursday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { data: conta } = useConta();
  const hoje = new Date();
  const ehQuinta = isThursday(hoje);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Bem-vindo, {conta?.nome_life_planner || 'Life Planner'} — {format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Alerta quinta-feira */}
      {ehQuinta && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">Hora de montar a agenda da sexta!</p>
              <p className="text-xs text-orange-600 mt-0.5">
                As ligações são amanhã. Monte a lista de indicações e envie os avisos para os clientes.
              </p>
            </div>
            <Link
              to="/agenda"
              className="text-xs font-medium text-orange-700 border border-orange-300 rounded-lg px-3 py-1.5 hover:bg-orange-100 whitespace-nowrap"
            >
              Ir para Agenda
            </Link>
          </CardContent>
        </Card>
      )}

      <MetricasCards />
    </div>
  );
}
