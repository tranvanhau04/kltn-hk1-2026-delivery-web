'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, CheckCircle, DollarSign, Plus, Route, Map as MapIcon, ChevronRight } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { mockOrders, mockChartData } from '@/lib/mock-data';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-dropdown px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p: { color: string; name: string; value: number }, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  
  // Derived KPIs based on mock requirement
  const totalOrders = 30;
  const activeCouriers = 8;
  const successRate = "96.2%";
  const totalCOD = 45200000;
  
  const recentOrders = mockOrders.slice(0, 5);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-slate-900">Tổng quan hệ thống</h2>
        <p className="text-xs text-slate-500 mt-0.5">Bảng điều khiển hoạt động giao vận hàng ngày</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng đơn hàng"
          value={totalOrders}
          trend={12}
          icon={<Package size={15} className="text-red-600" />}
          iconBg="bg-red-50"
        />
        <StatCard
          title="Tài xế hoạt động"
          value={activeCouriers}
          trend={2}
          icon={<Truck size={15} className="text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Giao thành công"
          value={successRate}
          trend={1.5}
          icon={<CheckCircle size={15} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="COD Đã thu"
          value={formatCurrency(totalCOD)}
          trend={5}
          icon={<DollarSign size={15} className="text-amber-600" />}
          iconBg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Chart Column */}
        <div className="lg:col-span-2">
          <div className="card p-5 h-[340px] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Khối lượng đơn hàng</h3>
                <p className="text-xs text-slate-500 mt-0.5">Thống kê 7 ngày gần nhất</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorOrdersDb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
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
                    stroke="#DC2626"
                    strokeWidth={2}
                    fill="url(#colorOrdersDb)"
                    dot={{ r: 3, fill: '#DC2626', strokeWidth: 1.5, stroke: 'white' }}
                    activeDot={{ r: 4.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">Thao tác nhanh</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => router.push('/orders')}
                className="flex items-center justify-between p-2 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Plus size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">Tạo đơn hàng mới</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600" />
              </button>
              
              <button
                onClick={() => router.push('/vrp')}
                className="flex items-center justify-between p-2 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Route size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">Tối ưu tuyến đường</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600" />
              </button>

              <button
                onClick={() => router.push('/tracking')}
                className="flex items-center justify-between p-2 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <MapIcon size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">Bản đồ trực tiếp</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600" />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card flex flex-col h-[340px] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 shrink-0">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Hoạt động gần đây</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">5 đơn hàng cập nhật mới nhất</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50/80 transition-colors">
                  <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Package size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold font-mono text-slate-900">{order.code}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(order.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{order.receiverName} - {order.deliveryAddress}</p>
                  </div>
                  <StatusBadge status={order.status} className="text-[11px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
