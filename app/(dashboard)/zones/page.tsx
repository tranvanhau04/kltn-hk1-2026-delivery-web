'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Map, Plus, Pencil, Trash2, AlertTriangle, X,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { mockZones, mockDrivers } from '@/lib/mock-data';
import type { Zone } from '@/types/domain';
import { cn } from '@/lib/utils';

const ZoneMapView = dynamic(() => import('@/components/map/ZoneMapView'), { ssr: false });

function ZoneCard({
  zone,
  onEdit,
  onDelete,
  onClick,
  isSelected,
}: {
  zone: Zone;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  isSelected: boolean;
}) {
  const isOverloaded = (zone.orderCount ?? 0) > (zone.capacity ?? 999);
  const utilization = zone.capacity ? Math.min(100, Math.round(((zone.orderCount ?? 0) / zone.capacity) * 100)) : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-2xl border transition-all group',
        isSelected
          ? 'border-[#FA7070] bg-[#FFF0F0] shadow-md'
          : isOverloaded
          ? 'border-red-200 bg-red-50/50 hover:border-red-300'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'
      )}
      id={`zone-${zone.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
            isSelected ? 'bg-[#FA7070] text-white' :
            isOverloaded ? 'bg-red-100 text-red-600' :
            'bg-blue-50 text-blue-600'
          )}>
            <Map size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-700 text-gray-900">{zone.name}</h3>
              {isOverloaded && (
                <span className="inline-flex items-center gap-1 text-[10px] font-700 bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={9} /> Quá tải
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">ID: {zone.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-base font-700 text-gray-900">{zone.orderCount ?? 0}</p>
          <p className="text-[10px] text-gray-400">Đơn hàng</p>
        </div>
        <div className="text-center">
          <p className="text-base font-700 text-gray-900">{zone.capacity ?? '∞'}</p>
          <p className="text-[10px] text-gray-400">Sức chứa</p>
        </div>
        <div className="text-center">
          <p className={cn(
            'text-base font-700',
            mockDrivers.filter(() => true).length > 0 ? 'text-green-600' : 'text-gray-400'
          )}>
            {mockDrivers.length}
          </p>
          <p className="text-[10px] text-gray-400">Tài xế</p>
        </div>
      </div>

      {/* Utilization bar */}
      {zone.capacity && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400">Sử dụng</span>
            <span className={cn(
              'text-[10px] font-700',
              isOverloaded ? 'text-red-600' : utilization > 70 ? 'text-amber-600' : 'text-green-600'
            )}>
              {utilization}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isOverloaded ? 'bg-red-500' : utilization > 70 ? 'bg-amber-500' : 'bg-green-500'
              )}
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

function NewZoneModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (z: Partial<Zone>) => void;
}) {
  const [form, setForm] = useState({ name: '', capacity: '' });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Tạo khu vực mới"
      subtitle="Vẽ ranh giới trên bản đồ"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button
            onClick={() => onSubmit({ name: form.name, capacity: parseInt(form.capacity) || undefined, orderCount: 0, createdAt: new Date().toISOString() })}
            className="btn-primary"
            id="btn-create-zone"
          >
            <Plus size={15} /> Tạo khu vực
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Tên khu vực *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="VD: Khu vực Bình Dương"
            className="input-base"
            id="zone-name"
          />
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Sức chứa tối đa</label>
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            placeholder="Số đơn hàng tối đa"
            className="input-base"
            id="zone-capacity"
          />
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-700 font-500 mb-1">💡 Hướng dẫn vẽ ranh giới</p>
          <p className="text-xs text-blue-600">
            Sau khi tạo, nhấn vào khu vực trên danh sách để xem bản đồ và vẽ ranh giới polygon.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>(mockZones);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [showNewZone, setShowNewZone] = useState(false);

  const overloadedCount = zones.filter((z) => (z.orderCount ?? 0) > (z.capacity ?? 999)).length;

  return (
    <div className="flex gap-5 animate-fade-in" style={{ minHeight: 'calc(100vh - 128px)' }}>
      {/* Left: Zone list */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        {/* Header */}
        <div className="card p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-700 text-gray-900">Khu vực</h2>
              <p className="text-xs text-gray-400">{zones.length} khu vực đang quản lý</p>
            </div>
            <button onClick={() => setShowNewZone(true)} className="btn-primary text-sm px-3 h-9" id="btn-new-zone">
              <Plus size={14} /> Thêm
            </button>
          </div>

          {/* Overload warning */}
          {overloadedCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 animate-fade-in">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-500">
                {overloadedCount} khu vực đang quá tải sức chứa
              </p>
            </div>
          )}
        </div>

        {/* Zone cards */}
        <div className="flex-1 space-y-3 overflow-y-auto">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              isSelected={selectedZone?.id === zone.id}
              onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
              onEdit={() => {}}
              onDelete={() => setZones((prev) => prev.filter((z) => z.id !== zone.id))}
            />
          ))}
        </div>
      </div>

      {/* Right: Zone map */}
      <div className="flex-1 card overflow-hidden">
        {selectedZone ? (
          <div className="flex flex-col h-full">
            {/* Zone map header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Map size={15} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-700 text-gray-900">{selectedZone.name}</h3>
                  <p className="text-xs text-gray-400">Nhấn vào bản đồ để vẽ ranh giới</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Map */}
            <div className="flex-1">
              <ZoneMapView zone={selectedZone} />
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

      {showNewZone && (
        <NewZoneModal
          onClose={() => setShowNewZone(false)}
          onSubmit={(data) => {
            const newZone: Zone = {
              id: `z${Date.now()}`,
              name: data.name ?? 'Khu vực mới',
              boundaryGeoJson: '{}',
              createdAt: new Date().toISOString(),
              orderCount: 0,
              capacity: data.capacity,
            };
            setZones((prev) => [...prev, newZone]);
            setShowNewZone(false);
          }}
        />
      )}
    </div>
  );
}
