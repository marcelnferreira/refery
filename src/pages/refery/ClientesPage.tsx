import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClienteModal } from '@/components/refery/ClienteModal';
import { IndicacaoModal } from '@/components/refery/IndicacaoModal';
import { useClientesAtivos, useUpdateCliente } from '@/hooks/useRefery';
import type { ClienteAtivo } from '@/types/refery';
import { Plus, Search, Phone, Mail, Users, MoreVertical, UserCheck, UserX, FileText, Calendar } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function ClientesPage() {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const { data: clientes = [] } = useClientesAtivos(!mostrarInativos);
  const updateCliente = useUpdateCliente();

  const [busca, setBusca] = useState('');
  const [clienteModal, setClienteModal] = useState(false);
  const [editando, setEditando] = useState<ClienteAtivo | null>(null);
  const [indicacaoModal, setIndicacaoModal] = useState(false);
  const [indicadorSelecionado, setIndicadorSelecionado] = useState('');
  const [confirmDesativar, setConfirmDesativar] = useState<ClienteAtivo | null>(null);

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca) ||
    (c.email ?? '').toLowerCase().includes(busca.toLowerCase())
  );

  const handleDesativar = async (cliente: ClienteAtivo) => {
    await updateCliente.mutateAsync({ id: cliente.id, ativo: !cliente.ativo });
    setConfirmDesativar(null);
    toast.success(cliente.ativo ? 'Cliente desativado.' : 'Cliente reativado!');
  };

  const novaIndicacaoParaCliente = (cliente: ClienteAtivo) => {
    setIndicadorSelecionado(cliente.id);
    setIndicacaoModal(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes Ativos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientes.filter(c => c.ativo).length} clientes ativos
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setClienteModal(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="pl-9"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="inativos" checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
          <Label htmlFor="inativos" className="text-sm">Mostrar inativos</Label>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center text-muted-foreground text-sm">
          {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(c => (
            <Card key={c.id} className={`border shadow-sm hover:shadow-md transition-shadow ${!c.ativo ? 'opacity-60' : ''}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{c.nome}</h3>
                      {!c.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />{c.telefone}
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /><span className="truncate">{c.email}</span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-gray-100 text-gray-400">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => novaIndicacaoParaCliente(c)}>
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Nova indicação
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditando(c); setClienteModal(true); }}>
                        Editar dados
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setConfirmDesativar(c)}
                        className={c.ativo ? 'text-destructive' : 'text-green-600'}
                      >
                        {c.ativo ? (
                          <><UserX className="h-3.5 w-3.5 mr-2" />Desativar</>
                        ) : (
                          <><UserCheck className="h-3.5 w-3.5 mr-2" />Reativar</>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {(c.numero_apolice || c.data_inicio_apolice) && (
                  <div className="mt-2 space-y-0.5">
                    {c.numero_apolice && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>Apólice: <span className="font-medium text-gray-700">{c.numero_apolice}</span></span>
                      </div>
                    )}
                    {c.data_inicio_apolice && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Início: <span className="font-medium text-gray-700">{format(new Date(c.data_inicio_apolice), "dd/MM/yyyy", { locale: ptBR })}</span></span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-semibold text-blue-600">{c.total_indicacoes}</span>
                    <span className="text-muted-foreground">indicações</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    desde {format(new Date(c.created_at), "MMM/yy", { locale: ptBR })}
                  </div>
                </div>

                {c.observacoes && (
                  <p className="mt-2 text-xs text-muted-foreground bg-gray-50 rounded-lg p-2 line-clamp-2">
                    {c.observacoes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClienteModal
        open={clienteModal}
        onClose={() => { setClienteModal(false); setEditando(null); }}
        cliente={editando}
      />

      <IndicacaoModal
        open={indicacaoModal}
        onClose={() => { setIndicacaoModal(false); setIndicadorSelecionado(''); }}
        indicadorPreSelecionado={indicadorSelecionado}
      />

      <AlertDialog open={!!confirmDesativar} onOpenChange={() => setConfirmDesativar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDesativar?.ativo ? 'Desativar cliente?' : 'Reativar cliente?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDesativar?.ativo
                ? `${confirmDesativar?.nome} não aparecerá mais nas listas e não receberá mensagens. O histórico é preservado.`
                : `${confirmDesativar?.nome} voltará a aparecer nas listas ativas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDesativar && handleDesativar(confirmDesativar)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
