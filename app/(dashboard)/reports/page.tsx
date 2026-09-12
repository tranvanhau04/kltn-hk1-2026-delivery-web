'use client';

import React, { useState } from 'react';
import {
  Package, CheckCircle, DollarSign, Clock,
  Check,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/common/StatCard';
import { mockChartData, mockDriverPerformance, mockOrders } from '@/lib/mock-data';
import { formatCurrency, cn } from '@/lib/utils';
import type { DriverPerformance } from '@/types/domain';

// ─── Custom Tooltip for Recharts ────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-700 text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-600 text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Driver Performance Table ────────────────────────────────────
function DriverPerfTable() {
  const [performances, setPerformances] = useState(mockDriverPerformance);

  const handleReconcile = (driverUserId: string) => {
    setPerformances((prev) =>
      prev.map((p) =>
        p.driver.userId === driverUserId
          ? { ...p, isReconciled: true, codSubmitted: p.codCollected }
          : p
      )
    );
  };

  const columns: ColumnDef<DriverPerformance>[] = [
    {
      key: 'driver',
      header: 'Tài xế',
      render: (_, row) => {
        const p = row as DriverPerformance;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-xs">
              {p.driver.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-600 text-gray-800">{p.driver.fullName}</p>
              <p className="text-xs text-gray-400">{p.driver.licensePlate}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'totalOrders',
      header: 'Tổng đơn',
      align: 'center',
      render: (v) => <span className="text-sm font-600">{String(v)}</span>,
    },
    {
      key: 'deliveredOrders',
      header: 'Hoàn thành',
      align: 'center',
      render: (v) => <span className="text-sm font-600 text-green-600">{String(v)}</span>,
    },
    {
      key: 'failedOrders',
      header: 'Thất bại',
      align: 'center',
      render: (v) => <span className="text-sm font-600 text-red-500">{String(v)}</span>,
    },
    {
      key: 'successRate',
      header: 'Tỷ lệ TP',
      align: 'center',
      render: (v) => {
        const rate = Number(v);
        return (
          <div className="flex items-center justify-center">
            <div className="relative w-10 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${rate}%`,
                  background: rate >= 80 ? '#22C55E' : rate >= 60 ? '#F59E0B' : '#EF4444',
                }}
              />
            </div>
            <span className="text-xs font-600">{rate}%</span>
          </div>
        );
      },
    },
    {
      key: 'codCollected',
      header: 'COD Thu',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="text-sm font-600 text-gray-800">{formatCurrency(Number(v))}</span>
      ),
    },
    {
      key: 'isReconciled',
      header: 'Đối soát',
      align: 'center',
      render: (v, row) => {
        const p = row as DriverPerformance;
        if (p.isReconciled) {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-600 text-green-700 bg-green-50 px-2 py-1 rounded-lg">
              <Check size={11} /> Đã đối soát
            </span>
          );
        }
        return (
          <button
            onClick={() => handleReconcile(p.driver.userId)}
            className="btn-primary text-xs h-8 px-3"
            id={`btn-reconcile-${p.driver.userId}`}
          >
            Duyệt đối soát
          </button>
        );
      },
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-base font-700 text-gray-900">Hiệu suất tài xế</h3>
        <p className="text-xs text-gray-400 mt-0.5">Đối soát COD và thống kê giao hàng theo tài xế</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {performances.map((perf, ri) => (
              <tr key={perf.driver.userId} className="border-b border-slate-50 hover:bg-[#FFF0F0]/30 transition-colors">
                {columns.map((col) => {
                  const key = String(col.key);
                  const raw = (perf as unknown as Record<string, unknown>)[key];
                  return (
                    <td
                      key={key}
                      className={cn(
                        'px-4 py-3.5',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right'
                      )}
                    >
                      {col.render ? col.render(raw, perf, ri) : String(raw ?? '–')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Reports Page ───────────────────────────────────────────
export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');
  const totalOrders = mockOrders.length;
  const delivered = mockOrders.filter((o) => o.status === 'DELIVERED').length;
  const successRate = Math.round((delivered / totalOrders) * 100);
  const totalCOD = mockOrders.reduce((s, o) => s + o.codAmount, 0);


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-700 text-gray-900">Báo cáo & Thống kê</h2>
          <p className="text-sm text-gray-400 mt-0.5">Tổng quan hoạt động giao vận</p>
        </div>
        <div className="flex items-center gap-2">
          {['7d', '30d', '90d'].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={cn(
                'px-4 h-9 rounded-xl text-sm font-500 transition-all',
                dateRange === r
                  ? 'bg-[#FA7070] text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-slate-200 hover:bg-gray-50'
              )}
              id={`range-${r}`}
            >
              {r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '90 ngày'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 stagger">
        <StatCard
          title="Tổng đơn hàng"
          value={totalOrders}
          trend={5}
          icon={<Package size={18} className="text-[#FA7070]" />}
          iconBg="bg-[#FFF0F0]"
        />
        <StatCard
          title="Tỷ lệ thành công"
          value={`${successRate}%`}
          trend={2}
          icon={<CheckCircle size={18} className="text-green-500" />}
          iconBg="bg-green-50"
        />
        <StatCard
          title="Tổng COD thu"
          value={formatCurrency(totalCOD)}
          trend={8}
          icon={<DollarSign size={18} className="text-amber-500" />}
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Thời gian giao TB"
          value="2.4"
          suffix="giờ"
          trend={-3}
          trendLabel="cải thiện so với tuần trước"
          icon={<Clock size={18} className="text-blue-500" />}
          iconBg="bg-blue-50"
        />
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-700 text-gray-900">Khối lượng đơn hàng theo ngày</h3>
            <p className="text-xs text-gray-400 mt-0.5">7 ngày gần nhất</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-[#FA7070] inline-block" />
              <span className="text-gray-500">Tổng đơn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-green-500 inline-block" />
              <span className="text-gray-500">Hoàn thành</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-red-400 inline-block" />
              <span className="text-gray-500">Thất bại</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={mockChartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FA7070" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#FA7070" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="orders"
              name="Tổng đơn"
              stroke="#FA7070"
              strokeWidth={2.5}
              fill="url(#colorOrders)"
              dot={{ r: 4, fill: '#FA7070', strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 6 }}
            />
            <Area
              type="monotone"
              dataKey="delivered"
              name="Hoàn thành"
              stroke="#22C55E"
              strokeWidth={2}
              fill="url(#colorDelivered)"
              dot={{ r: 3, fill: '#22C55E', strokeWidth: 2, stroke: 'white' }}
            />
            <Area
              type="monotone"
              dataKey="failed"
              name="Thất bại"
              stroke="#F87171"
              strokeWidth={1.5}
              fill="transparent"
              strokeDasharray="4 2"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Driver Performance Table */}
      <DriverPerfTable />
    </div>
  );
}
