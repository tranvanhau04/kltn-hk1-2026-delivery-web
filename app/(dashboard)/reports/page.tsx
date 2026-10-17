'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, CheckCircle, DollarSign, AlertTriangle,
  Check, FileSpreadsheet, Loader2, Inbox,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { StatCard } from '@/components/common/StatCard';
import { fetchReportKpis, reconcileShift, downloadReportExcel } from '@/lib/api';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import type { ReportKpis, ShiftOverviewItem } from '@/types/domain';

// ─── Date range → API period mapping ─────────────────────────────────────────

function mapDateRange(range: string): {
  period: 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
} {
  if (range === '7d') return { period: 'week' };
  if (range === '30d') return { period: 'month' };
  // 90d → custom with calculated dates
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  return {
    period: 'custom',
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ─── Custom Tooltip for Recharts ────────────────────────────────────────────

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

// ─── COD Reconciliation Table ────────────────────────────────────────────────

function ReconciliationTable({
  shifts,
  onReconcile,
}: {
  shifts: ShiftOverviewItem[];
  onReconcile: (shiftId: string, codCollected: number, driverName: string) => void;
}) {
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  const handleClick = async (shift: ShiftOverviewItem) => {
    setReconcilingId(shift.shiftId);
    await onReconcile(shift.shiftId, shift.codCollected, shift.driverName);
    setReconcilingId(null);
  };

  if (shifts.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-base font-700 text-gray-900">Đối soát COD theo ca</h3>
          <p className="text-xs text-gray-400 mt-0.5">Duyệt đối soát COD từng tài xế theo ca làm việc</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Inbox size={40} className="mb-3 text-gray-300" />
          <p className="text-sm font-500">Không có ca làm việc trong khoảng thời gian này</p>
          <p className="text-xs mt-1">Thử thay đổi bộ lọc ngày để xem dữ liệu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-base font-700 text-gray-900">Đối soát COD theo ca</h3>
        <p className="text-xs text-gray-400 mt-0.5">Duyệt đối soát COD từng tài xế theo ca làm việc</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Tài xế</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Biển số</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">Bắt đầu</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">COD Thu</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">COD Nộp</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Chênh lệch</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">Đối soát</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => {
              const diff = shift.codCollected - shift.codSubmitted;
              const isReconciled = shift.reconciliationStatus === 'RECONCILED';
              return (
                <tr key={shift.shiftId} className="border-b border-slate-50 hover:bg-[#FFF0F0]/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-xs">
                        {shift.driverName.charAt(0)}
                      </div>
                      <span className="text-sm font-600 text-gray-800">{shift.driverName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">{shift.licensePlate}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 text-center">
                    {shift.startTime ? formatDateTime(shift.startTime) : '–'}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">
                    {formatCurrency(shift.codCollected)}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">
                    {formatCurrency(shift.codSubmitted)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={cn(
                      'text-sm font-600',
                      diff > 0 ? 'text-red-500' : diff < 0 ? 'text-amber-500' : 'text-green-600',
                    )}>
                      {diff === 0 ? '0 ₫' : (diff > 0 ? '-' : '+') + formatCurrency(Math.abs(diff))}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {isReconciled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-600 text-green-700 bg-green-50 px-2 py-1 rounded-lg">
                        <Check size={11} /> Đã đối soát
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClick(shift)}
                        disabled={reconcilingId === shift.shiftId}
                        className="btn-primary text-xs h-8 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        id={`btn-reconcile-${shift.shiftId}`}
                      >
                        {reconcilingId === shift.shiftId ? (
                          <Loader2 size={12} className="animate-spin-slow" />
                        ) : null}
                        Duyệt đối soát
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Weekly BarChart ──────────────────────────────────────────────────────────

function WeeklyBarChart({ data }: { data: { label: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (data.every((d) => d.count === 0)) {
    return (
      <div className="card p-6">
        <div className="mb-6">
          <h3 className="text-base font-700 text-gray-900">Lượng đơn hàng theo tuần</h3>
          <p className="text-xs text-gray-400 mt-0.5">Phân bố đơn hàng theo ngày trong tuần</p>
        </div>
        <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
          <Inbox size={36} className="mb-2 text-gray-300" />
          <p className="text-sm">Chưa có dữ liệu đơn hàng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-700 text-gray-900">Lượng đơn hàng theo tuần</h3>
          <p className="text-xs text-gray-400 mt-0.5">Phân bố đơn hàng theo ngày trong tuần</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-[#FA7070] inline-block" />
          <span className="text-gray-500">Số đơn</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FA7070" stopOpacity={1} />
              <stop offset="100%" stopColor="#FA7070" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(250, 112, 112, 0.06)' }} />
          <Bar dataKey="count" name="Số đơn" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.count === maxCount ? '#FA7070' : 'url(#barGradient)'}
                opacity={entry.count === maxCount ? 1 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Reports Page ───────────────────────────────────────────────────────

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  // Fetch KPIs from API when dateRange changes
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const { period, startDate, endDate } = mapDateRange(dateRange);
        const data = await fetchReportKpis(period, startDate, endDate);
        if (!ignore) {
          setKpis(data);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch KPIs:', err);
          toast.error('Tải dữ liệu thất bại', 'Không thể kết nối đến server. Vui lòng thử lại.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [dateRange, toast]);

  // Refresh KPIs for event handlers (e.g. after COD reconciliation)
  const refreshKpis = useCallback(async () => {
    setLoading(true);
    try {
      const { period, startDate, endDate } = mapDateRange(dateRange);
      const data = await fetchReportKpis(period, startDate, endDate);
      setKpis(data);
    } catch (err) {
      console.error('Failed to fetch KPIs:', err);
      toast.error('Tải dữ liệu thất bại', 'Không thể kết nối đến server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, toast]);

  // Handle COD reconciliation (1-click: submittedAmount = codCollected)
  const handleReconcile = async (shiftId: string, codCollected: number, driverName: string) => {
    try {
      const result = await reconcileShift(shiftId, codCollected);
      toast.success('Đối soát COD thành công', result.message || `Đã duyệt đối soát cho ${driverName}`);
      // Refresh data to reflect the updated reconciliation status
      await refreshKpis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể duyệt đối soát. Vui lòng thử lại.';
      toast.error('Đối soát thất bại', msg);
    }
  };

  // Handle Excel export
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { startDate, endDate } = mapDateRange(dateRange);
      await downloadReportExcel(startDate, endDate);
      toast.success('Xuất báo cáo thành công', 'File Excel đã được tải xuống');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể xuất file. Vui lòng thử lại.';
      toast.error('Xuất báo cáo thất bại', msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-700 text-gray-900">Báo cáo & Thống kê</h2>
          <p className="text-sm text-gray-400 mt-0.5">Tổng quan hoạt động giao vận</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Filters */}
          {['7d', '30d', '90d'].map((r) => (
            <button
              key={r}
              onClick={() => {
                setLoading(true);
                setDateRange(r);
              }}
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

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className="btn-secondary text-sm h-9 px-4 ml-2 disabled:opacity-50"
            id="btn-export-excel"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin-slow" />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            Xuất báo cáo Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 stagger">
        <StatCard
          title="Tổng đơn hàng"
          value={kpis?.totalOrders ?? 0}
          trend={5}
          icon={<Package size={18} className="text-[#FA7070]" />}
          iconBg="bg-[#FFF0F0]"
          loading={loading}
        />
        <StatCard
          title="Tỷ lệ thành công"
          value={`${kpis?.successRate ?? 0}%`}
          trend={2}
          icon={<CheckCircle size={18} className="text-green-500" />}
          iconBg="bg-green-50"
          loading={loading}
        />
        <StatCard
          title="Tổng COD thu"
          value={formatCurrency(kpis?.totalCodCollected ?? 0)}
          trend={8}
          icon={<DollarSign size={18} className="text-amber-500" />}
          iconBg="bg-amber-50"
          loading={loading}
        />
        <StatCard
          title="Đơn giao thất bại"
          value={kpis?.failedOrders ?? 0}
          trend={-3}
          trendLabel="so với tuần trước"
          icon={<AlertTriangle size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          loading={loading}
        />
      </div>

      {/* Weekly Bar Chart */}
      <WeeklyBarChart data={kpis?.weeklyOrderTrends ?? []} />

      {/* COD Reconciliation Table */}
      <ReconciliationTable
        shifts={kpis?.shiftOverview ?? []}
        onReconcile={handleReconcile}
      />
    </div>
  );
}
