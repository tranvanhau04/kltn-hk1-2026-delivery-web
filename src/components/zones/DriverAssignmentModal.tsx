'use client';

import React, { useState, useMemo } from 'react';
import { Users, Check, X, Loader2, Truck, AlertCircle, UserCheck } from 'lucide-react';
import type { ApiZone } from '@/lib/api';
import type { Driver } from '@/types/domain';
import { cn } from '@/lib/utils';

interface DriverAssignmentModalProps {
  zone: ApiZone;
  allDrivers: Driver[];
  onClose: () => void;
  onAssign: (driverIds: string[]) => Promise<void>;
  onUnassign: (driverId: string) => Promise<void>;
}

const VEHICLE_LABELS: Record<string, string> = {
  MOTORBIKE: 'Xe máy',
  VAN_500KG: 'Van 500kg',
  TRUCK_1TON: 'Xe tải 1T',
  TRUCK_2TON: 'Xe tải 2T',
};

const SHIFT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ON_DUTY: { label: 'Đang làm', color: 'text-green-600 bg-green-50' },
  ONLINE_READY: { label: 'Sẵn sàng', color: 'text-blue-600 bg-blue-50' },
  ON_BREAK: { label: 'Nghỉ giữa ca', color: 'text-amber-600 bg-amber-50' },
  OFF_DUTY: { label: 'Nghỉ ca', color: 'text-gray-500 bg-gray-100' },
  OFFLINE: { label: 'Ngoại tuyến', color: 'text-gray-400 bg-gray-100' },
};

