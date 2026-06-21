import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useClientesAtivos, useIndicacoes, useConta,
  useMensagensWhatsapp, useSalvarMensagem,
} from '@/hooks/useRefery';
import { uazapiEnviarTexto } from '@/lib/uazapi';
import type { ClienteAtivo, Indicacao } from '@/types/refery';
import { INDICACAO_STATUS_LABELS } from '@/types/refery';
import {
  Search, Send, Phone, User, MessageCircle,
  Users, UserCheck, Loader2, CheckCheck, Info,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

type Contato =
  | { tipo: 'cliente'; dado: ClienteAtivo }
  | { tipo: 'indicacao'; dado: Indicacao };

function telefoneNumerico(tel: string) {
  return tel.replace(/\D/g, '');
}

export default function WhatsappPage() {
  const { data: clientes = [] } = useClientesAtivos(true);
  const { data: indicacoes = [] } = useIndicacoes();
  const { data: conta } = useConta();
  const salvarMensagem = useSalvarMensagem();

  const [busca, setBusca] = useState('');
  const [contatoAtivo, setContatoAtivo] = useState<Contato | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const phoneAtivo = contatoAtivo
    ? telefoneNumerico(contatoAtivo.dado.telefone)
    : undefined;

  const { data: mensagens = [] } = useMensagensWhatsapp(phoneAtivo);
  const fimRef = useRef<HTMLDivElement>(null);

  // Auto-refresh para capturar mensagens recebidas via webhook
  const qc = useQueryClient();

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Recarrega mensagens a cada 10 segundos para mostrar respostas recebidas
  useEffect(() => {
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['whatsapp_msgs'] });
    }, 10000);
    return () => clearInterval(interval);
  }, [qc]);

  // Monta lista unificada de contatos
  const todosContatos: Contato[] = [
    ...clientes.map(c => ({ tipo: 'cliente' as const, dado: c })),
    ...indicacoes
      .filter(i => !['convertido'].includes(i.status))
      .map(i => ({ tipo: 'indicacao' as const, dado: i })),
  ];

  const contatosFiltrados = todosContatos.filter(c => {
    const termo = busca.toLowerCase();
    return (
      c.dado.nome.toLowerCase().includes(termo) ||
      c.dado.telefone.includes(termo)
    );
  });

  const enviarMensagem = async () => {
    if (!texto.trim() || !contatoAtivo || !conta) return;
    if (!conta.uazapi_subdomain || !conta.uazapi_token) {
      toast.error('Configure a integração UAZAPI em Configurações primeiro.');
      return;
    }

    const phone = telefoneNumerico(contatoAtivo.dado.telefone);
    const nomeContato = contatoAtivo.dado.nome;
    const contactId = contatoAtivo.dado.id;
    const mensagemTexto = texto.trim();

    setEnviando(true);
    try {
      const result = await uazapiEnviarTexto(conta.uazapi_subdomain, conta.uazapi_token, phone, mensagemTexto);
      if (!result.ok) throw new Error(result.erro ?? 'Falha ao enviar mensagem');

      await salvarMensagem.mutateAsync({
        phone,
        contact_name: nomeContato,
        contact_id: contactId,
        contact_type: contatoAtivo.tipo,
        message: mensagemTexto,
        direction: 'outbound',
      });

      setTexto('');
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const nomeContato = contatoAtivo?.dado.nome ?? '';
  const telefoneContato = contatoAtivo?.dado.telefone ?? '';

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-xl border bg-white shadow-sm -mt-1">

      {/* ---- Painel esquerdo: lista de contatos ---- */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h1 className="font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp CRM
          </h1>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              className="pl-8 h-8 text-sm"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {contatosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground px-4">
              Nenhum contato encontrado.
            </div>
          ) : (
            contatosFiltrados.map(c => {
              const isAtivo =
                contatoAtivo?.dado.id === c.dado.id &&
                contatoAtivo?.tipo === c.tipo;

              const ultimaMensagem = [...mensagens]
                .filter(m => m.contact_id === c.dado.id)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

              return (
                <button
                  key={`${c.tipo}-${c.dado.id}`}
                  onClick={() => setContatoAtivo(c)}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${isAtivo ? 'bg-green-50 border-l-2 border-l-green-500' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${c.tipo === 'cliente' ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                      {c.dado.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{c.dado.nome}</span>
                        {c.tipo === 'cliente' ? (
                          <UserCheck className="h-3 w-3 text-blue-400 shrink-0" />
                        ) : (
                          <Users className="h-3 w-3 text-yellow-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {ultimaMensagem
                          ? ultimaMensagem.message
                          : c.dado.telefone}
                      </p>
                    </div>
                    {ultimaMensagem && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(ultimaMensagem.created_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Legenda */}
        <div className="p-3 border-t flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-blue-400" /> Cliente</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3 text-yellow-500" /> Indicação</span>
        </div>
      </div>

      {/* ---- Painel direito: chat ---- */}
      {contatoAtivo ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header do chat */}
          <div className="px-5 py-3 border-b flex items-center gap-3 bg-gray-50">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${contatoAtivo.tipo === 'cliente' ? 'bg-blue-500' : 'bg-yellow-500'}`}>
              {nomeContato.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">{nomeContato}</h2>
                {contatoAtivo.tipo === 'cliente' ? (
                  <Badge className="text-xs bg-blue-100 text-blue-700 border-none">Cliente Ativo</Badge>
                ) : (
                  <Badge className="text-xs bg-yellow-100 text-yellow-700 border-none">
                    {INDICACAO_STATUS_LABELS[(contatoAtivo.dado as Indicacao).status]}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {telefoneContato}
              </div>
            </div>
            <a
              href={`https://wa.me/${telefoneNumerico(telefoneContato)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline flex items-center gap-1"
            >
              Abrir no WhatsApp
            </a>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-[#f0f2f5]">
            {mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                <MessageCircle className="h-10 w-10 text-gray-300" />
                <p>Nenhuma mensagem ainda.</p>
                <p className="text-xs">Escreva abaixo para iniciar a conversa.</p>
              </div>
            ) : (
              mensagens.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      m.direction === 'outbound'
                        ? 'bg-green-500 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${m.direction === 'outbound' ? 'text-green-100' : 'text-muted-foreground'}`}>
                      <span className="text-xs">
                        {format(new Date(m.created_at), "HH:mm")}
                      </span>
                      {m.direction === 'outbound' && (
                        <CheckCheck className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={fimRef} />
          </div>

          {/* Campo de envio */}
          <div className="px-4 py-3 border-t bg-white flex items-end gap-2">
            <textarea
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px] max-h-32"
              placeholder="Digite uma mensagem... (Enter para enviar)"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <Button
              onClick={enviarMensagem}
              disabled={!texto.trim() || enviando}
              className="bg-green-500 hover:bg-green-600 h-11 w-11 p-0 rounded-full shrink-0"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-[#f0f2f5]">
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
            <MessageCircle className="h-10 w-10 text-gray-400" />
          </div>
          <p className="font-medium text-gray-500">Selecione um contato para conversar</p>
          <p className="text-xs text-center max-w-xs">
            Seus clientes ativos e indicações aparecem na lista ao lado. Clique em um para abrir o chat.
          </p>
        </div>
      )}
    </div>
  );
}
