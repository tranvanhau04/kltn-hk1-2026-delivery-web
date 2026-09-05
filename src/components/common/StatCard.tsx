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
  iconBg = 'bg-[#FFF0F0]',
  className,
  loading = false,
  prefix,
  suffix,
}: StatCardProps) {
  return (
    <div className={cn('card p-6 animate-fade-in', className)}>
      {loading ? (
        <div className="space-y-3">
          <div className="shimmer h-4 w-24 rounded" />
          <div className="shimmer h-8 w-32 rounded" />
          <div className="shimmer h-3 w-20 rounded" />
        </div>
      ) : (
        <>
          {/* Top row: title + icon */}
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-500 text-gray-500 leading-5">{title}</p>
            <div className={cn('flex items-center justify-center w-10 h-10 rounded-xl shrink-0', iconBg)}>
              {icon}
            </div>
          </div>

          {/* Value */}
          <p className="text-3xl font-800 text-gray-900 leading-none mb-3">
            {prefix && <span className="text-xl font-600 text-gray-600 mr-1">{prefix}</span>}
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
            {suffix && <span className="text-lg font-500 text-gray-500 ml-1">{suffix}</span>}
          </p>

          {/* Trend */}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full',
                  trend >= 0
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600'
                )}
              >
                {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-xs text-gray-400">{trendLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
