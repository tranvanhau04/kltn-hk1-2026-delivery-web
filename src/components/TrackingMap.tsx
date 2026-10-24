'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { connectSocket, disconnectSocket, onDriverLocationUpdated, type DriverLocationUpdate } from '@/lib/socketClient';

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
}

function SmoothMarker({ position, icon, children, duration = 1200 }: SmoothMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number]>(position);
  const currentPosRef = useRef<[number, number]>(position);
  const animFrameRef = useRef<number | null>(null);

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
    <Marker ref={markerRef} position={currentPos} icon={icon}>
      {children}
    </Marker>
  );
}

/**
 * Custom modern marker icon for drivers with directional heading
 */
function createDriverIcon(fullName: string, batteryLevel?: number | null, bearing?: number) {
  const shortName = fullName.split(' ').slice(-2).join(' ');
  const batteryHtml =
    batteryLevel != null
      ? `<span style="display:inline-flex; align-items:center; font-weight:700; color:${batteryLevel <= 20 ? '#EF4444' : '#10B981'}; font-size:10px;">⚡${batteryLevel}%</span>`
      : '';

  const rotationStyle =
    bearing != null
      ? `transform: rotate(${bearing}deg); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);`
      : '';

  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
        <div style="
          background:#1E293B; color:#FFFFFF; font-size:11px; font-weight:600;
          padding:2px 8px; border-radius:9999px; white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.2);
          margin-bottom:4px; display:flex; align-items:center; gap:6px;
        ">
          <span>${shortName}</span>
          ${batteryHtml}
        </div>
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:linear-gradient(135deg, #FA7070 0%, #E11D48 100%);
          border:3px solid #FFFFFF; box-shadow:0 4px 12px rgba(225,29,72,0.45);
          display:flex; align-items:center; justify-content:center; color:white;
          ${rotationStyle}
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>
        <div style="
          width:0; height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:6px solid #E11D48;
          margin-top:-1px;
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check localStorage
  const localToken = localStorage.getItem('accessToken');
  if (localToken) return localToken;

  // 2. Check cookies
  const cookieMatch = document.cookie.match(/(?:^|;\s*)(?:accessToken|token)=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);

  // 3. Fallback dev token for development/testing
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3ODk4MjU1ODcsImV4cCI6MTgyMTM4MzE4N30.-nGTW1elOIaxLav_V2C6u6DdDjY3HPn8n_5bXc6gDbc';
}

export interface TrackingMapProps {
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export default function TrackingMap({
  className = 'w-full h-full min-h-[600px]',
  defaultCenter = [10.8231, 106.6297], // TP. Hồ Chí Minh
  defaultZoom = 12,
}: TrackingMapProps) {
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [isConnected, setIsConnected] = useState(false);

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

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm ${className}`}>
      {/* CSS transitions for markers */}
      <style>{`
        .custom-driver-marker {
          transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
          will-change: transform;
        }
      `}</style>

      {/* Status Bar Header */}
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
        <span className="text-xs font-medium text-gray-600">
          Đang theo dõi: <strong className="text-[#FA7070]">{activeDrivers.length}</strong> tài xế
        </span>
      </div>

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

        {activeDrivers.map((driver) => (
          <SmoothMarker
            key={driver.driverId}
            position={[driver.latitude, driver.longitude]}
            icon={createDriverIcon(driver.fullName, driver.batteryLevel, driver.bearing)}
          >
            <Popup className="custom-driver-popup">
              <div className="p-1 min-w-[200px]">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                  <h4 className="font-bold text-sm text-gray-900">{driver.fullName}</h4>
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
                    <span className="font-medium text-gray-500">Tọa độ:</span>{' '}
                    {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)}
                  </p>
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
              </div>
            </Popup>
          </SmoothMarker>
        ))}
      </MapContainer>
    </div>
  );
}
