'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { connectSocket, disconnectSocket, onDriverLocationUpdated, type DriverLocationUpdate } from '@/lib/socketClient';
import type { Driver } from '@/types/domain';
import type { ApiLiveDriver, ApiDriverRouteTodayResponse } from '@/lib/api';

// Fix missing marker icons in Leaflet on Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface ActiveDriver {
  driverId: string;
  fullName: string;
  latitude: number;
  longitude: number;
  batteryLevel?: number | null;
  shiftId?: string | null;
  lastUpdated?: string | Date;
  bearing?: number;
  vehicleType?: string;
}

/**
 * Calculates bearing angle (0 - 360 degrees) between two coordinates
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

declare global {
  interface Window {
    __selectDriver?: (driverId: string) => void;
  }
}

/**
 * SmoothMarker — Task 12.1: Leaflet Marker Interpolation
 * Glides smoothly between the old coordinate and new coordinate
 * using requestAnimationFrame and ease-out cubic interpolation.
 */
interface SmoothMarkerProps {
  position: [number, number];
  icon: L.DivIcon | L.Icon;
  children?: React.ReactNode;
  duration?: number;
  eventHandlers?: L.LeafletEventHandlerFnMap;
  zIndexOffset?: number;
}

function SmoothMarker({ position, icon, children, duration = 1200, eventHandlers, zIndexOffset }: SmoothMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number]>(position);
  const currentPosRef = useRef<[number, number]>(position);
  const animFrameRef = useRef<number | null>(null);

  const eventHandlersRef = useRef(eventHandlers);
  useEffect(() => {
    eventHandlersRef.current = eventHandlers;
  }, [eventHandlers]);

  // Stable event handlers so React-Leaflet does not unbind/rebind listeners on every frame or render
  const stableHandlers = React.useMemo<L.LeafletEventHandlerFnMap>(() => ({
    click: (e) => {
      e.originalEvent?.stopPropagation();
      eventHandlersRef.current?.click?.(e);
    },
    mousedown: (e) => {
      e.originalEvent?.stopPropagation();
      eventHandlersRef.current?.mousedown?.(e);
    },
  }), []);

  const targetLat = position[0];
  const targetLng = position[1];

  useEffect(() => {
    const startLat = currentPosRef.current[0];
    const startLng = currentPosRef.current[1];
    const endLat = targetLat;
    const endLng = targetLng;

    const deltaLat = endLat - startLat;
    const deltaLng = endLng - startLng;

    // Skip animation if movement is negligible (< 10cm)
    if (Math.abs(deltaLat) < 0.000001 && Math.abs(deltaLng) < 0.000001) {
      return;
    }

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);

      const nextLat = startLat + deltaLat * ease;
      const nextLng = startLng + deltaLng * ease;

      currentPosRef.current = [nextLat, nextLng];

      if (markerRef.current) {
        markerRef.current.setLatLng([nextLat, nextLng]);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentPosRef.current = [endLat, endLng];
        if (markerRef.current) {
          markerRef.current.setLatLng([endLat, endLng]);
        }
        setCurrentPos([endLat, endLng]);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [targetLat, targetLng, duration]);

  return (
    <Marker
      ref={markerRef}
      position={currentPos}
      icon={icon}
      eventHandlers={stableHandlers}
      zIndexOffset={zIndexOffset}
    >
      {children}
    </Marker>
  );
}

/**
 * Strips vehicle type annotations, license plates, and parentheses from driver name
 * e.g. "Ngô Văn Tài (Xe máy 01)" -> "Ngô Văn Tài"
 * e.g. "Đặng Minh Khôi (Xe tải 1 Tấn)" -> "Đặng Minh Khôi"
 */
