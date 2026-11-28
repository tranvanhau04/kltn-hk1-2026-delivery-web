'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  User,
  Car,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Package,
  Camera,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { fetchShiftDetail } from '@/lib/api';
import type { ShiftDetail, ShiftDetailStop } from '@/types/domain';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function formatDate(val?: string | Date | null): string {
  if (!val) return '—';
  return new Date(val as string).toLocaleString('vi-VN');
}

function formatDateShort(val?: string | Date | null): string {
  if (!val) return '—';
  return new Date(val as string).toLocaleDateString('vi-VN');
}

function resolvePodPhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }
  const apiHost = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(
    /\/api\/?$/,
    '',
  );
  const normalizedPath = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${apiHost}${normalizedPath}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function ShiftStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    OPEN: { label: 'Đang mở', cls: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    PENDING_SETTLEMENT: { label: 'Chờ đối soát', cls: 'bg-amber-50/70 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    CLOSED: { label: 'Đã đóng', cls: 'bg-sky-50/70 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StopStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    COMPLETED: { label: 'Thành công', cls: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    FAILED: { label: 'Thất bại', cls: 'bg-red-50/70 text-red-700 border-red-200', dot: 'bg-red-500' },
    PENDING: { label: 'Chờ giao', cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
    ARRIVED: { label: 'Đã đến', cls: 'bg-sky-50/70 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
    SKIPPED: { label: 'Bỏ qua', cls: 'bg-amber-50/70 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Financial Card ────────────────────────────────────────────────────────────

function FinancialCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass?: string;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 flex flex-col gap-1 shadow-2xs">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className={`text-base font-semibold tabular-nums ${colorClass ?? 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

// ─── Stop Row ─────────────────────────────────────────────────────────────────

function StopRow({ stop, index }: { stop: ShiftDetailStop; index: number }) {
  return (
    <tr className="py-2.5 text-sm text-slate-700 border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
      <td className="px-3 py-2.5 text-xs text-slate-500 text-center w-10 tabular-nums">{index + 1}</td>
      <td className="px-3 py-2.5">
        <div className="text-xs font-mono font-semibold text-slate-900">{stop.orderCode}</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-sm font-medium text-slate-900">{stop.receiverName}</div>
        <div className="text-xs text-slate-500 tabular-nums">{stop.receiverPhone}</div>
      </td>
      <td className="px-3 py-2.5 max-w-[160px]">
        <div className="text-xs text-slate-600 truncate" title={stop.deliveryAddress}>
          {stop.deliveryAddress}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <div className="text-sm font-medium text-slate-800">{formatVND(stop.codAmount)}</div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {stop.pod ? (
          <div className={`text-sm font-medium ${stop.pod.codCollected !== stop.codAmount ? 'text-[#D92D20]' : 'text-emerald-700'}`}>
            {formatVND(stop.pod.codCollected)}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <StopStatusBadge status={stop.status} />
        {stop.pod?.failureReason && (
          <div className="text-xs text-[#D92D20] mt-1 max-w-[120px] truncate" title={stop.pod.failureReason}>
            {stop.pod.failureReason}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        {(() => {
          const fullPhotoUrl = resolvePodPhotoUrl(stop.pod?.photoUrl);
          return fullPhotoUrl ? (
            <a
              href={fullPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-xs"
              title="Xem ảnh POD"
            >
              <Camera className="w-4 h-4" />
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          );
        })()}
      </td>
    </tr>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface ShiftDetailModalProps {
  shiftId: string | null;
  onClose: () => void;
  onReconcile?: (shiftId: string, submittedAmount: number, driverName: string) => void;
}

export default function ShiftDetailModal({
  shiftId,
  onClose,
  onReconcile,
}: ShiftDetailModalProps) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedInput, setSubmittedInput] = useState<string>('');

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShiftDetail(id);
      setDetail(data);
      const defaultAmount =
        data.codSubmitted > 0 ? data.codSubmitted : data.codCollected;
      setSubmittedInput(String(defaultAmount));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu ca làm việc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shiftId) {
      setDetail(null);
      void loadDetail(shiftId);
    }
  }, [shiftId, loadDetail]);

  // Đóng khi bấm ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!shiftId) return null;

  const isReconciled = !!detail?.reconciledAt;

  const codDiff = detail ? detail.codDifference : 0;
  const diffColorClass =
    codDiff === 0 ? 'text-green-600' : codDiff > 0 ? 'text-red-600' : 'text-amber-600';

  const successRate =
    detail?.route && detail.route.totalOrders > 0
      ? Math.round((detail.route.deliveredCount / detail.route.totalOrders) * 100)
      : 0;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal panel */}
      <div className="bg-[#F8FAFC] w-full max-w-5xl max-h-[90vh] rounded-lg border border-slate-200 shadow-lg flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center">
              <User className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {loading ? 'Đang tải...' : (detail?.driverName ?? 'Chi tiết ca làm việc')}
                </h2>
                {detail && <ShiftStatusBadge status={detail.status} />}
                {isReconciled && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200 px-2 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" />
                    Đã đối soát
                  </span>
                )}
              </div>
              {detail && (
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    {detail.licensePlate} · {detail.vehicleType}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(detail.startTime)}
                    {detail.endTime ? ` → ${formatDate(detail.endTime)}` : ' (Chưa kết thúc)'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-7 h-7 text-slate-600 animate-spin" />
              <p className="text-xs text-slate-500">Đang tải chi tiết ca làm việc...</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-medium text-xs">Lỗi tải dữ liệu</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Detail content */}
          {detail && !loading && (
            <>
              {/* Financial Cards */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">Dòng tiền COD</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <FinancialCard
                    label="Tiền đầu ca"
                    value={formatVND(detail.startingCashCod)}
                    icon={<Package className="w-3.5 h-3.5" />}
                  />
                  <FinancialCard
                    label="COD Thu được"
                    value={formatVND(detail.codCollected)}
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                    colorClass="text-slate-900"
                  />
                  <FinancialCard
                    label="COD Đã nộp"
                    value={formatVND(detail.codSubmitted)}
                    icon={<CheckCircle className="w-3.5 h-3.5" />}
                    colorClass="text-indigo-700"
                  />
                  <FinancialCard
                    label={codDiff > 0 ? 'Thiếu' : codDiff < 0 ? 'Dư' : 'Chênh lệch'}
                    value={formatVND(Math.abs(codDiff))}
                    icon={<AlertCircle className="w-3.5 h-3.5" />}
                    colorClass={diffColorClass}
                  />
                </div>
              </div>

              {/* Route Stats */}
              {detail.route && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">Tuyến đường</h3>
                  <div className="bg-white border border-slate-200/80 rounded-lg p-4 grid grid-cols-2 gap-4 sm:grid-cols-5 shadow-2xs tabular-nums">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-slate-900">{detail.route.totalOrders}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Tổng đơn</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-emerald-600">{detail.route.deliveredCount}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Thành công</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-[#D92D20]">{detail.route.failedCount}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Thất bại</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-indigo-600">{successRate}%</div>
                      <div className="text-xs text-slate-500 mt-0.5">Tỷ lệ thành công</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-slate-800">
                        {Number(detail.route.totalDistanceKm).toFixed(1)} km
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Quãng đường</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reconcile info */}
              {isReconciled && (
                <div className="flex items-center gap-2.5 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-800 text-xs tabular-nums">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Đã đối soát bởi <strong>{detail.reconciledByName || detail.reconciledBy}</strong> lúc{' '}
                    <strong>{formatDate(detail.reconciledAt)}</strong>
                  </span>
                </div>
              )}

              {/* Stop list */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                  Danh sách đơn hàng{' '}
                  {detail.stops.length > 0 && (
                    <span className="text-slate-400 font-normal tabular-nums">({detail.stops.length} đơn)</span>
                  )}
                </h3>

                {detail.stops.length === 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-lg p-8 text-center text-xs text-slate-400">
                    Không có đơn hàng nào trong ca này
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center w-10">STT</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left">Mã đơn</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left">Người nhận</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left">Địa chỉ</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">COD (DK)</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">COD Thu</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Trạng thái</th>
                            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Ảnh POD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.stops.map((stop, index) => (
                            <StopRow key={stop.stopId} stop={stop} index={index} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Shift ID info */}
              <div className="text-xs text-slate-400 text-right tabular-nums">
                Mã ca: <span className="font-mono">{detail.shiftId}</span>
                {detail.endTime && (
                  <> · Ngày: {formatDateShort(detail.startTime)}</>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            {detail && !isReconciled && detail.status === 'OPEN' && (
              <span className="text-xs text-amber-700 font-medium">
                Ca đang mở — chờ tài xế kết thúc ca trước khi đối soát
              </span>
            )}
            {detail && !isReconciled && detail.status !== 'OPEN' && onReconcile && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="reconcile-actual-cash"
                  className="text-xs font-medium text-slate-600 whitespace-nowrap"
                >
                  Tiền thực nhận (VNĐ):
                </label>
                <input
                  id="reconcile-actual-cash"
                  type="number"
                  min={0}
                  step={1000}
                  value={submittedInput}
                  onChange={(e) => setSubmittedInput(e.target.value)}
                  className="w-36 h-8 px-2.5 text-sm font-medium tabular-nums text-right border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Đóng
            </button>
            {detail && !isReconciled && detail.status !== 'OPEN' && onReconcile && (
              <button
                onClick={() => {
                  const parsed = Number(submittedInput);
                  const amount =
                    Number.isFinite(parsed) && parsed >= 0
                      ? parsed
                      : detail.codSubmitted > 0
                        ? detail.codSubmitted
                        : detail.codCollected;
                  onReconcile(detail.shiftId, amount, detail.driverName);
                  onClose();
                }}
                className="btn-primary"
              >
                ✓ Duyệt ca này
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
