'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Rectangle,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ApiZone } from '@/lib/api';
import L from 'leaflet';

// Fix Leaflet default marker icons for Next.js / webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { parseZoneBoundary, polygonCenter } from '@/lib/zoneGeo';
export { parseZoneBoundary, polygonCenter };

// ─── Color coding by overload severity ────────────────────────────────────────

function severityToColor(severity: string | undefined, isSelected: boolean) {
  if (isSelected) return { stroke: '#3B82F6', fill: '#3B82F6' }; // vibrant blue for selected
  switch (severity) {
    case 'CRITICAL':
      return { stroke: '#EF4444', fill: '#EF4444' };
    case 'WARNING':
      return { stroke: '#F59E0B', fill: '#F59E0B' };
    default:
      return { stroke: '#10B981', fill: '#10B981' };
  }
}

// ─── Leaflet Controllers ──────────────────────────────────────────────────────

/**
 * Controller to invalidate map size on mount so Leaflet fills container smoothly.
 */
function MapInvalidateController() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/**
 * Automatically pans and fits the camera to the selected polygon bounds.
 */
function MapBoundsController({ focusCoords }: { focusCoords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (focusCoords && focusCoords.length >= 3) {
      try {
        const bounds = L.latLngBounds(focusCoords);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
        }
      } catch {
        // ignore invalid bounds
      }
    }
  }, [focusCoords, map]);
  return null;
}

/**
 * Interactive drag-to-draw rectangle controller using useMapEvents.
 * Disables map dragging & zooming during draw, previews rectangle, and emits GeoJSON Polygon.
 */
function ZoneDrawController({
  isDrawingMode,
  onDrawComplete,
}: {
  isDrawingMode: boolean;
  onDrawComplete?: (geoJsonString: string) => void;
}) {
  const map = useMap();
  const [startPoint, setStartPoint] = useState<L.LatLng | null>(null);
  const [currentPoint, setCurrentPoint] = useState<L.LatLng | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const container = map.getContainer();
    if (isDrawingMode) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      container.style.cursor = 'crosshair';
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      container.style.cursor = '';
      setStartPoint(null);
      setCurrentPoint(null);
      isDraggingRef.current = false;
    }
    return () => {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      container.style.cursor = '';
    };
  }, [isDrawingMode, map]);

  useMapEvents({
    mousedown(e) {
      if (!isDrawingMode) return;
      if (e.originalEvent.button !== 0) return; // Only left-click
      isDraggingRef.current = true;
      setStartPoint(e.latlng);
      setCurrentPoint(e.latlng);
    },
    mousemove(e) {
      if (!isDrawingMode || !isDraggingRef.current || !startPoint) return;
      setCurrentPoint(e.latlng);
    },
    mouseup(e) {
      if (!isDrawingMode || !isDraggingRef.current || !startPoint) return;
      isDraggingRef.current = false;
      const endPoint = e.latlng;

      const latDiff = Math.abs(startPoint.lat - endPoint.lat);
      const lngDiff = Math.abs(startPoint.lng - endPoint.lng);

      // Require minimal box area to prevent accidental single-clicks
      if (latDiff >= 0.0005 && lngDiff >= 0.0005) {
        const minLat = Math.min(startPoint.lat, endPoint.lat);
        const maxLat = Math.max(startPoint.lat, endPoint.lat);
        const minLng = Math.min(startPoint.lng, endPoint.lng);
        const maxLng = Math.max(startPoint.lng, endPoint.lng);

        const geoJson = {
          type: 'Polygon',
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        };
        onDrawComplete?.(JSON.stringify(geoJson));
      }

      setStartPoint(null);
      setCurrentPoint(null);
    },
  });

  if (!isDrawingMode || !startPoint || !currentPoint) return null;

  const bounds: L.LatLngBoundsExpression = [
    [startPoint.lat, startPoint.lng],
    [currentPoint.lat, currentPoint.lng],
  ];

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        color: '#2563EB',
        dashArray: '6, 6',
        weight: 2,
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
      }}
    />
  );
}

// ─── Main Component Props ─────────────────────────────────────────────────────

