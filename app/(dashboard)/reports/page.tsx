'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Package, CheckCircle, DollarSign, AlertTriangle,
  Check, FileSpreadsheet, Loader2, Inbox,
  TrendingUp, Truck, Trophy, Medal, Award, Users,
  Eye, Square, CheckSquare,
} from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';

const AiAnalystWidget = dynamic(
  () => import('@/components/ai-analyst/AiAnalystWidget').then((m) => m.AiAnalystWidget),
  { ssr: false },
);
const ShiftDetailModal = dynamic(() => import('@/components/reports/ShiftDetailModal'), {
  ssr: false,
});
const WeeklyBarChart = dynamic(
  () => import('@/components/reports/ReportsCharts').then((m) => m.WeeklyBarChart),
  { ssr: false },
);
const RevenueBarChart = dynamic(
  () => import('@/components/reports/ReportsCharts').then((m) => m.RevenueBarChart),
  { ssr: false },
);
const TopDriversBarChart = dynamic(
  () => import('@/components/reports/ReportsCharts').then((m) => m.TopDriversBarChart),
  { ssr: false },
);
const TopCustomersBarChart = dynamic(
  () => import('@/components/reports/ReportsCharts').then((m) => m.TopCustomersBarChart),
  { ssr: false },
);
import {
  fetchReportKpis,
  reconcileShift,
  downloadReportExcel,
  fetchAnalytics,
  downloadAnalyticsExcel,
  bulkReconcileShifts,
} from '@/lib/api';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import type { ReportKpis, ShiftOverviewItem, AnalyticsData } from '@/types/domain';
import { withRoleGuard } from '@/components/auth/withRoleGuard';

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

function mapDays(range: string): number {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  return 90;
}

// ─── COD Reconciliation Table ────────────────────────────────────────────────

