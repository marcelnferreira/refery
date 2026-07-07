import * as XLSX from 'xlsx';
import type { SituacaoFamiliar } from '@/types/refery';
import { SITUACAO_FAMILIAR_LABELS } from '@/types/refery';

export interface LigacaoImportada {
  data: Date | null;
  resultado: string;
}

export interface LinhaImportacao {
  linha: number;
  status_custom: string | null;
  nome: string;
  telefone: string;
  cidade: string | null;
  situacao_familiar: SituacaoFamiliar | null;
  profissao: string | null;
  data_inclusao: Date | null;
  quem_recomendou: string | null;
  contexto: string | null;
  ligacoes: LigacaoImportada[];
  avisos: string[];
}

export interface ResultadoParse {
  linhas: LinhaImportacao[];
  ignoradas: number;
  statusEncontrados: string[];
  indicadoresEncontrados: string[];
}

// Remove acentos e baixa para comparar cabeçalhos de forma resiliente
const normalizar = (s: string) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const limparTelefone = (v: any): string => String(v ?? '').replace(/\D/g, '');

const paraData = (v: any): Date | null => {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number') {
    // Serial do Excel (dias desde 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const CODIGOS_SITUACAO = Object.keys(SITUACAO_FAMILIAR_LABELS);

export function parsePlanilha(buffer: ArrayBuffer): ResultadoParse {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (rows.length < 2) {
    return { linhas: [], ignoradas: 0, statusEncontrados: [], indicadoresEncontrados: [] };
  }

  // Localiza colunas pelo cabeçalho (tolerante a variações)
  const headers = rows[0].map(h => normalizar(h ?? ''));
  const col = (...termos: string[]) =>
    headers.findIndex(h => termos.some(t => h.includes(t)));

  const iStatus = col('status');
  const iNome = col('nome');
  const iTelefone = col('telefone');
  const iCidade = col('cidade');
  const iSituacao = col('situacao');
  const iProfissao = col('profissao');
  const iInclusao = col('data de inclusao', 'inclusao');
  const iRecomendou = col('quem recomendou', 'recomendou');
  const iContexto = col('a.s.k', 'askthe');

  // Pares (data, resultado) das ligações 1ª a 5ª
  const pares: Array<[number, number]> = [];
  for (let n = 1; n <= 5; n++) {
    const iData = headers.findIndex(h => h.includes(`${n}a ligacao`) && h.includes('data'));
    const iRes = headers.findIndex(h => h.includes(`${n}a ligacao`) && h.includes('resultado'));
    if (iData >= 0 && iRes >= 0) pares.push([iData, iRes]);
  }

  const linhas: LinhaImportacao[] = [];
  let ignoradas = 0;
  const statusSet = new Set<string>();
  const indicadoresSet = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const nome = String(row[iNome] ?? '').trim();
    const telefone = limparTelefone(row[iTelefone]);

    if (!nome) { if (row.some(c => c !== null && c !== '')) ignoradas++; continue; }

    const avisos: string[] = [];
    if (!telefone) avisos.push('Sem telefone');

    const statusRaw = String(row[iStatus] ?? '').trim().toUpperCase();
    if (statusRaw) statusSet.add(statusRaw);

    const situacaoRaw = String(row[iSituacao] ?? '').trim().toUpperCase();
    const situacao = CODIGOS_SITUACAO.includes(situacaoRaw) ? (situacaoRaw as SituacaoFamiliar) : null;
    if (situacaoRaw && !situacao) avisos.push(`Situação "${situacaoRaw}" desconhecida`);

    const recomendou = String(row[iRecomendou] ?? '').trim();
    if (recomendou) indicadoresSet.add(recomendou);

    const ligacoes: LigacaoImportada[] = [];
    for (const [iData, iRes] of pares) {
      const data = paraData(row[iData]);
      const resultado = String(row[iRes] ?? '').trim();
      if (data || resultado) ligacoes.push({ data, resultado });
    }

    linhas.push({
      linha: r + 1,
      status_custom: statusRaw || null,
      nome,
      telefone,
      cidade: String(row[iCidade] ?? '').trim() || null,
      situacao_familiar: situacao,
      profissao: String(row[iProfissao] ?? '').trim() || null,
      data_inclusao: paraData(row[iInclusao]),
      quem_recomendou: recomendou || null,
      contexto: String(row[iContexto] ?? '').trim() || null,
      ligacoes,
      avisos,
    });
  }

  return {
    linhas,
    ignoradas,
    statusEncontrados: [...statusSet].sort(),
    indicadoresEncontrados: [...indicadoresSet].sort(),
  };
}

// Heurística: classifica o resultado textual da ligação
export function inferirStatusLigacao(resultado: string): 'realizada' | 'nao_atendeu' {
  const t = normalizar(resultado);
  if (!t) return 'nao_atendeu';
  if (
    t.startsWith('nao atendeu') ||
    t.includes('telefone desligado') ||
    t.includes('caiu') ||
    t.includes('nao consegui')
  ) return 'nao_atendeu';
  return 'realizada';
}
