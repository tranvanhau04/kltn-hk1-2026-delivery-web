'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-xs px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-900 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardOrdersChart({
  data,
}: {
  data: Array<{ day: string; orders: number; delivered: number; failed: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="colorOrdersDb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.14} />
            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="orders"
          name="Tổng đơn"
          stroke="#4F46E5"
          strokeWidth={2}
          fill="url(#colorOrdersDb)"
          dot={{ r: 3, fill: '#4F46E5', strokeWidth: 1.5, stroke: '#FFFFFF' }}
          activeDot={{ r: 5, fill: '#4F46E5', strokeWidth: 2, stroke: '#FFFFFF' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
