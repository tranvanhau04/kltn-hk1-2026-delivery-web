'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus, Download, Eye, Pencil,
  MapPin, Phone, User, Clock,
  CheckCircle, Truck, AlertCircle,
  Image as ImageIcon, Weight, Box,
  FileText, DollarSign,
} from 'lucide-react';
import { DataTable, type ColumnDef, type FilterTab } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import { useApp } from '@/context/AppContext';
import { formatDateTime, formatCurrency, cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types/domain';
import dynamic from 'next/dynamic';

// Lazy-load map picker to avoid SSR issues
const MapPickerModal = dynamic(() => import('@/components/map/MapPickerModal'), { ssr: false });

// ─── Delivery Progress Stepper ───────────────────────────────────
const STEPS: { key: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { key: ['NEW'],         label: 'Đã tạo',     icon: <FileText size={14} /> },
  { key: ['ASSIGNED'],    label: 'Đã giao TX', icon: <User size={14} /> },
  { key: ['IN_TRANSIT'],  label: 'Đang giao',  icon: <Truck size={14} /> },
  { key: ['DELIVERED'],   label: 'Hoàn thành', icon: <CheckCircle size={14} /> },
];
const FAILED_STEPS: { key: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { key: ['NEW'],         label: 'Đã tạo',     icon: <FileText size={14} /> },
  { key: ['ASSIGNED'],    label: 'Đã giao TX', icon: <User size={14} /> },
  { key: ['IN_TRANSIT'],  label: 'Đang giao',  icon: <Truck size={14} /> },
  { key: ['FAILED', 'RESCHEDULED'], label: 'Thất bại / Dời lịch', icon: <AlertCircle size={14} /> },
];

const STATUS_STEP_INDEX: Record<string, number> = {
  NEW: 0, ASSIGNED: 1, IN_TRANSIT: 2, DELIVERED: 3, FAILED: 3, RESCHEDULED: 3,
};

function DeliveryProgressStepper({ status }: { status: OrderStatus }) {
  const steps = ['FAILED', 'RESCHEDULED'].includes(status) ? FAILED_STEPS : STEPS;
  const currentStep = STATUS_STEP_INDEX[status] ?? 0;
  const isFailed = ['FAILED', 'RESCHEDULED'].includes(status);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const isLast = i === steps.length - 1;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                done  ? 'bg-[#FA7070] text-white' :
                active && isFailed ? 'bg-red-100 text-red-600 ring-2 ring-red-200' :
                active ? 'bg-[#FFF0F0] text-[#FA7070] ring-2 ring-[#FA7070]/30' :
                'bg-gray-100 text-gray-300'
              )}>
                {step.icon}
              </div>
              <span className={cn(
                'text-[10px] text-center leading-tight px-1',
                done ? 'text-[#FA7070] font-600' :
                active ? (isFailed ? 'text-red-600 font-600' : 'text-[#FA7070] font-600') :
                'text-gray-400'
              )}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 mb-5 rounded-full',
                done ? 'bg-[#FA7070]' : 'bg-gray-200'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Order Detail Modal (Frame 06) ───────────────────────────────
