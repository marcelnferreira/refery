import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KanbanBoard } from '@/components/refery/KanbanBoard';
import { IndicacaoModal } from '@/components/refery/IndicacaoModal';
import { StatusBadge } from '@/components/refery/StatusBadge';
import { HistoricoModal } from '@/components/refery/HistoricoModal';
import { useIndicacoes, useClientesAtivos } from '@/hooks/useRefery';
import type { Indicacao } from '@/types/refery';
import { Plus, Search, Phone, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function IndicacoesPage() {
  const { data: indicacoes = [] } = useIndicacoes();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Indicacao | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [indicacaoHistorico, setIndicacaoHistorico] = useState<Indicacao | null>(null);
  const [busca, setBusca] = useState('');

  const filtradas = indicacoes.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    i.telefone.includes(busca) ||
    i.cliente_indicador?.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Indicações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{indicacoes.length} indicações no total</p>
        </div>
        <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Indicação
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <div className="flex items-center gap-4">
          <TabsList>
            <TabsTrigger value="kanban">Pipeline Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard />
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            {filtradas.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                {busca ? 'Nenhuma indicação encontrada.' : 'Nenhuma indicação cadastrada ainda.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Indicado por</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cadastro</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtradas.map(ind => (
                    <tr key={ind.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{ind.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ind.telefone}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ind.cliente_indicador?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ind.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(ind.created_at), "dd/MM/yy", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => { setEditando(ind); setModalOpen(true); }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => { setIndicacaoHistorico(ind); setHistoricoOpen(true); }}
                          >
                            Histórico
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <IndicacaoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        indicacao={editando}
      />

      {historicoOpen && indicacaoHistorico && (
        <HistoricoModal
          open={historicoOpen}
          onClose={() => { setHistoricoOpen(false); setIndicacaoHistorico(null); }}
          indicacao={indicacaoHistorico}
        />
      )}
    </div>
  );
}
