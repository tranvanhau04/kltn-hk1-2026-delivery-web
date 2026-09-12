'use client';

import React from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Order, Depot } from '@/types/domain';

// Fix Leaflet icon
import L from 'leaflet';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function numberedIcon(n: number, color: string) {
  return divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;background:${color};color:white;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;border:2.5px solid white;
      box-shadow:0 2px 8px ${color}66;
    ">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function depotIcon() {
  return divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;background:#8B2626;color:white;
      border-radius:8px;display:flex;align-items:center;justify-content:center;
      font-size:16px;border:2.5px solid white;
      box-shadow:0 2px 12px rgba(139,38,38,0.5);
    ">🏭</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Simple mock polyline generator (straight lines between points)
function buildPolyline(depot: Depot, stops: Order[]): [number, number][] {
  const points: [number, number][] = [
    [depot.latitude, depot.longitude],
    ...stops.map((s) => [s.latitude, s.longitude] as [number, number]),
    [depot.latitude, depot.longitude],
  ];
  return points;
}

interface VrpMapViewProps {
  orders: Order[];
  solution: {
    routes: Array<{
      driver: { fullName: string };
      stops: Order[];
      color: string;
      polyline?: [number, number][];
    }>;
  } | null;
  depot: Depot;
}

export default function VrpMapView({ orders, solution, depot }: VrpMapViewProps) {
  const center: [number, number] = [depot.latitude, depot.longitude];

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />

      {/* Depot marker */}
      <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon()}>
        <Popup>
          <strong>{depot.name}</strong><br />
          {depot.address}
        </Popup>
      </Marker>

      {/* Unassigned orders */}
      {!solution && orders.map((order) => (
        <CircleMarker
          key={order.id}
          center={[order.latitude, order.longitude]}
          radius={8}
          pathOptions={{ color: '#FA7070', fillColor: '#FA7070', fillOpacity: 0.8, weight: 2 }}
        >
          <Popup>
            <strong>{order.code}</strong><br />
            {order.receiverName}<br />
            {order.weightKg}kg
          </Popup>
        </CircleMarker>
      ))}

      {/* Routes */}
      {solution?.routes.map((route) => (
        <React.Fragment key={route.driver.fullName}>
          {/* Polyline */}
          <Polyline
            positions={route.polyline && route.polyline.length > 0 ? route.polyline : buildPolyline(depot, route.stops)}
            pathOptions={{
              color: route.color,
              weight: 4,
              opacity: 0.85,
              dashArray: undefined,
            }}
          />

          {/* Stop markers */}
          {route.stops.map((stop, i) => (
            <Marker
              key={stop.id}
              position={[stop.latitude, stop.longitude]}
              icon={numberedIcon(i + 1, route.color)}
            >
              <Popup>
                <div style={{ fontSize: '13px' }}>
                  <strong style={{ color: route.color }}>#{i + 1} {stop.code}</strong><br />
                  {stop.receiverName}<br />
                  <small style={{ color: '#6B7280' }}>{stop.deliveryAddress}</small><br />
                  {stop.codAmount > 0 && (
                    <span style={{ color: '#059669', fontWeight: '600' }}>
                      COD: {stop.codAmount.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </React.Fragment>
      ))}
    </MapContainer>
  );
}
