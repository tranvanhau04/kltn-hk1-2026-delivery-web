'use client';

import React, { useEffect, useState } from 'react';
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
  RefreshCw,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { fetchReportKpis, fetchOrders, ApiOrder } from '@/lib/api';
import type { ReportKpis } from '@/types/domain';
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
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardOverviewPage() {
  const router = useRouter();

  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiRes, ordersRes] = await Promise.all([
        fetchReportKpis('week'),
        fetchOrders({ limit: 5 }).catch(() => ({ data: [], total: 0 })),
      ]);
      setKpis(kpiRes);
      setRecentOrders(ordersRes.data || []);
    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
      setError(
        err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      try {
        const [kpiRes, ordersRes] = await Promise.all([
          fetchReportKpis('week'),
          fetchOrders({ limit: 5 }).catch(() => ({ data: [], total: 0 })),
        ]);
        if (!ignore) {
          setKpis(kpiRes);
          setRecentOrders(ordersRes.data || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Error fetching dashboard data:', err);
          setError(
            err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.',
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      ignore = true;
    };
  }, []);

  // Transform weekly trends for Recharts AreaChart
  const chartData =
    kpis?.weeklyOrderTrends?.map((item) => ({
      day: item.label,
      orders: item.count,
    })) || [
      { day: 'T2', orders: 0 },
      { day: 'T3', orders: 0 },
      { day: 'T4', orders: 0 },
      { day: 'T5', orders: 0 },
      { day: 'T6', orders: 0 },
      { day: 'T7', orders: 0 },
      { day: 'CN', orders: 0 },
    ];

  const totalOrders = kpis?.totalOrders ?? 0;
  const activeCouriers = kpis?.shiftOverview?.length ?? 0;
  const successRate = kpis ? `${kpis.successRate}%` : '0%';
  const totalCOD = kpis?.totalCodCollected ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tổng quan hệ thống</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Bảng điều khiển hoạt động giao vận hàng ngày (Dữ liệu thời gian thực)
          </p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50 w-fit"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#FA7070]' : ''} />
          Làm mới
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void handleRefresh()}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium text-xs transition-colors shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng đơn hàng tuần này"
          value={totalOrders}
          loading={loading}
          icon={<Package size={18} className="text-[#FA7070]" />}
          iconBg="bg-[#FFF0F0]"
        />
        <StatCard
          title="Ca làm việc / Tài xế"
          value={activeCouriers}
          loading={loading}
          icon={<Truck size={18} className="text-blue-500" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Tỷ lệ giao thành công"
          value={successRate}
          loading={loading}
          icon={<CheckCircle size={18} className="text-green-500" />}
          iconBg="bg-green-50"
        />
        <StatCard
          title="Tổng COD đã thu"
          value={formatCurrency(totalCOD)}
          loading={loading}
          icon={<DollarSign size={18} className="text-amber-500" />}
          iconBg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 h-[360px] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">Khối lượng đơn hàng</h3>
                <p className="text-xs text-gray-400 mt-0.5">Biểu đồ thống kê 7 ngày trong tuần</p>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="space-y-3 w-full p-4">
                  <div className="shimmer h-48 w-full rounded-xl" />
                  <div className="flex justify-between">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div key={i} className="shimmer h-4 w-8 rounded" />
                    ))}
                  </div>
                </div>
              </div>
            ) : totalOrders === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <Inbox size={40} className="mb-2 text-gray-300" />
                <p className="text-sm font-medium">Chưa có đơn hàng nào trong tuần này</p>
                <p className="text-xs text-gray-400 mt-1">Dữ liệu sẽ hiển thị khi có đơn hàng mới phát sinh.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colorOrdersDb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FA7070" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#FA7070" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
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
            )}
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Thao tác nhanh</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => router.push('/orders')}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[#FA7070] hover:bg-[#FFF0F0] transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FA7070]/10 flex items-center justify-center group-hover:bg-[#FA7070] transition-colors">
                    <Plus size={16} className="text-[#FA7070] group-hover:text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Tạo đơn hàng mới</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-[#FA7070]" />
              </button>

              <button
                onClick={() => router.push('/reports')}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                    <DollarSign size={16} className="text-amber-600 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Đối soát COD & Báo cáo</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-amber-600" />
              </button>

              <button
                onClick={() => router.push('/vrp')}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-violet-300 hover:bg-violet-50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-500 transition-colors">
                    <Route size={16} className="text-violet-600 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Tối ưu tuyến đường</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-violet-600" />
              </button>

              <button
                onClick={() => router.push('/tracking')}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <MapIcon size={16} className="text-blue-600 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Bản đồ trực tiếp</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card flex flex-col h-[360px]">
            <div className="p-5 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Hoạt động gần đây</h3>
                <p className="text-xs text-gray-400 mt-0.5">5 đơn hàng cập nhật mới nhất</p>
              </div>
              <button
                onClick={() => router.push('/orders')}
                className="text-xs font-semibold text-[#FA7070] hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="space-y-3 p-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="shimmer w-9 h-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="shimmer h-3.5 w-24 rounded" />
                        <div className="shimmer h-3 w-40 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                  <Inbox size={28} className="mb-1 text-gray-300" />
                  <p className="text-xs font-medium">Chưa có đơn hàng nào</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/orders?selected=${order.id}`)}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{order.code}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {order.receiverName} - {order.deliveryAddress}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {order.createdAt ? formatDateTime(order.createdAt) : ''}
                      </p>
                    </div>
                    <StatusBadge status={order.status} className="text-[10px]" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
