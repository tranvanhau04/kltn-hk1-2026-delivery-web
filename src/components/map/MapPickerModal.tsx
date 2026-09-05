'use client';

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { MapPin, Save, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
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

function ClickableMap({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface MapPickerModalProps {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
  readOnly?: boolean;
  title?: string;
}

export default function MapPickerModal({
  initialLat = 10.8012,
  initialLng = 106.7138,
  onConfirm,
  onClose,
  readOnly = false,
  title = 'Chọn vị trí giao hàng',
}: MapPickerModalProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.2)] animate-scale-in flex flex-col"
        style={{ height: '70vh' }}
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
                <p className="text-xs text-gray-400">Nhấn vào bản đồ để chọn vị trí</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
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
            <Marker position={[lat, lng]} icon={coralPinIcon} />
            {!readOnly && <ClickableMap onChange={(la, ln) => { setLat(la); setLng(ln); }} />}
          </MapContainer>

          {/* Coords overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md border border-slate-100">
            <p className="text-xs text-gray-500 font-500">
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
            <button onClick={onClose} className="btn-secondary text-sm">
              Hủy
            </button>
            <button
              onClick={() => onConfirm(lat, lng)}
              className="btn-primary text-sm"
              id="btn-save-location"
            >
              <Save size={15} /> Lưu vị trí
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
