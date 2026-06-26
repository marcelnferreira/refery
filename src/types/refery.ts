export type ContaStatus = 'ativo' | 'suspenso' | 'cancelado';
export type ContaPlano = 'starter' | 'growth' | 'pro';
export type UsuarioRole = 'life_planner' | 'assistente';
export type IndicacaoStatus = 'novo' | 'contato_agendado' | 'reuniao_realizada' | 'proposta_enviada' | 'convertido' | 'perdido';
export type AgendaStatus = 'em_montagem' | 'confirmada' | 'executada';
export type AgendaItemResultado = 'nao_atendeu' | 'sem_interesse' | 'quer_saber_mais' | 'reuniao_agendada';
export type TipoAtividade = 'criacao' | 'mudanca_status' | 'ligacao' | 'reuniao' | 'mensagem_aviso' | 'anotacao' | 'proposta';
export type DisparoStatus = 'pendente' | 'enviado' | 'entregue' | 'falhou';

export interface Conta {
  id: string;
  owner_id: string;
  nome_empresa: string;
  nome_life_planner: string;
  plano: ContaPlano;
  status: ContaStatus;
  uazapi_subdomain: string | null;
  uazapi_token: string | null;
  wavoip_token: string | null;
  sip_user: string | null;
  sip_password: string | null;
  soniox_api_key: string | null;
  google_calendar_config: any;
  created_at: string;
  updated_at: string;
}

export type LigacaoStatus = 'realizada' | 'nao_atendeu' | 'ocupado' | 'erro';

export interface Ligacao {
  id: string;
  conta_id: string;
  contato_id: string;
  contato_tipo: 'cliente' | 'indicacao';
  contato_nome: string;
  contato_telefone: string;
  status: LigacaoStatus;
  duracao_segundos: number;
  transcricao: string | null;
  resumo_ia: string | null;
  pontos_chave: string[];
  proxima_acao: string | null;
  created_at: string;
}

export interface UsuarioConta {
  id: string;
  conta_id: string;
  user_id: string;
  role: UsuarioRole;
  nome: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
}

export interface ConfiguracoesConta {
  id: string;
  conta_id: string;
  dia_montagem_agenda: number;
  dia_execucao: number;
  horario_lembrete: string;
  dias_alerta_sem_atividade: number;
  template_aviso_indicador: string;
  updated_at: string;
}

export interface ClienteAtivo {
  id: string;
  conta_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  indicacao_origem_id: string | null;
  indicado_por_id: string | null;
  numero_apolice: string | null;
  data_inicio_apolice: string | null;
  observacoes: string | null;
  ativo: boolean;
  ultimo_contato: string | null;
  total_indicacoes: number;
  created_at: string;
  updated_at: string;
  indicador?: ClienteAtivo;
}

export interface Indicacao {
  id: string;
  conta_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  indicado_por_id: string;
  status: IndicacaoStatus;
  motivo_perda: string | null;
  data_reuniao: string | null;
  observacoes: string | null;
  via_bot: boolean;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
  cliente_indicador?: ClienteAtivo;
}

export interface HistoricoAtividade {
  id: string;
  conta_id: string;
  indicacao_id: string | null;
  cliente_id: string | null;
  tipo: TipoAtividade;
  descricao: string;
  dados: any;
  usuario_id: string | null;
  created_at: string;
}

export interface AgendaSemanal {
  id: string;
  conta_id: string;
  semana_inicio: string;
  status: AgendaStatus;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
  itens?: AgendaItem[];
}

export interface AgendaItem {
  id: string;
  agenda_id: string;
  indicacao_id: string;
  ordem: number;
  resultado: AgendaItemResultado | null;
  observacoes: string | null;
  executado_at: string | null;
  created_at: string;
  indicacao?: Indicacao;
}

export interface DisparoMensagem {
  id: string;
  conta_id: string;
  tipo: string;
  destinatario_id: string | null;
  destinatario_nome: string | null;
  destinatario_telefone: string | null;
  mensagem: string;
  status: DisparoStatus;
  agenda_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const INDICACAO_STATUS_LABELS: Record<IndicacaoStatus, string> = {
  novo: 'Novo',
  contato_agendado: 'Contato Agendado',
  reuniao_realizada: 'Reunião Realizada',
  proposta_enviada: 'Proposta Enviada',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

export const INDICACAO_STATUS_COLORS: Record<IndicacaoStatus, string> = {
  novo: 'bg-blue-100 text-blue-700 border-blue-200',
  contato_agendado: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  reuniao_realizada: 'bg-purple-100 text-purple-700 border-purple-200',
  proposta_enviada: 'bg-orange-100 text-orange-700 border-orange-200',
  convertido: 'bg-green-100 text-green-700 border-green-200',
  perdido: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const KANBAN_COLUMNS: Array<{
  status: IndicacaoStatus;
  label: string;
  headerColor: string;
  nextStep: string;
}> = [
  {
    status: 'novo',
    label: 'Novo',
    headerColor: 'bg-blue-500',
    nextStep: 'Incluir na agenda de ligações',
  },
  {
    status: 'contato_agendado',
    label: 'Contato Agendado',
    headerColor: 'bg-yellow-500',
    nextStep: 'Realizar a reunião agendada',
  },
  {
    status: 'reuniao_realizada',
    label: 'Reunião Realizada',
    headerColor: 'bg-purple-500',
    nextStep: 'Enviar proposta',
  },
  {
    status: 'proposta_enviada',
    label: 'Proposta Enviada',
    headerColor: 'bg-orange-500',
    nextStep: 'Aguardar retorno ou follow-up',
  },
  {
    status: 'convertido',
    label: 'Convertido',
    headerColor: 'bg-green-500',
    nextStep: 'Solicitar novas indicações',
  },
  {
    status: 'perdido',
    label: 'Perdido',
    headerColor: 'bg-gray-400',
    nextStep: 'Registrar motivo e arquivar',
  },
];

export const AGENDA_ITEM_RESULTADO_LABELS: Record<AgendaItemResultado, string> = {
  nao_atendeu: 'Não atendeu',
  sem_interesse: 'Sem interesse',
  quer_saber_mais: 'Quer saber mais',
  reuniao_agendada: 'Reunião agendada',
};

export const TIPO_ATIVIDADE_LABELS: Record<TipoAtividade, string> = {
  criacao: 'Indicação criada',
  mudanca_status: 'Status alterado',
  ligacao: 'Ligação realizada',
  reuniao: 'Reunião realizada',
  mensagem_aviso: 'Aviso WhatsApp enviado',
  anotacao: 'Anotação',
  proposta: 'Proposta enviada',
};
