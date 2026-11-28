'use client';

import React, { useState, useMemo } from 'react';
import { Users, Check, X, Loader2, Truck, AlertCircle, UserCheck } from 'lucide-react';
import type { ApiZone } from '@/lib/api';
import type { Driver } from '@/types/domain';
import { cn } from '@/lib/utils';

interface DriverAssignmentModalProps {
  zone: ApiZone;
  allZones?: ApiZone[];
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
  allZones = [],
  allDrivers,
  onClose,
  onAssign,
  onUnassign,
}: DriverAssignmentModalProps) {
  const currentZoneAssignedIds = useMemo(
    () => new Set(zone.assignedDriverIds ?? []),
    [zone.assignedDriverIds],
  );

  // Set of all drivers assigned to ANY zone across the whole system
  const allAssignedDriverIds = useMemo(() => {
    const set = new Set<string>();
    (allZones ?? []).forEach((z) => {
      (z.assignedDriverIds ?? []).forEach((id) => set.add(id));
    });
    (zone.assignedDriverIds ?? []).forEach((id) => set.add(id));
    return set;
  }, [allZones, zone.assignedDriverIds]);

  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Available to assign: only drivers who DO NOT belong to ANY zone
  const availableDrivers = useMemo(
    () => allDrivers.filter((d) => !allAssignedDriverIds.has(d.userId)),
    [allDrivers, allAssignedDriverIds],
  );

  // Drivers currently assigned to this specific zone
  const assignedDrivers = useMemo(
    () => allDrivers.filter((d) => currentZoneAssignedIds.has(d.userId)),
    [allDrivers, currentZoneAssignedIds],
  );

  const togglePendingAdd = (driverId: string) => {
    setPendingAdd((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) {
        next.delete(driverId);
      } else {
        next.add(driverId);
      }
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
    NORMAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
    CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden flex flex-col max-h-[88vh]" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Users size={16} className="text-slate-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Phân công tài xế</h2>
              <p className="text-xs text-slate-500">{zone.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            id="btn-close-driver-modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Capacity Metrics */}
        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 shrink-0 tabular-nums">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tình trạng tải</p>
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded border', severityColors[metrics.overloadSeverity])}>
              {metrics.overloadSeverity === 'NORMAL' ? 'An toàn' : metrics.overloadSeverity === 'WARNING' ? 'Sắp đầy' : 'QUÁ TẢI'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-slate-500">Trọng lượng</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-xs overflow-hidden">
                <div
                  className={cn('h-full transition-all', weightPct > 100 ? 'bg-[#D92D20]' : weightPct > 80 ? 'bg-amber-500' : 'bg-emerald-600')}
                  style={{ width: `${Math.min(100, weightPct)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{weightPct}%</p>
            </div>
            {/* Volume */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-slate-500">Thể tích</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  {metrics.demandVolume}m³ / {metrics.fleetCapacityVolume}m³
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-xs overflow-hidden">
                <div
                  className={cn('h-full transition-all', volumePct > 100 ? 'bg-[#D92D20]' : volumePct > 80 ? 'bg-amber-500' : 'bg-emerald-600')}
                  style={{ width: `${Math.min(100, volumePct)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{volumePct}%</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span>{metrics.totalOrders} đơn chờ</span>
            <span>·</span>
            <span>{metrics.activeDriversCount} tài xế hoạt động</span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-3 p-2.5 bg-red-50 rounded-md border border-red-200 flex items-center gap-2 shrink-0">
            <AlertCircle size={14} className="text-[#D92D20] shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Currently Assigned */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 tabular-nums">
              <UserCheck size={13} />
              Đang phân công ({assignedDrivers.length})
            </p>
            {assignedDrivers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có tài xế nào được phân công.</p>
            ) : (
              <div className="space-y-2">
                {assignedDrivers.map((d) => {
                  const shift = SHIFT_STATUS_LABELS[d.currentShiftStatus] ?? { label: d.currentShiftStatus, color: 'text-slate-500 bg-slate-100' };
                  return (
                    <div
                      key={d.userId}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-200/80"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <Truck size={13} className="text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{d.fullName}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {d.licensePlate} · {VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType} · {d.maxWeightKg}kg
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200/60', shift.color)}>
                          {shift.label}
                        </span>
                        <button
                          onClick={() => handleUnassign(d.userId)}
                          disabled={loadingId === d.userId}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-[#D92D20] transition-colors disabled:opacity-40"
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
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 tabular-nums">
              <Users size={13} />
              Tài xế có thể thêm ({availableDrivers.length})
            </p>
            {availableDrivers.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-500">
                  Tất cả tài xế hiện đều đã được phân công khu vực. Hãy gỡ tài xế ở khu vực khác nếu muốn điều chuyển.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableDrivers.map((d) => {
                  const isSelected = pendingAdd.has(d.userId);
                  const shift = SHIFT_STATUS_LABELS[d.currentShiftStatus] ?? { label: d.currentShiftStatus, color: 'text-slate-500 bg-slate-100' };
                  return (
                    <button
                      key={d.userId}
                      onClick={() => togglePendingAdd(d.userId)}
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-md border transition-colors text-left',
                        isSelected
                          ? 'bg-slate-50 border-slate-900'
                          : 'bg-white border-slate-200/80 hover:border-slate-300',
                      )}
                      id={`btn-select-driver-${d.userId}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0 border transition-colors',
                          isSelected ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-200'
                        )}>
                          {isSelected ? <Check size={13} className="text-white" /> : <Truck size={13} className="text-slate-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{d.fullName}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {d.licensePlate} · {VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType} · {d.maxWeightKg}kg / {d.maxVolumeM3}m³
                          </p>
                        </div>
                      </div>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200/60 shrink-0', shift.color)}>
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
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 shrink-0">
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