export interface ZoneMapViewProps {
  /** The zone currently selected/focused in the sidebar, or null for general overview */
  zone: ApiZone | null;
  /** All zones to render as background polygons */
  allZones?: ApiZone[];
  /** Callback when user clicks a zone polygon */
  onZoneSelect?: (zoneId: string) => void;
  /** Drawing mode active */
  isDrawingMode?: boolean;
  /** Name of the target zone being drawn for the floating banner */
  drawingTargetName?: string | null;
  /** Callback when user completes drawing a rectangle */
  onDrawComplete?: (geoJsonString: string) => void;
  /** Callback to cancel drawing */
  onCancelDrawing?: () => void;
  /** Callback to initiate drawing */
  onStartDrawing?: () => void;
  /** Temporary polygon preview (e.g., when creating a new zone) */
  previewPolygonGeoJson?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ZoneMapView({
  zone,
  allZones = [],
  onZoneSelect,
  isDrawingMode = false,
  drawingTargetName = null,
  onDrawComplete,
  onCancelDrawing,
  onStartDrawing,
  previewPolygonGeoJson,
}: ZoneMapViewProps) {
  const selectedPolygon = zone ? parseZoneBoundary(zone.boundaryGeoJson) : [];
  const previewPolygon = previewPolygonGeoJson ? parseZoneBoundary(previewPolygonGeoJson) : [];

  const focusCoords =
    selectedPolygon.length >= 3
      ? selectedPolygon
      : previewPolygon.length >= 3
      ? previewPolygon
      : [];

  const center: [number, number] =
    focusCoords.length > 0 ? polygonCenter(focusCoords) : [10.8012, 106.7138];

  const metrics = zone?.metrics;
  const overloadLabel =
    metrics?.overloadSeverity === 'CRITICAL'
      ? 'QUÁ TẢI'
      : metrics?.overloadSeverity === 'WARNING'
      ? 'Sắp đầy (>80%)'
      : 'Tải an toàn';
  const overloadClass =
    metrics?.overloadSeverity === 'CRITICAL'
      ? 'text-red-600 bg-red-50 border-red-200'
      : metrics?.overloadSeverity === 'WARNING'
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-green-700 bg-green-50 border-green-200';

  return (
    <div className="relative h-full w-full select-none">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <MapInvalidateController />
        <MapBoundsController focusCoords={focusCoords} />

        <ZoneDrawController
          isDrawingMode={isDrawingMode}
          onDrawComplete={onDrawComplete}
        />

        {/* Background zones (all except selected) */}
        {allZones
          .filter((z) => !zone || z.id !== zone.id)
          .map((z) => {
            const coords = parseZoneBoundary(z.boundaryGeoJson);
            if (coords.length < 3) return null;
            const { stroke, fill } = severityToColor(z.metrics?.overloadSeverity, false);
            return (
              <Polygon
                key={z.id}
                positions={coords}
                pathOptions={{
                  color: stroke,
                  fillColor: fill,
                  fillOpacity: 0.1,
                  weight: 1.5,
                  dashArray: '4 4',
                }}
                eventHandlers={{ click: () => onZoneSelect?.(z.id) }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong className="text-sm text-gray-900">{z.name}</strong>
                    <p className="text-gray-500 mt-0.5">
                      {z.metrics?.totalOrders ?? 0} đơn · {z.metrics?.activeDriversCount ?? 0} tài xế
                    </p>
                    <button
                      onClick={() => onZoneSelect?.(z.id)}
                      className="mt-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 font-semibold rounded text-[11px]"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

        {/* Selected zone polygon */}
        {selectedPolygon.length >= 3 && (
          <Polygon
            positions={selectedPolygon}
            pathOptions={{
              color: severityToColor(zone?.metrics?.overloadSeverity, true).stroke,
              fillColor: severityToColor(zone?.metrics?.overloadSeverity, true).fill,
              fillOpacity: 0.22,
              weight: 3,
            }}
          >
            <Popup>
              <div className="text-xs">
                <strong className="text-sm text-gray-900">{zone?.name}</strong>
                <p className="text-gray-500 mt-0.5">
                  {metrics?.totalOrders ?? 0} đơn · {metrics?.activeDriversCount ?? 0} tài xế
                </p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* Temporary preview polygon while creating new zone */}
        {previewPolygon.length >= 3 && (!zone || selectedPolygon.length < 3) && (
          <Polygon
            positions={previewPolygon}
            pathOptions={{
              color: '#2563EB',
              fillColor: '#3B82F6',
              fillOpacity: 0.25,
              weight: 2.5,
              dashArray: '6 6',
            }}
          >
            <Popup>
              <div className="text-xs">
                <strong className="text-sm text-blue-600">Vùng mới khoanh</strong>
                <p className="text-gray-500 mt-0.5">Chưa lưu vào cơ sở dữ liệu</p>
              </div>
            </Popup>
          </Polygon>
        )}
      </MapContainer>

      {/* Floating Guidance Banner on Top during Drawing Mode */}
      {isDrawingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-3 bg-slate-900/90 text-white rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700/60 transition-all animate-in fade-in slide-in-from-top duration-300">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          <span className="text-xs sm:text-sm font-medium">
            {drawingTargetName
              ? `Đang khoanh vùng cho: "${drawingTargetName}" — Nhấn giữ và kéo chuột trên bản đồ`
              : 'Nhấn giữ chuột trái và kéo trên bản đồ để khoanh vùng khu vực'}
          </span>
          {onCancelDrawing && (
            <button
              onClick={onCancelDrawing}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors ml-1"
            >
              Hủy vẽ
            </button>
          )}
        </div>
      )}

      {/* Top Left Floating Information Card */}
      {zone ? (
        <div className="absolute top-4 left-4 z-[999] rounded-2xl px-4 py-3 shadow-lg border border-slate-100 bg-white/95 backdrop-blur-sm max-w-xs transition-all">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-700 text-gray-900 truncate">{zone.name}</h4>
            {selectedPolygon.length >= 3 ? (
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                Đã có vùng
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                Chưa có vùng
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {metrics?.totalOrders ?? 0} đơn chờ · {metrics?.activeDriversCount ?? 0} tài xế hoạt động
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full border ${overloadClass}`}>
              {overloadLabel}
            </span>
            {metrics && metrics.fleetCapacityWeight > 0 && (
              <span className="text-[10px] text-gray-400">
                {metrics.demandWeight}kg / {metrics.fleetCapacityWeight}kg
              </span>
            )}
          </div>
          {onStartDrawing && !isDrawingMode && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <button
                onClick={onStartDrawing}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors"
                id="btn-map-start-drawing"
              >
                ✏️ {selectedPolygon.length >= 3 ? 'Vẽ lại vùng trên bản đồ' : 'Khoanh vùng trên bản đồ'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute top-4 left-4 z-[999] rounded-2xl px-4 py-3 shadow-md border border-slate-100 bg-white/90 backdrop-blur-sm text-xs text-gray-600 max-w-xs">
          <p className="font-semibold text-gray-800">🗺️ Bản đồ khu vực</p>
          <p className="text-gray-400 text-[11px] mt-0.5">
            Chọn khu vực bên trái để xem chi tiết hoặc bấm tạo khu vực mới.
          </p>
        </div>
      )}
    </div>
  );
}