function OrderDetailModal({
  order,
  onClose,
  onOpenMap,
}: {
  order: Order;
  onClose: () => void;
  onOpenMap: () => void;
}) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Chi tiết đơn hàng – ${order.code}`}
      subtitle={`Tạo lúc ${formatDateTime(order.createdAt)}`}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Đóng</button>
          <button onClick={onOpenMap} className="btn-primary">
            <MapPin size={15} /> Xem bản đồ
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Customer Info */}
          <div>
            <h3 className="text-xs font-700 text-gray-400 uppercase tracking-wider mb-3">Thông tin khách hàng</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#FFF0F0] flex items-center justify-center shrink-0">
                  <User size={15} className="text-[#FA7070]" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Người nhận</p>
                  <p className="text-sm font-600 text-gray-800">{order.receiverName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#FFF0F0] flex items-center justify-center shrink-0">
                  <Phone size={15} className="text-[#FA7070]" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Số điện thoại</p>
                  <p className="text-sm font-600 text-gray-800">{order.receiverPhone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#FFF0F0] flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={15} className="text-[#FA7070]" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Địa chỉ giao hàng</p>
                  <p className="text-sm font-600 text-gray-800">{order.deliveryAddress}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
              {order.driverName && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                    <Truck size={15} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Tài xế phụ trách</p>
                    <p className="text-sm font-600 text-gray-800">{order.driverName}</p>
                  </div>
                </div>
              )}
              {order.notes && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[11px] text-amber-700 font-600 mb-0.5">Ghi chú</p>
                  <p className="text-xs text-amber-700">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Progress */}
          <div>
            <h3 className="text-xs font-700 text-gray-400 uppercase tracking-wider mb-3">Tiến độ giao hàng</h3>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge status={order.status} />
                {order.estimatedDelivery && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} /> {formatDateTime(order.estimatedDelivery)}
                  </div>
                )}
              </div>
              <DeliveryProgressStepper status={order.status} />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Package Specs */}
          <div>
            <h3 className="text-xs font-700 text-gray-400 uppercase tracking-wider mb-3">Thông số kiện hàng</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <Weight size={20} className="text-[#FA7070] mx-auto mb-1" />
                <p className="text-lg font-700 text-gray-900">{order.weightKg}</p>
                <p className="text-xs text-gray-400">kg</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <Box size={20} className="text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-700 text-gray-900">{order.volumeM3}</p>
                <p className="text-xs text-gray-400">m³</p>
              </div>
              <div className="col-span-2 p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-green-500" />
                    <span className="text-sm text-gray-600">COD thu hộ</span>
                  </div>
                  <span className="text-base font-700 text-gray-900">
                    {order.codAmount > 0 ? formatCurrency(order.codAmount) : '–'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Proof of Delivery */}
          <div>
            <h3 className="text-xs font-700 text-gray-400 uppercase tracking-wider mb-3">Bằng chứng giao hàng (POD)</h3>
            {order.status === 'DELIVERED' ? (
              <div className="rounded-xl overflow-hidden border border-slate-100">
                <div className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://placehold.co/400x200/FFF0F0/FA7070?text=📷+POD+Photo"
                    alt="Proof of delivery"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 bg-green-50">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={14} />
                    <span className="text-xs font-600">Xác nhận giao hàng thành công</span>
                  </div>
                </div>
              </div>
            ) : order.status === 'FAILED' ? (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle size={16} />
                  <span className="text-sm font-600">Giao hàng thất bại</span>
                </div>
                <p className="text-xs text-red-500">{order.notes ?? 'Không liên lạc được khách hàng'}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 gap-2">
                <ImageIcon size={24} className="text-gray-300" />
                <p className="text-xs text-gray-400">Chưa có ảnh POD</p>
              </div>
            )}
          </div>

          {/* Order meta */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Mã đơn</span>
              <span className="font-600 text-gray-700 font-mono">{order.code}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Khu vực</span>
              <span className="font-600 text-gray-700">{order.zoneId ?? '–'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Ngày tạo</span>
              <span className="font-600 text-gray-700">{formatDateTime(order.createdAt)}</span>
            </div>
            {order.estimatedDelivery && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Dự kiến giao</span>
                <span className="font-600 text-gray-700">{formatDateTime(order.estimatedDelivery)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── New / Edit Order Modal ───────────────────────────────────────
function NewOrderModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: Partial<Order>) => void }) {
  const [form, setForm] = useState({
    receiverName: '',
    receiverPhone: '',
    deliveryAddress: '',
    weightKg: '',
    volumeM3: '',
    codAmount: '',
    notes: '',
  });
  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState({ lat: 10.8012, lng: 106.7138 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
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
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Thêm đơn hàng mới"
      subtitle="Điền đầy đủ thông tin giao hàng"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button form="new-order-form" type="submit" className="btn-primary">
            <Plus size={15} /> Tạo đơn hàng
          </button>
        </>
      }
    >
      <form id="new-order-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Tên người nhận *</label>
            <input
              required
              value={form.receiverName}
              onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="input-base"
              id="order-receiver-name"
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
              id="order-receiver-phone"
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
              placeholder="123 Đường ABC, Phường XYZ, Quận 1, TP.HCM"
              className="input-base flex-1"
              id="order-delivery-address"
            />
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="btn-secondary shrink-0 px-3 text-xs"
              id="btn-pick-map"
            >
              <MapPin size={14} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Tọa độ: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Trọng lượng (kg)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.weightKg}
              onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
              placeholder="0.0"
              className="input-base"
              id="order-weight"
            />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Thể tích (m³)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.volumeM3}
              onChange={(e) => setForm((f) => ({ ...f, volumeM3: e.target.value }))}
              placeholder="0.000"
              className="input-base"
              id="order-volume"
            />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">COD (VND)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={form.codAmount}
              onChange={(e) => setForm((f) => ({ ...f, codAmount: e.target.value }))}
              placeholder="0"
              className="input-base"
              id="order-cod"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Ghi chú</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Hướng dẫn giao hàng đặc biệt..."
            className="input-base h-auto py-3 resize-none"
            id="order-notes"
          />
        </div>
      </form>

      {showMap && (
        <MapPickerModal
          initialLat={coords.lat}
          initialLng={coords.lng}
          onConfirm={(lat, lng) => { setCoords({ lat, lng }); setShowMap(false); }}
          onClose={() => setShowMap(false)}
        />
      )}
    </Modal>
  );
}

// ─── Main Orders Page ─────────────────────────────────────────────
const STATUS_FILTER_TABS: FilterTab[] = [
  { label: 'Tất cả',       value: 'ALL' },
  { label: 'Mới',          value: 'NEW' },
  { label: 'Đã giao tài xế', value: 'ASSIGNED' },
  { label: 'Đang giao',    value: 'IN_TRANSIT' },
  { label: 'Hoàn thành',   value: 'DELIVERED' },
  { label: 'Ngoại lệ',     value: 'EXCEPTION' },
];

const EXCEPTION_STATUSES: OrderStatus[] = ['FAILED', 'RESCHEDULED'];

export default function OrdersPage() {
  const { orders } = useApp();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showMapForOrder, setShowMapForOrder] = useState<Order | null>(null);
  const [localOrders, setLocalOrders] = useState<Order[]>(orders);



  // Build tabs with counts
  const tabsWithCounts = useMemo(() => {
    return STATUS_FILTER_TABS.map((tab) => ({
      ...tab,
      count: tab.value === 'ALL'
        ? orders.length
        : tab.value === 'EXCEPTION'
        ? orders.filter((o) => EXCEPTION_STATUSES.includes(o.status)).length
        : orders.filter((o) => o.status === tab.value).length,
    }));
  }, [orders]);

  // Apply search + filter
  const filteredOrders = useMemo(() => {
    let res = localOrders;
    if (activeFilter !== 'ALL' && activeFilter !== 'EXCEPTION') {
      res = res.filter((o) => o.status === activeFilter);
    } else if (activeFilter === 'EXCEPTION') {
      res = res.filter((o) => EXCEPTION_STATUSES.includes(o.status));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (o) =>
          o.code.toLowerCase().includes(q) ||
          o.receiverName.toLowerCase().includes(q) ||
          o.receiverPhone.includes(q) ||
          o.deliveryAddress.toLowerCase().includes(q) ||
          (o.driverName ?? '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [localOrders, activeFilter, search]);

  const columns: ColumnDef<Order>[] = [
    {
      key: 'code',
      header: 'Mã đơn',
      sortable: true,
      render: (v) => (
        <span className="font-mono text-xs font-600 text-[#FA7070]">{String(v)}</span>
      ),
    },
    {
      key: 'receiverName',
      header: 'Người nhận',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-500 text-gray-800 text-sm">{String(v)}</p>
          <p className="text-xs text-gray-400">{(row as Order).receiverPhone}</p>
        </div>
      ),
    },
    {
      key: 'deliveryAddress',
      header: 'Địa chỉ giao',
      render: (v) => (
        <span className="text-xs text-gray-600 max-w-[200px] block truncate">{String(v)}</span>
      ),
    },
    {
      key: 'weightKg',
      header: 'Trọng lượng',
      sortable: true,
      align: 'center',
      render: (v) => <span className="text-sm">{String(v)} kg</span>,
    },
    {
      key: 'codAmount',
      header: 'COD',
      sortable: true,
      align: 'right',
      render: (v) => (
        <span className={cn('text-sm font-600', Number(v) > 0 ? 'text-green-600' : 'text-gray-400')}>
          {Number(v) > 0 ? formatCurrency(Number(v)) : '–'}
        </span>
      ),
    },
    {
      key: 'driverName',
      header: 'Tài xế',
      render: (v) =>
        v ? (
          <span className="text-sm text-gray-700">{String(v)}</span>
        ) : (
          <span className="text-xs text-gray-300 italic">Chưa gán</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortable: true,
      render: (v) => <StatusBadge status={v as OrderStatus} />,
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      sortable: true,
      render: (v) => <span className="text-xs text-gray-400">{formatDateTime(String(v))}</span>,
    },
  ];

  const handleNewOrder = (data: Partial<Order>) => {
    const newOrder: Order = {
      id: `ord${Date.now()}`,
      code: `SE${Date.now().toString().slice(-9)}`,
      dispatcherId: 'u2',
      receiverName: data.receiverName ?? '',
      receiverPhone: data.receiverPhone ?? '',
      deliveryAddress: data.deliveryAddress ?? '',
      latitude: data.latitude ?? 10.8012,
      longitude: data.longitude ?? 106.7138,
      weightKg: data.weightKg ?? 0,
      volumeM3: data.volumeM3 ?? 0,
      codAmount: data.codAmount ?? 0,
      status: 'NEW',
      createdAt: new Date().toISOString(),
      notes: data.notes,
    };
    setLocalOrders((prev) => [newOrder, ...prev]);
    setShowNewOrder(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-700 text-gray-900">Đơn hàng</h2>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} tổng số đơn hàng</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary text-sm"
            id="btn-import-excel"
          >
            <Download size={15} /> Nhập Excel
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="btn-primary text-sm"
            id="btn-new-order"
          >
            <Plus size={15} /> Thêm đơn hàng
          </button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={filteredOrders}
        columns={columns}
        filterTabs={tabsWithCounts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm mã đơn, tên khách, địa chỉ..."
        pageSize={10}
        getRowKey={(row) => row.id}
        onRowClick={(row) => setSelectedOrder(row)}
        rowActions={(row) => (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedOrder(row); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors"
              title="Xem chi tiết"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMapForOrder(row); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#FA7070] hover:bg-[#FFF0F0] transition-colors"
              title="Xem bản đồ"
            >
              <MapPin size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              title="Chỉnh sửa"
            >
              <Pencil size={14} />
            </button>
          </>
        )}
        emptyMessage="Không tìm thấy đơn hàng phù hợp"
      />

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOpenMap={() => { setShowMapForOrder(selectedOrder); setSelectedOrder(null); }}
        />
      )}

      {/* Map Picker Modal for viewing order location */}
      {showMapForOrder && (
        <MapPickerModal
          initialLat={showMapForOrder.latitude}
          initialLng={showMapForOrder.longitude}
          readOnly
          title={`Vị trí giao hàng – ${showMapForOrder.code}`}
          onConfirm={() => setShowMapForOrder(null)}
          onClose={() => setShowMapForOrder(null)}
        />
      )}

      {/* New Order Modal */}
      {showNewOrder && (
        <NewOrderModal
          onClose={() => setShowNewOrder(false)}
          onSubmit={handleNewOrder}
        />
      )}
    </div>
  );
}
