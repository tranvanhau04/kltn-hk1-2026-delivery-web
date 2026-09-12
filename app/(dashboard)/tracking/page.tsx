'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Navigation, Phone, MessageSquare,
  MapPin, X,
  Activity,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { mockDrivers, mockOrders } from '@/lib/mock-data';
import { fetchLiveTracking, type ApiLiveDriver } from '@/lib/api';
import type { Driver } from '@/types/domain';
import { cn } from '@/lib/utils';

const TrackingMapView = dynamic(() => import('@/components/map/TrackingMapView'), { ssr: false });

// ─── Polyline Interpolation Helper ──────────────────────────────
function moveAlongPolyline(
  polyline: [number, number][],
  currentDistance: number,
  stepMeters: number
): { lat: number; lng: number; newDistance: number; heading: number } {
  if (!polyline || polyline.length < 2) {
    return { lat: polyline?.[0]?.[0] ?? 0, lng: polyline?.[0]?.[1] ?? 0, newDistance: 0, heading: 0 };
  }

  const d = currentDistance + stepMeters;
  let accumulated = 0;
  const R = 6371e3; // Earth radius in meters

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    
    const lat1 = p1[0] * Math.PI/180;
    const lat2 = p2[0] * Math.PI/180;
    const dLat = (p2[0]-p1[0]) * Math.PI/180;
    const dLng = (p2[1]-p1[1]) * Math.PI/180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const segmentDist = R * c;

    if (accumulated + segmentDist >= d) {
      const ratio = segmentDist === 0 ? 0 : (d - accumulated) / segmentDist;
      const lat = p1[0] + (p2[0] - p1[0]) * ratio;
      const lng = p1[1] + (p2[1] - p1[1]) * ratio;

      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      const theta = Math.atan2(y, x);
      const heading = (theta * 180 / Math.PI + 360) % 360;

      return { lat, lng, newDistance: d, heading };
    }
    accumulated += segmentDist;
  }

  // Reached end, loop back
  return { lat: polyline[0][0], lng: polyline[0][1], newDistance: 0, heading: 0 };
}

