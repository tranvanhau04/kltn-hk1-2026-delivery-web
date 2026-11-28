'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Truck,
  CheckCircle,
  DollarSign,
  Plus,
  Route,
  Map as MapIcon,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fetchDashboardStats, fetchOrders, type DashboardStats, type ApiOrder } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import dynamic from 'next/dynamic';

const DashboardOrdersChart = dynamic(
  () => import('@/components/dashboard/DashboardOrdersChart'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col justify-end gap-3 p-4 animate-pulse">
        <div className="flex items-end gap-3 h-48 w-full justify-between">
          {[40, 65, 45, 85, 60, 75, 95].map((h, i) => (
            <div key={i} className="flex-1 bg-slate-100 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="h-3 bg-slate-100 rounded w-full" />
      </div>
    ),
  },
);

export default function DashboardOverviewPage() {
  const router = useRouter();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, ordersRes] = await Promise.all([
        fetchDashboardStats(),
        fetchOrders({ limit: 5 }),
      ]);
      setStats(statsRes);
      setRecentOrders(ordersRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalOrders = stats?.totalOrders ?? 0;
  const activeCouriers = stats?.activeDrivers ?? 0;
  const successRate = `${stats?.successRate ?? 0}%`;
  const totalCOD = stats?.totalCOD ?? 0;
  const chartData = stats?.chartData || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Tổng quan hệ thống</h2>
          <p className="text-xs text-slate-500 mt-0.5">Bảng điều khiển hoạt động giao vận hàng ngày</p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1.5 h-8 px-3"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng đơn hàng"
          value={totalOrders}
          trend={12}
          loading={loading}
          icon={<Package size={16} className="text-slate-700" />}
          iconBg="bg-slate-100"
        />
        <StatCard
          title="Tài xế hoạt động"
          value={activeCouriers}
          trend={2}
          loading={loading}
          icon={<Truck size={16} className="text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Giao thành công"
          value={successRate}
          trend={1.5}
          loading={loading}
          icon={<CheckCircle size={16} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="COD Đã thu"
          value={formatCurrency(totalCOD)}
          trend={5}
          loading={loading}
          icon={<DollarSign size={16} className="text-amber-600" />}
          iconBg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 h-[360px] flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Khối lượng đơn hàng</h3>
                <p className="text-xs text-slate-500 mt-0.5">Thống kê phân bổ theo ngày trong tuần</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
                <span>Tổng đơn</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              {loading ? (
                <div className="w-full h-full flex flex-col justify-end gap-3 p-4 animate-pulse">
                  <div className="flex items-end gap-3 h-48 w-full justify-between">
                    {[40, 65, 45, 85, 60, 75, 95].map((h, i) => (
                      <div key={i} className="flex-1 bg-slate-100 rounded-t" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ) : chartData.length > 0 ? (
                <DashboardOrdersChart data={chartData} />
              ) : (
                <p className="text-xs text-slate-400">Không có dữ liệu đơn hàng</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Thao tác nhanh</h3>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => router.push('/orders')} className="flex items-center justify-between p-2.5 rounded-md border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white">
                    <Plus size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-800">Tạo đơn hàng mới</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-700" />
              </button>
              
              <button onClick={() => router.push('/vrp')} className="flex items-center justify-between p-2.5 rounded-md border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                    <Route size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-800">Tối ưu tuyến đường</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-700" />
              </button>

              <button onClick={() => router.push('/tracking')} className="flex items-center justify-between p-2.5 rounded-md border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
                    <MapIcon size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-800">Bản đồ trực tiếp</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-700" />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card flex flex-col h-[360px]">
            <div className="px-5 py-3.5 border-b border-slate-200 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900">Hoạt động gần đây</h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">5 đơn hàng cập nhật mới nhất</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 gap-2">
                  <Loader2 size={15} className="animate-spin text-slate-600" />
                  <span>Đang tải đơn hàng...</span>
                </div>
              ) : recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 transition-colors">
                    <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200/70 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold text-slate-900 truncate tabular-nums">{order.code}</p>
                      <p className="text-xs text-slate-500 truncate">{order.receiverName} · {order.deliveryAddress}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <StatusBadge status={order.status} className="text-[11px]" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 p-4 text-center">Chưa có đơn hàng nào</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
