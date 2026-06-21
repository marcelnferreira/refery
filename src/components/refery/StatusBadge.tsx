import { Badge } from '@/components/ui/badge';
import { INDICACAO_STATUS_LABELS, INDICACAO_STATUS_COLORS } from '@/types/refery';
import type { IndicacaoStatus } from '@/types/refery';

interface StatusBadgeProps {
  status: IndicacaoStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${INDICACAO_STATUS_COLORS[status]} ${className ?? ''}`}
    >
      {INDICACAO_STATUS_LABELS[status]}
    </span>
  );
}
