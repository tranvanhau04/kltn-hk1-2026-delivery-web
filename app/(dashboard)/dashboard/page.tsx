'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, CheckCircle, DollarSign, Plus, Route, Map as MapIcon, ChevronRight } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { mockOrders, mockChartData } from '@/lib/mock-data';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-700 text-gray-700 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-600 text-gray-800">{p.value}</span>
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-700 text-gray-900">Tổng quan hệ thống</h2>
        <p className="text-sm text-gray-400 mt-0.5">Bảng điều khiển hoạt động giao vận hàng ngày</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng đơn hàng"
          value={totalOrders}
          trend={12}
          icon={<Package size={18} className="text-[#FA7070]" />}
          iconBg="bg-[#FFF0F0]"
        />
        <StatCard
          title="Tài xế hoạt động"
          value={activeCouriers}
          trend={2}
          icon={<Truck size={18} className="text-blue-500" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Giao thành công"
          value={successRate}
          trend={1.5}
          icon={<CheckCircle size={18} className="text-green-500" />}
          iconBg="bg-green-50"
        />
        <StatCard
          title="COD Đã thu"
          value={formatCurrency(totalCOD)}
          trend={5}
          icon={<DollarSign size={18} className="text-amber-500" />}
          iconBg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 h-[360px] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h3 className="text-base font-700 text-gray-900">Khối lượng đơn hàng</h3>
                <p className="text-xs text-gray-400 mt-0.5">Thống kê 7 ngày gần nhất</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorOrdersDb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FA7070" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FA7070" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    name="Tổng đơn"
                    stroke="#FA7070"
                    strokeWidth={3}
                    fill="url(#colorOrdersDb)"
                    dot={{ r: 4, fill: '#FA7070', strokeWidth: 2, stroke: 'white' }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-5">
            <h3 className="text-sm font-700 text-gray-900 mb-4">Thao tác nhanh</h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => router.push('/orders')} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[#FA7070] hover:bg-[#FFF0F0] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FA7070]/10 flex items-center justify-center group-hover:bg-[#FA7070] transition-colors">
                    <Plus size={16} className="text-[#FA7070] group-hover:text-white" />
                  </div>
                  <span className="text-sm font-600 text-gray-700">Tạo đơn hàng mới</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-[#FA7070]" />
              </button>
              
              <button onClick={() => router.push('/vrp')} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-violet-300 hover:bg-violet-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-500 transition-colors">
                    <Route size={16} className="text-violet-600 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-600 text-gray-700">Tối ưu tuyến đường</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-violet-600" />
              </button>

              <button onClick={() => router.push('/tracking')} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <MapIcon size={16} className="text-blue-600 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-600 text-gray-700">Bản đồ trực tiếp</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card flex flex-col h-[360px]">
            <div className="p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-700 text-gray-900">Hoạt động gần đây</h3>
              <p className="text-xs text-gray-400 mt-0.5">5 đơn hàng cập nhật mới nhất</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-600 text-gray-800 truncate">{order.code}</p>
                    <p className="text-xs text-gray-500 truncate">{order.receiverName} - {order.deliveryAddress}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <StatusBadge status={order.status} className="text-[10px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
