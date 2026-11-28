'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Navigation, Phone, MessageSquare,
  MapPin, X,
  Activity, User, Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fetchLiveTracking, fetchDriverActiveOrders, fetchDriverRouteToday, type ApiLiveDriver, type ApiOrder, type ApiDriverRouteTodayResponse } from '@/lib/api';
import type { Driver } from '@/types/domain';
import { connectSocket, onDriverLocationUpdated } from '@/lib/socketClient';
import { useDebounce } from '@/hooks/useDebounce';

const VEHICLE_LABELS: Record<string, string> = {
  MOTORBIKE: '🏍️ Xe máy',
  VAN_500KG: '🚐 Xe tải 500kg',
  TRUCK_1TON: '🚛 Xe tải 1 tấn',
  'TRUCK_1.5TON': '🚛 Xe tải 1.5 tấn',
  TRUCK_2TON: '🚛 Xe tải 2 tấn',
};

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
  const lastSocketUpdateRef = useRef<Record<string, number>>({});

  const COLORS = ['#FA7070', '#6D28D9', '#1D4ED8', '#059669', '#D97706', '#DB2777'];

  const fetchPositions = useCallback(async () => {
    try {
      const data = await fetchLiveTracking();
      const list = Array.isArray(data) ? data : [];
      
      const mergedList = list.map((d) => {
        const existing = driversRef.current.find((p) => p.driverId === d.driverId);
        if (existing && !existing.positionUnknown && (d.positionUnknown || !d.currentLat)) {
          return {
            ...d,
            currentLat: existing.currentLat,
            currentLng: existing.currentLng,
            positionUnknown: false,
            lastUpdated: existing.lastUpdated,
          };
        }
        return d;
      });

      setLiveDrivers(mergedList);
      driversRef.current = mergedList;
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

  // Realtime Socket.io Live Tracking with throttle protection
  useEffect(() => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token && typeof document !== 'undefined') {
      const cookieMatch = document.cookie.match(/(?:^|;\s*)(?:accessToken|token)=([^;]+)/);
      if (cookieMatch) token = decodeURIComponent(cookieMatch[1]);
    }

    connectSocket(token || '');

    const unsubscribe = onDriverLocationUpdated((data) => {
      const now = Date.now();
      const last = lastSocketUpdateRef.current[data.driverId] || 0;
      if (now - last < 800) {
        return; // Throttle excessive socket bursts under 800ms
      }
      lastSocketUpdateRef.current[data.driverId] = now;
      setUsingRealApi(true);
      setPositionSource((ps) => (ps[data.driverId] === 'real' ? ps : { ...ps, [data.driverId]: 'real' }));
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

  // Simulation Tick (every 1200ms, synchronized with Leaflet SmoothMarker 1200ms interpolation)
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
            if (!next[did] || next[did].lat !== dLive.currentLat || next[did].lng !== dLive.currentLng) {
              next[did] = { lat: dLive.currentLat, lng: dLive.currentLng };
              changed = true;
            }
            setPositionSource(ps => ps[did] === 'real' ? ps : { ...ps, [did]: 'real' });
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
    }, 1200);

    return () => clearInterval(t2);
  }, [usingRealApi]);

  return { positions, positionSource, polylines, liveDrivers, usingRealApi };
}

