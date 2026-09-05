'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
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

function driverIcon(driver: Driver, isSelected: boolean) {
  const color = STATUS_COLORS[driver.currentShiftStatus];
  const initials = driver.fullName.split(' ').pop()?.charAt(0) ?? 'D';
  return divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:${isSelected ? '44px' : '36px'};
      height:${isSelected ? '44px' : '36px'};
      transition:all 0.3s;
    ">
      <div style="
        width:100%;height:100%;
        background:${isSelected ? '#FA7070' : color};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:${isSelected ? '16px' : '13px'};
        border:${isSelected ? '3px' : '2.5px'} solid white;
        box-shadow:0 ${isSelected ? '4' : '2'}px ${isSelected ? '16' : '8'}px ${isSelected ? 'rgba(250,112,112,0.6)' : color + '66'};
      ">${initials}</div>
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
  positions: Record<string, { lat: number; lng: number }>;
  selectedDriverId?: string;
  onDriverSelect: (driver: Driver) => void;
}

export default function TrackingMapView({
  drivers,
  positions,
  selectedDriverId,
  onDriverSelect,
}: TrackingMapViewProps) {
  const center: [number, number] = [10.8012, 106.7138];
  const selectedPos = selectedDriverId ? positions[selectedDriverId] : null;
  const mapCenter = selectedPos ? [selectedPos.lat, selectedPos.lng] as [number, number] : center;

  return (
    <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />

      {drivers.map((driver) => {
        const pos = positions[driver.userId];
        if (!pos) return null;
        const isSelected = driver.userId === selectedDriverId;

        return (
          <React.Fragment key={driver.userId}>
            {/* Accuracy circle for selected */}
            {isSelected && (
              <Circle
                center={[pos.lat, pos.lng]}
                radius={150}
                pathOptions={{ color: '#FA7070', fillColor: '#FA7070', fillOpacity: 0.08, weight: 1 }}
              />
            )}
            <Marker
              position={[pos.lat, pos.lng]}
              icon={driverIcon(driver, isSelected)}
              eventHandlers={{ click: () => onDriverSelect(driver) }}
            >
              <Popup>
                <div style={{ fontSize: '13px', minWidth: '140px' }}>
                  <strong style={{ color: '#FA7070' }}>{driver.fullName}</strong><br />
                  <span style={{ color: '#6B7280', fontSize: '11px' }}>{driver.licensePlate}</span><br />
                  <span style={{ color: '#6B7280', fontSize: '11px' }}>📍 {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</span><br />
                  {driver.currentSpeedKmh !== undefined && (
                    <span style={{ color: '#1D4ED8', fontSize: '11px', fontWeight: '600' }}>
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
  );
}
