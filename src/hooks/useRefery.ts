import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type {
  Conta, UsuarioConta, ConfiguracoesConta, ClienteAtivo, Indicacao,
  HistoricoAtividade, AgendaSemanal, AgendaItem, IndicacaoStatus, AgendaItemResultado,
  Ligacao, LigacaoStatus, StatusIndicacaoCustom,
} from '@/types/refery';

// ============================================================
// HELPERS
// ============================================================

function tsToStr(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (ts?.seconds) return new Date(ts.seconds * 1000).toISOString();
  return String(ts);
}

function docToObj<T>(snap: any): T {
  const data = snap.data() ?? {};
  return { id: snap.id, ...data, created_at: tsToStr(data.created_at), updated_at: tsToStr(data.updated_at) } as T;
}

// ============================================================
// CONTA ID
// ============================================================

async function getContaId(userId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'userConta', userId));
  return snap.exists() ? (snap.data().conta_id as string) : null;
}

// ============================================================
// CONTA
// ============================================================

export function useConta() {
  const { user } = useAuth();
  return useQuery<Conta | null>({
    queryKey: ['conta', user?.uid],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return null;
      const snap = await getDoc(doc(db, 'contas', contaId));
      if (!snap.exists()) return null;
      return docToObj<Conta>(snap);
    },
    enabled: !!user,
  });
}

export function useUpdateConta() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (updates: Partial<Conta>) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await updateDoc(doc(db, 'contas', contaId), { ...updates, updated_at: serverTimestamp() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conta'] }); toast.success('Salvo!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================

export function useConfiguracoes() {
  const { user } = useAuth();
  return useQuery<ConfiguracoesConta | null>({
    queryKey: ['configuracoes', user?.uid],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return null;
      const snap = await getDoc(doc(db, 'contas', contaId, 'configuracoes', 'default'));
      if (!snap.exists()) return null;
      return { id: 'default', conta_id: contaId, ...snap.data() } as ConfiguracoesConta;
    },
    enabled: !!user,
  });
}

export function useUpdateConfiguracoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (updates: Partial<ConfiguracoesConta>) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await setDoc(
        doc(db, 'contas', contaId, 'configuracoes', 'default'),
        { ...updates, updated_at: serverTimestamp() },
        { merge: true }
      );
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['configuracoes'] }); toast.success('Configurações salvas!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// USUÁRIOS
// ============================================================

export function useUsuariosConta() {
  const { user } = useAuth();
  return useQuery<UsuarioConta[]>({
    queryKey: ['usuarios_conta', user?.uid],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];
      const snap = await getDocs(collection(db, 'contas', contaId, 'usuarios'));
      return snap.docs.map(d => ({ id: d.id, conta_id: contaId, ...d.data() }) as UsuarioConta);
    },
    enabled: !!user,
  });
}

export function useCurrentUserRole() {
  const { user } = useAuth();
  const { data: usuarios } = useUsuariosConta();
  return usuarios?.find(u => u.user_id === user?.uid)?.role ?? 'assistente';
}

// ============================================================
// CLIENTES ATIVOS
// ============================================================