export default function DriverAssignmentModal({
  zone,
  allDrivers,
  onClose,
  onAssign,
  onUnassign,
}: DriverAssignmentModalProps) {
  const assignedIds = new Set(zone.assignedDriverIds ?? []);
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unassignedDrivers = useMemo(
    () => allDrivers.filter((d) => !assignedIds.has(d.userId)),
    [allDrivers, assignedIds],
  );
  const assignedDrivers = useMemo(
    () => allDrivers.filter((d) => assignedIds.has(d.userId)),
    [allDrivers, assignedIds],
  );

  const togglePendingAdd = (driverId: string) => {
    setPendingAdd((prev) => {
      const next = new Set(prev);
      next.has(driverId) ? next.delete(driverId) : next.add(driverId);
      return next;
    });
  };

  const handleConfirmAdd = async () => {
    if (pendingAdd.size === 0) return;
    setError(null);
    setLoadingId('batch');
    try {
      await onAssign([...pendingAdd]);
      setPendingAdd(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoadingId(null);
    }
  };

  const handleUnassign = async (driverId: string) => {
    setError(null);
    setLoadingId(driverId);
    try {
      await onUnassign(driverId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoadingId(null);
    }
  };

  const metrics = zone.metrics;
  const weightPct = metrics.fleetCapacityWeight > 0
    ? Math.min(200, Math.round((metrics.demandWeight / metrics.fleetCapacityWeight) * 100))
    : metrics.demandWeight > 0 ? 200 : 0;
  const volumePct = metrics.fleetCapacityVolume > 0
    ? Math.min(200, Math.round((metrics.demandVolume / metrics.fleetCapacityVolume) * 100))
    : metrics.demandVolume > 0 ? 200 : 0;

  const severityColors: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-700',
    WARNING: 'bg-amber-100 text-amber-700',
    CRITICAL: 'bg-red-100 text-red-700',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[88vh]" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-700 text-gray-900">Phân công tài xế</h2>
              <p className="text-xs text-gray-400">{zone.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            id="btn-close-driver-modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Capacity Metrics */}
        <div className="px-6 py-4 bg-gray-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-700 text-gray-500 uppercase tracking-wider">Tình trạng tải</p>
            <span className={cn('text-[11px] font-700 px-2.5 py-0.5 rounded-full', severityColors[metrics.overloadSeverity])}>
              {metrics.overloadSeverity === 'NORMAL' ? 'An toàn' : metrics.overloadSeverity === 'WARNING' ? 'Sắp đầy' : 'QUÁ TẢI'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-gray-500">Trọng lượng</span>
                <span className="text-[11px] font-600 text-gray-700">
                  {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', weightPct > 100 ? 'bg-red-500' : weightPct > 80 ? 'bg-amber-500' : 'bg-green-500')}
                  style={{ width: `${Math.min(100, weightPct)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{weightPct}%</p>
            </div>
            {/* Volume */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-gray-500">Thể tích</span>
                <span className="text-[11px] font-600 text-gray-700">
                  {metrics.demandVolume}m³ / {metrics.fleetCapacityVolume}m³
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', volumePct > 100 ? 'bg-red-500' : volumePct > 80 ? 'bg-amber-500' : 'bg-green-500')}
                  style={{ width: `${Math.min(100, volumePct)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{volumePct}%</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span>📦 {metrics.totalOrders} đơn chờ</span>
            <span>🚗 {metrics.activeDriversCount} tài xế hoạt động</span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2 shrink-0">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Currently Assigned */}
          <div>
            <p className="text-xs font-700 text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCheck size={13} />
              Đang phân công ({assignedDrivers.length})
            </p>
            {assignedDrivers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Chưa có tài xế nào được phân công.</p>
            ) : (
              <div className="space-y-2">
                {assignedDrivers.map((d) => {
                  const shift = SHIFT_STATUS_LABELS[d.currentShiftStatus] ?? { label: d.currentShiftStatus, color: 'text-gray-400 bg-gray-100' };
                  return (
                    <div
                      key={d.userId}
                      className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <Truck size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-600 text-gray-800">{d.fullName}</p>
                          <p className="text-[11px] text-gray-400">
                            {d.licensePlate} · {VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType} · {d.maxWeightKg}kg
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-600 px-2 py-0.5 rounded-full', shift.color)}>
                          {shift.label}
                        </span>
                        <button
                          onClick={() => handleUnassign(d.userId)}
                          disabled={loadingId === d.userId}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Hủy phân công"
                          id={`btn-unassign-${d.userId}`}
                        >
                          {loadingId === d.userId ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available to Assign */}
          <div>
            <p className="text-xs font-700 text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users size={13} />
              Tài xế có thể thêm ({unassignedDrivers.length})
            </p>
            {unassignedDrivers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Tất cả tài xế đã được phân công.</p>
            ) : (
              <div className="space-y-2">
                {unassignedDrivers.map((d) => {
                  const isSelected = pendingAdd.has(d.userId);
                  const shift = SHIFT_STATUS_LABELS[d.currentShiftStatus] ?? { label: d.currentShiftStatus, color: 'text-gray-400 bg-gray-100' };
                  return (
                    <button
                      key={d.userId}
                      onClick={() => togglePendingAdd(d.userId)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
                        isSelected
                          ? 'bg-[#FFF0F0] border-[#FA7070] shadow-sm'
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm',
                      )}
                      id={`btn-select-driver-${d.userId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                          isSelected ? 'bg-[#FA7070]' : 'bg-gray-100'
                        )}>
                          {isSelected ? <Check size={14} className="text-white" /> : <Truck size={14} className="text-gray-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-600 text-gray-800">{d.fullName}</p>
                          <p className="text-[11px] text-gray-400">
                            {d.licensePlate} · {VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType} · {d.maxWeightKg}kg / {d.maxVolumeM3}m³
                          </p>
                        </div>
                      </div>
                      <span className={cn('text-[10px] font-600 px-2 py-0.5 rounded-full shrink-0', shift.color)}>
                        {shift.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="btn-secondary text-sm">
            Đóng
          </button>
          {pendingAdd.size > 0 && (
            <button
              onClick={handleConfirmAdd}
              disabled={loadingId === 'batch'}
              className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              id="btn-confirm-assign-drivers"
            >
              {loadingId === 'batch' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Thêm {pendingAdd.size} tài xế
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
