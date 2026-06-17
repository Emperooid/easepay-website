import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'red' | 'yellow' | 'orange' | 'blue' | 'purple' | 'gray' | 'navy';
  className?: string;
}

const variants = {
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  navy: 'bg-[#050A30]/10 text-[#050A30] border-[#050A30]/20',
};

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border', variants[variant], className)}>
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, 'green' | 'red' | 'yellow' | 'orange' | 'blue' | 'gray'> = {
    // uppercase (legacy web)
    PAID: 'green', ACTIVE: 'green',
    PENDING: 'yellow',
    OVERDUE: 'red', FAILED: 'red',
    DRAFT: 'gray', UNPAID: 'orange',
    CANCELLED: 'gray', SENT: 'blue',
    'PARTIAL PAYMENT': 'blue',
    // Title Case (matching mobile)
    Paid: 'green',
    Sent: 'blue',
    Draft: 'gray',
    Unpaid: 'orange',
    Overdue: 'red',
    Cancelled: 'gray',
    'Partial Payment': 'blue',
    // lowercase fallbacks
    paid: 'green', pending: 'yellow', overdue: 'red',
    failed: 'red', draft: 'gray', unpaid: 'orange',
    cancelled: 'gray', sent: 'blue',
  };
  return map[status] || 'gray';
}