export function useClientesAtivos(apenasAtivos = true) {
  const { user } = useAuth();
  return useQuery<ClienteAtivo[]>({
    queryKey: ['clientes_ativos', user?.uid, apenasAtivos],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];
      let q = query(collection(db, 'contas', contaId, 'clientes'), orderBy('nome'));
      const snap = await getDocs(q);
      const clientes = snap.docs.map(d => docToObj<ClienteAtivo>(d));
      return apenasAtivos ? clientes.filter(c => c.ativo) : clientes;
    },
    enabled: !!user,
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { nome: string; telefone: string; email?: string; observacoes?: string; indicacao_origem_id?: string; indicado_por_id?: string; numero_apolice?: string; data_inicio_apolice?: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      const ref = await addDoc(collection(db, 'contas', contaId, 'clientes'), {
        conta_id: contaId,
        ...input,
        email: input.email ?? null,
        observacoes: input.observacoes ?? null,
        indicacao_origem_id: input.indicacao_origem_id ?? null,
        indicado_por_id: input.indicado_por_id ?? null,
        numero_apolice: input.numero_apolice ?? null,
        data_inicio_apolice: input.data_inicio_apolice ?? null,
        ativo: true,
        total_indicacoes: 0,
        ultimo_contato: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return { id: ref.id };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes_ativos'] }); toast.success('Cliente cadastrado!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClienteAtivo> & { id: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await updateDoc(doc(db, 'contas', contaId, 'clientes', id), { ...updates, updated_at: serverTimestamp() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes_ativos'] }); toast.success('Cliente atualizado!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// INDICAÇÕES
// ============================================================

export function useIndicacoes(filtroStatus?: IndicacaoStatus[]) {
  const { user } = useAuth();
  return useQuery<Indicacao[]>({
    queryKey: ['indicacoes', user?.uid, filtroStatus],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];

      const [indSnap, cliSnap] = await Promise.all([
        getDocs(query(collection(db, 'contas', contaId, 'indicacoes'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'contas', contaId, 'clientes')),
      ]);

      const clientes = Object.fromEntries(
        cliSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as ClienteAtivo])
      );

      let indicacoes = indSnap.docs.map(d => {
        const data = d.data();
        return {
          ...docToObj<Indicacao>(d),
          cliente_indicador: clientes[data.indicado_por_id] ?? undefined,
        };
      });

      if (filtroStatus?.length) {
        indicacoes = indicacoes.filter(i => filtroStatus.includes(i.status));
      }

      return indicacoes;
    },
    enabled: !!user,
  });
}

export function useCreateIndicacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { nome: string; telefone: string; email?: string; indicado_por_id: string; observacoes?: string; status_custom?: string | null }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');

      const ref = await addDoc(collection(db, 'contas', contaId, 'indicacoes'), {
        conta_id: contaId,
        ...input,
        email: input.email ?? null,
        observacoes: input.observacoes ?? null,
        status_custom: input.status_custom ?? null,
        status: 'novo',
        motivo_perda: null,
        data_reuniao: null,
        via_bot: false,
        google_event_id: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Incrementar total_indicacoes do cliente
      const cliRef = doc(db, 'contas', contaId, 'clientes', input.indicado_por_id);
      const cliSnap = await getDoc(cliRef);
      if (cliSnap.exists()) {
        await updateDoc(cliRef, { total_indicacoes: (cliSnap.data().total_indicacoes ?? 0) + 1 });
      }

      // Log no histórico
      await addDoc(collection(db, 'contas', contaId, 'historico'), {
        conta_id: contaId,
        indicacao_id: ref.id,
        tipo: 'criacao',
        descricao: 'Indicação criada',
        usuario_id: user!.uid,
        created_at: serverTimestamp(),
      });

      return { id: ref.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['indicacoes'] });
      qc.invalidateQueries({ queryKey: ['clientes_ativos'] });
      toast.success('Indicação cadastrada!');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateIndicacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Indicacao> & { id: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');

      const ref = doc(db, 'contas', contaId, 'indicacoes', id);

      // Detectar mudança de status para log
      if (updates.status || updates.status_custom !== undefined) {
        const prev = await getDoc(ref);
        const prevStatus = prev.data()?.status;
        const prevCustom = prev.data()?.status_custom ?? null;
        if (updates.status && prevStatus && prevStatus !== updates.status) {
          await addDoc(collection(db, 'contas', contaId, 'historico'), {
            conta_id: contaId,
            indicacao_id: id,
            tipo: 'mudanca_status',
            descricao: `Status alterado de "${prevStatus}" para "${updates.status}"`,
            dados: { status_anterior: prevStatus, status_novo: updates.status },
            usuario_id: user!.uid,
            created_at: serverTimestamp(),
          });
        }
        if (updates.status_custom !== undefined && prevCustom !== updates.status_custom) {
          await addDoc(collection(db, 'contas', contaId, 'historico'), {
            conta_id: contaId,
            indicacao_id: id,
            tipo: 'mudanca_status',
            descricao: `Status de acompanhamento alterado de "${prevCustom ?? '—'}" para "${updates.status_custom ?? '—'}"`,
            dados: { status_custom_anterior: prevCustom, status_custom_novo: updates.status_custom },
            usuario_id: user!.uid,
            created_at: serverTimestamp(),
          });
        }
      }

      await updateDoc(ref, { ...updates, updated_at: serverTimestamp() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['indicacoes'] });
      qc.invalidateQueries({ queryKey: ['historico'] });
      toast.success('Indicação atualizada!');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useConverterParaCliente() {
  const qc = useQueryClient();
  const createCliente = useCreateCliente();
  const updateIndicacao = useUpdateIndicacao();
  return useMutation({
    mutationFn: async (indicacao: Indicacao) => {
      const cliente = await createCliente.mutateAsync({
        nome: indicacao.nome,
        telefone: indicacao.telefone,
        email: indicacao.email ?? undefined,
        indicacao_origem_id: indicacao.id,
      });
      await updateIndicacao.mutateAsync({ id: indicacao.id, status: 'convertido' });
      return cliente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['indicacoes'] });
      qc.invalidateQueries({ queryKey: ['clientes_ativos'] });
      toast.success('Convertido em cliente ativo!');
    },
  });
}

// ============================================================
// HISTÓRICO
// ============================================================

export function useHistorico(indicacaoId?: string) {
  const { user } = useAuth();
  return useQuery<HistoricoAtividade[]>({
    queryKey: ['historico', user?.uid, indicacaoId],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];
      let q = query(
        collection(db, 'contas', contaId, 'historico'),
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({
        id: d.id,
        conta_id: contaId,
        ...d.data(),
        created_at: tsToStr((d.data() as any).created_at),
      }) as HistoricoAtividade);
      return indicacaoId ? all.filter(h => h.indicacao_id === indicacaoId) : all;
    },
    enabled: !!user,
  });
}

export function useAddAtividade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { indicacao_id?: string; cliente_id?: string; tipo: string; descricao: string; dados?: any }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await addDoc(collection(db, 'contas', contaId, 'historico'), {
        conta_id: contaId,
        usuario_id: user!.uid,
        ...input,
        created_at: serverTimestamp(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['historico'] }); toast.success('Atividade registrada!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// AGENDAS
// ============================================================

export function useAgendas() {
  const { user } = useAuth();
  return useQuery<AgendaSemanal[]>({
    queryKey: ['agendas', user?.uid],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];

      const agendasSnap = await getDocs(
        query(collection(db, 'contas', contaId, 'agendas'), orderBy('semana_inicio', 'desc'))
      );

      // Para cada agenda, buscar itens + indicações
      const indSnap = await getDocs(collection(db, 'contas', contaId, 'indicacoes'));
      const cliSnap = await getDocs(collection(db, 'contas', contaId, 'clientes'));

      const clientes = Object.fromEntries(cliSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as ClienteAtivo]));
      const indicacoes = Object.fromEntries(indSnap.docs.map(d => {
        const data = d.data();
        return [d.id, { ...docToObj<Indicacao>(d), cliente_indicador: clientes[data.indicado_por_id] }];
      }));

      const agendas = await Promise.all(
        agendasSnap.docs.map(async agendaDoc => {
          const itensSnap = await getDocs(
            query(collection(db, 'contas', contaId, 'agendas', agendaDoc.id, 'itens'), orderBy('ordem'))
          );
          const itens: AgendaItem[] = itensSnap.docs.map(d => ({
            id: d.id,
            agenda_id: agendaDoc.id,
            ...d.data(),
            indicacao: indicacoes[d.data().indicacao_id],
          } as AgendaItem));

          return { ...docToObj<AgendaSemanal>(agendaDoc), itens };
        })
      );

      return agendas;
    },
    enabled: !!user,
  });
}

