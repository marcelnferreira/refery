import { useStatusIndicacao } from '@/hooks/useRefery';
import { STATUS_CORES } from '@/types/refery';

interface StatusCustomBadgeProps {
  codigo: string | null | undefined;
  className?: string;
}

// Badge do status personalizado de acompanhamento (cadastrado em Configurações > Status).
// Mostra o código colorido; a descrição aparece no title (hover).
export function StatusCustomBadge({ codigo, className }: StatusCustomBadgeProps) {
  const { data: statusList } = useStatusIndicacao();
  if (!codigo) return <span className="text-muted-foreground text-xs">—</span>;

  const status = statusList?.find(s => s.codigo.toUpperCase() === codigo.toUpperCase());
  const cores = status ? STATUS_CORES[status.cor] : null;

  return (
    <span
      title={status?.descricao ?? codigo}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
        cores?.badge ?? 'bg-gray-100 text-gray-500 border-gray-200'
      } ${className ?? ''}`}
    >
      {codigo}
    </span>
  );
}
