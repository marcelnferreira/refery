import { useState, useRef, useEffect, useCallback } from 'react';
import { useClientesAtivos, useIndicacoes } from '@/hooks/useRefery';
import type { ClienteAtivo, Indicacao, IndicacaoStatus } from '@/types/refery';
import { INDICACAO_STATUS_COLORS } from '@/types/refery';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TreeNode {
  id: string;
  label: string;
  tipo: 'cliente' | 'indicacao';
  status?: IndicacaoStatus;
  children: TreeNode[];
  x?: number;
  y?: number;
}

const NODE_W = 160;
const NODE_H = 48;
const H_GAP = 40;
const V_GAP = 80;

function buildTree(
  clientes: ClienteAtivo[],
  indicacoes: Indicacao[],
): TreeNode[] {
  // Clientes raiz: não têm indicacao_origem_id (foram cadastrados diretamente)
  const raizes = clientes.filter(c => !c.indicacao_origem_id);

  function buildClienteNode(cliente: ClienteAtivo, depth = 0): TreeNode {
    const indicacoesDoCliente = indicacoes.filter(i => i.indicado_por_id === cliente.id);
    return {
      id: `c-${cliente.id}`,
      label: cliente.nome,
      tipo: 'cliente',
      children: indicacoesDoCliente.map(ind => buildIndicacaoNode(ind, depth + 1)),
    };
  }

  function buildIndicacaoNode(indicacao: Indicacao, depth = 0): TreeNode {
    // Se foi convertido, pode ter se tornado cliente
    const clienteFilho = clientes.find(c => c.indicacao_origem_id === indicacao.id);
    if (clienteFilho && indicacao.status === 'convertido') {
      return buildClienteNode(clienteFilho, depth + 1);
    }
    return {
      id: `i-${indicacao.id}`,
      label: indicacao.nome,
      tipo: 'indicacao',
      status: indicacao.status,
      children: [],
    };
  }

  return raizes.map(c => buildClienteNode(c));
}

function layoutTree(nodes: TreeNode[]): { nodes: TreeNode[]; width: number; height: number } {
  let totalWidth = 0;
  const result: TreeNode[] = [];

  function layoutNode(node: TreeNode, depth: number, offsetX: number): number {
    const subtreeW = Math.max(NODE_W, getSubtreeWidth(node));
    const x = offsetX + subtreeW / 2 - NODE_W / 2;
    const y = depth * (NODE_H + V_GAP);

    node.x = x;
    node.y = y;

    let childOffset = offsetX;
    for (const child of node.children) {
      const childW = getSubtreeWidth(child);
      layoutNode(child, depth + 1, childOffset);
      childOffset += childW + H_GAP;
    }

    return subtreeW;
  }

  function getSubtreeWidth(node: TreeNode): number {
    if (node.children.length === 0) return NODE_W + H_GAP;
    return node.children.reduce((sum, c) => sum + getSubtreeWidth(c), 0);
  }

  let offsetX = 0;
  for (const root of nodes) {
    const w = getSubtreeWidth(root);
    layoutNode(root, 0, offsetX);
    offsetX += w + H_GAP * 2;
    result.push(root);
  }

  function getAllNodes(n: TreeNode): TreeNode[] {
    return [n, ...n.children.flatMap(getAllNodes)];
  }

  const allNodes = nodes.flatMap(getAllNodes);
  const maxX = Math.max(...allNodes.map(n => (n.x ?? 0) + NODE_W));
  const maxY = Math.max(...allNodes.map(n => (n.y ?? 0) + NODE_H));

  return { nodes: result, width: maxX + H_GAP, height: maxY + V_GAP };
}