export function useAgendaAtual() {
  const { data: agendas } = useAgendas();
  return agendas?.find(a => a.status === 'em_montagem' || a.status === 'confirmada') ?? null;
}

export function useCreateAgenda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (semana_inicio: string) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      const ref = await addDoc(collection(db, 'contas', contaId, 'agendas'), {
        conta_id: contaId,
        semana_inicio,
        status: 'em_montagem',
        google_event_id: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return { id: ref.id };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agendas'] }); toast.success('Agenda criada!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateAgenda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgendaSemanal> & { id: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await updateDoc(doc(db, 'contas', contaId, 'agendas', id), { ...updates, updated_at: serverTimestamp() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agendas'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useAddAgendaItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ agenda_id, indicacao_id, ordem }: { agenda_id: string; indicacao_id: string; ordem: number }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await addDoc(collection(db, 'contas', contaId, 'agendas', agenda_id, 'itens'), {
        indicacao_id,
        ordem,
        resultado: null,
        observacoes: null,
        executado_at: null,
        created_at: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agendas'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateAgendaItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, agenda_id, ...updates }: Partial<AgendaItem> & { id: string; agenda_id: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await updateDoc(doc(db, 'contas', contaId, 'agendas', agenda_id, 'itens', id), updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agendas'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRemoveAgendaItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, agenda_id }: { id: string; agenda_id: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await deleteDoc(doc(db, 'contas', contaId, 'agendas', agenda_id, 'itens', id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agendas'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// MÉTRICAS
// ============================================================

export function useMetricas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['metricas', user?.uid],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return null;

      const [indSnap, cliSnap] = await Promise.all([
        getDocs(collection(db, 'contas', contaId, 'indicacoes')),
        getDocs(collection(db, 'contas', contaId, 'clientes')),
      ]);

      const indicacoes = indSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      const clientes = cliSnap.docs.map(d => ({ id: d.id, ...d.data() }) as ClienteAtivo);

      const agora = new Date();
      const seteDiasAtras = new Date(agora.getTime() - 7 * 86400000);
      const trintaDiasAtras = new Date(agora.getTime() - 30 * 86400000);

      const toDate = (ts: any) => {
        if (!ts) return new Date(0);
        if (ts.seconds) return new Date(ts.seconds * 1000);
        return new Date(ts);
      };

      const total = indicacoes.length;
      const novos = indicacoes.filter((i: any) => toDate(i.created_at) >= seteDiasAtras).length;
      const convertidos = indicacoes.filter((i: any) => i.status === 'convertido').length;
      const perdidos = indicacoes.filter((i: any) => i.status === 'perdido').length;
      const emAndamento = indicacoes.filter((i: any) => !['convertido', 'perdido'].includes(i.status)).length;
      const taxaConversao = total > 0 ? Math.round((convertidos / total) * 100) : 0;

      const porStatus = {
        novo: indicacoes.filter((i: any) => i.status === 'novo').length,
        contato_agendado: indicacoes.filter((i: any) => i.status === 'contato_agendado').length,
        reuniao_realizada: indicacoes.filter((i: any) => i.status === 'reuniao_realizada').length,
        proposta_enviada: indicacoes.filter((i: any) => i.status === 'proposta_enviada').length,
        convertido: convertidos,
        perdido: perdidos,
      };

      const clientesAtivos = clientes.filter(c => c.ativo);
      const topClientes = [...clientesAtivos]
        .sort((a, b) => (b.total_indicacoes ?? 0) - (a.total_indicacoes ?? 0))
        .slice(0, 5);

      const clientesSemIndicacaoRecente = clientesAtivos.filter(c => {
        if (!c.ultimo_contato) return true;
        return toDate(c.ultimo_contato) < trintaDiasAtras;
      }).length;

      return { total, novos, convertidos, perdidos, emAndamento, taxaConversao, porStatus, topClientes, clientesSemIndicacaoRecente };
    },
    enabled: !!user,
  });
}

// ============================================================
// MENSAGENS WHATSAPP
// ============================================================

export interface MensagemWhatsapp {
  id: string;
  phone: string;
  contact_name: string;
  contact_id: string;
  contact_type: 'cliente' | 'indicacao';
  message: string;
  direction: 'outbound' | 'inbound';
  created_at: string;
}

export function useMensagensWhatsapp(phone?: string) {
  const { user } = useAuth();
  return useQuery<MensagemWhatsapp[]>({
    queryKey: ['whatsapp_msgs', user?.uid, phone],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];
      const q = query(
        collection(db, 'contas', contaId, 'whatsapp_msgs'),
        orderBy('created_at', 'asc')
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        created_at: tsToStr((d.data() as any).created_at),
      }) as MensagemWhatsapp);
      if (!phone) return all;
      const norm = (p: string) => {
        const n = p.replace(/\D/g, '');
        const sem55 = (n.startsWith('55') && n.length >= 12) ? n.slice(2) : n;
        return sem55.length === 10 ? sem55.slice(0, 2) + '9' + sem55.slice(2) : sem55;
      };
      const phoneNorm = norm(phone);
      return all.filter(m => norm(m.phone) === phoneNorm);
    },
    enabled: !!user,
  });
}

