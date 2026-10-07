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
  iconBg = 'bg-slate-100 text-slate-600',
  className,
  loading = false,
  prefix,
  suffix,
}: StatCardProps) {
  return (
    <div className={cn('card p-4.5 transition-all', className)}>
      {loading ? (
        <div className="space-y-2.5 animate-pulse">
          <div className="h-3.5 w-24 bg-slate-200 rounded" />
          <div className="h-7 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
      ) : (
        <>
          {/* Top row: title + icon */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 leading-none">{title}</span>
            <div className={cn('flex items-center justify-center w-7 h-7 rounded-md shrink-0 border border-slate-200/50', iconBg)}>
              {icon}
            </div>
          </div>

          {/* Value */}
          <div className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight mb-2">
            {prefix && <span className="text-lg font-medium text-slate-500 mr-1">{prefix}</span>}
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
            {suffix && <span className="text-base font-normal text-slate-500 ml-1">{suffix}</span>}
          </div>

          {/* Trend */}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded border',
                  trend >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : 'bg-red-50 text-red-700 border-red-200/80'
                )}
              >
                {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-[11px] text-slate-400 font-normal">{trendLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
