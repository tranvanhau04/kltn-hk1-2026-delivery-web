'use client';

import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Zone } from '@/types/domain';

import L from 'leaflet';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function drawingIcon() {
  return divIcon({
    className: '',
    html: `<div style="
      width:12px;height:12px;background:#FA7070;
      border-radius:50%;border:2.5px solid white;
      box-shadow:0 2px 6px rgba(250,112,112,0.5);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function DrawingLayer({ onAddPoint, enabled }: { onAddPoint: (lat: number, lng: number) => void; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (enabled) onAddPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface ZoneMapViewProps {
  zone: Zone;
}

export default function ZoneMapView({ zone }: ZoneMapViewProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);

  // Parse existing boundary
  let existingPolygon: [number, number][] = [];
  try {
    const geoJson = JSON.parse(zone.boundaryGeoJson);
    if (geoJson?.coordinates?.[0]) {
      existingPolygon = geoJson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
    }
  } catch {
    // No boundary
  }

  const displayPolygon = drawnPoints.length >= 3 ? drawnPoints : existingPolygon;
  const center: [number, number] = existingPolygon.length > 0
    ? [
        existingPolygon.reduce((s, p) => s + p[0], 0) / existingPolygon.length,
        existingPolygon.reduce((s, p) => s + p[1], 0) / existingPolygon.length,
      ]
    : [10.8012, 106.7138];

  const isOverloaded = (zone.orderCount ?? 0) > (zone.capacity ?? 999);

  return (
    <div className="relative h-full">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        <DrawingLayer
          enabled={isDrawing}
          onAddPoint={(lat, lng) => setDrawnPoints((prev) => [...prev, [lat, lng]])}
        />

        {/* Existing polygon */}
        {displayPolygon.length >= 3 && (
          <Polygon
            positions={displayPolygon}
            pathOptions={{
              color: isOverloaded ? '#EF4444' : '#FA7070',
              fillColor: isOverloaded ? '#EF4444' : '#FA7070',
              fillOpacity: 0.12,
              weight: 2,
              dashArray: isDrawing ? '5 5' : undefined,
            }}
          />
        )}

        {/* Drawing points */}
        {isDrawing && drawnPoints.map((p, i) => (
          <Marker key={i} position={p} icon={drawingIcon()}>
            <Popup>Điểm {i + 1}</Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Drawing controls overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        {!isDrawing ? (
          <button
            onClick={() => { setIsDrawing(true); setDrawnPoints([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-sm font-500 text-gray-700 hover:bg-gray-50 border border-slate-200 transition-colors"
            id="btn-draw-zone"
          >
            ✏️ Vẽ ranh giới
          </button>
        ) : (
          <>
            <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-slate-200 text-xs text-gray-600">
              {drawnPoints.length < 3 ? `Nhấn bản đồ để thêm điểm (${drawnPoints.length}/3 tối thiểu)` : `${drawnPoints.length} điểm`}
            </div>
            {drawnPoints.length >= 3 && (
              <button
                onClick={() => setIsDrawing(false)}
                className="px-4 py-1.5 bg-[#FA7070] text-white rounded-xl shadow-md text-xs font-600 hover:bg-[#E85D5D] transition-colors"
                id="btn-finish-drawing"
              >
                ✓ Hoàn thành
              </button>
            )}
            <button
              onClick={() => { setIsDrawing(false); setDrawnPoints([]); }}
              className="px-4 py-1.5 bg-white text-gray-600 rounded-xl shadow-md border text-xs font-500 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
          </>
        )}
      </div>

      {/* Zone info overlay */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md border border-slate-100">
        <p className="text-sm font-700 text-gray-800">{zone.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {zone.orderCount ?? 0} đơn / {zone.capacity ?? '∞'} sức chứa
        </p>
        {isOverloaded && (
          <p className="text-[11px] text-red-600 font-600 mt-1">⚠️ Đang quá tải</p>
        )}
      </div>
    </div>
  );
}
