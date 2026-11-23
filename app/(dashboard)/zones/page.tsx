'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Map, Plus, Trash2, AlertTriangle, X, Users,
  RefreshCw, AlertCircle, Loader2, Compass, CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/lib/utils';
import {
  fetchZones, assignDriversToZone, unassignDriverFromZone, fetchDrivers,
  apiFetch,
  type ApiZone,
} from '@/lib/api';
import type { Driver } from '@/types/domain';
import { useToast } from '@/context/ToastContext';
import { parseZoneBoundary } from '@/components/map/ZoneMapView';
import { withRoleGuard } from '@/components/auth/withRoleGuard';

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
  onStartDraw,
  isSelected,
}: {
  zone: ApiZone;
  onDelete: () => void;
  onClick: () => void;
  onOpenDrivers: () => void;
  onStartDraw: () => void;
  isSelected: boolean;
}) {
  const metrics = zone.metrics;
  const { label, badgeClass, dotClass } = SEVERITY_CONFIG[metrics.overloadSeverity];
  const weightPct = metrics.fleetCapacityWeight > 0
    ? Math.min(100, Math.round((metrics.demandWeight / metrics.fleetCapacityWeight) * 100))
    : metrics.demandWeight > 0 ? 100 : 0;

  const boundaryCoords = parseZoneBoundary(zone.boundaryGeoJson);
  const hasBoundary = boundaryCoords.length >= 3;

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
        <div className="mb-2">
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
        </div>
      )}

      {/* Boundary status & Drawing action */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100/90 text-[11px]">
        {hasBoundary ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
            <CheckCircle2 size={12} className="text-emerald-500" /> Đã có vùng
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
            ⚠️ Chưa có vùng
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartDraw();
          }}
          className="font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
          title={hasBoundary ? 'Kéo chuột để vẽ lại vùng' : 'Kéo chuột để khoanh vùng'}
          id={`btn-card-draw-${zone.id}`}
        >
          ✏️ {hasBoundary ? 'Vẽ lại vùng' : 'Khoanh vùng'}
        </button>
      </div>
    </div>
  );
}

// ─── NewZoneModal ─────────────────────────────────────────────────────────────

interface NewZoneModalProps {
  onClose: () => void;
  onSubmit: (name: string, boundaryGeoJson?: string) => void;
  loading: boolean;
  name: string;
  onNameChange: (val: string) => void;
  boundaryGeoJson: string | null;
  onStartDraw: () => void;
  onClearBoundary: () => void;
}

