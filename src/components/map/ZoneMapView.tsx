'use client';

import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ApiZone } from '@/lib/api';

import L from 'leaflet';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── Color coding by overload severity ────────────────────────────────────────

function severityToColor(severity: string | undefined, isSelected: boolean) {
  if (isSelected) return { stroke: '#6366F1', fill: '#6366F1' }; // indigo for selected
  switch (severity) {
    case 'CRITICAL': return { stroke: '#EF4444', fill: '#EF4444' };
    case 'WARNING':  return { stroke: '#F59E0B', fill: '#F59E0B' };
    default:         return { stroke: '#22C55E', fill: '#22C55E' };
  }
}

// ─── GeoJSON → [lat,lng][] conversion ────────────────────────────────────────

function parsePolygonFromGeoJson(geoJson: object | string | null): [number, number][] {
  if (!geoJson) return [];
  try {
    const parsed: unknown = typeof geoJson === 'string' ? JSON.parse(geoJson) : geoJson;
    if (typeof parsed !== 'object' || parsed === null) return [];
    const geo = parsed as { type?: string; coordinates?: unknown[][] };
    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates?.[0])) {
      return (geo.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng]);
    }
    if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates?.[0]?.[0])) {
      // Render first ring of first polygon
      return ((geo.coordinates as [number, number][][][])[0][0]).map(([lng, lat]) => [lat, lng]);
    }
  } catch {
    // malformed — ignore
  }
  return [];
}

function polygonCenter(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [10.8012, 106.7138];
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}

function drawingIcon() {
  return divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;background:#FA7070;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(250,112,112,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function DrawingLayer({
  onAddPoint,
  enabled,
}: {
  onAddPoint: (lat: number, lng: number) => void;
  enabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onAddPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ZoneMapViewProps {
  /** The zone currently selected/focused in the sidebar */
  zone: ApiZone;
  /** All zones to render as background polygons */
  allZones?: ApiZone[];
  /** Callback when user clicks a zone polygon */
  onZoneSelect?: (zoneId: string) => void;
}

export default function ZoneMapView({ zone, allZones = [], onZoneSelect }: ZoneMapViewProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);

  const selectedPolygon = parsePolygonFromGeoJson(zone.boundaryGeoJson);
  const drawnOrExisting = drawnPoints.length >= 3 ? drawnPoints : selectedPolygon;

  const center: [number, number] =
    selectedPolygon.length > 0 ? polygonCenter(selectedPolygon) : [10.8012, 106.7138];

  const metrics = zone.metrics;
  const overloadLabel =
    metrics.overloadSeverity === 'CRITICAL'
      ? 'QUÁ TẢI'
      : metrics.overloadSeverity === 'WARNING'
      ? 'Sắp đầy (>80%)'
      : 'Tải an toàn';
  const overloadClass =
    metrics.overloadSeverity === 'CRITICAL'
      ? 'text-red-600 bg-red-50 border-red-100'
      : metrics.overloadSeverity === 'WARNING'
      ? 'text-amber-600 bg-amber-50 border-amber-100'
      : 'text-green-700 bg-green-50 border-green-100';

  return (
    <div className="relative h-full">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        <DrawingLayer
          enabled={isDrawing}
          onAddPoint={(lat, lng) => setDrawnPoints((prev) => [...prev, [lat, lng]])}
        />

        {/* Background zones (all except selected) */}
        {allZones
          .filter((z) => z.id !== zone.id)
          .map((z) => {
            const coords = parsePolygonFromGeoJson(z.boundaryGeoJson);
            if (coords.length < 3) return null;
            const { stroke, fill } = severityToColor(z.metrics?.overloadSeverity, false);
            return (
              <Polygon
                key={z.id}
                positions={coords}
                pathOptions={{
                  color: stroke,
                  fillColor: fill,
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: '4 3',
                }}
                eventHandlers={{ click: () => onZoneSelect?.(z.id) }}
              >
                <Popup>
                  <strong>{z.name}</strong>
                  <br />
                  {z.metrics?.overloadSeverity ?? 'NORMAL'}
                </Popup>
              </Polygon>
            );
          })}

        {/* Selected zone polygon */}
        {drawnOrExisting.length >= 3 && (
          <Polygon
            positions={drawnOrExisting}
            pathOptions={{
              color: severityToColor(zone.metrics?.overloadSeverity, true).stroke,
              fillColor: severityToColor(zone.metrics?.overloadSeverity, true).fill,
              fillOpacity: 0.15,
              weight: 2.5,
              dashArray: isDrawing ? '5 5' : undefined,
            }}
          />
        )}

        {/* Drawing points */}
        {isDrawing &&
          drawnPoints.map((p, i) => (
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
              {drawnPoints.length < 3
                ? `Nhấn bản đồ để thêm điểm (${drawnPoints.length}/3 tối thiểu)`
                : `${drawnPoints.length} điểm`}
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

      {/* Zone info + severity overlay */}
      <div className={`absolute top-4 left-4 z-10 rounded-xl px-4 py-3 shadow-md border bg-white/95 backdrop-blur-sm`}>
        <p className="text-sm font-700 text-gray-800">{zone.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {metrics.totalOrders} đơn chờ · {metrics.activeDriversCount} tài xế hoạt động
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full border ${overloadClass}`}>
            {overloadLabel}
          </span>
          {metrics.fleetCapacityWeight > 0 && (
            <span className="text-[10px] text-gray-400">
              {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
