import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClientesAtivos, useCreateIndicacao, useUpdateIndicacao, useStatusIndicacao } from '@/hooks/useRefery';
import type { Indicacao, IndicacaoStatus, SituacaoFamiliar } from '@/types/refery';
import { INDICACAO_STATUS_LABELS, STATUS_CORES, SITUACAO_FAMILIAR_LABELS } from '@/types/refery';
import { Loader2 } from 'lucide-react';

const SEM_STATUS = '__none__';

interface IndicacaoModalProps {
  open: boolean;
  onClose: () => void;
  indicacao?: Indicacao | null;
  statusInicial?: IndicacaoStatus;
  indicadorPreSelecionado?: string;
}

export function IndicacaoModal({
  open, onClose, indicacao, statusInicial = 'novo', indicadorPreSelecionado,
}: IndicacaoModalProps) {
  const { data: clientes = [] } = useClientesAtivos();
  const { data: statusCustomList = [] } = useStatusIndicacao();
  const createIndicacao = useCreateIndicacao();
  const updateIndicacao = useUpdateIndicacao();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [indicadoPorId, setIndicadoPorId] = useState('');
  const [status, setStatus] = useState<IndicacaoStatus>(statusInicial);
  const [statusCustom, setStatusCustom] = useState<string>(SEM_STATUS);
  const [cidade, setCidade] = useState('');
  const [profissao, setProfissao] = useState('');
  const [situacaoFamiliar, setSituacaoFamiliar] = useState<string>(SEM_STATUS);
  const [contexto, setContexto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [motivoPerda, setMotivoPerda] = useState('');
  const [dataReuniao, setDataReuniao] = useState('');

  const statusAtivos = statusCustomList.filter(s => s.ativo);

  const isEditing = !!indicacao;
  const loading = createIndicacao.isPending || updateIndicacao.isPending;

  useEffect(() => {
    if (indicacao) {
      setNome(indicacao.nome);
      setTelefone(indicacao.telefone);
      setEmail(indicacao.email ?? '');
      setIndicadoPorId(indicacao.indicado_por_id);
      setStatus(indicacao.status);
      setStatusCustom(indicacao.status_custom ?? SEM_STATUS);
      setCidade(indicacao.cidade ?? '');
      setProfissao(indicacao.profissao ?? '');
      setSituacaoFamiliar(indicacao.situacao_familiar ?? SEM_STATUS);
      setContexto(indicacao.contexto ?? '');
      setObservacoes(indicacao.observacoes ?? '');
      setMotivoPerda(indicacao.motivo_perda ?? '');
      setDataReuniao(indicacao.data_reuniao ? indicacao.data_reuniao.slice(0, 16) : '');
    } else {
      setNome(''); setTelefone(''); setEmail('');
      setIndicadoPorId(indicadorPreSelecionado ?? '');
      setStatus(statusInicial);
      setStatusCustom(SEM_STATUS);
      setCidade(''); setProfissao(''); setSituacaoFamiliar(SEM_STATUS); setContexto('');
      setObservacoes(''); setMotivoPerda(''); setDataReuniao('');
    }
  }, [indicacao, open, indicadorPreSelecionado, statusInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim() || !indicadoPorId) return;

    const statusCustomValue = statusCustom === SEM_STATUS ? null : statusCustom;
    const situacaoValue = situacaoFamiliar === SEM_STATUS ? null : (situacaoFamiliar as SituacaoFamiliar);

    if (isEditing) {
      await updateIndicacao.mutateAsync({
        id: indicacao!.id, nome, telefone,
        email: email || null, indicado_por_id: indicadoPorId,
        status, status_custom: statusCustomValue,
        cidade: cidade.trim() || null,
        profissao: profissao.trim() || null,
        situacao_familiar: situacaoValue,
        contexto: contexto.trim() || null,
        observacoes: observacoes || null,
        motivo_perda: motivoPerda || null,
        data_reuniao: dataReuniao ? new Date(dataReuniao).toISOString() : null,
      });
    } else {
      await createIndicacao.mutateAsync({
        nome, telefone, email: email || undefined,
        indicado_por_id: indicadoPorId, observacoes: observacoes || undefined,
        status_custom: statusCustomValue,
        cidade: cidade.trim() || null,
        profissao: profissao.trim() || null,
        situacao_familiar: situacaoValue,
        contexto: contexto.trim() || null,
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Indicação' : 'Nova Indicação'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do indicado" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opcional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Salvador" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profissao">Profissão</Label>
              <Input id="profissao" value={profissao} onChange={e => setProfissao(e.target.value)} placeholder="Ex: Empresário" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Situação familiar</Label>
            <Select value={situacaoFamiliar} onValueChange={setSituacaoFamiliar}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_STATUS}>
                  <span className="text-muted-foreground">Não informado</span>
                </SelectItem>
                {(Object.keys(SITUACAO_FAMILIAR_LABELS) as SituacaoFamiliar[]).map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs">{s}</span>
                      <span>{SITUACAO_FAMILIAR_LABELS[s]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="indicador">Indicado por *</Label>
            <Select value={indicadoPorId} onValueChange={setIndicadoPorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente indicador" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {statusAtivos.length > 0 && (
            <div className="space-y-2">
              <Label>Status de acompanhamento</Label>
              <Select value={statusCustom} onValueChange={setStatusCustom}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_STATUS}>
                    <span className="text-muted-foreground">Nenhum</span>
                  </SelectItem>
                  {statusAtivos.map(s => (
                    <SelectItem key={s.id} value={s.codigo}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CORES[s.cor]?.dot ?? 'bg-gray-400'}`} />
                        <span className="font-mono font-bold text-xs">{s.codigo}</span>
                        <span>{s.descricao}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isEditing && (
            <div className="space-y-2">
              <Label>Etapa do Funil</Label>
              <Select value={status} onValueChange={v => setStatus(v as IndicacaoStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INDICACAO_STATUS_LABELS) as IndicacaoStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{INDICACAO_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(status === 'contato_agendado' || status === 'reuniao_realizada') && (
            <div className="space-y-2">
              <Label htmlFor="dataReuniao">Data/hora da reunião</Label>
              <Input
                id="dataReuniao"
                type="datetime-local"
                value={dataReuniao}
                onChange={e => setDataReuniao(e.target.value)}
              />
            </div>
          )}

          {status === 'perdido' && (
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da perda *</Label>
              <Select value={motivoPerda} onValueChange={setMotivoPerda}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_atendeu">Não atendeu</SelectItem>
                  <SelectItem value="sem_interesse">Sem interesse</SelectItem>
                  <SelectItem value="preco">Preço não adequado</SelectItem>
                  <SelectItem value="ja_tem_seguro">Já possui seguro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contexto">Contexto (A.S.K.T.H.E.M.A.N)</Label>
            <Textarea
              id="contexto" value={contexto} onChange={e => setContexto(e.target.value)}
              placeholder="Quem é essa pessoa? Relação com o indicador, família, momento de vida..." rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs" value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Anotações sobre este indicado..." rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !indicadoPorId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
