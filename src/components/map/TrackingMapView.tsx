'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Driver } from '@/types/domain';

import L from 'leaflet';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const STATUS_COLORS = {
  ON_DUTY: '#22C55E',
  ON_BREAK: '#F59E0B',
  OFF_DUTY: '#9CA3AF',
};

function driverIcon(driver: Driver, isSelected: boolean, heading: number = 0) {
  const color = STATUS_COLORS[driver.currentShiftStatus];
  const shortName = driver.fullName.replace(/\s*\(.*\)/, '').split(' ').slice(-2).join(' ');

  return divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:${isSelected ? '44px' : '36px'};
      height:${isSelected ? '44px' : '36px'};
      transition:all 0.3s;
      display:flex;
      flex-direction:column;
      align-items:center;
    ">
      <div style="
        position:absolute; top:-26px; white-space:nowrap;
        background:white; color:#1f2937; font-weight:700; font-size:11px;
        padding:2px 8px; border-radius:12px;
        box-shadow:0 2px 6px rgba(0,0,0,0.15); border:1px solid #e5e7eb;
        z-index: 1000;
      ">${shortName}</div>
      <div style="
        width:100%;height:100%;
        background:${isSelected ? '#FA7070' : color};
        border-radius:50%;
        border:${isSelected ? '3px' : '2.5px'} solid white;
        box-shadow:0 ${isSelected ? '4' : '2'}px ${isSelected ? '16' : '8'}px ${isSelected ? 'rgba(250,112,112,0.6)' : color + '66'};
        transform: rotate(${heading}deg);
        transition: transform 150ms linear;
        display: flex; justify-content: center; align-items: flex-start;
      ">
        <div style="
          width: 0; height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 6px solid white;
          margin-top: 2px;
        "></div>
      </div>
      ${driver.currentShiftStatus === 'ON_DUTY' ? `
        <div style="
          position:absolute;bottom:-2px;right:-2px;
          width:10px;height:10px;background:#22C55E;
          border-radius:50%;border:2px solid white;
        "></div>` : ''}
    </div>`,
    iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
    iconAnchor: [(isSelected ? 44 : 36) / 2, (isSelected ? 44 : 36) / 2],
  });
}

interface TrackingMapViewProps {
  drivers: Driver[];
  positions: Record<string, { lat: number; lng: number; heading?: number }>;
  /** 'real' = actual device GPS, 'simulated' = OSRM polyline interpolation */
  positionSource?: Record<string, 'real' | 'simulated'>;
  selectedDriverId?: string;
  onDriverSelect: (driver: Driver) => void;
  /** Optional active route polylines for each driver */
  polylines?: { driverId: string; path: [number, number][]; color: string }[];
}

import { useMap } from 'react-leaflet';
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, 14, { duration: 1.5 });
  }, [center, map]);
  return null;
}

export default function TrackingMapView({
  drivers,
  positions,
  positionSource = {},
  selectedDriverId,
  onDriverSelect,
  polylines = [],
}: TrackingMapViewProps) {
  const center: [number, number] = [10.8012, 106.7138];
  const selectedPos = selectedDriverId ? positions[selectedDriverId] : null;
  const mapCenter = selectedPos ? [selectedPos.lat, selectedPos.lng] as [number, number] : center;

  return (
    <>
    <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      {selectedDriverId && <MapController center={mapCenter} />}

      {/* Active route polylines */}
      {polylines.map((poly) => (
        <Polyline
          key={poly.driverId}
          positions={poly.path}
          pathOptions={{
            color: poly.color,
            weight: 3,
            opacity: 0.75,
            dashArray: '8, 5',
          }}
        />
      ))}

      {drivers.map((driver) => {
        const pos = positions[driver.userId];
        // Skip drivers with no position — do not render a phantom marker
        if (!pos) return null;
        const isSelected = driver.userId === selectedDriverId;
        const source = positionSource[driver.userId];
        const isSimulated = source === 'simulated';

        return (
          <React.Fragment key={driver.userId}>
            {/* Accuracy circle for selected real-GPS driver */}
            {isSelected && !isSimulated && (
              <Circle
                center={[pos.lat, pos.lng]}
                radius={150}
                pathOptions={{ color: '#FA7070', fillColor: '#FA7070', fillOpacity: 0.08, weight: 1 }}
              />
            )}
            {/* Simulation indicator circle */}
            {isSimulated && (
              <Circle
                center={[pos.lat, pos.lng]}
                radius={300}
                pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.05, weight: 1, dashArray: '6 4' }}
              />
            )}
              <Marker
                position={[pos.lat, pos.lng]}
                icon={driverIcon(driver, isSelected, pos.heading)}
                eventHandlers={{ click: () => onDriverSelect(driver) }}
              >
              <Popup>
                <div style={{ fontSize: '13px', minWidth: '140px' }}>
                  <strong style={{ color: '#FA7070' }}>{driver.fullName}</strong><br />
                  <span style={{ color: '#6B7280', fontSize: '11px' }}>{driver.licensePlate}</span><br />
                  <span style={{ color: '#6B7280', fontSize: '11px' }}>📍 {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</span><br />
                  {isSimulated ? (
                    <span style={{ color: '#3B82F6', fontSize: '11px', fontWeight: '600' }}>
                      🔵 Mô phỏng lộ trình
                    </span>
                  ) : (
                    <span style={{ color: '#22C55E', fontSize: '11px', fontWeight: '600' }}>
                      🟢 GPS thực
                    </span>
                  )}
                  {driver.currentSpeedKmh !== undefined && (
                    <span style={{ color: '#1D4ED8', fontSize: '11px', fontWeight: '600', display: 'block' }}>
                      🚀 {driver.currentSpeedKmh} km/h
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </MapContainer>
    <style>{`.leaflet-marker-icon { transition: transform 150ms linear !important; }`}</style>
    </>
  );
}
