import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHistorico, useAddAtividade, useLigacoes } from '@/hooks/useRefery';
import type { Indicacao, TipoAtividade, HistoricoAtividade, Ligacao } from '@/types/refery';
import { TIPO_ATIVIDADE_LABELS } from '@/types/refery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PlusCircle, Phone, PhoneMissed, PhoneOff, Users, MessageCircle, FileText,
  StickyNote, TrendingUp, Star, Loader2, Sparkles, Clock,
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

const LIGACAO_STATUS_INFO: Record<string, { label: string; icon: typeof Phone; cor: string }> = {
  realizada: { label: 'Atendida', icon: Phone, cor: 'bg-green-100 text-green-700 border-green-200' },
  nao_atendeu: { label: 'Não atendida', icon: PhoneMissed, cor: 'bg-red-100 text-red-600 border-red-200' },
  ocupado: { label: 'Ocupado', icon: PhoneOff, cor: 'bg-orange-100 text-orange-700 border-orange-200' },
  erro: { label: 'Erro', icon: PhoneOff, cor: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const fmtDuracao = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

interface HistoricoModalProps {
  open: boolean;
  onClose: () => void;
  indicacao: Indicacao;
}

type ItemTimeline =
  | { kind: 'atividade'; created_at: string; data: HistoricoAtividade }
  | { kind: 'ligacao'; created_at: string; data: Ligacao };

export function HistoricoModal({ open, onClose, indicacao }: HistoricoModalProps) {
  const { data: historico = [] } = useHistorico(indicacao.id);
  const { data: ligacoes = [] } = useLigacoes(indicacao.id);
  const addAtividade = useAddAtividade();

  const [tipo, setTipo] = useState<TipoAtividade>('anotacao');
  const [descricao, setDescricao] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  const timeline = useMemo(() => {
    const itens: ItemTimeline[] = [
      ...historico.map(h => ({ kind: 'atividade' as const, created_at: h.created_at, data: h })),
      ...ligacoes.map(l => ({ kind: 'ligacao' as const, created_at: l.created_at, data: l })),
    ];
    return itens.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [historico, ligacoes]);

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
          {timeline.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada.</p>
          )}
          {timeline.map(item => {
            if (item.kind === 'atividade') {
              const h = item.data;
              return (
                <div key={`a-${h.id}`} className="flex gap-3">
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
              );
            }

            const l = item.data;
            const info = LIGACAO_STATUS_INFO[l.status] ?? LIGACAO_STATUS_INFO.erro;
            const StatusIcon = info.icon;
            return (
              <div key={`l-${l.id}`} className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-yellow-50 flex items-center justify-center">
                  <StatusIcon className="h-3.5 w-3.5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${info.cor} text-xs`}>{info.label}</Badge>
                    {l.duracao_segundos > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{fmtDuracao(l.duracao_segundos)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {format(new Date(l.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  {l.resumo_ia && (
                    <p className="text-sm text-gray-700 flex items-start gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                      {l.resumo_ia}
                    </p>
                  )}

                  {l.gravacao_url && (
                    <audio controls preload="none" src={l.gravacao_url} className="w-full h-9" />
                  )}
                </div>
              </div>
            );
          })}
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
