'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Map, Plus, Trash2, AlertTriangle, X, Users,
  RefreshCw, AlertCircle, Loader2, Compass, CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/lib/utils';
import {
  fetchZones, assignDriversToZone, unassignDriverFromZone, fetchDrivers, deleteZone,
  apiFetch,
  type ApiZone,
} from '@/lib/api';
import type { Driver } from '@/types/domain';
import { useToast } from '@/context/ToastContext';
import { parseZoneBoundary } from '@/lib/zoneGeo';
import { withRoleGuard } from '@/components/auth/withRoleGuard';

// Dynamically import Leaflet map components to prevent SSR window errors
const ZoneMapView = dynamic(() => import('@/components/map/ZoneMapView'), { ssr: false });
const DriverAssignmentModal = dynamic(
  () => import('@/components/zones/DriverAssignmentModal'),
  { ssr: false },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  NORMAL:   { label: 'Tải an toàn',    badgeClass: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dotClass: 'bg-emerald-500' },
  WARNING:  { label: 'Sắp đầy (>80%)', badgeClass: 'bg-amber-50/70 text-amber-700 border-amber-200',       dotClass: 'bg-amber-500' },
  CRITICAL: { label: 'QUÁ TẢI',        badgeClass: 'bg-red-50/70 text-red-700 border-red-200',             dotClass: 'bg-red-500' },
} as const;

// ─── ZoneCard ─────────────────────────────────────────────────────────────────

