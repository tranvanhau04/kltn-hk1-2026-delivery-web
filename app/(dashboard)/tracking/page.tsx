'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Navigation, Phone, MessageSquare,
  MapPin, X,
  Activity, User, Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fetchLiveTracking, fetchDriverActiveOrders, type ApiLiveDriver, type ApiOrder } from '@/lib/api';
import type { Driver } from '@/types/domain';
import { connectSocket, onDriverLocationUpdated } from '@/lib/socketClient';

const TrackingMap = dynamic(() => import('@/components/TrackingMap'), { ssr: false });

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
      const list = Array.isArray(data) ? data : [];
      
      setLiveDrivers(list);
      driversRef.current = list;
      setUsingRealApi(true);

      const newPolylines: typeof polylines = [];
      list.forEach((d, idx) => {
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
      setLiveDrivers([]);
      driversRef.current = [];
      setPolylines([]);
      polylinesRef.current = [];
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // API Polling — every 5 seconds
  useEffect(() => {
    fetchPositions();
    const t1 = setInterval(fetchPositions, 5000);
    return () => clearInterval(t1);
  }, [fetchPositions]);

  // Realtime Socket.io Live Tracking
  useEffect(() => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token && typeof document !== 'undefined') {
      const cookieMatch = document.cookie.match(/(?:^|;\s*)(?:accessToken|token)=([^;]+)/);
      if (cookieMatch) token = decodeURIComponent(cookieMatch[1]);
    }

    connectSocket(token || '');

    const unsubscribe = onDriverLocationUpdated((data) => {
      setUsingRealApi(true);
      setPositionSource((ps) => ({ ...ps, [data.driverId]: 'real' }));
      setPositions((prev) => ({
        ...prev,
        [data.driverId]: { lat: data.latitude, lng: data.longitude },
      }));
      setLiveDrivers((prev) => {
        const idx = prev.findIndex((d) => d.driverId === data.driverId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            currentLat: data.latitude,
            currentLng: data.longitude,
            lastUpdated: String(data.timestamp || new Date().toISOString()),
            positionUnknown: false,
          };
          driversRef.current = next;
          return next;
        }
        const created: ApiLiveDriver = {
          driverId: data.driverId,
          fullName: data.fullName,
          phone: '',
          licensePlate: '',
          vehicleType: 'MOTORBIKE',
          currentShiftStatus: 'ONLINE_READY',
          currentLat: data.latitude,
          currentLng: data.longitude,
          lastUpdated: String(data.timestamp || new Date().toISOString()),
          positionUnknown: false,
          activeRoute: null,
        };
        const next = [...prev, created];
        driversRef.current = next;
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

        const currentDrivers = driversRef.current;

        currentDrivers.forEach(d => {
          const did = d.driverId;
          const dLive = d;

          // Priority 1: Real GPS
          const isRealGps =
            !dLive.positionUnknown &&
            dLive.lastUpdated &&
            dLive.currentLat != null &&
            dLive.currentLng != null;

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

          // Priority 3: No location data at all
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

// ─── Merge live driver data with driver domain structure ────────────
function mergeDriverData(liveDrivers: ApiLiveDriver[]): Driver[] {
  if (liveDrivers.length === 0) return [];

  return liveDrivers.map((ld) => {
    return {
      userId: ld.driverId,
      fullName: ld.fullName,
      phone: ld.phone,
      email: '',
      licensePlate: ld.licensePlate,
      vehicleType: (ld.vehicleType || 'MOTORBIKE') as Driver['vehicleType'],
      maxWeightKg: 50,
      maxVolumeM3: 0.2,
      currentShiftStatus: (ld.currentShiftStatus === 'BUSY' || ld.currentShiftStatus === 'ONLINE_READY'
        ? 'ON_DUTY'
        : 'OFF_DUTY') as Driver['currentShiftStatus'],
      currentLat: ld.currentLat ?? undefined,
      currentLng: ld.currentLng ?? undefined,
      currentSpeedKmh: undefined,
    };
  });
}

function DriverSlideOver({ driver, position, onClose, liveData }: {
  driver: Driver;
  position: { lat: number; lng: number };
  onClose: () => void;
  liveData?: ApiLiveDriver;
}) {
  const [activeStops, setActiveStops] = useState<ApiOrder[]>([]);
  const [loadingStops, setLoadingStops] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStops() {
      if (!driver?.userId) return;
      try {
        setLoadingStops(true);
        const orders = await fetchDriverActiveOrders(driver.userId);
        if (isMounted) setActiveStops(orders);
      } catch (err) {
        console.error('Failed to fetch driver active orders:', err);
        if (isMounted) setActiveStops([]);
      } finally {
        if (isMounted) setLoadingStops(false);
      }
    }
    loadStops();
    return () => {
      isMounted = false;
    };
  }, [driver.userId]);

  const nextOrder = activeStops.find((o) => o.status === 'IN_TRANSIT') ??
                    activeStops.find((o) => o.status === 'ASSIGNED') ??
                    activeStops[0];

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
          {loadingStops ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
              <Loader2 size={13} className="animate-spin text-[#FA7070]" />
              <span>Đang tải thông tin...</span>
            </div>
          ) : nextOrder ? (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={13} className="text-blue-500 shrink-0" />
                <span className="text-xs font-600 text-blue-700">{nextOrder.code} - {nextOrder.receiverName}</span>
              </div>
              <p className="text-[11px] text-blue-500 ml-5 truncate">{nextOrder.deliveryAddress}</p>
              {Number(nextOrder.codAmount) > 0 && (
                <p className="text-[11px] text-green-600 ml-5 mt-1 font-500">
                  COD: {Number(nextOrder.codAmount).toLocaleString('vi-VN')}đ
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Không có điểm dừng tiếp theo</p>
          )}
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-700 text-gray-400 uppercase tracking-wide">Tất cả điểm giao</p>
            {activeStops.length > 0 && (
              <span className="text-[11px] font-600 text-gray-500">({activeStops.length})</span>
            )}
          </div>
          {loadingStops ? (
            <div className="flex items-center justify-center p-6 text-xs text-gray-400 gap-2">
              <Loader2 size={14} className="animate-spin text-[#FA7070]" />
              <span>Đang tải danh sách điểm giao...</span>
            </div>
          ) : activeStops.length > 0 ? (
            activeStops.map((order, i) => (
              <div key={order.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-slate-100">
                <div className="w-5 h-5 rounded-full bg-[#FA7070]/10 flex items-center justify-center text-[#FA7070] text-[10px] font-700 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-600 text-gray-800 truncate">{order.code} - {order.receiverName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{order.deliveryAddress}</p>
                  <StatusBadge status={order.status} className="text-[9px] mt-0.5" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 italic text-center p-3">Chưa có điểm giao được phân công</p>
          )}
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
  const activeDrivers = allDrivers.filter((d) => d.currentShiftStatus !== 'OFFLINE');
  const filteredDrivers = activeDrivers.filter((d) =>
    !search || d.fullName.toLowerCase().includes(search.toLowerCase()) || d.licensePlate.toLowerCase().includes(search.toLowerCase())
  );

  // Count GPS sources for status bar
  const realGpsCount = Object.values(positionSource).filter(s => s === 'real').length;

  return (
    <div className="flex flex-col gap-3 animate-fade-in" style={{ height: 'calc(100vh - 128px)' }}>
      {/* Top bar */}
      <div className="card px-4 py-2.5 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 text-[#FA7070]">
          <Navigation size={18} className="animate-pulse-glow" />
          <span className="text-sm font-700 text-gray-800">Theo dõi trực tiếp (Live Tracking)</span>
        </div>

        {/* Realtime Status Indicator */}
        {usingRealApi ? (
          <div className="flex items-center gap-2">
            {realGpsCount > 0 ? (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full text-emerald-700 bg-emerald-50 font-600 border border-emerald-200/60 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {realGpsCount} GPS trực tuyến
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full text-gray-500 bg-gray-50 border border-gray-200">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                Chờ tín hiệu GPS...
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full text-gray-500 bg-gray-50 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Không có tín hiệu GPS
          </div>
        )}

        {/* Search */}
        <div className="ml-auto relative flex items-center w-52 sm:w-60">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài xế, biển số..."
            className="input-base pl-10 h-9 text-xs sm:text-sm w-full"
            id="tracking-search"
          />
        </div>

        {/* Driver selector dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor="driver-select"
            className="text-xs font-600 text-gray-500 whitespace-nowrap flex items-center gap-1 cursor-pointer"
          >
            <User size={14} className="text-[#FA7070] shrink-0" />
            <span className="hidden sm:inline">Tài xế:</span>
          </label>
          <div className="relative">
            <select
              id="driver-select"
              value={selectedDriver?.userId || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setSelectedDriver(null);
                } else {
                  const d = allDrivers.find((item) => item.userId === val);
                  setSelectedDriver(d || null);
                }
              }}
              className="bg-white border border-gray-300 text-gray-800 font-600 text-xs rounded-xl focus:ring-2 focus:ring-[#FA7070]/30 focus:border-[#FA7070] cursor-pointer shadow-2xs hover:border-gray-400 transition-colors h-9 pl-3 pr-8 min-w-[170px] max-w-[240px] truncate"
              aria-label="Chọn tài xế cần theo dõi"
            >
              <option value="">Tất cả tài xế ({activeDrivers.length})</option>
              {filteredDrivers.map((driver) => {
                const hasGps = positions[driver.userId] !== undefined;
                const statusEmoji =
                  driver.currentShiftStatus === 'ONLINE_READY'
                    ? '🟢'
                    : driver.currentShiftStatus === 'BUSY'
                    ? '🔵'
                    : '⚪';
                return (
                  <option key={driver.userId} value={driver.userId}>
                    {statusEmoji} {driver.fullName} {driver.licensePlate ? `(${driver.licensePlate})` : ''} {hasGps ? '📍' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Unified Live Tracking Map */}
      <div className="relative flex-1 card overflow-hidden">
        <TrackingMap
          className="w-full h-full min-h-[500px]"
          selectedDriverId={selectedDriver?.userId}
          onDriverSelect={(driverId) => {
            if (!driverId) {
              setSelectedDriver(null);
            } else {
              const found = allDrivers.find((d) => d.userId === driverId);
              setSelectedDriver(found || null);
            }
          }}
          drivers={filteredDrivers}
          polylines={polylines}
          liveDrivers={liveDrivers}
        />

        {/* Slide-over panel for selected driver details */}
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