function getDriverDisplayName(fullName: string): string {
  if (!fullName) return 'Tài xế';
  return fullName.replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Custom modern marker icon for drivers with directional heading and highlight
 */
/**
 * Helper to determine if a driver operates a motorbike or a truck/van
 */
export function isMotorbikeVehicle(vehicleType?: string, fullName?: string): boolean {
  if (vehicleType) {
    const vt = vehicleType.toUpperCase();
    if (vt.includes('MOTOR') || vt.includes('BIKE') || vt.includes('MOTO') || vt === 'XE_MAY') {
      return true;
    }
    if (vt.includes('TRUCK') || vt.includes('VAN') || vt.includes('TAI') || vt.includes('OTO')) {
      return false;
    }
  }
  if (fullName) {
    const lower = fullName.toLowerCase();
    if (lower.includes('xe máy') || lower.includes('xe may') || lower.includes('motorbike')) {
      return true;
    }
    if (lower.includes('xe tải') || lower.includes('xe tai') || lower.includes('truck') || lower.includes('van')) {
      return false;
    }
  }
  return true; // Mặc định xe máy cho giao hàng nội thành
}

// Lucide Motorbike Icon SVG
const MOTORBIKE_SVG = `
  <svg style="pointer-events:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m18 14-1-3"></path>
    <path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81"></path>
    <path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5"></path>
    <circle cx="19" cy="17" r="3"></circle>
    <circle cx="5" cy="17" r="3"></circle>
  </svg>
`;

// Lucide Truck Icon SVG
const TRUCK_SVG = `
  <svg style="pointer-events:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="3" width="15" height="13"></rect>
    <polygon points="16 8 20 8 23 11 23 16 16 8"></polygon>
    <circle cx="5.5" cy="18.5" r="2.5"></circle>
    <circle cx="18.5" cy="18.5" r="2.5"></circle>
  </svg>
`;

/**
 * Custom modern marker icon for drivers with directional heading, vehicle-specific icon & theme
 */
function createDriverIcon(
  driverId: string,
  fullName: string,
  batteryLevel?: number | null,
  bearing?: number,
  isSelected?: boolean,
  vehicleType?: string,
) {
  const driverName = getDriverDisplayName(fullName);
  const isMotorbike = isMotorbikeVehicle(vehicleType, fullName);

  const batteryHtml =
    batteryLevel != null
      ? `<span style="display:inline-flex; align-items:center; font-weight:700; color:${batteryLevel <= 20 ? '#EF4444' : '#10B981'}; font-size:10px; pointer-events:none;">⚡${batteryLevel}%</span>`
      : '';

  const rotationStyle =
    bearing != null
      ? `transform: rotate(${bearing}deg); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);`
      : '';

  // Theme colors: Motorbike (Warm Coral/Red #FA7070 -> #E11D48), Truck/Van (Vibrant Blue/Indigo #3B82F6 -> #1D4ED8)
  const bgGradient = isMotorbike
    ? 'linear-gradient(135deg, #FA7070 0%, #E11D48 100%)'
    : 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)';
  const arrowColor = isMotorbike ? '#E11D48' : '#1D4ED8';
  const selectedBadgeBg = isMotorbike ? '#FA7070' : '#2563EB';

  const highlightShadow = isSelected
    ? isMotorbike
      ? 'border:3px solid #FFFFFF; box-shadow:0 0 0 4px rgba(250, 112, 112, 0.6), 0 6px 16px rgba(225,29,72,0.6);'
      : 'border:3px solid #FFFFFF; box-shadow:0 0 0 4px rgba(59, 130, 246, 0.6), 0 6px 16px rgba(29, 78, 216, 0.6);'
    : isMotorbike
      ? 'border:3px solid #FFFFFF; box-shadow:0 4px 12px rgba(225,29,72,0.45);'
      : 'border:3px solid #FFFFFF; box-shadow:0 4px 12px rgba(29, 78, 216, 0.45);';

  const iconSvg = isMotorbike ? MOTORBIKE_SVG : TRUCK_SVG;
  const vehicleEmoji = isMotorbike ? '🏍️' : '🚛';

  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div
        data-driver-id="${driverId}"
        onclick="if(event){event.stopPropagation();event.preventDefault();}window.__selectDriver&&window.__selectDriver('${driverId}');"
        onmousedown="if(event){event.stopPropagation();event.preventDefault();}window.__selectDriver&&window.__selectDriver('${driverId}');"
        style="
          position:relative;
          display:flex;
          flex-direction:column;
          align-items:center;
          transform:translate(-50%, -100%);
          cursor:pointer;
          pointer-events:auto;
          user-select:none;
        "
      >
        <div style="
          background:${isSelected ? selectedBadgeBg : '#1E293B'}; color:#FFFFFF; font-size:11px; font-weight:600;
          padding:2px 8px; border-radius:9999px; white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.2);
          margin-bottom:4px; display:flex; align-items:center; gap:5px;
          pointer-events:auto;
        ">
          <span style="font-size:10px; pointer-events:none;">${vehicleEmoji}</span>
          <span style="pointer-events:none;">${driverName}</span>
          ${batteryHtml}
        </div>
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:${bgGradient};
          ${highlightShadow}
          display:flex; align-items:center; justify-content:center; color:white;
          ${rotationStyle}
          pointer-events:auto;
        ">
          ${iconSvg}
        </div>
        <div style="
          width:0; height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:6px solid ${arrowColor};
          margin-top:-1px;
          pointer-events:none;
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const driverIconCache = new Map<string, L.DivIcon>();

