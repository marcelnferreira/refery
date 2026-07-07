import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Ligacao } from '@/types/refery';
import { Phone, PhoneMissed, PhoneOff, Clock, MessageSquareText, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  ligacao: Ligacao | null;
  onClose: () => void;
}

const fmtDuracao = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const STATUS_INFO: Record<string, { label: string; icon: typeof Phone; cor: string }> = {
  realizada: { label: 'Atendida', icon: Phone, cor: 'bg-green-100 text-green-700 border-green-200' },
  nao_atendeu: { label: 'Não atendida', icon: PhoneMissed, cor: 'bg-red-100 text-red-600 border-red-200' },
  ocupado: { label: 'Ocupado', icon: PhoneOff, cor: 'bg-orange-100 text-orange-700 border-orange-200' },
  erro: { label: 'Erro', icon: PhoneOff, cor: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export function DetalheLigacaoModal({ ligacao, onClose }: Props) {
  if (!ligacao) return null;
  const info = STATUS_INFO[ligacao.status] ?? STATUS_INFO.erro;
  const StatusIcon = info.icon;

  return (
    <Dialog open={!!ligacao} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm shrink-0">
              {ligacao.contato_nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate">{ligacao.contato_nome}</p>
              <p className="text-xs font-normal text-muted-foreground">{ligacao.contato_telefone}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${info.cor} text-xs`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {info.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {ligacao.contato_tipo === 'cliente' ? 'Cliente' : 'Indicação'}
            </Badge>
            {ligacao.duracao_segundos > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {fmtDuracao(ligacao.duracao_segundos)}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(ligacao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>

          {ligacao.resumo_ia && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Resumo da IA
              </p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{ligacao.resumo_ia}</p>
            </div>
          )}

          {ligacao.pontos_chave?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pontos-chave</p>
              <ul className="space-y-0.5">
                {ligacao.pontos_chave.map((p, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                    <span className="text-blue-500 mt-0.5">•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ligacao.proxima_acao && (
            <div className="bg-blue-50 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Próxima ação</p>
              <p className="text-sm text-blue-800 mt-0.5">{ligacao.proxima_acao}</p>
            </div>
          )}

          {ligacao.transcricao && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <MessageSquareText className="h-3 w-3" /> Transcrição / anotações
              </p>
              <ScrollArea className="h-48 border rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap p-3">{ligacao.transcricao}</p>
              </ScrollArea>
            </div>
          )}

          {!ligacao.transcricao && !ligacao.resumo_ia && (
            <div className="text-sm text-muted-foreground bg-gray-50 rounded-lg px-3 py-3 text-center">
              Nenhuma transcrição ou análise disponível para esta ligação.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
