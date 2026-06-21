import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useAgendas, useCreateAgenda, useUpdateAgenda, useAddAgendaItem,
  useRemoveAgendaItem, useUpdateAgendaItem, useIndicacoes, useConta,
  useUpdateIndicacao, useClientesAtivos, useConfiguracoes, useSalvarMensagem,
} from '@/hooks/useRefery';
import type { AgendaSemanal, AgendaItem, Indicacao, AgendaItemResultado } from '@/types/refery';
import { AGENDA_ITEM_RESULTADO_LABELS } from '@/types/refery';
import { toast } from 'sonner';
import { uazapiEnviarTexto } from '@/lib/uazapi';
import {
  Plus, CalendarDays, CheckCircle2, Clock, Phone, Send,
  ChevronDown, ChevronRight, Trash2, GripVertical, MessageCircle, Loader2,
} from 'lucide-react';
import { format, addDays, startOfWeek, nextFriday, isFriday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const RESULTADO_COLORS: Record<AgendaItemResultado, string> = {
  nao_atendeu: 'text-gray-500',
  sem_interesse: 'text-red-500',
  quer_saber_mais: 'text-blue-500',
  reuniao_agendada: 'text-green-600',
};

function getProximaSexta(): string {
  const hoje = new Date();
  const sexta = nextFriday(hoje);
  return format(sexta, 'yyyy-MM-dd');
}

export default function AgendaPage() {
  const { data: agendas = [] } = useAgendas();
  const { data: indicacoes = [] } = useIndicacoes(['novo', 'contato_agendado']);
  const { data: clientes = [] } = useClientesAtivos();
  const { data: conta } = useConta();
  const { data: configuracoes } = useConfiguracoes();
  const createAgenda = useCreateAgenda();
  const updateAgenda = useUpdateAgenda();
  const addItem = useAddAgendaItem();
  const removeItem = useRemoveAgendaItem();
  const updateItem = useUpdateAgendaItem();
  const updateIndicacao = useUpdateIndicacao();
  const salvarMensagem = useSalvarMensagem();

  const [agendaAtiva, setAgendaAtiva] = useState<string | null>(null);
  const [adicionandoIndicacao, setAdicionandoIndicacao] = useState(false);
  const [indicacaoSelecionada, setIndicacaoSelecionada] = useState('');
  const [resultadoModal, setResultadoModal] = useState<AgendaItem | null>(null);
  const [observacaoResultado, setObservacaoResultado] = useState('');
  const [resultadoSelecionado, setResultadoSelecionado] = useState<AgendaItemResultado | ''>('');
  const [enviandoAvisos, setEnviandoAvisos] = useState(false);
  const [registrandoResultado, setRegistrandoResultado] = useState(false);
  const [modalAvisos, setModalAvisos] = useState(false);
  const [templateEditado, setTemplateEditado] = useState('');

  const agendaAtivaObj = agendas.find(a => a.id === agendaAtiva) ?? agendas[0] ?? null;
  const indicacoesNaAgenda = agendaAtivaObj?.itens?.map(i => i.indicacao_id) ?? [];
  const indicacoesDisponiveis = indicacoes.filter(i => !indicacoesNaAgenda.includes(i.id));

  const criarNovaAgenda = async () => {
    const semana = getProximaSexta();
    const agenda = await createAgenda.mutateAsync(semana);
    setAgendaAtiva(agenda.id);
  };

  const adicionarIndicacao = async () => {
    if (!agendaAtivaObj || !indicacaoSelecionada) return;
    const nextOrder = (agendaAtivaObj.itens?.length ?? 0);
    await addItem.mutateAsync({
      agenda_id: agendaAtivaObj.id,
      indicacao_id: indicacaoSelecionada,
      ordem: nextOrder,
    });
    setIndicacaoSelecionada('');
    setAdicionandoIndicacao(false);
  };

  const confirmarAgenda = async () => {
    if (!agendaAtivaObj) return;
    await updateAgenda.mutateAsync({ id: agendaAtivaObj.id, status: 'confirmada' });
    toast.success('Agenda confirmada! Agora você pode enviar os avisos.');
  };

  // Monta grupos de indicados por cliente indicador
  const montarGrupos = () => {
    const grupos: Record<string, { clienteId: string; cliente: { nome: string; telefone: string }; indicados: string[] }> = {};
    for (const item of (agendaAtivaObj?.itens ?? [])) {
      const ind = item.indicacao;
      if (!ind) continue;
      const clienteId = ind.indicado_por_id;
      const cliente = clientes.find(c => c.id === clienteId);
      if (!cliente) continue;
      if (!grupos[clienteId]) {
        grupos[clienteId] = { clienteId, cliente: { nome: cliente.nome, telefone: cliente.telefone }, indicados: [] };
      }
      grupos[clienteId].indicados.push(ind.nome);
    }
    return Object.values(grupos);
  };

  const abrirModalAvisos = () => {
    if (!conta) return;
    const templatePadrao = configuracoes?.template_aviso_indicador ??
      'Olá {nome_cliente}! Na próxima sexta entrarei em contato com {lista_indicados}, que você me indicou. Pode avisar que sou da {nome_empresa} e que ligarei? Muito obrigado!';
    setTemplateEditado(templatePadrao);
    setModalAvisos(true);
  };

  const confirmarEnvioAvisos = async () => {
    if (!agendaAtivaObj || !conta) return;
    if (!conta.uazapi_subdomain || !conta.uazapi_token) {
      toast.error('Configure a integração UAZAPI em Configurações primeiro.');
      return;
    }

    const grupos = montarGrupos();
    if (grupos.length === 0) {
      toast.error('Nenhuma indicação com cliente indicador encontrada.');
      return;
    }

    const dataLigacao = format(new Date(agendaAtivaObj.semana_inicio + 'T00:00:00'), "EEEE, dd/MM", { locale: ptBR });

    setEnviandoAvisos(true);
    let enviados = 0;
    let falhos = 0;

    try {
      for (const grupo of grupos) {
        const mensagem = templateEditado
          .replace(/{nome_cliente}/g, grupo.cliente.nome)
          .replace(/{lista_indicados}/g, grupo.indicados.join(', '))
          .replace(/{nome_empresa}/g, conta.nome_empresa)
          .replace(/{nome_life_planner}/g, conta.nome_life_planner)
          .replace(/{data_ligacao}/g, dataLigacao);

        try {
          const result = await uazapiEnviarTexto(conta.uazapi_subdomain, conta.uazapi_token, grupo.cliente.telefone, mensagem);
          if (result.ok) {
            enviados++;
            // Salva no histórico do WhatsApp CRM
            await salvarMensagem.mutateAsync({
              phone: grupo.cliente.telefone.replace(/\D/g, ''),
              contact_name: grupo.cliente.nome,
              contact_id: grupo.clienteId,
              contact_type: 'cliente',
              message: mensagem,
              direction: 'outbound',
            });
          } else {
            falhos++;
          }
        } catch {
          falhos++;
        }
      }

      await updateAgenda.mutateAsync({ id: agendaAtivaObj.id, status: 'confirmada' });
      setModalAvisos(false);
      toast.success(`Avisos enviados! ${enviados} entregues${falhos > 0 ? `, ${falhos} com falha` : ''}.`);
    } finally {
      setEnviandoAvisos(false);
    }
  };

  const registrarResultado = async () => {
    if (!resultadoModal || !resultadoSelecionado) return;
    setRegistrandoResultado(true);
    try {
      await updateItem.mutateAsync({
        id: resultadoModal.id,
        agenda_id: agendaAtivaObj!.id,
        resultado: resultadoSelecionado as AgendaItemResultado,
        observacoes: observacaoResultado || null,
        executado_at: new Date().toISOString(),
      });

      // Atualizar status da indicação
      const novoStatus = resultadoSelecionado === 'reuniao_agendada'
        ? 'contato_agendado'
        : resultadoSelecionado === 'sem_interesse'
        ? 'perdido'
        : undefined;

      if (novoStatus && resultadoModal.indicacao) {
        await updateIndicacao.mutateAsync({
          id: resultadoModal.indicacao_id,
          status: novoStatus as any,
          motivo_perda: resultadoSelecionado === 'sem_interesse' ? 'sem_interesse' : undefined,
        });
      }

      setResultadoModal(null);
      setResultadoSelecionado('');
      setObservacaoResultado('');
      toast.success('Resultado registrado!');
    } finally {
      setRegistrandoResultado(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda de Ligações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ciclo semanal quinta → sexta
          </p>
        </div>
        <Button onClick={criarNovaAgenda} disabled={createAgenda.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Agenda
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lista de agendas */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Agendas</h2>
          {agendas.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                Nenhuma agenda criada.
                <br />
                <button onClick={criarNovaAgenda} className="text-primary hover:underline mt-1 text-xs">
                  Criar agenda da próxima sexta
                </button>
              </CardContent>
            </Card>
          ) : (
            agendas.map(a => (
              <button
                key={a.id}
                onClick={() => setAgendaAtiva(a.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  agendaAtiva === a.id || (!agendaAtiva && agendas[0]?.id === a.id)
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(a.semana_inicio + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.itens?.length ?? 0} indicações
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      a.status === 'confirmada' ? 'bg-green-100 text-green-700' :
                      a.status === 'executada' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {a.status === 'em_montagem' ? 'Em montagem' :
                     a.status === 'confirmada' ? 'Confirmada' : 'Executada'}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detalhe da agenda */}
        <div className="lg:col-span-2 space-y-4">
          {agendaAtivaObj ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Sexta, {format(new Date(agendaAtivaObj.semana_inicio + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                    <div className="flex gap-2">
                      {agendaAtivaObj.status === 'em_montagem' && (
                        <Button size="sm" variant="outline" onClick={confirmarAgenda}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Confirmar agenda
                        </Button>
                      )}
                      {agendaAtivaObj.status === 'confirmada' && (
                        <Button size="sm" onClick={abrirModalAvisos}>
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          Enviar avisos WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(agendaAtivaObj.itens ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma indicação adicionada ainda.
                    </p>
                  ) : (
                    (agendaAtivaObj.itens ?? []).map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.indicacao?.nome ?? 'Indicação'}</p>
                          <p className="text-xs text-muted-foreground">{item.indicacao?.telefone}</p>
                        </div>
                        {item.resultado ? (
                          <span className={`text-xs font-medium ${RESULTADO_COLORS[item.resultado]}`}>
                            {AGENDA_ITEM_RESULTADO_LABELS[item.resultado]}
                          </span>
                        ) : (
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { setResultadoModal(item); }}
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Registrar
                          </Button>
                        )}
                        <button
                          onClick={() => removeItem.mutate({ id: item.id, agenda_id: agendaAtivaObj!.id })}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}

                  {/* Adicionar indicação */}
                  {agendaAtivaObj.status === 'em_montagem' && (
                    adicionandoIndicacao ? (
                      <div className="flex gap-2 pt-2">
                        <Select value={indicacaoSelecionada} onValueChange={setIndicacaoSelecionada}>
                          <SelectTrigger className="flex-1 h-8 text-sm">
                            <SelectValue placeholder="Selecione uma indicação..." />
                          </SelectTrigger>
                          <SelectContent>
                            {indicacoesDisponiveis.map(i => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.nome} — {i.cliente_indicador?.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" onClick={adicionarIndicacao} disabled={!indicacaoSelecionada}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setAdicionandoIndicacao(false)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAdicionandoIndicacao(true)}
                        className="w-full text-xs text-muted-foreground hover:text-gray-700 flex items-center justify-center gap-1 py-2 border border-dashed rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar indicação
                      </button>
                    )
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                Selecione ou crie uma agenda.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de envio de avisos */}
      {modalAvisos && agendaAtivaObj && conta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                Enviar avisos via WhatsApp
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revise a mensagem e confirme o envio.
              </p>
            </div>

            {/* Destinatários */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Destinatários:</p>
              {montarGrupos().length === 0 ? (
                <p className="text-sm text-red-500">
                  Nenhuma indicação com cliente indicador encontrado. Verifique se as indicações têm o campo "Indicado por" preenchido.
                </p>
              ) : (
                montarGrupos().map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {g.cliente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{g.cliente.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Indicados: <span className="text-gray-700">{g.indicados.join(', ')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{g.cliente.telefone}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mensagem editável */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Mensagem:</p>
              <Textarea
                value={templateEditado}
                onChange={e => setTemplateEditado(e.target.value)}
                rows={5}
                className="text-sm font-mono"
                placeholder="Digite a mensagem..."
              />
              <div className="text-xs text-muted-foreground bg-gray-50 rounded-lg px-3 py-2 space-y-0.5">
                <p className="font-medium text-gray-600">Variáveis disponíveis:</p>
                <p><code>{'{nome_cliente}'}</code> · <code>{'{lista_indicados}'}</code> · <code>{'{nome_empresa}'}</code> · <code>{'{nome_life_planner}'}</code> · <code>{'{data_ligacao}'}</code></p>
              </div>
            </div>

            {/* Prévia */}
            {montarGrupos().length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Prévia (primeiro destinatário):</p>
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                  {(() => {
                    const g = montarGrupos()[0];
                    const dataLigacao = format(new Date(agendaAtivaObj.semana_inicio + 'T00:00:00'), "EEEE, dd/MM", { locale: ptBR });
                    return templateEditado
                      .replace(/{nome_cliente}/g, g.cliente.nome)
                      .replace(/{lista_indicados}/g, g.indicados.join(', '))
                      .replace(/{nome_empresa}/g, conta.nome_empresa)
                      .replace(/{nome_life_planner}/g, conta.nome_life_planner)
                      .replace(/{data_ligacao}/g, dataLigacao);
                  })()}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={confirmarEnvioAvisos}
                disabled={enviandoAvisos || montarGrupos().length === 0 || !templateEditado.trim()}
              >
                {enviandoAvisos
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Send className="h-4 w-4 mr-2" />}
                {enviandoAvisos ? 'Enviando...' : `Enviar para ${montarGrupos().length} cliente(s)`}
              </Button>
              <Button variant="outline" onClick={() => setModalAvisos(false)} disabled={enviandoAvisos}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resultado */}
      {resultadoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-semibold">Resultado da ligação</h3>
            <p className="text-sm text-muted-foreground">{resultadoModal.indicacao?.nome}</p>

            <div className="space-y-2">
              {(Object.entries(AGENDA_ITEM_RESULTADO_LABELS) as [AgendaItemResultado, string][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setResultadoSelecionado(k)}
                  className={`w-full text-left px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                    resultadoSelecionado === k
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Observações (opcional)..."
              value={observacaoResultado}
              onChange={e => setObservacaoResultado(e.target.value)}
              rows={2}
              className="text-sm"
            />

            <div className="flex gap-2">
              <Button
                className="flex-1" size="sm"
                disabled={!resultadoSelecionado || registrandoResultado}
                onClick={registrarResultado}
              >
                {registrandoResultado && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Salvar
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setResultadoModal(null); setResultadoSelecionado(''); setObservacaoResultado(''); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
