'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Map, Plus, Trash2, AlertTriangle, X, Users,
  RefreshCw, CheckCircle, AlertCircle, Loader2,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/lib/utils';
import {
  fetchZones, createZone, assignDriversToZone, unassignDriverFromZone, fetchDrivers,
  type ApiZone,
} from '@/lib/api';
import type { Driver } from '@/types/domain';

// Dynamically import Leaflet map components to prevent SSR window errors
const ZoneMapView = dynamic(() => import('@/components/map/ZoneMapView'), { ssr: false });
const DriverAssignmentModal = dynamic(
  () => import('@/components/zones/DriverAssignmentModal'),
  { ssr: false },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  NORMAL:   { label: 'Tải an toàn',    badgeClass: 'bg-green-100 text-green-700 border-green-200', dotClass: 'bg-green-500' },
  WARNING:  { label: 'Sắp đầy (>80%)', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200', dotClass: 'bg-amber-500' },
  CRITICAL: { label: 'QUÁ TẢI',        badgeClass: 'bg-red-100 text-red-700 border-red-200',       dotClass: 'bg-red-500' },
} as const;

// ─── ZoneCard ─────────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  onDelete,
  onClick,
  onOpenDrivers,
  isSelected,
}: {
  zone: ApiZone;
  onDelete: () => void;
  onClick: () => void;
  onOpenDrivers: () => void;
  isSelected: boolean;
}) {
  const metrics = zone.metrics;
  const { label, badgeClass, dotClass } = SEVERITY_CONFIG[metrics.overloadSeverity];
  const weightPct = metrics.fleetCapacityWeight > 0
    ? Math.min(100, Math.round((metrics.demandWeight / metrics.fleetCapacityWeight) * 100))
    : metrics.demandWeight > 0 ? 100 : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={cn(
        'w-full text-left p-4 rounded-2xl border transition-all group cursor-pointer',
        isSelected
          ? 'border-[#FA7070] bg-[#FFF0F0] shadow-md'
          : metrics.overloadSeverity === 'CRITICAL'
          ? 'border-red-200 bg-red-50/50 hover:border-red-300 hover:shadow-md'
          : metrics.overloadSeverity === 'WARNING'
          ? 'border-amber-100 bg-amber-50/30 hover:border-amber-300 hover:shadow-md'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md',
      )}
      id={`zone-card-${zone.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
            isSelected ? 'bg-[#FA7070] text-white' :
            metrics.overloadSeverity === 'CRITICAL' ? 'bg-red-100 text-red-600' :
            metrics.overloadSeverity === 'WARNING' ? 'bg-amber-100 text-amber-600' :
            'bg-blue-50 text-blue-600'
          )}>
            <Map size={17} />
          </div>
          <div>
            <h3 className="text-sm font-700 text-gray-900">{zone.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
              <span className={cn('text-[10px] font-700 px-1.5 py-0.5 rounded-full border', badgeClass)}>
                {label}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons (hover reveal) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDrivers(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-100 transition-colors"
            title="Phân công tài xế"
            id={`btn-zone-drivers-${zone.id}`}
          >
            <Users size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors"
            title="Xóa khu vực"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-base font-700 text-gray-900">{metrics.totalOrders}</p>
          <p className="text-[10px] text-gray-400">Đơn chờ</p>
        </div>
        <div className="text-center">
          <p className={cn('text-base font-700', metrics.activeDriversCount > 0 ? 'text-green-600' : 'text-gray-400')}>
            {metrics.activeDriversCount}
          </p>
          <p className="text-[10px] text-gray-400">TX hoạt động</p>
        </div>
        <div className="text-center">
          <p className="text-base font-700 text-gray-900">{zone.assignedDriverIds?.length ?? 0}</p>
          <p className="text-[10px] text-gray-400">TX phân công</p>
        </div>
      </div>

      {/* Weight utilization bar */}
      {metrics.fleetCapacityWeight > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400">
              Tải trọng: {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg
            </span>
            <span className={cn(
              'text-[10px] font-700',
              metrics.overloadSeverity === 'CRITICAL' ? 'text-red-600' :
              metrics.overloadSeverity === 'WARNING' ? 'text-amber-600' : 'text-green-600',
            )}>
              {Math.round(metrics.weightRatio * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                metrics.overloadSeverity === 'CRITICAL' ? 'bg-red-500' :
                metrics.overloadSeverity === 'WARNING' ? 'bg-amber-500' : 'bg-green-500',
              )}
              style={{ width: `${Math.min(100, weightPct)}%` }}
            />
          </div>
          {metrics.overloadSeverity === 'CRITICAL' && (
            <p className="text-[10px] text-red-600 font-600 mt-1">
              ⚠️ {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg tải trọng xe
            </p>
          )}
        </div>
      )}
      {metrics.fleetCapacityWeight === 0 && metrics.totalOrders > 0 && (
        <p className="text-[10px] text-amber-600 font-500 mt-1">
          ⚠️ Chưa có tài xế — {metrics.totalOrders} đơn chưa xử lý
        </p>
      )}
    </div>
  );
}

// ─── NewZoneModal ─────────────────────────────────────────────────────────────

function NewZoneModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Tạo khu vực mới"
      subtitle="Vẽ ranh giới trên bản đồ sau khi tạo"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button
            onClick={() => { if (name.trim()) onSubmit(name.trim()); }}
            disabled={!name.trim() || loading}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            id="btn-create-zone"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Tạo khu vực
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Tên khu vực *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Khu vực Bình Dương"
            className="input-base"
            id="zone-name"
            autoFocus
          />
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-700 font-500 mb-1">💡 Hướng dẫn vẽ ranh giới</p>
          <p className="text-xs text-blue-600">
            Sau khi tạo, nhấn vào khu vực trong danh sách để xem bản đồ và vẽ ranh giới polygon.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Zones Page ──────────────────────────────────────────────────────────

export default function ZonesPage() {
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ApiZone | null>(null);
  const [showNewZone, setShowNewZone] = useState(false);
  const [driverZone, setDriverZone] = useState<ApiZone | null>(null);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadZonesAndDrivers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [zonesData, driversData] = await Promise.all([
        fetchZones(),
        fetchDrivers()
      ]);
      setZones(zonesData);
      setAllDrivers(driversData);
      
      // Keep selected zone in sync after refresh
      setSelectedZone((prev) => (prev ? zonesData.find((z) => z.id === prev.id) ?? null : null));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadZones = loadZonesAndDrivers; // fallback for refresh button

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadZonesAndDrivers();
  }, [loadZonesAndDrivers]);

  const handleCreateZone = async (name: string) => {
    setIsCreating(true);
    try {
      const created = await createZone(name);
      setZones((prev) => [...prev, created]);
      setShowNewZone(false);
      showToast('success', `Đã tạo khu vực "${name}"`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Tạo khu vực thất bại.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteZone = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    if (selectedZone?.id === zoneId) setSelectedZone(null);
    if (driverZone?.id === zoneId) setDriverZone(null);
  };

  const handleAssignDrivers = async (driverIds: string[]) => {
    if (!driverZone) return;
    const updated = await assignDriversToZone(driverZone.id, driverIds);
    setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
    setDriverZone(updated);
    if (selectedZone?.id === updated.id) setSelectedZone(updated);
    showToast('success', `Đã thêm ${driverIds.length} tài xế vào khu vực.`);
  };

  const handleUnassignDriver = async (driverId: string) => {
    if (!driverZone) return;
    const updated = await unassignDriverFromZone(driverZone.id, driverId);
    setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
    setDriverZone(updated);
    if (selectedZone?.id === updated.id) setSelectedZone(updated);
    showToast('success', 'Đã hủy phân công tài xế.');
  };

  const criticalCount = zones.filter((z) => z.metrics.overloadSeverity === 'CRITICAL').length;
  const warningCount = zones.filter((z) => z.metrics.overloadSeverity === 'WARNING').length;

  return (
    <div className="flex gap-5 animate-fade-in" style={{ minHeight: 'calc(100vh - 128px)' }}>
      {/* Left: Zone list */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        {/* Header card */}
        <div className="card p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-700 text-gray-900">Khu vực</h2>
              <p className="text-xs text-gray-400">{zones.length} khu vực đang quản lý</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadZones}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-40"
                title="Làm mới dữ liệu"
                id="btn-refresh-zones"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowNewZone(true)}
                className="btn-primary text-sm px-3 h-9"
                id="btn-new-zone"
              >
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          {/* Alert banners */}
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 mb-2 animate-fade-in">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-500">
                {criticalCount} khu vực đang {' '}
                <strong>QUÁ TẢI</strong>
              </p>
            </div>
          )}
          {warningCount > 0 && !criticalCount && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 mb-2 animate-fade-in">
              <AlertCircle size={15} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 font-500">
                {warningCount} khu vực sắp đầy tải (&gt;80%)
              </p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Zone cards */}
        <div className="flex-1 space-y-3 overflow-y-auto">
          {isLoading && zones.length === 0 ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-white animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((j) => <div key={j} className="h-10 bg-gray-100 rounded-xl" />)}
                </div>
              </div>
            ))
          ) : (
            zones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                isSelected={selectedZone?.id === zone.id}
                onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
                onDelete={() => handleDeleteZone(zone.id)}
                onOpenDrivers={() => setDriverZone(zone)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Map */}
      <div className="flex-1 card overflow-hidden">
        {selectedZone ? (
          <div className="flex flex-col h-full">
            {/* Map header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Map size={15} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-700 text-gray-900">{selectedZone.name}</h3>
                  <p className="text-xs text-gray-400">
                    {selectedZone.assignedDriverIds?.length ?? 0} tài xế phân công
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDriverZone(selectedZone)}
                  className="btn-secondary text-sm px-3 h-8"
                  id="btn-open-driver-assignment"
                >
                  <Users size={14} /> Phân công tài xế
                </button>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Map */}
            <div className="flex-1">
              <ZoneMapView
                zone={selectedZone}
                allZones={zones}
                onZoneSelect={(id) => {
                  const z = zones.find((z) => z.id === id);
                  if (z) setSelectedZone(z);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center p-10">
            <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center">
              <Map size={36} className="text-blue-400/60" />
            </div>
            <div>
              <h3 className="text-lg font-600 text-gray-700 mb-2">Chọn khu vực để xem bản đồ</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                Nhấn vào một khu vực trong danh sách bên trái để xem và chỉnh sửa ranh giới trên bản đồ.
              </p>
            </div>
            <button onClick={() => setShowNewZone(true)} className="btn-primary">
              <Plus size={15} /> Tạo khu vực mới
            </button>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-500 transition-all',
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          )}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Modals */}
      {showNewZone && (
        <NewZoneModal
          onClose={() => setShowNewZone(false)}
          onSubmit={handleCreateZone}
          loading={isCreating}
        />
      )}

      {driverZone && (
        <DriverAssignmentModal
          zone={driverZone}
          allDrivers={allDrivers}
          onClose={() => setDriverZone(null)}
          onAssign={handleAssignDrivers}
          onUnassign={handleUnassignDriver}
        />
      )}
    </div>
  );
}
