import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number; // positive = up, negative = down
  trendLabel?: string;
  icon: React.ReactNode;
  iconBg?: string;
  className?: string;
  loading?: boolean;
  prefix?: string;
  suffix?: string;
}

export function StatCard({
  title,
  value,
  trend,
  trendLabel = 'so với tuần trước',
  icon,
  iconBg = 'bg-slate-100',
  className,
  loading = false,
  prefix,
  suffix,
}: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-slate-200/80 shadow-xs p-5 animate-fade-in', className)}>
      {loading ? (
        <div className="space-y-3">
          <div className="shimmer h-3.5 w-24 rounded" />
          <div className="shimmer h-7 w-32 rounded" />
          <div className="shimmer h-3 w-20 rounded" />
        </div>
      ) : (
        <>
          {/* Top row: title + icon */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider leading-4">{title}</p>
            <div className={cn('flex items-center justify-center w-8 h-8 rounded-md border border-slate-200/70 shrink-0', iconBg)}>
              {icon}
            </div>
          </div>

          {/* Value */}
          <p className="text-2xl font-semibold text-slate-900 tracking-tight leading-none mb-2.5 tabular-nums">
            {prefix && <span className="text-base font-medium text-slate-500 mr-1">{prefix}</span>}
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
            {suffix && <span className="text-sm font-medium text-slate-500 ml-1">{suffix}</span>}
          </p>

          {/* Trend */}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border tabular-nums',
                  trend >= 0
                    ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/80'
                    : 'bg-red-50/70 text-red-700 border-red-200/80'
                )}
              >
                {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-[11px] text-slate-400">{trendLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