function renderEdges(nodes: TreeNode[]): React.ReactNode[] {
  const edges: React.ReactNode[] = [];

  function traverse(node: TreeNode) {
    for (const child of node.children) {
      const x1 = (node.x ?? 0) + NODE_W / 2;
      const y1 = (node.y ?? 0) + NODE_H;
      const x2 = (child.x ?? 0) + NODE_W / 2;
      const y2 = child.y ?? 0;
      const midY = (y1 + y2) / 2;

      edges.push(
        <path
          key={`${node.id}-${child.id}`}
          d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth={1.5}
        />
      );
      traverse(child);
    }
  }

  nodes.forEach(traverse);
  return edges;
}

function NodeCard({ node, onClick }: { node: TreeNode; onClick: (n: TreeNode) => void }) {
  const isCliente = node.tipo === 'cliente';
  const statusClass = node.status ? INDICACAO_STATUS_COLORS[node.status] : '';

  return (
    <foreignObject x={node.x} y={node.y} width={NODE_W} height={NODE_H}>
      <div
        onClick={() => onClick(node)}
        className={`w-full h-full rounded-lg border-2 cursor-pointer flex items-center justify-center px-2 text-center transition-shadow hover:shadow-md ${
          isCliente
            ? 'bg-blue-600 border-blue-700 text-white'
            : node.status === 'convertido'
            ? 'bg-green-100 border-green-400 text-green-800'
            : node.status === 'perdido'
            ? 'bg-gray-100 border-gray-300 text-gray-400'
            : 'bg-white border-gray-200 text-gray-700'
        }`}
      >
        <span className="text-xs font-medium leading-tight line-clamp-2">{node.label}</span>
      </div>
    </foreignObject>
  );
}

export function ArvoreVisualizacao() {
  const { data: clientes = [] } = useClientesAtivos(false);
  const { data: indicacoes = [] } = useIndicacoes();
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [soConvertidos, setSoConvertidos] = useState(false);

  const filteredClientes = soConvertidos
    ? clientes.filter(c => c.indicacao_origem_id || !c.indicacao_origem_id)
    : clientes;
  const filteredIndicacoes = soConvertidos
    ? indicacoes.filter(i => i.status === 'convertido')
    : indicacoes;

  const rawNodes = buildTree(filteredClientes, filteredIndicacoes);
  const { nodes: laidOut, width, height } = rawNodes.length > 0
    ? layoutTree(rawNodes)
    : { nodes: [], width: 400, height: 300 };

  function getAllNodes(n: TreeNode): TreeNode[] {
    return [n, ...n.children.flatMap(getAllNodes)];
  }
  const allNodes = laidOut.flatMap(getAllNodes);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => { setZoom(0.8); setPan({ x: 40, y: 40 }); };

  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
        <p className="text-xs mt-1">Cadastre clientes e indicações para ver a árvore.</p>
      </div>
    );
  }

  return (
    <div className="relative border rounded-xl bg-gray-50 overflow-hidden" style={{ height: '65vh' }}>
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setSoConvertidos(!soConvertidos)} className="text-xs h-7">
          {soConvertidos ? 'Ver todos' : 'Só convertidos'}
        </Button>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={resetView}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex gap-3 text-xs bg-white/90 rounded-lg px-3 py-2 border shadow-sm">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Cliente ativo</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border-2 border-gray-200 inline-block" />Indicação</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border-2 border-green-400 inline-block" />Convertido</span>
      </div>

      {/* Selected info */}
      {selected && (
        <div className="absolute top-3 left-3 z-10 bg-white rounded-lg border shadow-md p-3 max-w-[200px]">
          <p className="font-medium text-sm">{selected.label}</p>
          <p className="text-xs text-muted-foreground capitalize">{selected.tipo === 'cliente' ? 'Cliente ativo' : `Indicação — ${selected.status}`}</p>
          <button onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline mt-1">fechar</button>
        </div>
      )}

      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={e => setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)))}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {renderEdges(laidOut)}
          {allNodes.map(n => (
            <NodeCard key={n.id} node={n} onClick={setSelected} />
          ))}
        </g>
      </svg>
    </div>
  );
}