function ReconciliationTable({
  shifts,
  onReconcile,
  onViewDetail,
  onBulkReconcile,
}: {
  shifts: ShiftOverviewItem[];
  onReconcile: (shiftId: string, codCollected: number, driverName: string) => void;
  onViewDetail: (shiftId: string) => void;
  onBulkReconcile: (shiftIds: string[]) => Promise<void>;
}) {
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Reset selection khi shifts thay đổi
  useEffect(() => {
    setSelectedIds(new Set());
  }, [shifts]);

  const pendingShifts = shifts.filter((s) => s.reconciliationStatus === 'PENDING');

  const allPendingSelected =
    pendingShifts.length > 0 && pendingShifts.every((s) => selectedIds.has(s.shiftId));
  const somePendingSelected =
    pendingShifts.some((s) => selectedIds.has(s.shiftId)) && !allPendingSelected;

  const toggleAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingShifts.map((s) => s.shiftId)));
    }
  };

  const toggleOne = (shiftId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.add(shiftId);
      }
      return next;
    });
  };

  const handleClick = async (shift: ShiftOverviewItem) => {
    setReconcilingId(shift.shiftId);
    await onReconcile(shift.shiftId, shift.codCollected, shift.driverName);
    setReconcilingId(null);
  };

  const handleBulkClick = async () => {
    setBulkLoading(true);
    await onBulkReconcile(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkLoading(false);
  };

  const selectedCount = selectedIds.size;
  const selectedTotalCod = shifts
    .filter((s) => selectedIds.has(s.shiftId))
    .reduce((sum, s) => sum + s.codCollected, 0);

  if (shifts.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Đối soát COD theo ca</h3>
          <p className="text-xs text-slate-500 mt-0.5">Duyệt đối soát COD từng tài xế theo ca làm việc</p>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
          <Inbox size={32} className="mb-2.5 text-slate-300" />
          <p className="text-xs font-medium text-slate-600">Không có ca làm việc trong khoảng thời gian này</p>
          <p className="text-xs mt-0.5 text-slate-400">Thử thay đổi bộ lọc ngày để xem dữ liệu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Table Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Đối soát COD theo ca</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhấn vào dòng để xem chi tiết · Chọn nhiều ca để duyệt hàng loạt
          </p>
        </div>
        {pendingShifts.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {pendingShifts.length} ca chờ duyệt
          </span>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckSquare size={15} className="text-emerald-400" />
            <span className="tabular-nums">
              Đã chọn <strong>{selectedCount}</strong> ca ·{' '}
              Tổng COD: <strong>{formatCurrency(selectedTotalCod)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-md hover:bg-slate-800 transition-colors"
            >
              Hủy chọn
            </button>
            <button
              onClick={handleBulkClick}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#D92D20] hover:bg-[#B42318] disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors tabular-nums"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Duyệt {selectedCount} ca đã chọn
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-y border-slate-200">
              {/* Checkbox column */}
              <th className="pl-4 pr-2 py-2.5 w-10">
                <button
                  onClick={toggleAll}
                  className="text-slate-400 hover:text-slate-800 transition-colors"
                  title={allPendingSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả ca chờ duyệt'}
                >
                  {allPendingSelected ? (
                    <CheckSquare size={15} className="text-slate-900" />
                  ) : somePendingSelected ? (
                    <Square size={15} className="text-slate-600 opacity-70" />
                  ) : (
                    <Square size={15} />
                  )}
                </button>
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left">Tài xế</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left">Biển số</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Bắt đầu</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">COD Thu</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">COD Nộp</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Chênh lệch</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => {
              const diff = shift.codCollected - shift.codSubmitted;
              const isReconciled = shift.reconciliationStatus === 'RECONCILED';
              const isSelected = selectedIds.has(shift.shiftId);

              return (
                <tr
                  key={shift.shiftId}
                  className={cn(
                    'py-2.5 text-sm text-slate-700 border-b border-slate-100 transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-slate-100/80 hover:bg-slate-100'
                      : 'hover:bg-slate-50/70',
                  )}
                  onClick={() => onViewDetail(shift.shiftId)}
                >
                  {/* Checkbox */}
                  <td
                    className="pl-4 pr-2 py-2.5 w-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isReconciled) toggleOne(shift.shiftId);
                    }}
                  >
                    {!isReconciled ? (
                      <button className="text-slate-400 hover:text-slate-800 transition-colors">
                        {isSelected ? (
                          <CheckSquare size={15} className="text-slate-900" />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 h-4 block" />
                    )}
                  </td>

                  {/* Driver */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs">
                        {shift.driverName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{shift.driverName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{shift.licensePlate}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 text-center tabular-nums">
                    {shift.startTime ? formatDateTime(shift.startTime) : '–'}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">
                    {formatCurrency(shift.codCollected)}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">
                    {formatCurrency(shift.codSubmitted)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={cn(
                      'text-sm font-medium tabular-nums',
                      diff > 0 ? 'text-[#D92D20]' : diff < 0 ? 'text-amber-600' : 'text-emerald-600',
                    )}>
                      {diff === 0 ? '0 ₫' : (diff > 0 ? '-' : '+') + formatCurrency(Math.abs(diff))}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    className="px-4 py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Eye - View detail */}
                      <button
                        onClick={() => onViewDetail(shift.shiftId)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        title="Xem chi tiết ca"
                      >
                        <Eye size={14} />
                      </button>

                      {/* Reconcile button */}
                      {isReconciled ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/70 border border-emerald-200 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Đã duyệt
                        </span>
                      ) : (
                        <button
                          onClick={() => void handleClick(shift)}
                          disabled={reconcilingId === shift.shiftId}
                          className="btn-primary text-xs h-7 px-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          id={`btn-reconcile-${shift.shiftId}`}
                        >
                          {reconcilingId === shift.shiftId ? (
                            <Loader2 size={12} className="animate-spin-slow" />
                          ) : null}
                          Duyệt
                        </button>
                      )}
                    </div>
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

// ─── Rank Badge ──────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-50 border border-amber-200 text-amber-600">
        <Trophy size={13} />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-600">
        <Medal size={13} />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-orange-50 border border-orange-200 text-orange-600">
        <Award size={13} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-50 border border-slate-200/70 text-slate-500 text-xs font-medium tabular-nums">
      {rank}
    </span>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabKey = 'overview' | 'revenue' | 'top_drivers' | 'top_customers';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Tổng quan & Đơn hàng' },
  { key: 'revenue', label: 'Báo cáo Doanh thu' },
  { key: 'top_drivers', label: 'Top Tài xế Doanh thu' },
  { key: 'top_customers', label: 'Top Khách hàng' },
];

// ─── Main Reports Page ───────────────────────────────────────────────────────

function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const toast = useToast();

  // Fetch analytics data
  const loadAnalytics = useCallback(async (range: string) => {
    setAnalyticsLoading(true);
    try {
      const data = await fetchAnalytics(mapDays(range));
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

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
    loadAnalytics(dateRange);
    return () => {
      ignore = true;
    };
  }, [dateRange, toast, loadAnalytics]);

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

  // Handle single COD reconciliation (1-click: submittedAmount = codCollected)
  const handleReconcile = async (shiftId: string, codCollected: number, driverName: string) => {
    try {
      const result = await reconcileShift(shiftId, codCollected);
      toast.success('Đối soát COD thành công', result.message || `Đã duyệt đối soát cho ${driverName}`);
      await refreshKpis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể duyệt đối soát. Vui lòng thử lại.';
      toast.error('Đối soát thất bại', msg);
    }
  };

  // Handle bulk COD reconciliation
  const handleBulkReconcile = async (shiftIds: string[]) => {
    try {
      const result = await bulkReconcileShifts(shiftIds);
      toast.success(
        'Duyệt hàng loạt thành công',
        result.message || `Đã duyệt ${result.reconciledCount} ca`,
      );
      await refreshKpis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể duyệt hàng loạt. Vui lòng thử lại.';
      toast.error('Duyệt hàng loạt thất bại', msg);
    }
  };

  // Handle Excel export
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      if (activeTab === 'overview') {
        const { startDate, endDate } = mapDateRange(dateRange);
        await downloadReportExcel(startDate, endDate);
      } else if (activeTab === 'revenue') {
        await downloadAnalyticsExcel(mapDays(dateRange), 'revenue');
      } else if (activeTab === 'top_drivers') {
        await downloadAnalyticsExcel(mapDays(dateRange), 'top_drivers');
      } else {
        await downloadAnalyticsExcel(mapDays(dateRange), 'top_customers');
      }
      toast.success('Xuất báo cáo thành công', 'File Excel đã được tải xuống');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể xuất file. Vui lòng thử lại.';
      toast.error('Xuất báo cáo thất bại', msg);
    } finally {
      setExporting(false);
    }
  };

  // ─── Revenue Tab Content ─────────────────────────────────────────────────

  const renderRevenueTab = () => {
    if (analyticsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 size={32} className="animate-spin-slow mb-3" />
          <p className="text-sm">Đang tải dữ liệu doanh thu...</p>
        </div>
      );
    }

    if (!analytics) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Inbox size={40} className="mb-3 text-gray-300" />
          <p className="text-sm font-500">Chưa có dữ liệu phân tích</p>
        </div>
      );
    }

    const { summary, chartData } = analytics.revenueReport;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200/70 flex items-center justify-center">
                <DollarSign size={16} className="text-slate-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tổng cước vận chuyển</p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">{formatCurrency(summary.totalGrossRevenue)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 tabular-nums">{summary.deliveredCount} đơn giao thành công</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-8 h-8 rounded-md bg-emerald-50 border border-emerald-200/70 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Doanh thu nền tảng (15%)</p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">{formatCurrency(summary.totalPlatformRevenue)}</p>
              </div>
            </div>
            <p className="text-xs text-emerald-600 font-medium">Chiết khấu nền tảng</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200/70 flex items-center justify-center">
                <Truck size={16} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Chi trả tài xế (85%)</p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">{formatCurrency(summary.totalDriverPayout)}</p>
              </div>
            </div>
            <p className="text-xs text-indigo-600 font-medium">Thu nhập tài xế</p>
          </div>
        </div>

        {/* Revenue Bar Chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Biểu đồ doanh thu theo ngày</h3>
              <p className="text-xs text-slate-500 mt-0.5">Phân bổ doanh thu: cước vận chuyển, nền tảng, tài xế</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block" />
                <span className="text-slate-600">Tổng cước</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                <span className="text-slate-600">Nền tảng</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
                <span className="text-slate-600">Tài xế</span>
              </span>
            </div>
          </div>
          <RevenueBarChart chartData={chartData} />
        </div>
      </div>
    );
  };

  // ─── Top Drivers Tab Content ─────────────────────────────────────────────

  const renderTopDriversTab = () => {
    if (analyticsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 size={28} className="animate-spin-slow mb-3" />
          <p className="text-xs">Đang tải dữ liệu tài xế...</p>
        </div>
      );
    }

    if (!analytics || analytics.topDriversByRevenue.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Users size={36} className="mb-2.5 text-slate-300" />
          <p className="text-xs font-medium">Chưa có dữ liệu tài xế</p>
        </div>
      );
    }

    const drivers = analytics.topDriversByRevenue;
    const top5 = drivers.slice(0, 5);

    return (
      <div className="space-y-6">
        {/* Horizontal Bar Chart — Top 5 by Revenue */}
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-900">Top 5 Tài xế theo Doanh thu</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tổng cước vận chuyển cao nhất</p>
          </div>
          <TopDriversBarChart top5={top5} />
        </div>

        {/* Drivers Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Bảng xếp hạng Tài xế</h3>
            <p className="text-xs text-slate-500 mt-0.5">Chi tiết doanh thu và thu nhập từng tài xế</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-200">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Hạng</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left">Tên tài xế</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left">Biển số xe</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Số đơn giao</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Tổng doanh thu</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Chiết khấu NTT (15%)</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Thu nhập thực (85%)</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, i) => (
                  <tr key={driver.driverId} className="py-2.5 text-sm text-slate-700 border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 text-center">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs">
                          {driver.fullName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{driver.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{driver.licensePlate}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">{driver.deliveredOrders}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">{formatCurrency(driver.totalGrossRevenue)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-emerald-700 text-right tabular-nums">{formatCurrency(driver.platformRevenue)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-indigo-700 text-right tabular-nums">{formatCurrency(driver.driverNetIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ─── Top Customers Tab Content ───────────────────────────────────────────

  const renderTopCustomersTab = () => {
    if (analyticsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 size={28} className="animate-spin-slow mb-3" />
          <p className="text-xs">Đang tải dữ liệu khách hàng...</p>
        </div>
      );
    }

    if (!analytics || analytics.topCustomersByOrders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Users size={36} className="mb-2.5 text-slate-300" />
          <p className="text-xs font-medium">Chưa có dữ liệu khách hàng</p>
        </div>
      );
    }

    const customers = analytics.topCustomersByOrders;
    const top5 = customers.slice(0, 5);

    return (
      <div className="space-y-6">
        {/* Vertical Bar Chart — Top 5 by Order Count */}
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-900">Top 5 Khách hàng theo Số đơn</h3>
            <p className="text-xs text-slate-500 mt-0.5">Khách hàng có tổng đơn hàng cao nhất</p>
          </div>
          <TopCustomersBarChart top5={top5} />
        </div>

        {/* Customers Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Bảng xếp hạng Khách hàng</h3>
            <p className="text-xs text-slate-500 mt-0.5">Chi tiết đơn hàng và giá trị từng khách hàng</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-200">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Hạng</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left">Tên khách hàng</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left">SĐT</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Tổng đơn</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Đơn giao OK</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Tổng COD</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Tổng phí ship</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, i) => (
                  <tr key={`${customer.customerPhone}-${i}`} className="py-2.5 text-sm text-slate-700 border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 text-center">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs">
                          {customer.customerName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{customer.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600 tabular-nums">{customer.customerPhone}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">{customer.totalOrders}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-emerald-700 text-right tabular-nums">{customer.deliveredOrders}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">{formatCurrency(customer.totalCodValue)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">{formatCurrency(customer.totalShippingFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Báo cáo &amp; Thống kê</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tổng quan hoạt động giao vận và đối soát tài chính</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Date Range Filters */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-md p-0.5">
            {['7d', '30d', '90d'].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setLoading(true);
                  setDateRange(r);
                }}
                className={cn(
                  'px-3 h-7 rounded text-xs font-medium tabular-nums transition-colors',
                  dateRange === r
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
                id={`range-${r}`}
              >
                {r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '90 ngày'}
              </button>
            ))}
          </div>

          {/* Export Excel Button */}
          <button
            onClick={() => void handleExportExcel()}
            disabled={exporting || loading}
            className="btn-secondary text-xs h-8 px-3 ml-1 disabled:opacity-50"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard
          title="Tổng đơn hàng"
          value={kpis?.totalOrders ?? 0}
          trend={5}
          icon={<Package size={16} className="text-slate-700" />}
          iconBg="bg-slate-100"
          loading={loading}
        />
        <StatCard
          title="Tỷ lệ thành công"
          value={`${kpis?.successRate ?? 0}%`}
          trend={2}
          icon={<CheckCircle size={16} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          loading={loading}
        />
        <StatCard
          title="Tổng COD thu"
          value={formatCurrency(kpis?.totalCodCollected ?? 0)}
          trend={8}
          icon={<DollarSign size={16} className="text-amber-600" />}
          iconBg="bg-amber-50"
          loading={loading}
        />
        <StatCard
          title="Đơn giao thất bại"
          value={kpis?.failedOrders ?? 0}
          trend={-3}
          trendLabel="so với tuần trước"
          icon={<AlertTriangle size={16} className="text-[#D92D20]" />}
          iconBg="bg-red-50"
          loading={loading}
        />
      </div>

      {/* Tab Bar */}
      <div className="bg-slate-100/80 rounded-lg p-1 border border-slate-200/80 inline-flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Weekly Bar Chart */}
          <WeeklyBarChart data={kpis?.weeklyOrderTrends ?? []} />

          {/* COD Reconciliation Table */}
          <ReconciliationTable
            shifts={kpis?.shiftOverview ?? []}
            onReconcile={(shiftId, codCollected, driverName) => void handleReconcile(shiftId, codCollected, driverName)}
            onViewDetail={(shiftId) => setSelectedShiftId(shiftId)}
            onBulkReconcile={handleBulkReconcile}
          />
        </>
      )}

      {activeTab === 'revenue' && renderRevenueTab()}
      {activeTab === 'top_drivers' && renderTopDriversTab()}
      {activeTab === 'top_customers' && renderTopCustomersTab()}

      {/* SmartExpress AI Analyst Widget with Glowing Neon Robot Button */}
      <AiAnalystWidget period={dateRange} />

      {/* Shift Detail Modal — only load/mount when a shift is selected */}
      {selectedShiftId && (
        <ShiftDetailModal
          shiftId={selectedShiftId}
          onClose={() => setSelectedShiftId(null)}
          onReconcile={(shiftId, codCollected, driverName) =>
            void handleReconcile(shiftId, codCollected, driverName)
          }
        />
      )}
    </div>
  );
}

export default withRoleGuard(ReportsPage, ['ADMIN', 'DISPATCHER']);