// ─── Merge live driver data with driver domain structure ────────────
function mergeDriverData(
  liveDrivers: ApiLiveDriver[],
  positions?: Record<string, { lat: number; lng: number; heading?: number }>
): Driver[] {
  if (liveDrivers.length === 0) return [];

  return liveDrivers.map((ld) => {
    const pos = positions?.[ld.driverId];
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
      currentLat: pos ? pos.lat : (ld.currentLat ?? undefined),
      currentLng: pos ? pos.lng : (ld.currentLng ?? undefined),
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
      <div className="flex flex-col bg-white shadow-lg rounded-lg overflow-hidden border border-slate-200 h-full">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-semibold text-base">
              {driver.fullName.charAt(0)}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer z-10">
              <X size={16} />
            </button>
          </div>
          <h3 className="text-white font-semibold text-sm">{driver.fullName}</h3>
          <p className="text-slate-400 text-xs mt-0.5 font-mono">{driver.licensePlate} · {VEHICLE_LABELS[driver.vehicleType] || driver.vehicleType.replace(/_/g, ' ')}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <StatusBadge status={driver.currentShiftStatus} className="text-[11px]" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-0 border-b border-slate-200 shrink-0 tabular-nums">
          <div className="p-3.5 text-center border-r border-slate-200">
            <div className="flex items-center justify-center gap-1 text-slate-900 mb-0.5">
              <Activity size={13} className="text-emerald-600" />
              <span className="text-lg font-semibold">{driver.currentSpeedKmh ?? 0}</span>
            </div>
            <p className="text-[11px] text-slate-500">km/h</p>
          </div>
          <div className="p-3.5 text-center font-mono">
            <div className="flex items-center justify-center gap-1 text-slate-800 mb-0.5">
              <MapPin size={13} className="text-indigo-600" />
              <span className="text-xs font-semibold">{position.lat.toFixed(4)}</span>
            </div>
            <p className="text-[11px] text-slate-500">{position.lng.toFixed(4)}</p>
          </div>
        </div>

        {/* Active route from API */}
        {liveData?.activeRoute && (
          <div className="p-3.5 border-b border-slate-200 shrink-0 bg-slate-50 tabular-nums">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tuyến đang chạy</p>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-800">
              <span>{liveData.activeRoute.totalDistanceKm} km</span>
              <span className="text-slate-300">·</span>
              <span>{liveData.activeRoute.totalEstimatedTimeMin} phút</span>
            </div>
          </div>
        )}

        {/* Next Stop */}
        <div className="p-3.5 border-b border-slate-200 shrink-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Điểm dừng tiếp theo</p>
          {loadingStops ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-1.5">
              <Loader2 size={13} className="animate-spin text-slate-600" />
              <span>Đang tải thông tin...</span>
            </div>
          ) : nextOrder ? (
            <div className="p-2.5 bg-indigo-50/60 rounded-md border border-indigo-200/80">
              <div className="flex items-center gap-1.5 mb-0.5">
                <MapPin size={12} className="text-indigo-600 shrink-0" />
                <span className="text-xs font-semibold text-indigo-900 truncate">{nextOrder.code} · {nextOrder.receiverName}</span>
              </div>
              <p className="text-[11px] text-indigo-700 ml-4 truncate">{nextOrder.deliveryAddress}</p>
              {Number(nextOrder.codAmount) > 0 && (
                <p className="text-[11px] text-emerald-700 ml-4 mt-1 font-medium tabular-nums">
                  COD: {Number(nextOrder.codAmount).toLocaleString('vi-VN')}đ
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Không có điểm dừng tiếp theo</p>
          )}
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tất cả điểm giao</p>
            {activeStops.length > 0 && (
              <span className="text-[11px] font-medium text-slate-500 tabular-nums">({activeStops.length})</span>
            )}
          </div>
          {loadingStops ? (
            <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
              <Loader2 size={14} className="animate-spin text-slate-600" />
              <span>Đang tải danh sách điểm giao...</span>
            </div>
          ) : activeStops.length > 0 ? (
            activeStops.map((order, i) => (
              <div key={order.id} className="flex items-center gap-2 p-2 rounded-md bg-slate-50/70 border border-slate-200/70">
                <div className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center text-white text-[10px] font-semibold tabular-nums shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{order.code} · {order.receiverName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{order.deliveryAddress}</p>
                  <StatusBadge status={order.status} className="text-[10px] mt-1" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic text-center p-3">Chưa có điểm giao được phân công</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/40 space-y-2 shrink-0">
          <a
            href={`tel:${driver.phone}`}
            className="btn-secondary w-full justify-center text-xs tabular-nums"
          >
            <Phone size={14} /> {driver.phone}
          </a>
          <button
            className="btn-primary w-full justify-center text-xs"
            id="btn-message-driver"
          >
            <MessageSquare size={14} /> Nhắn tin tài xế
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedDriverRoute, setSelectedDriverRoute] = useState<ApiDriverRouteTodayResponse | null>(null);

  // Poll full route details when a driver is selected, auto-updating next stops as orders are delivered
  const selectedDriverUserId = selectedDriver?.userId;
  useEffect(() => {
    let isMounted = true;
    if (!selectedDriverUserId) {
      setSelectedDriverRoute(null);
      return;
    }
    const currentUserId = selectedDriverUserId;

    async function loadRoute() {
      try {
        const routeData = await fetchDriverRouteToday(currentUserId);
        if (isMounted) {
          setSelectedDriverRoute(routeData);
        }
      } catch (err) {
        console.warn('Failed to load selected driver route:', err);
        if (isMounted) setSelectedDriverRoute(null);
      }
    }

    loadRoute();
    const interval = setInterval(loadRoute, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedDriverUserId]);
  const { positions, positionSource, polylines, liveDrivers, usingRealApi } = useLiveTracking();

  const allDrivers = useMemo(() => mergeDriverData(liveDrivers, positions), [liveDrivers, positions]);
  const activeDrivers = useMemo(() => allDrivers.filter((d) => d.currentShiftStatus !== 'OFFLINE'), [allDrivers]);
  const filteredDrivers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return activeDrivers;
    return activeDrivers.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.licensePlate.toLowerCase().includes(q),
    );
  }, [activeDrivers, debouncedSearch]);

  // Ensure dropdown contains the selected driver even if excluded by search filter
  const dropdownDrivers = useMemo(() => {
    if (selectedDriver && !filteredDrivers.some((d) => d.userId === selectedDriver.userId)) {
      return [selectedDriver, ...filteredDrivers];
    }
    return filteredDrivers;
  }, [selectedDriver, filteredDrivers]);

  // Unified driver selection handler shared between Marker clicks and Dropdown
  const handleSelectDriver = useCallback((driverId: string | null) => {
    if (!driverId) {
      setSelectedDriver(null);
    } else {
      const found =
        allDrivers.find((d) => String(d.userId) === String(driverId)) ||
        allDrivers.find((d) => String((d as { driverId?: string | number }).driverId) === String(driverId));
      if (found) {
        setSelectedDriver(found);
      } else {
        const liveFound = liveDrivers.find((d) => String(d.driverId) === String(driverId));
        if (liveFound) {
          const merged = mergeDriverData([liveFound], positions)[0];
          setSelectedDriver(merged);
        }
      }
    }
  }, [allDrivers, liveDrivers, positions]);

  // Count GPS sources for status bar
  const realGpsCount = useMemo(
    () => Object.values(positionSource).filter((s) => s === 'real').length,
    [positionSource],
  );

  return (
    <div className="flex flex-col gap-3 animate-fade-in" style={{ height: 'calc(100vh - 128px)' }}>
      {/* Top bar */}
      <div className="card px-4 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white">
            <Navigation size={14} />
          </div>
          <span className="text-sm font-semibold text-slate-900">Theo dõi trực tiếp</span>
        </div>

        {/* Realtime Status Indicator */}
        {usingRealApi ? (
          <div className="flex items-center gap-2">
            {realGpsCount > 0 ? (
              <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded border text-emerald-700 bg-emerald-50/70 font-medium border-emerald-200 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {realGpsCount} GPS trực tuyến
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded border text-slate-600 bg-slate-50 border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Chờ tín hiệu GPS...
              </div>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded border text-slate-600 bg-slate-50 border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Không có tín hiệu GPS
          </div>
        )}

        {/* Search */}
        <div className="ml-auto relative flex items-center w-52 sm:w-60">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài xế, biển số..."
            className="input-base pl-9 h-8 text-xs w-full"
            id="tracking-search"
          />
        </div>

        {/* Driver selector dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor="driver-select"
            className="text-xs font-medium text-slate-500 whitespace-nowrap flex items-center gap-1 cursor-pointer"
          >
            <User size={13} className="text-slate-400 shrink-0" />
            <span className="hidden sm:inline">Tài xế:</span>
          </label>
          <div className="relative">
            <select
              id="driver-select"
              value={selectedDriver?.userId || ''}
              onChange={(e) => handleSelectDriver(e.target.value || null)}
              className="bg-white border border-slate-200 text-slate-800 font-medium text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 cursor-pointer hover:border-slate-300 transition-colors h-8 pl-2.5 pr-7 min-w-[170px] max-w-[240px] truncate tabular-nums"
              aria-label="Chọn tài xế cần theo dõi"
            >
              <option value="">Tất cả tài xế ({activeDrivers.length})</option>
              {dropdownDrivers.map((driver) => {
                const hasGps = positions[driver.userId] !== undefined;
                const statusEmoji =
                  driver.currentShiftStatus === 'ONLINE_READY'
                    ? '🟢'
                    : driver.currentShiftStatus === 'BUSY'
                    ? '🔵'
                    : '⚪';
                return (
                  <option key={driver.userId} value={driver.userId}>
                    {statusEmoji} {driver.vehicleType === 'MOTORBIKE' ? '🏍️' : '🚛'} {driver.fullName} {driver.licensePlate ? `(${driver.licensePlate})` : ''} {hasGps ? '📍' : ''}
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
          selectedDriverRoute={selectedDriverRoute}
          onDriverSelect={handleSelectDriver}
          drivers={filteredDrivers}
          polylines={polylines}
          liveDrivers={liveDrivers}
        />

        {/* Slide-over panel for selected driver details */}
        {selectedDriver && (positions[selectedDriver.userId] || (selectedDriver.currentLat != null && selectedDriver.currentLng != null)) && (
          <DriverSlideOver
            driver={selectedDriver}
            position={positions[selectedDriver.userId] || { lat: selectedDriver.currentLat!, lng: selectedDriver.currentLng! }}
            onClose={() => handleSelectDriver(null)}
            liveData={liveDrivers.find((d) => d.driverId === selectedDriver.userId)}
          />
        )}
      </div>
    </div>
  );
}