const ZoneCard = React.memo(function ZoneCard({
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

  const boundaryCoords = useMemo(() => parseZoneBoundary(zone.boundaryGeoJson), [zone.boundaryGeoJson]);
  const hasBoundary = boundaryCoords.length >= 3;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-colors group cursor-pointer shadow-2xs',
        isSelected
          ? 'border-slate-900 bg-slate-50/90 ring-1 ring-slate-900/10'
          : metrics.overloadSeverity === 'CRITICAL'
          ? 'border-red-200 bg-red-50/30 hover:border-red-300'
          : metrics.overloadSeverity === 'WARNING'
          ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
          : 'border-slate-200/80 bg-white hover:border-slate-300',
      )}
      id={`zone-card-${zone.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2.5">
          <div className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center shrink-0 border',
            isSelected ? 'bg-slate-900 border-slate-900 text-white' :
            metrics.overloadSeverity === 'CRITICAL' ? 'bg-red-50 border-red-200 text-[#D92D20]' :
            metrics.overloadSeverity === 'WARNING' ? 'bg-amber-50 border-amber-200 text-amber-600' :
            'bg-slate-100 border-slate-200/80 text-slate-700'
          )}>
            <Map size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{zone.name}</h3>
            <div className="mt-1">
              <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border', badgeClass)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
                {label}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons (hover reveal) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDrivers(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Phân công tài xế"
            id={`btn-zone-drivers-${zone.id}`}
          >
            <Users size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-[#D92D20] transition-colors"
            title="Xóa khu vực"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3 tabular-nums">
        <div className="text-center p-1.5 rounded bg-slate-50/70 border border-slate-100">
          <p className="text-sm font-semibold text-slate-900">{metrics.totalOrders}</p>
          <p className="text-[10px] text-slate-500">Đơn chờ</p>
        </div>
        <div className="text-center p-1.5 rounded bg-slate-50/70 border border-slate-100">
          <p className={cn('text-sm font-semibold', metrics.activeDriversCount > 0 ? 'text-emerald-600' : 'text-slate-400')}>
            {metrics.activeDriversCount}
          </p>
          <p className="text-[10px] text-slate-500">TX hoạt động</p>
        </div>
        <div className="text-center p-1.5 rounded bg-slate-50/70 border border-slate-100">
          <p className="text-sm font-semibold text-slate-900">{zone.assignedDriverIds?.length ?? 0}</p>
          <p className="text-[10px] text-slate-500">TX phân công</p>
        </div>
      </div>

      {/* Weight utilization bar */}
      {metrics.fleetCapacityWeight > 0 && (
        <div className="mb-2.5 tabular-nums">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">
              Tải trọng: {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg
            </span>
            <span className={cn(
              'text-[11px] font-semibold',
              metrics.overloadSeverity === 'CRITICAL' ? 'text-[#D92D20]' :
              metrics.overloadSeverity === 'WARNING' ? 'text-amber-600' : 'text-emerald-600',
            )}>
              {Math.round(metrics.weightRatio * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-xs overflow-hidden">
            <div
              className={cn('h-full transition-all',
                metrics.overloadSeverity === 'CRITICAL' ? 'bg-[#D92D20]' :
                metrics.overloadSeverity === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-600',
              )}
              style={{ width: `${Math.min(100, weightPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Boundary status & Drawing action */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/70 text-[11px]">
        {hasBoundary ? (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" /> Đã có vùng
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200">
            Chưa có vùng
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartDraw();
          }}
          className="font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
          title={hasBoundary ? 'Kéo chuột để vẽ lại vùng' : 'Kéo chuột để khoanh vùng'}
          id={`btn-card-draw-${zone.id}`}
        >
          {hasBoundary ? 'Vẽ lại vùng' : 'Khoanh vùng'}
        </button>
      </div>
    </div>
  );
});

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
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <Compass size={14} className="text-slate-600" />
              Khoanh vùng bản đồ:
            </span>
            {hasBoundary ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                <CheckCircle2 size={12} className="text-emerald-600" /> Đã khoanh vùng (4 tọa độ góc)
              </span>
            ) : (
              <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                Chưa khoanh vùng
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartDraw}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium transition-colors"
              id="btn-modal-draw-zone"
            >
              {hasBoundary ? 'Vẽ lại khoanh vùng trên bản đồ' : 'Vẽ khoanh vùng trên bản đồ'}
            </button>
            {hasBoundary && (
              <button
                type="button"
                onClick={onClearBoundary}
                className="px-3 py-2 bg-white hover:bg-red-50 text-[#D92D20] border border-red-200 rounded-md text-xs font-medium transition-colors"
              >
                Xóa
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Nhấn &quot;Vẽ khoanh vùng trên bản đồ&quot; để ẩn tạm form, sau đó nhấn giữ chuột trái và kéo một ô vuông trên bản đồ. Tọa độ 4 góc sẽ tự động lưu vào khu vực.
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

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await deleteZone(zoneId);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      if (selectedZone?.id === zoneId) setSelectedZone(null);
      if (driverZone?.id === zoneId) setDriverZone(null);
      toast.success('Đã xóa khu vực', 'Khu vực đã được xóa vĩnh viễn khỏi hệ thống.');
    } catch (err) {
      toast.error('Xóa khu vực thất bại', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    }
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
              <h2 className="text-sm font-semibold text-slate-900">Khu vực</h2>
              <p className="text-xs text-slate-500 tabular-nums">{zones.length} khu vực đang quản lý</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={loadZones}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
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
                className="btn-primary text-xs px-3 h-8"
                id="btn-new-zone"
              >
                <Plus size={14} /> Thêm
              </button>
            </div>
          </div>

          {/* Alert banners */}
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-md border border-red-200 mb-2 animate-fade-in">
              <AlertTriangle size={14} className="text-[#D92D20] shrink-0" />
              <p className="text-xs text-red-700 font-medium tabular-nums">
                {criticalCount} khu vực đang <strong>QUÁ TẢI</strong>
              </p>
            </div>
          )}
          {warningCount > 0 && !criticalCount && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-md border border-amber-200 mb-2 animate-fade-in">
              <AlertCircle size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-medium tabular-nums">
                {warningCount} khu vực sắp đầy tải (&gt;80%)
              </p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-md border border-red-200">
              <AlertCircle size={14} className="text-[#D92D20] shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Zone cards list */}
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {isLoading && zones.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-slate-200/80 bg-white animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-md bg-slate-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((j) => <div key={j} className="h-10 bg-slate-100 rounded-md" />)}
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Map size={15} className="text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {selectedZone ? selectedZone.name : 'Toàn bộ khu vực vận hành'}
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
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
                  className="btn-secondary text-xs px-3 h-8"
                  id="btn-header-redraw-zone"
                >
                  {parseZoneBoundary(selectedZone.boundaryGeoJson).length >= 3 ? 'Vẽ lại vùng' : 'Khoanh vùng'}
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
                  className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
