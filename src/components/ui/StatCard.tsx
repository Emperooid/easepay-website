import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: number;
  trendLabel?: string;
  className?: string;
  dark?: boolean;
}

export function StatCard({ label, value, icon, iconBg = 'bg-gray-100', trend, trendLabel, className, dark }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl p-4 border transition-all hover:shadow-md',
      dark ? 'bg-[#050A30] border-[#050A30] text-white' : 'bg-white border-gray-200 text-gray-900',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <p className={cn('text-xs font-medium', dark ? 'text-white/60' : 'text-gray-500')}>{label}</p>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', dark ? 'bg-white/10' : iconBg)}>
          {icon}
        </div>
      </div>
      <p className={cn('text-xl font-bold tracking-tight', dark ? 'text-white' : 'text-gray-900')}>{value}</p>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-medium', trend >= 0 ? 'text-green-500' : 'text-red-400')}>
          {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{Math.abs(trend).toFixed(1)}% {trendLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
  );
}