function getCachedDriverIcon(
  driverId: string,
  fullName: string,
  batteryLevel?: number | null,
  bearing?: number,
  isSelected?: boolean,
  vehicleType?: string,
): L.DivIcon {
  const roundedBearing = bearing != null ? Math.round(bearing / 10) * 10 : 'none';
  const batteryBucket = batteryLevel != null ? (batteryLevel <= 20 ? 'low' : 'normal') : 'none';
  const key = `${driverId}_${fullName}_${batteryBucket}_${roundedBearing}_${isSelected ? '1' : '0'}_${vehicleType || 'M'}`;

  let icon = driverIconCache.get(key);
  if (!icon) {
    icon = createDriverIcon(driverId, fullName, batteryLevel, bearing, isSelected, vehicleType);
    driverIconCache.set(key, icon);
  }
  return icon;
}

/**
 * Custom modern stop marker icon representing order destination & status
 */
function createStopIcon(
  sequenceNo: number,
  isNext: boolean,
  isCompleted: boolean,
  receiverName: string,
  isMotorbike: boolean,
) {
  if (isCompleted) {
    return L.divIcon({
      className: 'custom-stop-marker',
      html: `
        <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); cursor:pointer;">
          <div style="
            width:26px; height:26px; border-radius:50%; background:#10B981;
            border:2.5px solid #FFFFFF; box-shadow:0 2px 8px rgba(16,185,129,0.5);
            display:flex; align-items:center; justify-content:center; color:white;
            font-size:13px; font-weight:800;
          ">
            ✓
          </div>
          <div style="
            background:rgba(15,23,42,0.85); color:#94A3B8; font-size:10px; font-weight:600;
            padding:1px 6px; border-radius:9999px; margin-top:2px; white-space:nowrap;
            border:1px solid rgba(255,255,255,0.15);
          ">
            #${sequenceNo} Đã giao
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  if (isNext) {
    const pulseColor = isMotorbike ? 'rgba(250, 112, 112, 0.45)' : 'rgba(59, 130, 246, 0.45)';
    const mainColor = isMotorbike
      ? 'linear-gradient(135deg, #FA7070 0%, #E11D48 100%)'
      : 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)';
    const borderColor = isMotorbike ? '#E11D48' : '#1D4ED8';

    return L.divIcon({
      className: 'custom-stop-marker next-stop-pulse',
      html: `
        <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer;">
          <div style="
            background:#0F172A; color:#FFFFFF; font-size:11px; font-weight:700;
            padding:3px 8px; border-radius:8px; white-space:nowrap;
            box-shadow:0 4px 12px rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.2);
            margin-bottom:4px; display:flex; align-items:center; gap:5px;
          ">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10B981;"></span>
            <span>Đang giao #${sequenceNo}: ${receiverName}</span>
          </div>
          <div style="position:relative; width:34px; height:34px;">
            <div style="
              position:absolute; inset:-8px; border-radius:50%;
              background:${pulseColor}; animation:ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              position:relative; width:34px; height:34px; border-radius:50%;
              background:${mainColor}; border:3px solid #FFFFFF;
              box-shadow:0 4px 14px rgba(0,0,0,0.35);
              display:flex; align-items:center; justify-content:center;
              color:white; font-size:13px; font-weight:800;
            ">
              ${sequenceNo}
            </div>
          </div>
          <div style="
            width:0; height:0;
            border-left:6px solid transparent;
            border-right:6px solid transparent;
            border-top:7px solid ${borderColor};
            margin-top:-1px;
          "></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  // Pending future stops (2, 3, 4...)
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); cursor:pointer;">
        <div style="
          width:24px; height:24px; border-radius:50%; background:#334155;
          border:2px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.25);
          display:flex; align-items:center; justify-content:center; color:white;
          font-size:11px; font-weight:700;
        ">
          ${sequenceNo}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';

  const localToken = localStorage.getItem('accessToken');
  if (localToken) return localToken;

  const cookieMatch = document.cookie.match(/(?:^|;\s*)(?:accessToken|token)=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);

  return '';
}

