import { useState } from 'react';
import { useIndicacoes, useUpdateIndicacao, useConverterParaCliente } from '@/hooks/useRefery';
import { KANBAN_COLUMNS, INDICACAO_STATUS_LABELS } from '@/types/refery';
import type { Indicacao, IndicacaoStatus } from '@/types/refery';
import { StatusBadge } from './StatusBadge';
import { StatusCustomBadge } from './StatusCustomBadge';
import { IndicacaoModal } from './IndicacaoModal';
import { HistoricoModal } from './HistoricoModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Phone, MoreVertical, Plus, User, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function KanbanBoard() {
  const { data: indicacoes = [], isLoading } = useIndicacoes();
  const updateIndicacao = useUpdateIndicacao();
  const converterParaCliente = useConverterParaCliente();

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Indicacao | null>(null);
  const [statusInicial, setStatusInicial] = useState<IndicacaoStatus>('novo');
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [indicacaoHistorico, setIndicacaoHistorico] = useState<Indicacao | null>(null);
  const [confirmConverter, setConfirmConverter] = useState<Indicacao | null>(null);
  const [motivoPerdaModal, setMotivoPerdaModal] = useState<{ indicacao: Indicacao; motivo: string } | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<IndicacaoStatus | null>(null);

  const byStatus = (status: IndicacaoStatus) =>
    indicacoes.filter(i => i.status === status);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: IndicacaoStatus) => {
    e.preventDefault();
    setOverCol(null);
    if (!dragging) return;
    const indicacao = indicacoes.find(i => i.id === dragging);
    if (!indicacao || indicacao.status === targetStatus) return;

    if (targetStatus === 'convertido') {
      setConfirmConverter(indicacao);
    } else if (targetStatus === 'perdido') {
      setMotivoPerdaModal({ indicacao, motivo: '' });
    } else {
      await updateIndicacao.mutateAsync({ id: indicacao.id, status: targetStatus });
    }
    setDragging(null);
  };

  const handleMoverStatus = async (indicacao: Indicacao, novoStatus: IndicacaoStatus) => {
    if (novoStatus === 'convertido') {
      setConfirmConverter(indicacao);
    } else if (novoStatus === 'perdido') {
      setMotivoPerdaModal({ indicacao, motivo: '' });
    } else {
      await updateIndicacao.mutateAsync({ id: indicacao.id, status: novoStatus });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
      {KANBAN_COLUMNS.map(col => (
        <div
          key={col.status}
          className={`flex-shrink-0 w-72 flex flex-col rounded-xl border bg-gray-50 transition-colors ${
            overCol === col.status ? 'ring-2 ring-primary bg-blue-50' : ''
          }`}
          onDragOver={e => { e.preventDefault(); setOverCol(col.status); }}
          onDragLeave={() => setOverCol(null)}
          onDrop={e => handleDrop(e, col.status)}
        >
          {/* Column Header */}
          <div className={`${col.headerColor} text-white rounded-t-xl px-4 py-3`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{col.label}</span>
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {byStatus(col.status).length}
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">{col.nextStep}</p>
          </div>

          {/* Cards */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {byStatus(col.status).map(ind => (
              <div
                key={ind.id}
                draggable
                onDragStart={e => handleDragStart(e, ind.id)}
                onDragEnd={() => setDragging(null)}
                className={`bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
                  dragging === ind.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm text-gray-900 truncate">{ind.nome}</p>
                      {ind.status_custom && <StatusCustomBadge codigo={ind.status_custom} />}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <User className="h-3 w-3" />
                      <span className="truncate">{ind.cliente_indicador?.nome ?? '—'}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-gray-100 text-gray-400">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => { setEditando(ind); setModalOpen(true); }}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setIndicacaoHistorico(ind); setHistoricoOpen(true); }}>
                        Ver histórico
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs text-muted-foreground font-medium" disabled>
                        Mover para:
                      </DropdownMenuItem>
                      {KANBAN_COLUMNS.filter(c => c.status !== col.status).map(c => (
                        <DropdownMenuItem key={c.status} onClick={() => handleMoverStatus(ind, c.status)}>
                          {c.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <Phone className="h-3 w-3" />
                  <span>{ind.telefone}</span>
                </div>

                {ind.data_reuniao && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-purple-600">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(ind.data_reuniao), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(ind.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                </div>
              </div>
            ))}

            {/* Add card button */}
            <button
              onClick={() => { setEditando(null); setStatusInicial(col.status === 'novo' ? 'novo' : 'novo'); setModalOpen(true); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg py-2 flex items-center justify-center gap-1 transition-colors border border-dashed border-gray-200 hover:border-gray-300"
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </button>
          </div>
        </div>
      ))}

      {/* Modals */}
      <IndicacaoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        indicacao={editando}
        statusInicial={statusInicial}
      />

      {historicoOpen && indicacaoHistorico && (
        <HistoricoModal
          open={historicoOpen}
          onClose={() => { setHistoricoOpen(false); setIndicacaoHistorico(null); }}
          indicacao={indicacaoHistorico}
        />
      )}

      {/* Confirmar conversão */}
      <AlertDialog open={!!confirmConverter} onOpenChange={() => setConfirmConverter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter em cliente ativo?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConverter?.nome} será convertido em cliente ativo e poderá gerar novas indicações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmConverter) {
                  await converterParaCliente.mutateAsync(confirmConverter);
                  setConfirmConverter(null);
                }
              }}
            >
              Converter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Motivo perda */}
      <AlertDialog open={!!motivoPerdaModal} onOpenChange={() => setMotivoPerdaModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar como perdido</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o motivo para encerrar a negociação com {motivoPerdaModal?.indicacao.nome}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            {['nao_atendeu', 'sem_interesse', 'preco', 'ja_tem_seguro', 'outro'].map(m => (
              <button
                key={m}
                onClick={() => setMotivoPerdaModal(prev => prev ? { ...prev, motivo: m } : null)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                  motivoPerdaModal?.motivo === m
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {{ nao_atendeu: 'Não atendeu', sem_interesse: 'Sem interesse', preco: 'Preço não adequado', ja_tem_seguro: 'Já possui seguro', outro: 'Outro' }[m]}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!motivoPerdaModal?.motivo}
              onClick={async () => {
                if (motivoPerdaModal) {
                  await updateIndicacao.mutateAsync({
                    id: motivoPerdaModal.indicacao.id,
                    status: 'perdido',
                    motivo_perda: motivoPerdaModal.motivo,
                  });
                  setMotivoPerdaModal(null);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
