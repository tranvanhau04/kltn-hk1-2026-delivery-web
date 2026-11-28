'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Inbox } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { RevenueChartItem, TopDriverItem, TopCustomerItem } from '@/types/domain';

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-xs px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-900 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-xs px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function WeeklyBarChart({ data }: { data: { label: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (data.every((d) => d.count === 0)) {
    return (
      <div className="card p-5">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-900">Lượng đơn hàng theo tuần</h3>
          <p className="text-xs text-slate-500 mt-0.5">Phân bố đơn hàng theo ngày trong tuần</p>
        </div>
        <div className="flex flex-col items-center justify-center h-[260px] text-slate-400">
          <Inbox size={32} className="mb-2 text-slate-300" />
          <p className="text-xs">Chưa có dữ liệu đơn hàng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Lượng đơn hàng theo tuần</h3>
          <p className="text-xs text-slate-500 mt-0.5">Phân bố đơn hàng theo ngày trong tuần</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block" />
          <span className="text-slate-500">Số đơn</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
          <Bar dataKey="count" name="Số đơn" radius={[4, 4, 0, 0]} maxBarSize={42}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.count === maxCount ? '#0F172A' : '#4F46E5'}
                opacity={entry.count === maxCount ? 1 : 0.78}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueBarChart({ chartData }: { chartData: RevenueChartItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: '#64748B', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
          }
        />
        <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
        <Bar dataKey="grossRevenue" name="Tổng cước" fill="#0F172A" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="platformRevenue" name="Nền tảng (15%)" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="driverPayout" name="Tài xế (85%)" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopDriversBarChart({ top5 }: { top5: TopDriverItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, top5.length * 48)}>
      <BarChart data={top5} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#64748B', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
          }
        />
        <YAxis
          type="category"
          dataKey="fullName"
          tick={{ fill: '#334155', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
        <Bar dataKey="totalGrossRevenue" name="Tổng doanh thu" fill="#4F46E5" radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopCustomersBarChart({ top5 }: { top5: TopCustomerItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={top5} margin={{ top: 5, right: 10, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="customerName" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
        <Bar dataKey="totalOrders" name="Tổng đơn" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}
