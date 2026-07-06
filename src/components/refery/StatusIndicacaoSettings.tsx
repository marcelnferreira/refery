import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useStatusIndicacao, useCreateStatusIndicacao,
  useUpdateStatusIndicacao, useDeleteStatusIndicacao,
} from '@/hooks/useRefery';
import { STATUS_CORES, type StatusCor, type StatusIndicacaoCustom } from '@/types/refery';
import { Loader2, Tags, Plus, Pencil, Trash2, Check, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_PLANILHA: Array<{ codigo: string; descricao: string; cor: StatusCor }> = [
  { codigo: 'N',   descricao: 'Novo',              cor: 'azul' },
  { codigo: 'PC',  descricao: 'Primeiro Contato',  cor: 'amarelo' },
  { codigo: 'AM',  descricao: '',                  cor: 'roxo' },
  { codigo: 'OI',  descricao: '',                  cor: 'laranja' },
  { codigo: 'C22', descricao: '',                  cor: 'verde' },
];

export default function StatusIndicacaoSettings() {
  const { data: statusList, isLoading } = useStatusIndicacao();
  const createStatus = useCreateStatusIndicacao();
  const updateStatus = useUpdateStatusIndicacao();
  const deleteStatus = useDeleteStatusIndicacao();

  const [showForm, setShowForm] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCor, setNovaCor] = useState<StatusCor>('azul');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editCor, setEditCor] = useState<StatusCor>('azul');

  const lista = statusList ?? [];
  const proximaOrdem = lista.length > 0 ? Math.max(...lista.map(s => s.ordem)) + 1 : 1;

  const adicionar = () => {
    const codigo = novoCodigo.trim().toUpperCase();
    if (!codigo) { toast.error('Informe o código do status.'); return; }
    if (!novaDescricao.trim()) { toast.error('Informe a descrição do status.'); return; }
    if (lista.some(s => s.codigo.toUpperCase() === codigo)) {
      toast.error(`Já existe um status com o código "${codigo}".`);
      return;
    }
    createStatus.mutate(
      { codigo, descricao: novaDescricao.trim(), cor: novaCor, ordem: proximaOrdem, ativo: true },
      { onSuccess: () => { setNovoCodigo(''); setNovaDescricao(''); setNovaCor('azul'); setShowForm(false); } }
    );
  };

  const iniciarEdicao = (s: StatusIndicacaoCustom) => {
    setEditandoId(s.id);
    setEditCodigo(s.codigo);
    setEditDescricao(s.descricao);
    setEditCor(s.cor);
  };

  const salvarEdicao = () => {
    if (!editandoId) return;
    const codigo = editCodigo.trim().toUpperCase();
    if (!codigo || !editDescricao.trim()) { toast.error('Código e descrição são obrigatórios.'); return; }
    if (lista.some(s => s.id !== editandoId && s.codigo.toUpperCase() === codigo)) {
      toast.error(`Já existe um status com o código "${codigo}".`);
      return;
    }
    updateStatus.mutate(
      { id: editandoId, codigo, descricao: editDescricao.trim(), cor: editCor },
      { onSuccess: () => setEditandoId(null) }
    );
  };

  const importarDaPlanilha = () => {
    const existentes = new Set(lista.map(s => s.codigo.toUpperCase()));
    const faltantes = STATUS_PLANILHA.filter(s => !existentes.has(s.codigo));
    if (faltantes.length === 0) { toast.info('Todos os status da planilha já foram criados.'); return; }
    faltantes.forEach((s, i) => {
      createStatus.mutate({
        codigo: s.codigo,
        descricao: s.descricao || `(editar descrição de ${s.codigo})`,
        cor: s.cor,
        ordem: proximaOrdem + i,
        ativo: true,
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Status de Indicação
            </CardTitle>
            <CardDescription className="mt-1">
              Cadastre os status usados no acompanhamento das indicações. Você pode adicionar novos a qualquer momento.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showForm ? 'Cancelar' : 'Novo status'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Form de novo status */}
        {showForm && (
          <div className="p-4 border rounded-lg bg-muted/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr_130px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código</Label>
                <Input
                  placeholder="Ex: AM"
                  value={novoCodigo}
                  onChange={e => setNovoCodigo(e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input
                  placeholder="Ex: Agendamento Marcado"
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <Select value={novaCor} onValueChange={v => setNovaCor(v as StatusCor)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CORES).map(([key, c]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={adicionar} disabled={createStatus.isPending} className="w-full">
              {createStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar status
            </Button>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Tags className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum status cadastrado ainda.</p>
            <Button variant="outline" size="sm" onClick={importarDaPlanilha} disabled={createStatus.isPending}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Criar status da planilha (N, PC, AM, OI, C22)
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg">
                {editandoId === s.id ? (
                  <>
                    <Input
                      value={editCodigo}
                      onChange={e => setEditCodigo(e.target.value.toUpperCase())}
                      className="w-24"
                      maxLength={10}
                    />
                    <Input
                      value={editDescricao}
                      onChange={e => setEditDescricao(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={editCor} onValueChange={v => setEditCor(v as StatusCor)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CORES).map(([key, c]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                              {c.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={salvarEdicao} disabled={updateStatus.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditandoId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className={`${STATUS_CORES[s.cor]?.badge ?? ''} font-mono font-bold min-w-[3rem] justify-center`}>
                      {s.codigo}
                    </Badge>
                    <span className={`flex-1 text-sm ${s.ativo ? 'text-gray-800' : 'text-muted-foreground line-through'}`}>
                      {s.descricao}
                    </span>
                    {!s.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => updateStatus.mutate({ id: s.id, ativo: !s.ativo })}
                    >
                      {s.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => iniciarEdicao(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(`Excluir o status "${s.codigo} — ${s.descricao}"?`)) {
                          deleteStatus.mutate(s.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {/* Botão de importar códigos faltantes da planilha */}
            {STATUS_PLANILHA.some(sp => !lista.some(s => s.codigo.toUpperCase() === sp.codigo)) && (
              <Button variant="outline" size="sm" onClick={importarDaPlanilha} disabled={createStatus.isPending} className="w-full">
                <Sparkles className="h-4 w-4 mr-1.5" />
                Adicionar status da planilha que faltam
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
