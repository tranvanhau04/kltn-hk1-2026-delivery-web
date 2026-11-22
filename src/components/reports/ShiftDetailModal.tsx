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

// ─── Status Badge ─────────────────────────────────────────────────────────────

function ShiftStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPEN: { label: 'Đang mở', cls: 'bg-green-100 text-green-800' },
    PENDING_SETTLEMENT: { label: 'Chờ đối soát', cls: 'bg-amber-100 text-amber-800' },
    CLOSED: { label: 'Đã đóng', cls: 'bg-blue-100 text-blue-800' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function StopStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    COMPLETED: { label: 'Thành công', cls: 'bg-green-100 text-green-700' },
    FAILED: { label: 'Thất bại', cls: 'bg-red-100 text-red-700' },
    PENDING: { label: 'Chờ giao', cls: 'bg-gray-100 text-gray-600' },
    ARRIVED: { label: 'Đã đến', cls: 'bg-blue-100 text-blue-700' },
    SKIPPED: { label: 'Bỏ qua', cls: 'bg-orange-100 text-orange-700' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
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
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${colorClass ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

// ─── Stop Row ─────────────────────────────────────────────────────────────────

function StopRow({ stop, index }: { stop: ShiftDetailStop; index: number }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-xs text-gray-500 text-center w-10">{index + 1}</td>
      <td className="px-3 py-3">
        <div className="text-xs font-mono font-semibold text-blue-700">{stop.orderCode}</div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm font-medium text-gray-900">{stop.receiverName}</div>
        <div className="text-xs text-gray-500">{stop.receiverPhone}</div>
      </td>
      <td className="px-3 py-3 max-w-[160px]">
        <div className="text-xs text-gray-600 truncate" title={stop.deliveryAddress}>
          {stop.deliveryAddress}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <div className="text-sm font-medium text-gray-800">{formatVND(stop.codAmount)}</div>
      </td>
      <td className="px-3 py-3 text-right">
        {stop.pod ? (
          <div className={`text-sm font-medium ${stop.pod.codCollected !== stop.codAmount ? 'text-red-600' : 'text-green-700'}`}>
            {formatVND(stop.pod.codCollected)}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <StopStatusBadge status={stop.status} />
        {stop.pod?.failureReason && (
          <div className="text-xs text-red-500 mt-1 max-w-[120px] truncate" title={stop.pod.failureReason}>
            {stop.pod.failureReason}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {stop.pod?.photoUrl ? (
          <a
            href={stop.pod.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
            title="Xem ảnh POD"
          >
            <Camera className="w-4 h-4" />
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface ShiftDetailModalProps {
  shiftId: string | null;
  onClose: () => void;
  onReconcile?: (shiftId: string) => void;
}

export default function ShiftDetailModal({
  shiftId,
  onClose,
  onReconcile,
}: ShiftDetailModalProps) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShiftDetail(id);
      setDetail(data);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal panel */}
      <div className="bg-gray-50 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {loading ? 'Đang tải...' : (detail?.driverName ?? 'Chi tiết ca làm việc')}
                </h2>
                {detail && <ShiftStatusBadge status={detail.status} />}
                {isReconciled && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Đã đối soát
                  </span>
                )}
              </div>
              {detail && (
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500">Đang tải chi tiết ca làm việc...</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Lỗi tải dữ liệu</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Detail content */}
          {detail && !loading && (
            <>
              {/* Financial Cards */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 Dòng tiền COD</h3>
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
                    colorClass="text-blue-700"
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
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📦 Tuyến đường</h3>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-4 sm:grid-cols-5 shadow-sm">
                    <div className="text-center">
                      <div className="text-xl font-bold text-gray-900">{detail.route.totalOrders}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Tổng đơn</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{detail.route.deliveredCount}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Thành công</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-500">{detail.route.failedCount}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Thất bại</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{successRate}%</div>
                      <div className="text-xs text-gray-500 mt-0.5">Tỷ lệ thành công</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-gray-700">
                        {Number(detail.route.totalDistanceKm).toFixed(1)} km
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Quãng đường</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reconcile info */}
              {isReconciled && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Đã đối soát bởi <strong>{detail.reconciledBy}</strong> lúc{' '}
                    <strong>{formatDate(detail.reconciledAt)}</strong>
                  </span>
                </div>
              )}

              {/* Stop list */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  🗂️ Danh sách đơn hàng{' '}
                  {detail.stops.length > 0 && (
                    <span className="text-gray-400 font-normal">({detail.stops.length} đơn)</span>
                  )}
                </h3>

                {detail.stops.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                    Không có đơn hàng nào trong ca này
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center w-10">STT</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-left">Mã đơn</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-left">Người nhận</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-left">Địa chỉ</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-right">COD (DK)</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-right">COD Thu</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center">Trạng thái</th>
                            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center">Ảnh POD</th>
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
              <div className="text-xs text-gray-400 text-right">
                Mã ca: <span className="font-mono">{detail.shiftId}</span>
                {detail.endTime && (
                  <> · Ngày: {formatDateShort(detail.startTime)}</>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Đóng
          </button>
          {detail && !isReconciled && onReconcile && (
            <button
              onClick={() => {
                onReconcile(detail.shiftId);
                onClose();
              }}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              ✓ Duyệt ca này
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