function NewZoneModal({
  onClose,
  onSubmit,
  loading,
  name,
  onNameChange,
  boundaryGeoJson,
  onStartDraw,
  onClearBoundary,
}: NewZoneModalProps) {
  const hasBoundary = !!boundaryGeoJson;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Tạo khu vực mới"
      subtitle="Khoanh vùng ô vuông GeoJSON trực tiếp trên bản đồ"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button
            onClick={() => {
              if (name.trim()) {
                onSubmit(name.trim(), boundaryGeoJson ?? undefined);
              }
            }}
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
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="VD: Khu vực Tân Bình / Tân Phú"
            className="input-base"
            id="zone-name"
            autoFocus
          />
        </div>

        {/* Boundary Selection */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Compass size={14} className="text-blue-500" />
              Khoanh vùng bản đồ:
            </span>
            {hasBoundary ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 size={12} className="text-emerald-600" /> Đã khoanh vùng (4 tọa độ góc)
              </span>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-200/70 px-2 py-0.5 rounded-full">
                Chưa khoanh vùng
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartDraw}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              id="btn-modal-draw-zone"
            >
              ✏️ {hasBoundary ? 'Vẽ lại khoanh vùng trên bản đồ' : 'Vẽ khoanh vùng trên bản đồ'}
            </button>
            {hasBoundary && (
              <button
                type="button"
                onClick={onClearBoundary}
                className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Xóa
              </button>
            )}
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed">
            💡 Nhấn &quot;Vẽ khoanh vùng trên bản đồ&quot; để ẩn tạm form, sau đó nhấn giữ chuột trái và kéo một ô vuông trên bản đồ. Tọa độ 4 góc sẽ tự động lưu vào khu vực.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Zones Page ──────────────────────────────────────────────────────────

function ZonesPage() {
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ApiZone | null>(null);
  const toast = useToast();
  const [showNewZone, setShowNewZone] = useState(false);
  const [driverZone, setDriverZone] = useState<ApiZone | null>(null);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawing states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTarget, setDrawingTarget] = useState<
    | { type: 'NEW_ZONE' }
    | { type: 'EXISTING_ZONE'; zone: ApiZone }
    | null
  >(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneBoundary, setNewZoneBoundary] = useState<string | null>(null);

  const loadZonesAndDrivers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [zonesData, driversData] = await Promise.all([
        fetchZones(),
        fetchDrivers(),
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

  const loadZones = loadZonesAndDrivers;

  useEffect(() => {
    void loadZonesAndDrivers();
  }, [loadZonesAndDrivers]);

  // Create new zone
  const handleCreateZone = async (name: string, boundaryGeoJson?: string) => {
    setIsCreating(true);
    try {
      const created = await apiFetch<ApiZone>('/zones', {
        method: 'POST',
        body: JSON.stringify({ name, boundaryGeoJson }),
      });
      setZones((prev) => [...prev, created]);
      setSelectedZone(created);
      setShowNewZone(false);
      setNewZoneName('');
      setNewZoneBoundary(null);
      toast.success('Tạo khu vực thành công', `Đã tạo khu vực "${name}"`);
    } catch (err) {
      toast.error('Tạo khu vực thất bại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setIsCreating(false);
    }
  };

  // Start drawing for new zone creation
  const handleStartDrawForNewZone = () => {
    setShowNewZone(false);
    setIsDrawingMode(true);
    setDrawingTarget({ type: 'NEW_ZONE' });
  };

  // Start drawing for an existing zone
  const handleStartDrawForExistingZone = (zone: ApiZone) => {
    setSelectedZone(zone);
    setIsDrawingMode(true);
    setDrawingTarget({ type: 'EXISTING_ZONE', zone });
  };

  // Handle completion of drawing a rectangle on map
  const handleDrawComplete = async (geoJsonString: string) => {
    if (!drawingTarget) return;

    if (drawingTarget.type === 'NEW_ZONE') {
      setNewZoneBoundary(geoJsonString);
      setIsDrawingMode(false);
      setDrawingTarget(null);
      setShowNewZone(true);
      toast.info('Đã khoanh vùng', 'Đã ghi nhận 4 tọa độ góc. Bấm "Tạo khu vực" để lưu.');
      return;
    }

    if (drawingTarget.type === 'EXISTING_ZONE') {
      const targetZone = drawingTarget.zone;
      try {
        const updated = await apiFetch<ApiZone>(`/zones/${targetZone.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ boundaryGeoJson: geoJsonString }),
        });
        setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
        setSelectedZone(updated);
        toast.success(
          'Đã lưu khoanh vùng thành công',
          `Đã cập nhật ranh giới cho khu vực "${targetZone.name}"`,
        );
      } catch (err) {
        toast.error('Lưu khoanh vùng thất bại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
      } finally {
        setIsDrawingMode(false);
        setDrawingTarget(null);
      }
    }
  };

  // Cancel drawing
  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    if (drawingTarget?.type === 'NEW_ZONE') {
      setShowNewZone(true);
    }
    setDrawingTarget(null);
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
    toast.success('Phân công tài xế', `Đã thêm ${driverIds.length} tài xế vào khu vực.`);
  };

  const handleUnassignDriver = async (driverId: string) => {
    if (!driverZone) return;
    const updated = await unassignDriverFromZone(driverZone.id, driverId);
    setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
    setDriverZone(updated);
    if (selectedZone?.id === updated.id) setSelectedZone(updated);
    toast.info('Hủy phân công', 'Đã hủy phân công tài xế khỏi khu vực.');
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
                onClick={() => {
                  setNewZoneName('');
                  setNewZoneBoundary(null);
                  setShowNewZone(true);
                }}
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
                {criticalCount} khu vực đang <strong>QUÁ TẢI</strong>
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

        {/* Zone cards list */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {isLoading && zones.length === 0 ? (
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
                onStartDraw={() => handleStartDrawForExistingZone(zone)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Map View (Always rendered for smooth drawing & overview) */}
      <div className="flex-1 card overflow-hidden flex flex-col">
        {/* Map Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Map size={15} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-700 text-gray-900">
                {selectedZone ? selectedZone.name : 'Toàn bộ khu vực vận hành'}
              </h3>
              <p className="text-xs text-gray-400">
                {selectedZone
                  ? `${selectedZone.assignedDriverIds?.length ?? 0} tài xế phân công · ${selectedZone.metrics.totalOrders} đơn chờ`
                  : `${zones.length} khu vực trên bản đồ`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedZone && (
              <>
                <button
                  onClick={() => handleStartDrawForExistingZone(selectedZone)}
                  disabled={isDrawingMode}
                  className="btn-secondary text-xs px-3 h-8 text-blue-600 hover:text-blue-700 font-semibold"
                  id="btn-header-redraw-zone"
                >
                  ✏️ {parseZoneBoundary(selectedZone.boundaryGeoJson).length >= 3 ? 'Vẽ lại vùng' : 'Khoanh vùng'}
                </button>
                <button
                  onClick={() => setDriverZone(selectedZone)}
                  className="btn-secondary text-xs px-3 h-8"
                  id="btn-open-driver-assignment"
                >
                  <Users size={13} /> Phân công tài xế
                </button>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                  title="Bỏ chọn khu vực"
                >
                  <X size={15} />
                </button>
              </>
            )}
            {!selectedZone && (
              <button
                onClick={() => {
                  setNewZoneName('');
                  setNewZoneBoundary(null);
                  setShowNewZone(true);
                }}
                className="btn-primary text-xs px-3 h-8"
              >
                <Plus size={13} /> Tạo khu vực mới
              </button>
            )}
          </div>
        </div>

        {/* Leaflet Map */}
        <div className="flex-1 relative">
          <ZoneMapView
            zone={selectedZone}
            allZones={zones}
            onZoneSelect={(id) => {
              const z = zones.find((item) => item.id === id);
              if (z) setSelectedZone(z);
            }}
            isDrawingMode={isDrawingMode}
            drawingTargetName={
              drawingTarget?.type === 'EXISTING_ZONE'
                ? drawingTarget.zone.name
                : drawingTarget?.type === 'NEW_ZONE'
                ? (newZoneName || 'Khu vực mới')
                : null
            }
            onDrawComplete={handleDrawComplete}
            onCancelDrawing={handleCancelDrawing}
            onStartDrawing={() => {
              if (selectedZone) {
                handleStartDrawForExistingZone(selectedZone);
              }
            }}
            previewPolygonGeoJson={newZoneBoundary}
          />
        </div>
      </div>

      {/* Modals */}
      {showNewZone && (
        <NewZoneModal
          onClose={() => {
            setShowNewZone(false);
            setNewZoneName('');
            setNewZoneBoundary(null);
          }}
          onSubmit={handleCreateZone}
          loading={isCreating}
          name={newZoneName}
          onNameChange={setNewZoneName}
          boundaryGeoJson={newZoneBoundary}
          onStartDraw={handleStartDrawForNewZone}
          onClearBoundary={() => setNewZoneBoundary(null)}
        />
      )}

      {driverZone && (
        <DriverAssignmentModal
          zone={driverZone}
          allZones={zones}
          allDrivers={allDrivers}
          onClose={() => setDriverZone(null)}
          onAssign={handleAssignDrivers}
          onUnassign={handleUnassignDriver}
        />
      )}
    </div>
  );
}

export default withRoleGuard(ZonesPage, ['ADMIN', 'DISPATCHER']);
