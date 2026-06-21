import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHistorico, useAddAtividade } from '@/hooks/useRefery';
import type { Indicacao, TipoAtividade } from '@/types/refery';
import { TIPO_ATIVIDADE_LABELS } from '@/types/refery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PlusCircle, Phone, Users, MessageCircle, FileText, StickyNote, TrendingUp, Star, Loader2,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';

const ICONE_TIPO: Record<TipoAtividade, React.ReactNode> = {
  criacao: <Star className="h-3.5 w-3.5 text-blue-500" />,
  mudanca_status: <TrendingUp className="h-3.5 w-3.5 text-purple-500" />,
  ligacao: <Phone className="h-3.5 w-3.5 text-yellow-500" />,
  reuniao: <Users className="h-3.5 w-3.5 text-green-500" />,
  mensagem_aviso: <MessageCircle className="h-3.5 w-3.5 text-teal-500" />,
  anotacao: <StickyNote className="h-3.5 w-3.5 text-gray-400" />,
  proposta: <FileText className="h-3.5 w-3.5 text-orange-500" />,
};

interface HistoricoModalProps {
  open: boolean;
  onClose: () => void;
  indicacao: Indicacao;
}

export function HistoricoModal({ open, onClose, indicacao }: HistoricoModalProps) {
  const { data: historico = [] } = useHistorico(indicacao.id);
  const addAtividade = useAddAtividade();

  const [tipo, setTipo] = useState<TipoAtividade>('anotacao');
  const [descricao, setDescricao] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  const handleAdd = async () => {
    if (!descricao.trim()) return;
    await addAtividade.mutateAsync({ indicacao_id: indicacao.id, tipo, descricao });
    setDescricao('');
    setAdicionando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico — {indicacao.nome}</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={indicacao.status} />
            <span className="text-xs text-muted-foreground">{indicacao.telefone}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {historico.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada.</p>
          )}
          {historico.map(h => (
            <div key={h.id} className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                {ICONE_TIPO[h.tipo as TipoAtividade] ?? <StickyNote className="h-3 w-3 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{h.descricao}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {format(new Date(h.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3">
          {adicionando ? (
            <div className="space-y-2">
              <Select value={tipo} onValueChange={v => setTipo(v as TipoAtividade)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['ligacao', 'reuniao', 'anotacao', 'proposta'] as TipoAtividade[]).map(t => (
                    <SelectItem key={t} value={t}>{TIPO_ATIVIDADE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva a atividade..."
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={addAtividade.isPending || !descricao.trim()}>
                  {addAtividade.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdicionando(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm" variant="outline" className="w-full"
              onClick={() => setAdicionando(true)}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              Registrar atividade
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