export function useSalvarMensagem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<MensagemWhatsapp, 'id' | 'created_at'>) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await addDoc(collection(db, 'contas', contaId, 'whatsapp_msgs'), {
        ...input,
        created_at: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp_msgs'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// LIGAÇÕES
// ============================================================

export function useLigacoes(contatoId?: string) {
  const { user } = useAuth();
  return useQuery<Ligacao[]>({
    queryKey: ['ligacoes', user?.uid, contatoId],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];
      const q = query(
        collection(db, 'contas', contaId, 'ligacoes'),
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        created_at: tsToStr((d.data() as any).created_at),
        pontos_chave: (d.data() as any).pontos_chave ?? [],
      }) as Ligacao);
      return contatoId ? all.filter(l => l.contato_id === contatoId) : all;
    },
    enabled: !!user,
  });
}

export function useSalvarLigacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Ligacao, 'id' | 'created_at' | 'conta_id'>) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      const ref = await addDoc(collection(db, 'contas', contaId, 'ligacoes'), {
        ...input,
        conta_id: contaId,
        created_at: serverTimestamp(),
      });
      return ref.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ligacoes'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ============================================================
// STATUS PERSONALIZADOS DE INDICAÇÃO
// ============================================================

export function useStatusIndicacao() {
  const { user } = useAuth();
  return useQuery<StatusIndicacaoCustom[]>({
    queryKey: ['status-indicacao', user?.uid],
    queryFn: async () => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) return [];
      const snap = await getDocs(query(
        collection(db, 'contas', contaId, 'status_indicacao'),
        orderBy('ordem')
      ));
      return snap.docs.map(d => docToObj<StatusIndicacaoCustom>(d));
    },
    enabled: !!user,
  });
}

export function useCreateStatusIndicacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<StatusIndicacaoCustom, 'id' | 'created_at'>) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      const ref = await addDoc(collection(db, 'contas', contaId, 'status_indicacao'), {
        ...input,
        created_at: serverTimestamp(),
      });
      return ref.id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-indicacao'] }); toast.success('Status criado!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateStatusIndicacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StatusIndicacaoCustom> & { id: string }) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await updateDoc(doc(db, 'contas', contaId, 'status_indicacao', id), updates);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-indicacao'] }); toast.success('Status atualizado!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteStatusIndicacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const contaId = await getContaId(user!.uid);
      if (!contaId) throw new Error('Conta não encontrada');
      await deleteDoc(doc(db, 'contas', contaId, 'status_indicacao', id));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-indicacao'] }); toast.success('Status excluído!'); },
    onError: (e: any) => toast.error(e.message),
  });
}
