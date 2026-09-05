'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Navigation, Phone, MessageSquare,
  Zap, Clock, MapPin, Truck, ArrowRight, X, ChevronRight,
  Activity,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { mockDrivers, mockOrders } from '@/lib/mock-data';
import type { Driver } from '@/types/domain';
import { cn } from '@/lib/utils';

const TrackingMapView = dynamic(() => import('@/components/map/TrackingMapView'), { ssr: false });

// Simulate moving driver positions
function useSimulatedPositions() {
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>(() => {
    const init: Record<string, { lat: number; lng: number }> = {};
    mockDrivers.forEach((d) => {
      if (d.currentLat && d.currentLng) {
        init[d.userId] = { lat: d.currentLat, lng: d.currentLng };
      }
    });
    return init;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          const driver = mockDrivers.find((d) => d.userId === id);
          if (driver?.currentShiftStatus === 'ON_DUTY') {
            next[id] = {
              lat: prev[id].lat + (Math.random() - 0.5) * 0.002,
              lng: prev[id].lng + (Math.random() - 0.5) * 0.002,
            };
          }
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return positions;
}

function DriverSlideOver({ driver, position, onClose }: {
  driver: Driver;
  position: { lat: number; lng: number };
  onClose: () => void;
}) {
  const nextOrder = mockOrders.find((o) => o.driverId === driver.userId && o.status === 'IN_TRANSIT') ??
                    mockOrders.find((o) => o.driverId === driver.userId && o.status === 'ASSIGNED');

  return (
    <div className="absolute top-4 right-4 bottom-4 w-72 z-10 animate-slide-right">
      <div className="card h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-br from-[#FA7070] to-[#8B2626] shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-700 text-xl">
              {driver.fullName.charAt(0)}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
          </div>
          <h3 className="text-white font-700 text-base">{driver.fullName}</h3>
          <p className="text-white/70 text-xs mt-0.5">{driver.licensePlate} · {driver.vehicleType.replace(/_/g, ' ')}</p>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={driver.currentShiftStatus} className="text-[11px]" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-0 border-b border-slate-100 shrink-0">
          <div className="p-4 text-center border-r border-slate-100">
            <div className="flex items-center justify-center gap-1 text-[#FA7070] mb-1">
              <Activity size={14} />
              <span className="text-xl font-700">{driver.currentSpeedKmh ?? 0}</span>
            </div>
            <p className="text-xs text-gray-400">km/h</p>
          </div>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
              <MapPin size={14} />
              <span className="text-xs font-600">{position.lat.toFixed(4)}</span>
            </div>
            <p className="text-xs text-gray-400">{position.lng.toFixed(4)}</p>
          </div>
        </div>

        {/* Next Stop */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <p className="text-xs font-700 text-gray-400 uppercase tracking-wide mb-3">Điểm dừng tiếp theo</p>
          {nextOrder ? (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={13} className="text-blue-500 shrink-0" />
                <span className="text-xs font-600 text-blue-700">{nextOrder.receiverName}</span>
              </div>
              <p className="text-[11px] text-blue-500 ml-5">{nextOrder.deliveryAddress}</p>
              {nextOrder.codAmount > 0 && (
                <p className="text-[11px] text-green-600 ml-5 mt-1 font-500">
                  COD: {nextOrder.codAmount.toLocaleString('vi-VN')}đ
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Không có điểm dừng tiếp theo</p>
          )}
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-700 text-gray-400 uppercase tracking-wide mb-2">Tất cả điểm giao</p>
          {mockOrders
            .filter((o) => o.driverId === driver.userId)
            .map((order, i) => (
              <div key={order.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50">
                <div className="w-5 h-5 rounded-full bg-[#FA7070]/10 flex items-center justify-center text-[#FA7070] text-[10px] font-700 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-500 text-gray-700 truncate">{order.receiverName}</p>
                  <StatusBadge status={order.status} className="text-[9px] mt-0.5" />
                </div>
              </div>
            ))}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-100 space-y-2 shrink-0">
          <a
            href={`tel:${driver.phone}`}
            className="flex items-center justify-center gap-2 w-full h-10 bg-gray-100 text-gray-700 rounded-xl text-sm font-500 hover:bg-gray-200 transition-colors"
          >
            <Phone size={15} /> {driver.phone}
          </a>
          <button
            className="btn-primary w-full justify-center text-sm"
            id="btn-message-driver"
          >
            <MessageSquare size={15} /> Nhắn tin tài xế
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const [search, setSearch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const positions = useSimulatedPositions();

  const activeDrivers = mockDrivers.filter((d) => d.currentShiftStatus !== 'OFF_DUTY');
  const filteredDrivers = activeDrivers.filter((d) =>
    !search || d.fullName.toLowerCase().includes(search.toLowerCase()) || d.licensePlate.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 128px)' }}>
      {/* Top bar */}
      <div className="card px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-[#FA7070]">
          <Navigation size={18} className="animate-pulse-glow" />
          <span className="text-sm font-600 text-gray-800">Theo dõi thực time</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {activeDrivers.filter((d) => d.currentShiftStatus === 'ON_DUTY').length} tài xế đang hoạt động
        </div>
        <div className="ml-auto relative flex items-center w-56">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài xế, biển số..."
            className="input-base pl-10 h-9 text-sm w-full"
            id="tracking-search"
          />
        </div>

        {/* Driver quick-select */}
        <div className="flex items-center gap-2">
          {filteredDrivers.slice(0, 5).map((driver) => (
            <button
              key={driver.userId}
              onClick={() => setSelectedDriver(driver === selectedDriver ? null : driver)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-500 border transition-all',
                selectedDriver?.userId === driver.userId
                  ? 'border-[#FA7070] bg-[#FFF0F0] text-[#FA7070]'
                  : 'border-slate-100 text-gray-600 hover:border-slate-200 hover:bg-gray-50'
              )}
              id={`track-driver-${driver.userId}`}
            >
              <span className={cn(
                'w-2 h-2 rounded-full',
                driver.currentShiftStatus === 'ON_DUTY' ? 'bg-green-500' :
                driver.currentShiftStatus === 'ON_BREAK' ? 'bg-amber-500' : 'bg-gray-400'
              )} />
              {driver.fullName.split(' ').pop()}
            </button>
          ))}
        </div>
      </div>

      {/* Map + slide-over */}
      <div className="relative flex-1 card overflow-hidden">
        <TrackingMapView
          drivers={filteredDrivers}
          positions={positions}
          selectedDriverId={selectedDriver?.userId}
          onDriverSelect={(driver) => setSelectedDriver(driver === selectedDriver ? null : driver)}
        />

        {/* Slide-over panel */}
        {selectedDriver && positions[selectedDriver.userId] && (
          <DriverSlideOver
            driver={selectedDriver}
            position={positions[selectedDriver.userId]}
            onClose={() => setSelectedDriver(null)}
          />
        )}
      </div>
    </div>
  );
}
