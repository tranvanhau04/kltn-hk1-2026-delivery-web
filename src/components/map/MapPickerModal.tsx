'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { MapPin, Save, X, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue in Next.js
import L from 'leaflet';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const coralPinIcon = divIcon({
  className: '',
  html: `<div style="
    width:36px;height:44px;display:flex;flex-direction:column;align-items:center;
    filter:drop-shadow(0 4px 8px rgba(250,112,112,0.4));
  ">
    <div style="
      width:32px;height:32px;background:#FA7070;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(250,112,112,0.5);
    ">
      <div style="transform:rotate(45deg);color:white;font-size:14px;">📍</div>
    </div>
    <div style="width:4px;height:12px;background:#FA7070;border-radius:0 0 2px 2px;margin-top:-2px;"></div>
  </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
});

/** Moves the map center when lat/lng change externally */
function MapCenterSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat, lng });
  useEffect(() => {
    if (prevRef.current.lat !== lat || prevRef.current.lng !== lng) {
      map.setView([lat, lng], map.getZoom());
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

function ClickableMap({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

export interface MapPickerModalProps {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
  readOnly?: boolean;
  title?: string;
  /** If provided, enables the "Lưu tọa độ" save-to-server button */
  orderId?: string;
  /** Callback after a successful PATCH /orders/:id/coordinates call */
  onCoordinatesSaved?: (lat: number, lng: number) => void;
}

export default function MapPickerModal({
  initialLat = 10.8012,
  initialLng = 106.7138,
  onConfirm,
  onClose,
  readOnly = false,
  title = 'Chọn vị trí giao hàng',
  orderId,
  onCoordinatesSaved,
}: MapPickerModalProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [reverseAddress, setReverseAddress] = useState<string | null>(null);
  const [isReverseLoading, setIsReverseLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  /** Reverse geocode a lat/lng via Nominatim */
  const doReverseGeocode = useCallback(async (la: number, ln: number) => {
    setIsReverseLoading(true);
    setReverseAddress(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${la}&lon=${ln}`,
        { headers: { 'User-Agent': 'IUH-SmartExpress-KLTN/1.0 (contact@iuh.edu.vn)' } },
      );
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string };
        setReverseAddress(data.display_name ?? null);
      }
    } catch {
      // Reverse geocode is best-effort — silently ignore failures
    } finally {
      setIsReverseLoading(false);
    }
  }, []);

  // Reverse geocode on initial load if coordinates are non-zero
  useEffect(() => {
    if (lat !== 0 && lng !== 0) {
      void doReverseGeocode(lat, lng);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback(
    (la: number, ln: number) => {
      setLat(la);
      setLng(ln);
      void doReverseGeocode(la, ln);
    },
    [doReverseGeocode],
  );

  /** PATCH /orders/:id/coordinates via backend API */
  const handleSaveToServer = async () => {
    if (!orderId) return;
    setIsSaving(true);
    try {
      const { patchOrderCoordinates } = await import('@/lib/api');
      await patchOrderCoordinates(orderId, lat, lng);
      showToast('success', `Đã lưu tọa độ: ${Number(lat || 0).toFixed(5)}, ${Number(lng || 0).toFixed(5)}`);
      onCoordinatesSaved?.(lat, lng);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      if (msg.includes('400') || msg.includes('DELIVERED')) {
        showToast('error', 'Không thể cập nhật: đơn hàng đã được giao (DELIVERED).');
      } else {
        showToast('error', `Lưu thất bại: ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isServerSaveMode = !!orderId && !readOnly;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.25)] flex flex-col"
        style={{ height: '72vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F0] flex items-center justify-center">
              <MapPin size={16} className="text-[#FA7070]" />
            </div>
            <div>
              <p className="text-sm font-600 text-gray-900">{title}</p>
              {!readOnly && (
                <p className="text-xs text-gray-400">
                  {isServerSaveMode
                    ? 'Nhấn bản đồ để định vị, rồi "Lưu tọa độ" để cập nhật'
                    : 'Nhấn vào bản đồ để chọn vị trí'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            id="btn-close-map-picker"
          >
            <X size={18} />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[lat, lng]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            <MapCenterSync lat={lat} lng={lng} />
            <Marker position={[lat, lng]} icon={coralPinIcon} />
            {!readOnly && <ClickableMap onChange={handleMapClick} />}
          </MapContainer>

          {/* Coordinate + address overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border border-slate-100 max-w-xs">
            <p className="text-xs font-600 text-gray-700 font-mono">
              📍 {Number(lat || 0).toFixed(6)}, {Number(lng || 0).toFixed(6)}
            </p>
            {isReverseLoading && (
              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Đang tra cứu địa chỉ...
              </p>
            )}
            {!isReverseLoading && reverseAddress && (
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                {reverseAddress}
              </p>
            )}
          </div>

          {/* Reset pin button */}
          {!readOnly && (lat !== initialLat || lng !== initialLng) && (
            <button
              onClick={() => {
                setLat(initialLat);
                setLng(initialLng);
                void doReverseGeocode(initialLat, initialLng);
              }}
              className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-slate-100 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              id="btn-reset-pin"
            >
              <RotateCcw size={12} /> Đặt lại
            </button>
          )}
        </div>

        {/* Toast notification */}
        {toast && (
          <div
            className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-sm font-500 transition-all ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.message}
          </div>
        )}

        {/* Footer */}
        {!readOnly && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
            <button onClick={onClose} className="btn-secondary text-sm">
              Hủy
            </button>

            {/* Server-save mode: PATCH /orders/:id/coordinates */}
            {isServerSaveMode ? (
              <button
                onClick={handleSaveToServer}
                disabled={isSaving}
                className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                id="btn-save-coordinates"
              >
                {isSaving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Lưu tọa độ
              </button>
            ) : (
              /* Local-only mode: return coords to parent */
              <button
                onClick={() => onConfirm(lat, lng)}
                className="btn-primary text-sm"
                id="btn-save-location"
              >
                <Save size={15} /> Lưu vị trí
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
