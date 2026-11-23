'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, CheckCircle, DollarSign, AlertTriangle,
  Check, FileSpreadsheet, Loader2, Inbox,
  TrendingUp, Truck, Trophy, Medal, Award, Users,
  Eye, Square, CheckSquare,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { StatCard } from '@/components/common/StatCard';
import { AiAnalystWidget } from '@/components/ai-analyst/AiAnalystWidget';
import ShiftDetailModal from '@/components/reports/ShiftDetailModal';
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

// ─── Revenue Tooltip (VNĐ formatted) ────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: {
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
          <span className="font-600 text-gray-800">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
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
      {/* Table Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-700 text-gray-900">Đối soát COD theo ca</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Nhấn vào dòng để xem chi tiết · Chọn nhiều ca để duyệt hàng loạt
          </p>
        </div>
        {pendingShifts.length > 0 && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
            {pendingShifts.length} ca chờ duyệt
          </span>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-blue-800">
            <CheckSquare size={16} className="text-blue-600" />
            <span>
              Đã chọn <strong>{selectedCount}</strong> ca ·{' '}
              Tổng COD: <strong>{formatCurrency(selectedTotalCod)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white/60 transition-colors"
            >
              Hủy chọn
            </button>
            <button
              onClick={handleBulkClick}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-xs font-600 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Duyệt {selectedCount} ca đã chọn
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {/* Checkbox column */}
              <th className="pl-4 pr-2 py-3 w-10">
                <button
                  onClick={toggleAll}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title={allPendingSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả ca chờ duyệt'}
                >
                  {allPendingSelected ? (
                    <CheckSquare size={16} className="text-blue-600" />
                  ) : somePendingSelected ? (
                    <Square size={16} className="text-blue-400 opacity-70" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Tài xế</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Biển số</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">Bắt đầu</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">COD Thu</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">COD Nộp</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Chênh lệch</th>
              <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">Hành động</th>
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
                    'border-b border-slate-50 transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-blue-50/60 hover:bg-blue-50'
                      : 'hover:bg-[#FFF0F0]/30',
                  )}
                  onClick={() => onViewDetail(shift.shiftId)}
                >
                  {/* Checkbox */}
                  <td
                    className="pl-4 pr-2 py-3.5 w-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isReconciled) toggleOne(shift.shiftId);
                    }}
                  >
                    {!isReconciled ? (
                      <button className="text-gray-400 hover:text-blue-600 transition-colors">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 h-4 block" />
                    )}
                  </td>

                  {/* Driver */}
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

                  {/* Actions */}
                  <td
                    className="px-4 py-3.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {/* Eye - View detail */}
                      <button
                        onClick={() => onViewDetail(shift.shiftId)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Xem chi tiết ca"
                      >
                        <Eye size={15} />
                      </button>

                      {/* Reconcile button */}
                      {isReconciled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-600 text-green-700 bg-green-50 px-2 py-1 rounded-lg">
                          <Check size={11} /> Đã duyệt
                        </span>
                      ) : (
                        <button
                          onClick={() => void handleClick(shift)}
                          disabled={reconcilingId === shift.shiftId}
                          className="btn-primary text-xs h-8 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
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

// ─── Rank Badge ──────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-600">
        <Trophy size={14} />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500">
        <Medal size={14} />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-500">
        <Award size={14} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-400 text-xs font-600">
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
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF0F0] flex items-center justify-center">
                <DollarSign size={18} className="text-[#FA7070]" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-500">Tổng cước vận chuyển</p>
                <p className="text-lg font-700 text-gray-900">{formatCurrency(summary.totalGrossRevenue)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">{summary.deliveredCount} đơn giao thành công</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-500">Doanh thu nền tảng (15%)</p>
                <p className="text-lg font-700 text-gray-900">{formatCurrency(summary.totalPlatformRevenue)}</p>
              </div>
            </div>
            <p className="text-xs text-emerald-500 font-500">Chiết khấu nền tảng</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Truck size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-500">Chi trả tài xế (85%)</p>
                <p className="text-lg font-700 text-gray-900">{formatCurrency(summary.totalDriverPayout)}</p>
              </div>
            </div>
            <p className="text-xs text-blue-500 font-500">Thu nhập tài xế</p>
          </div>
        </div>

        {/* Revenue Bar Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-700 text-gray-900">Biểu đồ doanh thu theo ngày</h3>
              <p className="text-xs text-gray-400 mt-0.5">Phân bổ doanh thu: cước vận chuyển, nền tảng, tài xế</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#FA7070] inline-block" />
                <span className="text-gray-500">Tổng cước</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#10B981] inline-block" />
                <span className="text-gray-500">Nền tảng</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#3B82F6] inline-block" />
                <span className="text-gray-500">Tài xế</span>
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(250, 112, 112, 0.06)' }} />
              <Bar dataKey="grossRevenue" name="Tổng cước" fill="#FA7070" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Bar dataKey="platformRevenue" name="Nền tảng (15%)" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Bar dataKey="driverPayout" name="Tài xế (85%)" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ─── Top Drivers Tab Content ─────────────────────────────────────────────

  const renderTopDriversTab = () => {
    if (analyticsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 size={32} className="animate-spin-slow mb-3" />
          <p className="text-sm">Đang tải dữ liệu tài xế...</p>
        </div>
      );
    }

    if (!analytics || analytics.topDriversByRevenue.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users size={40} className="mb-3 text-gray-300" />
          <p className="text-sm font-500">Chưa có dữ liệu tài xế</p>
        </div>
      );
    }

    const drivers = analytics.topDriversByRevenue;
    const top5 = drivers.slice(0, 5);

    return (
      <div className="space-y-6">
        {/* Horizontal Bar Chart — Top 5 by Revenue */}
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-base font-700 text-gray-900">Top 5 Tài xế theo Doanh thu</h3>
            <p className="text-xs text-gray-400 mt-0.5">Tổng cước vận chuyển cao nhất</p>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, top5.length * 50)}>
            <BarChart data={top5} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              />
              <YAxis
                type="category"
                dataKey="fullName"
                tick={{ fill: '#374151', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(250, 112, 112, 0.06)' }} />
              <Bar dataKey="totalGrossRevenue" name="Tổng doanh thu" fill="#FA7070" radius={[0, 6, 6, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Drivers Table */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-700 text-gray-900">Bảng xếp hạng Tài xế</h3>
            <p className="text-xs text-gray-400 mt-0.5">Chi tiết doanh thu và thu nhập từng tài xế</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">Hạng</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Tên tài xế</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Biển số xe</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Số đơn giao</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Tổng doanh thu</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Chiết khấu NTT (15%)</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Thu nhập thực (85%)</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, i) => (
                  <tr key={driver.driverId} className="border-b border-slate-50 hover:bg-[#FFF0F0]/30 transition-colors">
                    <td className="px-4 py-3.5 text-center">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-xs">
                          {driver.fullName.charAt(0)}
                        </div>
                        <span className="text-sm font-600 text-gray-800">{driver.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{driver.licensePlate}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">{driver.deliveredOrders}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">{formatCurrency(driver.totalGrossRevenue)}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-emerald-600 text-right">{formatCurrency(driver.platformRevenue)}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-blue-600 text-right">{formatCurrency(driver.driverNetIncome)}</td>
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
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 size={32} className="animate-spin-slow mb-3" />
          <p className="text-sm">Đang tải dữ liệu khách hàng...</p>
        </div>
      );
    }

    if (!analytics || analytics.topCustomersByOrders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users size={40} className="mb-3 text-gray-300" />
          <p className="text-sm font-500">Chưa có dữ liệu khách hàng</p>
        </div>
      );
    }

    const customers = analytics.topCustomersByOrders;
    const top5 = customers.slice(0, 5);

    return (
      <div className="space-y-6">
        {/* Vertical Bar Chart — Top 5 by Order Count */}
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-base font-700 text-gray-900">Top 5 Khách hàng theo Số đơn</h3>
            <p className="text-xs text-gray-400 mt-0.5">Khách hàng có tổng đơn hàng cao nhất</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top5} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="customerBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FA7070" stopOpacity={1} />
                  <stop offset="100%" stopColor="#FA7070" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="customerName" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(250, 112, 112, 0.06)' }} />
              <Bar dataKey="totalOrders" name="Tổng đơn" fill="url(#customerBarGradient)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customers Table */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-700 text-gray-900">Bảng xếp hạng Khách hàng</h3>
            <p className="text-xs text-gray-400 mt-0.5">Chi tiết đơn hàng và giá trị từng khách hàng</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">Hạng</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">Tên khách hàng</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-left">SĐT</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Tổng đơn</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Đơn giao OK</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Tổng COD</th>
                  <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-right">Tổng phí ship</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, i) => (
                  <tr key={`${customer.customerPhone}-${i}`} className="border-b border-slate-50 hover:bg-[#FFF0F0]/30 transition-colors">
                    <td className="px-4 py-3.5 text-center">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-xs">
                          {customer.customerName.charAt(0)}
                        </div>
                        <span className="text-sm font-600 text-gray-800">{customer.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{customer.customerPhone}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">{customer.totalOrders}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-green-600 text-right">{customer.deliveredOrders}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">{formatCurrency(customer.totalCodValue)}</td>
                    <td className="px-4 py-3.5 text-sm font-600 text-gray-800 text-right">{formatCurrency(customer.totalShippingFee)}</td>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-700 text-gray-900">Báo cáo &amp; Thống kê</h2>
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
            onClick={() => void handleExportExcel()}
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

      {/* Tab Bar */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-500 transition-all',
              activeTab === tab.key
                ? 'bg-[#FA7070] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
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

      {/* Shift Detail Modal */}
      <ShiftDetailModal
        shiftId={selectedShiftId}
        onClose={() => setSelectedShiftId(null)}
        onReconcile={(shiftId) => void handleReconcile(shiftId, 0, '')}
      />
    </div>
  );
}

export default withRoleGuard(ReportsPage, ['ADMIN', 'DISPATCHER']);