// ─── Live tracking hook ──────────────────────────────────────────
function useLiveTracking() {
  const [liveDrivers, setLiveDrivers] = useState<ApiLiveDriver[]>([]);
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number; heading?: number }>>({});
  const [positionSource, setPositionSource] = useState<Record<string, 'real' | 'simulated'>>({});
  const [polylines, setPolylines] = useState<{ driverId: string; path: [number, number][]; color: string }[]>([]);
  const [usingRealApi, setUsingRealApi] = useState(false);
  
  const simStateRef = useRef<Record<string, { distance: number }>>({});
  const driversRef = useRef<ApiLiveDriver[]>([]);
  const polylinesRef = useRef<{ driverId: string; path: [number, number][]; color: string }[]>([]);

  const COLORS = ['#FA7070', '#6D28D9', '#1D4ED8', '#059669', '#D97706', '#DB2777'];

  const fetchPositions = useCallback(async () => {
    try {
      const data = await fetchLiveTracking();
      if (data.length === 0) throw new Error('No live drivers');
      
      setLiveDrivers(data);
      driversRef.current = data;
      setUsingRealApi(true);

      const newPolylines: typeof polylines = [];
      data.forEach((d, idx) => {
        if (d.activeRoute?.polyline?.length) {
          newPolylines.push({
            driverId: d.driverId,
            path: d.activeRoute.polyline,
            color: COLORS[idx % COLORS.length],
          });
        }
      });
      
      setPolylines(newPolylines);
      polylinesRef.current = newPolylines;
    } catch {
      setUsingRealApi(false);
      // Mock drivers will be used as fallback by mergeDriverData
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // API Polling — every 5 seconds
  useEffect(() => {
    // fetchPositions();
    const t1 = setInterval(fetchPositions, 5000);
    return () => clearInterval(t1);
  }, [fetchPositions]);

  // Simulation Tick (every 100ms) — only for drivers with polylines but no live GPS
  useEffect(() => {
    let lastTime = performance.now();
    
    const t2 = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000; // seconds
      lastTime = now;

      setPositions(prev => {
        const next = { ...prev };
        let changed = false;

        const currentDrivers = usingRealApi ? driversRef.current : mockDrivers;

        currentDrivers.forEach(d => {
          const did = usingRealApi ? (d as ApiLiveDriver).driverId : (d as Driver).userId;
          const dLive = d as ApiLiveDriver;

          // Priority 1: Real GPS
          const isRealGps =
            !dLive.positionUnknown &&
            dLive.lastUpdated &&
            dLive.currentLat != null &&
            dLive.currentLng != null; // Bypassed 60s time check for testing (timezone issues)

          if (isRealGps && dLive.currentLat != null && dLive.currentLng != null) {
            next[did] = { lat: dLive.currentLat, lng: dLive.currentLng };
            setPositionSource(ps => ps[did] === 'real' ? ps : { ...ps, [did]: 'real' });
            changed = true;
            return;
          }

          // Priority 2: Simulate movement along the assigned OSRM polyline.
          // Labeled clearly as 'Mô phỏng lộ trình' in the UI — not real GPS.
          const poly = polylinesRef.current.find(p => p.driverId === did)?.path;
          if (poly && poly.length > 1) {
            const state = simStateRef.current[did] || { distance: 0 };
            // Simulate ~25 km/h → ~6.944 m/s
            const res = moveAlongPolyline(poly, state.distance, 6.944 * dt);
            simStateRef.current[did] = { distance: res.newDistance };
            next[did] = { lat: res.lat, lng: res.lng, heading: res.heading };
            setPositionSource(ps => ps[did] === 'simulated' ? ps : { ...ps, [did]: 'simulated' });
            changed = true;
            return;
          }

          // Priority 3: Driver has no route and no GPS history — fallback to mock location for testing
          const mockDriver = mockDrivers.find(m => m.userId === did);
          if (mockDriver && mockDriver.currentLat != null && mockDriver.currentLng != null) {

            next[did] = { lat: mockDriver.currentLat, lng: mockDriver.currentLng };
            setPositionSource(ps => ps[did] === 'simulated' ? ps : { ...ps, [did]: 'simulated' });
            changed = true;
            return;
          }

          // Priority 4: No location data at all
          if (next[did]) {
            delete next[did];
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 100);

    return () => clearInterval(t2);
  }, [usingRealApi]);

  return { positions, positionSource, polylines, liveDrivers, usingRealApi };
}

// ─── Merge live driver data with mock driver structure ────────────
function mergeDriverData(liveDrivers: ApiLiveDriver[]): Driver[] {
  if (liveDrivers.length === 0) return mockDrivers;

  return liveDrivers.map((ld) => {
    const mock = mockDrivers.find((m) => m.userId === ld.driverId);
    return {
      userId: ld.driverId,
      fullName: ld.fullName,
      phone: ld.phone,
      email: mock?.email ?? '',
      licensePlate: ld.licensePlate,
      vehicleType: (ld.vehicleType || mock?.vehicleType || 'MOTORBIKE') as Driver['vehicleType'],
      maxWeightKg: mock?.maxWeightKg ?? 50,
      maxVolumeM3: mock?.maxVolumeM3 ?? 0.2,
      currentShiftStatus: (ld.currentShiftStatus === 'BUSY' || ld.currentShiftStatus === 'ONLINE_READY'
        ? 'ON_DUTY'
        : ld.currentShiftStatus === 'OFFLINE'
          ? 'OFF_DUTY'
          : mock?.currentShiftStatus ?? 'OFF_DUTY') as Driver['currentShiftStatus'],
      currentLat: ld.currentLat ?? mock?.currentLat,
      currentLng: ld.currentLng ?? mock?.currentLng,
      currentSpeedKmh: mock?.currentSpeedKmh,
    };
  });
}

function DriverSlideOver({ driver, position, onClose, liveData }: {
  driver: Driver;
  position: { lat: number; lng: number };
  onClose: () => void;
  liveData?: ApiLiveDriver;
}) {
  const nextOrder = mockOrders.find((o) => o.driverId === driver.userId && o.status === 'IN_TRANSIT') ??
                    mockOrders.find((o) => o.driverId === driver.userId && o.status === 'ASSIGNED');

  return (
    <div className="absolute top-4 right-4 w-72 z-[1000] animate-slide-right max-h-[calc(100vh-160px)] flex flex-col">
      <div className="card flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100 h-full">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-500 to-rose-600 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-700 text-xl">
              {driver.fullName.charAt(0)}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer z-10">
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

        {/* Active route from API */}
        {liveData?.activeRoute && (
          <div className="p-4 border-b border-slate-100 shrink-0 bg-blue-50">
            <p className="text-xs font-700 text-blue-600 uppercase tracking-wide mb-2">Tuyến đang chạy</p>
            <div className="flex items-center gap-3 text-xs text-blue-800">
              <span>📍 {liveData.activeRoute.totalDistanceKm} km</span>
              <span>⏱ {liveData.activeRoute.totalEstimatedTimeMin} phút</span>
            </div>
          </div>
        )}

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
  const { positions, positionSource, polylines, liveDrivers, usingRealApi } = useLiveTracking();

  const allDrivers = mergeDriverData(liveDrivers);
  const activeDrivers = allDrivers.filter((d) => d.currentShiftStatus !== 'OFF_DUTY');
  const filteredDrivers = activeDrivers.filter((d) =>
    !search || d.fullName.toLowerCase().includes(search.toLowerCase()) || d.licensePlate.toLowerCase().includes(search.toLowerCase())
  );

  // Count GPS sources for status bar
  const realGpsCount = Object.values(positionSource).filter(s => s === 'real').length;
  const simCount = Object.values(positionSource).filter(s => s === 'simulated').length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 128px)' }}>
      {/* Top bar */}
      <div className="card px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-[#FA7070]">
          <Navigation size={18} className="animate-pulse-glow" />
          <span className="text-sm font-600 text-gray-800">Theo dõi thực time</span>
        </div>
        {/* GPS status — clearly distinguishes real GPS from polyline simulation */}
        {usingRealApi ? (
          <div className="flex items-center gap-2">
            {realGpsCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-green-700 bg-green-50">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {realGpsCount} GPS thực
              </div>
            )}
            {simCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-blue-600 bg-blue-50">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                {simCount} Mô phỏng lộ trình
              </div>
            )}
            {realGpsCount === 0 && simCount === 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-gray-500 bg-gray-50">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                Chờ GPS...
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full text-amber-600 bg-amber-50">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {activeDrivers.filter((d) => d.currentShiftStatus === 'ON_DUTY').length} tài xế (demo)
          </div>
        )}
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
              {driver.fullName.replace(/\s*\(.*\)/, '').split(' ').slice(-2).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Map + slide-over */}
      <div className="relative flex-1 card overflow-hidden">
        <TrackingMapView
          drivers={filteredDrivers}
          positions={positions}
          positionSource={positionSource}
          selectedDriverId={selectedDriver?.userId}
          onDriverSelect={(driver) => setSelectedDriver(driver === selectedDriver ? null : driver)}
          polylines={polylines}
        />

        {/* Slide-over panel */}
        {selectedDriver && positions[selectedDriver.userId] && (
          <DriverSlideOver
            driver={selectedDriver}
            position={positions[selectedDriver.userId]}
            onClose={() => setSelectedDriver(null)}
            liveData={liveDrivers.find((d) => d.driverId === selectedDriver.userId)}
          />
        )}
      </div>
    </div>
  );
}
