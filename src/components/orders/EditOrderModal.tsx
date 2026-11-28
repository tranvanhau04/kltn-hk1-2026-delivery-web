'use client';

import React, { useState } from 'react';
import { Pencil, MapPin, Loader2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import type { Order } from '@/types/domain';
import dynamic from 'next/dynamic';

const MapPickerModal = dynamic(() => import('@/components/map/MapPickerModal'), { ssr: false });

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  onSubmit: (data: Partial<Order>) => Promise<void>;
}

export function EditOrderModal({ order, onClose, onSubmit }: EditOrderModalProps) {
  const [form, setForm] = useState({
    receiverName: order.receiverName || '',
    receiverPhone: order.receiverPhone || '',
    deliveryAddress: order.deliveryAddress || '',
    weightKg: String(order.weightKg ?? ''),
    volumeM3: String(order.volumeM3 ?? ''),
    codAmount: String(order.codAmount ?? ''),
    notes: order.notes || '',
  });

  const [coords, setCoords] = useState({
    lat: Number(order.latitude) || 10.8222,
    lng: Number(order.longitude) || 106.6875,
  });

  const [showMap, setShowMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit({
        receiverName: form.receiverName,
        receiverPhone: form.receiverPhone,
        deliveryAddress: form.deliveryAddress,
        latitude: coords.lat,
        longitude: coords.lng,
        weightKg: parseFloat(form.weightKg) || 0,
        volumeM3: parseFloat(form.volumeM3) || 0,
        codAmount: parseFloat(form.codAmount) || 0,
        notes: form.notes || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Chỉnh sửa đơn hàng – ${order.code}`}
      subtitle="Cập nhật thông tin giao nhận, người nhận và tiền COD"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Hủy
          </button>
          <button
            form="edit-order-form"
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-1.5"
            id="btn-save-edit-order"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
            <span>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
          </button>
        </>
      }
    >
      <form id="edit-order-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Tên người nhận *</label>
            <input
              required
              value={form.receiverName}
              onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="input-base"
              id="edit-receiver-name"
            />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Số điện thoại *</label>
            <input
              required
              value={form.receiverPhone}
              onChange={(e) => setForm((f) => ({ ...f, receiverPhone: e.target.value }))}
              placeholder="0901234567"
              className="input-base"
              id="edit-receiver-phone"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Địa chỉ giao hàng *</label>
          <div className="flex gap-2">
            <input
              required
              value={form.deliveryAddress}
              onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
              placeholder="Địa chỉ số nhà, tên đường, phường..."
              className="input-base flex-1"
              id="edit-delivery-address"
            />
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="btn-secondary shrink-0 px-3 text-xs"
              title="Chọn tọa độ trên bản đồ"
              id="btn-edit-pick-map"
            >
              <MapPin size={14} className="text-slate-600" />
            </button>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
            Tọa độ: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Trọng lượng (kg)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.weightKg}
              onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
              placeholder="1.5"
              className="input-base"
              id="edit-weight-kg"
            />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Thể tích (m³)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.volumeM3}
              onChange={(e) => setForm((f) => ({ ...f, volumeM3: e.target.value }))}
              placeholder="0.01"
              className="input-base"
              id="edit-volume-m3"
            />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Tiền COD (VNĐ)</label>
            <input
              type="number"
              step="1000"
              min="0"
              value={form.codAmount}
              onChange={(e) => setForm((f) => ({ ...f, codAmount: e.target.value }))}
              placeholder="250000"
              className="input-base"
              id="edit-cod-amount"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Ghi chú giao hàng</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Chỉ dẫn giao hàng, hẹn giờ giao..."
            className="input-base h-auto py-2.5 resize-none"
            id="edit-notes"
          />
        </div>
      </form>

      {showMap && (
        <MapPickerModal
          initialLat={coords.lat}
          initialLng={coords.lng}
          onConfirm={(lat, lng, address) => {
            setCoords({ lat, lng });
            if (address) setForm((f) => ({ ...f, deliveryAddress: address }));
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </Modal>
  );
}
