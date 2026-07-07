import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useImportarPlanilha, useStatusIndicacao, useCreateStatusIndicacao, type ResultadoImportacao } from '@/hooks/useRefery';
import { parsePlanilha, inferirStatusLigacao, type ResultadoParse } from '@/lib/importPlanilha';
import { StatusCustomBadge } from './StatusCustomBadge';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, Users, Phone, Tags,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CORES_ROTACAO = ['azul', 'roxo', 'laranja', 'teal', 'rosa', 'amarelo', 'verde', 'vermelho', 'cinza'] as const;

export function ImportarPlanilhaModal({ open, onClose }: Props) {
  const importar = useImportarPlanilha();
  const { data: statusList = [] } = useStatusIndicacao();
  const createStatus = useCreateStatusIndicacao();

  const [parse, setParse] = useState<ResultadoParse | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setParse(null); setNomeArquivo(''); setResultado(null); };

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const res = parsePlanilha(buffer);
      if (res.linhas.length === 0) {
        toast.error('Nenhuma linha válida encontrada. Verifique se a planilha segue o formato do modelo.');
        return;
      }
      setParse(res);
      setNomeArquivo(file.name);
      setResultado(null);
    } catch (e: any) {
      toast.error('Erro ao ler o arquivo: ' + (e.message ?? 'formato inválido'));
    }
  };

  const statusNaoCadastrados = parse
    ? parse.statusEncontrados.filter(
        codigo => !statusList.some(s => s.codigo.toUpperCase() === codigo)
      )
    : [];

  const cadastrarStatusFaltantes = () => {
    const proximaOrdem = statusList.length > 0 ? Math.max(...statusList.map(s => s.ordem)) + 1 : 1;
    statusNaoCadastrados.forEach((codigo, i) => {
      createStatus.mutate({
        codigo,
        descricao: `(editar descrição de ${codigo})`,
        cor: CORES_ROTACAO[(statusList.length + i) % CORES_ROTACAO.length],
        ordem: proximaOrdem + i,
        ativo: true,
      });
    });
  };

  const executarImportacao = async () => {
    if (!parse) return;
    const res = await importar.mutateAsync({
      linhas: parse.linhas,
      inferirStatus: inferirStatusLigacao,
    });
    setResultado(res);
  };

  const totalLigacoes = parse?.linhas.reduce((acc, l) => acc + l.ligacoes.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={() => { if (!importar.isPending) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Importar planilha de indicações
          </DialogTitle>
        </DialogHeader>

        {/* Passo 1: escolher arquivo */}
        {!parse && !resultado && (
          <div
            className="border-2 border-dashed rounded-xl p-10 text-center space-y-3 hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <p className="font-medium">Arraste o arquivo Excel aqui</p>
              <p className="text-sm text-muted-foreground mt-0.5">ou clique para escolher (.xlsx)</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato esperado: colunas Status, Nome, Telefone, Cidade, Situação, Profissão,
              Quem Recomendou, A.S.K.T.H.E.M.A.N e histórico de ligações (1ª a 5ª).
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Passo 2: preview */}
        {parse && !resultado && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-medium">{nomeArquivo}</span>
              <span>— {parse.linhas.length} contatos encontrados</span>
              {parse.ignoradas > 0 && <span className="text-muted-foreground">({parse.ignoradas} linhas ignoradas)</span>}
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border rounded-lg p-3">
                <Users className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                <p className="text-lg font-bold">{parse.linhas.length}</p>
                <p className="text-xs text-muted-foreground">Indicações</p>
              </div>
              <div className="border rounded-lg p-3">
                <Phone className="h-4 w-4 mx-auto text-green-500 mb-1" />
                <p className="text-lg font-bold">{totalLigacoes}</p>
                <p className="text-xs text-muted-foreground">Ligações no histórico</p>
              </div>
              <div className="border rounded-lg p-3">
                <Tags className="h-4 w-4 mx-auto text-purple-500 mb-1" />
                <p className="text-lg font-bold">{parse.statusEncontrados.length}</p>
                <p className="text-xs text-muted-foreground">Status distintos</p>
              </div>
            </div>

            {/* Status não cadastrados */}
            {statusNaoCadastrados.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-amber-800">
                  <p>Status ainda não cadastrados: <b>{statusNaoCadastrados.join(', ')}</b></p>
                  <Button
                    size="sm" variant="outline" className="mt-2 h-7 text-xs"
                    onClick={cadastrarStatusFaltantes}
                    disabled={createStatus.isPending}
                  >
                    Cadastrar automaticamente
                  </Button>
                </div>
              </div>
            )}

            {/* Indicadores */}
            <div className="text-sm text-muted-foreground">
              <b className="text-gray-700">Indicadores:</b> {parse.indicadoresEncontrados.join(' · ')}
              <p className="text-xs mt-0.5">Nomes que não existirem como clientes serão criados automaticamente.</p>
            </div>

            {/* Preview table */}
            <ScrollArea className="h-56 border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Telefone</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Indicador</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Ligações</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Avisos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parse.linhas.map(l => (
                    <tr key={l.linha}>
                      <td className="px-3 py-1.5"><StatusCustomBadge codigo={l.status_custom} /></td>
                      <td className="px-3 py-1.5 font-medium">{l.nome}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{l.telefone || '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{l.quem_recomendou ?? '—'}</td>
                      <td className="px-3 py-1.5">{l.ligacoes.length > 0 ? `${l.ligacoes.length}x` : '—'}</td>
                      <td className="px-3 py-1.5">
                        {l.avisos.length > 0 && (
                          <span className="text-amber-600" title={l.avisos.join('; ')}>
                            <AlertTriangle className="h-3.5 w-3.5 inline" /> {l.avisos.length}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              Contatos cujo telefone já existe nas indicações serão pulados (sem duplicar).
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} disabled={importar.isPending} className="flex-1">
                Escolher outro arquivo
              </Button>
              <Button onClick={executarImportacao} disabled={importar.isPending} className="flex-1">
                {importar.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                ) : (
                  <>Importar {parse.linhas.length} contatos</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Passo 3: resultado */}
        {resultado && (
          <div className="space-y-4">
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="font-semibold text-lg">Importação concluída!</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{resultado.indicacoesCriadas}</p>
                <p className="text-muted-foreground">Indicações criadas</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{resultado.ligacoesCriadas}</p>
                <p className="text-muted-foreground">Ligações no histórico</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{resultado.clientesCriados}</p>
                <p className="text-muted-foreground">Indicadores criados</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{resultado.indicacoesPuladas}</p>
                <p className="text-muted-foreground">Pulados (já existiam)</p>
              </div>
            </div>
            <Button onClick={() => { reset(); onClose(); }} className="w-full">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