function MapController({
  center,
  nextStopCenter,
}: {
  center: [number, number];
  nextStopCenter?: [number, number] | null;
}) {
  const map = useMap();
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (nextStopCenter) {
      const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}-${nextStopCenter[0].toFixed(4)},${nextStopCenter[1].toFixed(4)}`;
      if (lastKeyRef.current !== key) {
        lastKeyRef.current = key;
        const bounds = L.latLngBounds([center, nextStopCenter]);
        map.fitBounds(bounds, { padding: [90, 90], maxZoom: 15 });
      }
    } else {
      const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;
      if (lastKeyRef.current !== key) {
        lastKeyRef.current = key;
        map.flyTo(center, 15, { duration: 1.2 });
      }
    }
  }, [center, nextStopCenter, map]);

  return null;
}

export interface TrackingMapProps {
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  selectedDriverId?: string;
  onDriverSelect?: (driverId: string | null) => void;
  drivers?: Driver[];
  polylines?: { driverId: string; path: [number, number][]; color: string }[];
  liveDrivers?: ApiLiveDriver[];
  selectedDriverRoute?: ApiDriverRouteTodayResponse | null;
}

export default function TrackingMap({
  className = 'w-full h-full min-h-[600px]',
  defaultCenter = [10.8231, 106.6795], // TP. Hồ Chí Minh (Gò Vấp / Trung tâm)
  defaultZoom = 13,
  selectedDriverId,
  onDriverSelect,
  drivers = [],
  polylines = [],
  liveDrivers = [],
  selectedDriverRoute = null,
}: TrackingMapProps) {
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Sync initial positions from REST API drivers
  useEffect(() => {
    if (!drivers || drivers.length === 0) {
      setActiveDrivers([]);
      return;
    }
    setActiveDrivers((prev) => {
      // Avoid recreating array if coordinates and drivers haven't changed
      let hasChanged = prev.length !== drivers.length;
      if (!hasChanged) {
        for (const d of drivers) {
          const ex = prev.find((item) => item.driverId === d.userId);
          if (
            !ex ||
            Math.abs(ex.latitude - (d.currentLat ?? 0)) > 0.00001 ||
            Math.abs(ex.longitude - (d.currentLng ?? 0)) > 0.00001
          ) {
            hasChanged = true;
            break;
          }
        }
      }
      if (!hasChanged) return prev; // Avoid triggering re-render

      const next: ActiveDriver[] = [];
      drivers.forEach((d) => {
        if (d.currentLat != null && d.currentLng != null) {
          const existing = prev.find((item) => item.driverId === d.userId);
          let bearing = existing?.bearing;
          if (existing && (existing.latitude !== d.currentLat || existing.longitude !== d.currentLng)) {
            bearing = calculateBearing(existing.latitude, existing.longitude, d.currentLat, d.currentLng);
          }
          next.push({
            driverId: d.userId,
            fullName: d.fullName,
            latitude: d.currentLat,
            longitude: d.currentLng,
            batteryLevel: existing?.batteryLevel ?? 95,
            shiftId: existing?.shiftId,
            bearing,
            lastUpdated: existing?.lastUpdated ?? new Date(),
            vehicleType: d.vehicleType,
          });
        }
      });
      return next;
    });
  }, [drivers]);

  // Connect to Realtime WebSocket Gateway
  useEffect(() => {
    const token = getAdminToken();
    const socket = connectSocket(token);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const initTimer = setTimeout(() => {
      setIsConnected(socket.connected);
    }, 0);

    // Lắng nghe sự kiện driver_location_updated từ gateway
    const unsubscribe = onDriverLocationUpdated((data: DriverLocationUpdate) => {
      setActiveDrivers((prev) => {
        const index = prev.findIndex((d) => d.driverId === data.driverId);
        if (index >= 0) {
          const oldDriver = prev[index];
          let bearing = oldDriver.bearing;
          if (oldDriver.latitude !== data.latitude || oldDriver.longitude !== data.longitude) {
            bearing = calculateBearing(oldDriver.latitude, oldDriver.longitude, data.latitude, data.longitude);
          }

          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            ...data,
            bearing,
            lastUpdated: data.timestamp || new Date(),
            vehicleType: oldDriver.vehicleType || (data as { vehicleType?: string })?.vehicleType,
          };
          return updated;
        }

        return [
          ...prev,
          {
            driverId: data.driverId,
            fullName: data.fullName,
            latitude: data.latitude,
            longitude: data.longitude,
            batteryLevel: data.batteryLevel,
            shiftId: data.shiftId,
            bearing: undefined,
            lastUpdated: data.timestamp || new Date(),
          },
        ];
      });
    });

    return () => {
      clearTimeout(initTimer);
      unsubscribe();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      disconnectSocket();
    };
  }, []);

  const selectedActiveDriver = selectedDriverId
    ? activeDrivers.find((d) => d.driverId === selectedDriverId)
    : null;

  // ─── Active Route & Stops Parsing ──────────────────────────────
  const validStops = React.useMemo(() => {
    const stops = selectedDriverRoute?.stops || [];
    return stops.filter((s) => s.order && s.order.latitude != null && s.order.longitude != null);
  }, [selectedDriverRoute]);

  const completedStops = React.useMemo(() => {
    return validStops.filter((s) => s.status === 'COMPLETED');
  }, [validStops]);

  const pendingStops = React.useMemo(() => {
    return validStops.filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED');
  }, [validStops]);

  const nextStop = pendingStops[0] || null;

  const isSelectedMotorbike = React.useMemo(() => {
    if (!selectedActiveDriver) return true;
    const liveInfo = liveDrivers.find((ld) => ld.driverId === selectedActiveDriver.driverId);
    const driverInfo = drivers.find((d) => d.userId === selectedActiveDriver.driverId);
    const vt = selectedActiveDriver.vehicleType || liveInfo?.vehicleType || driverInfo?.vehicleType;
    return isMotorbikeVehicle(vt, selectedActiveDriver.fullName);
  }, [selectedActiveDriver, liveDrivers, drivers]);

  // Active traveling leg: line from live driver GPS to next stop
  const activeTravelingPath = React.useMemo<[number, number][]>(() => {
    if (!selectedActiveDriver || !nextStop) return [];
    return [
      [selectedActiveDriver.latitude, selectedActiveDriver.longitude],
      [Number(nextStop.order!.latitude), Number(nextStop.order!.longitude)],
    ];
  }, [selectedActiveDriver, nextStop]);

  // Subsequent pending stops path
  const subsequentPendingPath = React.useMemo<[number, number][]>(() => {
    if (pendingStops.length <= 1) return [];
    return pendingStops.map((s) => [Number(s.order!.latitude), Number(s.order!.longitude)]);
  }, [pendingStops]);

  // Completed stops path
  const completedPath = React.useMemo<[number, number][]>(() => {
    if (completedStops.length <= 1) return [];
    return completedStops.map((s) => [Number(s.order!.latitude), Number(s.order!.longitude)]);
  }, [completedStops]);

  const fullPlannedPolyline = selectedDriverRoute?.route?.polyline || [];

  // Expose global click bridge for DivIcon native DOM click handlers
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__selectDriver = (id: string) => {
        onDriverSelect?.(id);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__selectDriver;
      }
    };
  }, [onDriverSelect]);

  const motorbikeCount = activeDrivers.filter((d) => {
    const liveInfo = liveDrivers.find((ld) => ld.driverId === d.driverId);
    const driverInfo = drivers.find((di) => di.userId === d.driverId);
    return isMotorbikeVehicle(d.vehicleType || liveInfo?.vehicleType || driverInfo?.vehicleType, d.fullName);
  }).length;
  const truckCount = activeDrivers.length - motorbikeCount;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm ${className}`}>
      {/* CSS overrides for markers */}
      <style>{`
        .custom-driver-marker {
          cursor: pointer !important;
          pointer-events: auto !important;
          user-select: none;
        }
        .custom-driver-marker, .custom-driver-marker * {
          cursor: pointer !important;
          pointer-events: auto !important;
        }
      `}</style>

      {/* Floating Status Bar Header */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-semibold text-gray-700">
            {isConnected ? 'Realtime Connected' : 'Đang kết nối Socket...'}
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <span>Đang theo dõi: <strong className="text-[#FA7070] font-700">{activeDrivers.length}</strong> tài xế</span>
          <span className="text-gray-300">|</span>
          <span className="inline-flex items-center gap-1 text-[#E11D48] font-600">
            <span>🏍️</span> {motorbikeCount}
          </span>
          <span className="inline-flex items-center gap-1 text-blue-600 font-600">
            <span>🚛</span> {truckCount}
          </span>
        </div>
      </div>

      {/* Floating Route Quick Info Bar when a driver route is active */}
      {selectedDriverId && validStops.length > 0 && (
        <div className="absolute top-16 left-4 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] animate-ping" />
            <span className="text-xs font-bold text-gray-800">
              {nextStop ? `Đang giao đơn #${nextStop.sequenceNo}: ${nextStop.order?.code}` : 'Đã hoàn thành toàn bộ tuyến'}
            </span>
          </div>
          <div className="h-3.5 w-px bg-gray-200" />
          <span className="text-xs font-semibold text-emerald-600">
            {completedStops.length}/{validStops.length} điểm đã giao
          </span>
        </div>
      )}

      {/* Main Leaflet Map */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%', minHeight: '600px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Camera auto-focus on selected driver */}
        {selectedActiveDriver && (
          <MapController center={[selectedActiveDriver.latitude, selectedActiveDriver.longitude]} nextStopCenter={nextStop?.order ? [Number(nextStop.order.latitude), Number(nextStop.order.longitude)] : null} />
        )}

        {/* Active route polylines: Background full planned route */}
        {selectedDriverId && fullPlannedPolyline.length > 0 && (
          <Polyline
            positions={fullPlannedPolyline}
            pathOptions={{
              color: '#64748B',
              weight: 4,
              opacity: 0.45,
              dashArray: '5, 8',
            }}
          />
        )}

        {/* Highlighted active traveling leg: FROM CURRENT GPS TO NEXT STOP */}
        {activeTravelingPath.length >= 2 && (
          <>
            {/* Outer Luminous Glow */}
            <Polyline
              positions={activeTravelingPath}
              pathOptions={{
                color: isSelectedMotorbike ? '#FA7070' : '#38BDF8',
                weight: 12,
                opacity: 0.4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Core Bright Line */}
            <Polyline
              positions={activeTravelingPath}
              pathOptions={{
                color: isSelectedMotorbike ? '#E11D48' : '#2563EB',
                weight: 5.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Animated Flowing Stream Dash */}
            <Polyline
              positions={activeTravelingPath}
              pathOptions={{
                color: '#FFFFFF',
                weight: 2.5,
                opacity: 0.9,
                dashArray: '8, 12',
                className: 'active-delivery-stream',
              }}
            />
          </>
        )}

        {/* Subsequent pending stops path */}
        {subsequentPendingPath.length >= 2 && (
          <Polyline
            positions={subsequentPendingPath}
            pathOptions={{
              color: isSelectedMotorbike ? '#F43F5E' : '#3B82F6',
              weight: 3.5,
              opacity: 0.65,
              dashArray: '6, 6',
            }}
          />
        )}

        {/* Completed stops path (Green dashed trail) */}
        {completedPath.length >= 2 && (
          <Polyline
            positions={completedPath}
            pathOptions={{
              color: '#10B981',
              weight: 3,
              opacity: 0.7,
              dashArray: '4, 4',
            }}
          />
        )}

        {/* Other drivers polylines when no driver is selected */}
        {!selectedDriverId &&
          polylines.map((poly) => (
            <Polyline
              key={poly.driverId}
              positions={poly.path}
              pathOptions={{
                color: poly.color || '#FA7070',
                weight: 3.5,
                opacity: 0.7,
                dashArray: '8, 5',
              }}
            />
          ))}

        {/* Delivery Stop Markers for Selected Route */}
        {validStops.map((stop) => {
          const isNext = nextStop?.id === stop.id;
          const isCompleted = stop.status === 'COMPLETED';
          const stopPos: [number, number] = [Number(stop.order!.latitude), Number(stop.order!.longitude)];

          return (
            <Marker
              key={stop.id}
              position={stopPos}
              icon={createStopIcon(
                stop.sequenceNo,
                isNext,
                isCompleted,
                stop.order!.receiverName || 'Khách hàng',
                isSelectedMotorbike,
              )}
              zIndexOffset={isNext ? 1000 : 500}
            >
              <Popup className="custom-stop-popup">
                <div className="p-1 min-w-[220px]">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-2">
                    <span className="font-bold text-xs text-gray-900">
                      {isCompleted ? '✓ Đã giao' : isNext ? '🎯 Đang giao' : '⚪ Chờ giao'} #{stop.sequenceNo}
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {stop.order!.code}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>
                      <span className="font-medium text-gray-500">Người nhận:</span> 
                      <span className="font-semibold text-gray-800">{stop.order!.receiverName}</span> 
                      <span className="text-gray-400">({stop.order!.receiverPhone})</span>
                    </p>
                    <p>
                      <span className="font-medium text-gray-500">Địa chỉ:</span> 
                      <span>{stop.order!.deliveryAddress}</span>
                    </p>
                    {stop.order!.codAmount > 0 && (
                      <p className="font-bold text-[#E11D48]">
                        <span>Thu COD:</span> {stop.order!.codAmount.toLocaleString('vi-VN')} đ
                      </p>
                    )}
                    {stop.arrivedAt && (
                      <p className="text-[10px] text-gray-400">
                        Đến lúc: {new Date(stop.arrivedAt).toLocaleTimeString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Selected driver highlight circle */}
        {selectedActiveDriver && (
          <Circle
            center={[selectedActiveDriver.latitude, selectedActiveDriver.longitude]}
            radius={200}
            pathOptions={{
              color: '#FA7070',
              fillColor: '#FA7070',
              fillOpacity: 0.12,
              weight: 1.5,
            }}
          />
        )}

        {/* Live driver markers */}
        {activeDrivers.map((driver) => {
          const isSelected = driver.driverId === selectedDriverId;
          const liveInfo = liveDrivers.find((ld) => ld.driverId === driver.driverId);
          const driverInfo = drivers.find((d) => d.userId === driver.driverId);
          const vehicleType = driver.vehicleType || liveInfo?.vehicleType || driverInfo?.vehicleType;
          const isMotorbike = isMotorbikeVehicle(vehicleType, driver.fullName);
          const speed = liveInfo?.currentShiftStatus === 'ONLINE_READY' ? 28 : 0;

          return (
            <SmoothMarker
              key={driver.driverId}
              position={[driver.latitude, driver.longitude]}
              icon={getCachedDriverIcon(
                driver.driverId,
                driver.fullName,
                driver.batteryLevel,
                driver.bearing,
                isSelected,
                vehicleType,
              )}
              zIndexOffset={isSelected ? 3000 : 2000}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent?.stopPropagation();
                  onDriverSelect?.(driver.driverId);
                },
                mousedown: (e) => {
                  e.originalEvent?.stopPropagation();
                  onDriverSelect?.(driver.driverId);
                },
              }}
            >
              <Popup className="custom-driver-popup">
                <div className="p-1 min-w-[210px]">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h4 className="font-bold text-sm text-gray-900">{getDriverDisplayName(driver.fullName)}</h4>
                    {driver.batteryLevel != null && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          driver.batteryLevel <= 20
                            ? 'bg-red-50 text-red-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        ⚡ {driver.batteryLevel}%
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>
                      <span className="font-medium text-gray-500">Mã tài xế:</span>{' '}
                      <span className="font-mono text-[11px] text-gray-700">{driver.driverId.slice(0, 8)}...</span>
                    </p>
                    <p>
                      <span className="font-medium text-gray-500">Phương tiện:</span>{' '}
                      <span className={`font-semibold ${isMotorbike ? 'text-[#E11D48]' : 'text-blue-600'}`}>
                        {isMotorbike ? '🏍️ Xe máy' : '🚛 Xe tải / Van'}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium text-gray-500">Tọa độ:</span>{' '}
                      {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)}
                    </p>
                    {speed > 0 && (
                      <p className="text-[#FA7070] font-600">
                        <span>Tốc độ:</span> {speed} km/h
                      </p>
                    )}
                    {driver.shiftId && (
                      <p>
                        <span className="font-medium text-gray-500">Ca trực:</span>{' '}
                        <span className="font-mono text-[11px]">{driver.shiftId.slice(0, 8)}...</span>
                      </p>
                    )}
                    {driver.lastUpdated && (
                      <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-50">
                        Cập nhật: {new Date(driver.lastUpdated).toLocaleTimeString('vi-VN')}
                      </p>
                    )}
                  </div>
                  {onDriverSelect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDriverSelect(driver.driverId);
                      }}
                      className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-600 bg-[#FA7070] text-white hover:bg-[#e05656] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Xem chi tiết tuyến giao</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </Popup>
            </SmoothMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
