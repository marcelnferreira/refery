import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCliente, useUpdateCliente, useClientesAtivos } from '@/hooks/useRefery';
import type { ClienteAtivo } from '@/types/refery';
import { Loader2 } from 'lucide-react';

interface ClienteModalProps {
  open: boolean;
  onClose: () => void;
  cliente?: ClienteAtivo | null;
}

export function ClienteModal({ open, onClose, cliente }: ClienteModalProps) {
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const { data: todosClientes = [] } = useClientesAtivos(true);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [numeroApolice, setNumeroApolice] = useState('');
  const [dataInicioApolice, setDataInicioApolice] = useState('');
  const [indicadoPorId, setIndicadoPorId] = useState('');

  const isEditing = !!cliente;
  const loading = createCliente.isPending || updateCliente.isPending;

  // Clientes disponíveis como indicadores (exclui o próprio cliente sendo editado)
  const opcoesIndicador = todosClientes.filter(c => c.id !== cliente?.id);

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setTelefone(cliente.telefone);
      setEmail(cliente.email ?? '');
      setObservacoes(cliente.observacoes ?? '');
      setNumeroApolice(cliente.numero_apolice ?? '');
      setDataInicioApolice(cliente.data_inicio_apolice ? cliente.data_inicio_apolice.slice(0, 10) : '');
      setIndicadoPorId(cliente.indicado_por_id ?? '');
    } else {
      setNome(''); setTelefone(''); setEmail(''); setObservacoes('');
      setNumeroApolice(''); setDataInicioApolice(''); setIndicadoPorId('');
    }
  }, [cliente, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) return;

    const payload = {
      nome,
      telefone,
      email: email || null,
      observacoes: observacoes || null,
      numero_apolice: numeroApolice || null,
      data_inicio_apolice: dataInicioApolice || null,
      indicado_por_id: indicadoPorId || null,
    };

    if (isEditing) {
      await updateCliente.mutateAsync({ id: cliente!.id, ...payload });
    } else {
      await createCliente.mutateAsync({ nome, telefone, ...payload });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente Ativo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tel">Telefone *</Label>
            <Input id="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="apolice">Nº da Apólice</Label>
              <Input
                id="apolice"
                value={numeroApolice}
                onChange={e => setNumeroApolice(e.target.value)}
                placeholder="Ex: 12345-6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_apolice">Início da Apólice</Label>
              <Input
                id="data_apolice"
                type="date"
                value={dataInicioApolice}
                onChange={e => setDataInicioApolice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Indicado por</Label>
            <Select value={indicadoPorId || 'nenhum'} onValueChange={v => setIndicadoPorId(v === 'nenhum' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione quem indicou..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">— Sem indicador —</SelectItem>
                {opcoesIndicador.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs" value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Notas sobre o relacionamento..." rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
