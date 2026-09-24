'use client';

import React, { useState } from 'react';
import { Plus, Phone, Eye, Pencil } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import type { Driver, VehicleType, DriverShiftStatus } from '@/types/domain';
import { fetchDrivers, createUser, createDriver, updateDriverSpecs, updateShiftStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  MOTORBIKE:  '🏍️ Xe máy',
  VAN_500KG:  '🚐 Xe tải 500kg',
  TRUCK_1TON: '🚛 Xe tải 1 tấn',
  TRUCK_2TON: '🚛 Xe tải 2 tấn',
};

const VEHICLE_TYPES: VehicleType[] = ['MOTORBIKE', 'VAN_500KG', 'TRUCK_1TON', 'TRUCK_2TON'];

// Aligned with backend DriverShiftStatus enum: OFFLINE, ONLINE_READY, BUSY
const SHIFT_STATUS_LABELS: Record<DriverShiftStatus, string> = {
  OFFLINE:      '⬛ Offline',
  ONLINE_READY: '🟢 Sẵn sàng',
  BUSY:         '🔵 Đang giao',
};

const SHIFT_STATUSES: DriverShiftStatus[] = ['OFFLINE', 'ONLINE_READY', 'BUSY'];

function DriverAvatarCell({ driver }: { driver: Driver }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-sm shrink-0">
        {driver.fullName.charAt(0)}
      </div>
      <div>
        <p className="text-sm font-600 text-gray-800">{driver.fullName}</p>
        <p className="text-xs text-gray-400">{driver.email}</p>
      </div>
    </div>
  );
}

// ─── Add Driver Modal ─────────────────────────────────────────────────────────

function AddDriverModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (driver: Partial<Driver>) => void;
}) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    licensePlate: '',
    vehicleType: 'MOTORBIKE' as VehicleType,
    maxWeightKg: '',
    maxVolumeM3: '',
  });

  const vehicleDefaults: Record<VehicleType, { weight: string; volume: string }> = {
    MOTORBIKE:  { weight: '30',   volume: '0.1' },
    VAN_500KG:  { weight: '500',  volume: '4.2' },
    TRUCK_1TON: { weight: '1000', volume: '8.5' },
    TRUCK_2TON: { weight: '2000', volume: '16' },
  };

  const handleVehicleChange = (vt: VehicleType) => {
    const defaults = vehicleDefaults[vt];
    setForm((f) => ({ ...f, vehicleType: vt, maxWeightKg: defaults.weight, maxVolumeM3: defaults.volume }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      licensePlate: form.licensePlate,
      vehicleType: form.vehicleType,
      maxWeightKg: parseFloat(form.maxWeightKg) || 0,
      maxVolumeM3: parseFloat(form.maxVolumeM3) || 0,
      currentShiftStatus: 'OFFLINE', // Backend default
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Thêm tài xế mới"
      subtitle="Nhập thông tin tài xế và phương tiện"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button form="add-driver-form" type="submit" className="btn-primary">
            <Plus size={15} /> Thêm tài xế
          </button>
        </>
      }
    >
      <form id="add-driver-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Họ tên *</label>
            <input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Nguyễn Văn A" className="input-base" id="driver-fullname" />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Số điện thoại *</label>
            <input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0901234567" className="input-base" id="driver-phone" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="driver@iuhlogistics.vn" className="input-base" id="driver-email" />
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Biển số xe *</label>
          <input required value={form.licensePlate} onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value }))} placeholder="59G1-234.56" className="input-base" id="driver-plate" />
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-2">Loại phương tiện *</label>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLE_TYPES.map((vt) => (
              <button key={vt} type="button" onClick={() => handleVehicleChange(vt)} id={`vehicle-type-${vt}`}
                className={cn('px-3 py-2.5 rounded-xl border text-sm font-500 transition-all text-left',
                  form.vehicleType === vt ? 'border-[#FA7070] bg-[#FFF0F0] text-[#FA7070]' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50')}>
                {VEHICLE_TYPE_LABELS[vt]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Tải trọng tối đa (kg)</label>
            <input type="number" min="0" value={form.maxWeightKg} onChange={(e) => setForm((f) => ({ ...f, maxWeightKg: e.target.value }))} className="input-base" id="driver-max-weight" />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Thể tích tối đa (m³)</label>
            <input type="number" min="0" step="0.1" value={form.maxVolumeM3} onChange={(e) => setForm((f) => ({ ...f, maxVolumeM3: e.target.value }))} className="input-base" id="driver-max-volume" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Driver Modal (Bug #7 fix) ──────────────────────────────────────────

function EditDriverModal({ driver, onClose, onSubmit }: {
  driver: Driver;
  onClose: () => void;
  onSubmit: (payload: { maxWeightKg: number; maxVolumeM3: number; currentShiftStatus: DriverShiftStatus }) => void;
}) {
  const [form, setForm] = useState({
    maxWeightKg: String(driver.maxWeightKg),
    maxVolumeM3: String(driver.maxVolumeM3),
    currentShiftStatus: driver.currentShiftStatus,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      maxWeightKg: parseFloat(form.maxWeightKg) || 0,
      maxVolumeM3: parseFloat(form.maxVolumeM3) || 0,
      currentShiftStatus: form.currentShiftStatus as DriverShiftStatus,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Chỉnh sửa – ${driver.fullName}`}
      subtitle={`Biển số: ${driver.licensePlate}`}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button form="edit-driver-form" type="submit" className="btn-primary">Lưu thay đổi</button>
        </>
      }
    >
      <form id="edit-driver-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Tải trọng (kg)</label>
            <input type="number" min="0" step="0.1" required value={form.maxWeightKg}
              onChange={(e) => setForm((f) => ({ ...f, maxWeightKg: e.target.value }))}
              className="input-base" id="edit-driver-max-weight" />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Thể tích (m³)</label>
            <input type="number" min="0" step="0.001" required value={form.maxVolumeM3}
              onChange={(e) => setForm((f) => ({ ...f, maxVolumeM3: e.target.value }))}
              className="input-base" id="edit-driver-max-volume" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-2">Trạng thái ca làm việc</label>
          <div className="flex flex-col gap-2">
            {SHIFT_STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, currentShiftStatus: s }))} id={`edit-shift-${s}`}
                className={cn('px-3 py-2.5 rounded-xl border text-sm font-500 transition-all text-left',
                  form.currentShiftStatus === s ? 'border-[#FA7070] bg-[#FFF0F0] text-[#FA7070]' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50')}>
                {SHIFT_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [filter, setFilter] = useState('ALL');

  const loadDrivers = React.useCallback(async () => {
    try {
      const data = await fetchDrivers();
      setDrivers(data);
    } catch (err) {
      console.error('Failed to load drivers', err);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDrivers();
  }, [loadDrivers]);

  const filteredDrivers = drivers.filter((d) => {
    const matchSearch =
      !search ||
      d.fullName.toLowerCase().includes(search.toLowerCase()) ||
      d.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);
    const matchFilter = filter === 'ALL' || d.currentShiftStatus === filter;
    return matchSearch && matchFilter;
  });

  const columns: ColumnDef<Driver>[] = [
    {
      key: 'fullName',
      header: 'Tài xế',
      sortable: true,
      render: (_, row) => <DriverAvatarCell driver={row as Driver} />,
    },
    {
      key: 'licensePlate',
      header: 'Biển số',
      render: (v) => (
        <span className="font-mono text-sm font-600 text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">{String(v)}</span>
      ),
    },
    {
      key: 'vehicleType',
      header: 'Phương tiện',
      render: (v) => <span className="text-sm text-gray-600">{VEHICLE_TYPE_LABELS[v as VehicleType]}</span>,
    },
    {
      key: 'maxWeightKg',
      header: 'Tải trọng',
      align: 'center',
      render: (v) => <span className="text-sm">{Number(v).toLocaleString()} kg</span>,
    },
    {
      key: 'maxVolumeM3',
      header: 'Thể tích',
      align: 'center',
      render: (v) => <span className="text-sm">{String(v)} m³</span>,
    },
    {
      key: 'phone',
      header: 'Liên hệ',
      render: (v) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Phone size={12} className="text-gray-400" /> {String(v)}
        </div>
      ),
    },
    {
      key: 'currentShiftStatus',
      header: 'Ca làm việc',
      render: (v) => <StatusBadge status={v as DriverShiftStatus} />,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-700 text-gray-900">Tài xế</h2>
          <p className="text-sm text-gray-400 mt-0.5">{drivers.length} tài xế trong hệ thống</p>
        </div>
        <button onClick={() => setShowAddDriver(true)} className="btn-primary" id="btn-add-driver">
          <Plus size={15} /> Thêm tài xế
        </button>
      </div>

      {/* Quick stats — aligned with backend: OFFLINE / ONLINE_READY / BUSY */}
      <div className="grid grid-cols-3 gap-4 stagger">
        {[
          { label: 'Sẵn sàng', key: 'ONLINE_READY', color: 'bg-green-50 text-green-700', border: 'border-green-100' },
          { label: 'Đang giao', key: 'BUSY',         color: 'bg-blue-50 text-blue-700',   border: 'border-blue-100' },
          { label: 'Offline',   key: 'OFFLINE',      color: 'bg-gray-50 text-gray-600',   border: 'border-gray-100' },
        ].map((s) => (
          <div key={s.key} className={cn('card p-4 border animate-fade-in flex items-center gap-4', s.border)}>
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-700', s.color)}>
              {drivers.filter((d) => d.currentShiftStatus === s.key).length}
            </div>
            <p className="text-sm text-gray-600 font-500">{s.label}</p>
          </div>
        ))}
      </div>

      <DataTable
        data={filteredDrivers}
        columns={columns}
        filterTabs={[
          { label: 'Tất cả',    value: 'ALL',          count: drivers.length },
          { label: 'Sẵn sàng', value: 'ONLINE_READY',  count: drivers.filter((d) => d.currentShiftStatus === 'ONLINE_READY').length },
          { label: 'Đang giao',value: 'BUSY',           count: drivers.filter((d) => d.currentShiftStatus === 'BUSY').length },
          { label: 'Offline',  value: 'OFFLINE',        count: drivers.filter((d) => d.currentShiftStatus === 'OFFLINE').length },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên, biển số, SĐT..."
        getRowKey={(row) => row.userId}
        rowActions={(row) => (
          <>
            <button className="flex items-center justify-center w-7 h-7 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors" title="Xem chi tiết">
              <Eye size={14} />
            </button>
            {/* Pencil now opens EditDriverModal — Bug #7 fix */}
            <button
              onClick={(e) => { e.stopPropagation(); setEditingDriver(row as Driver); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              title="Chỉnh sửa thông số xe"
              id={`btn-edit-driver-${(row as Driver).userId}`}
            >
              <Pencil size={14} />
            </button>
          </>
        )}
      />

      {/* Add Driver Modal */}
      {showAddDriver && (
        <AddDriverModal
          onClose={() => setShowAddDriver(false)}
          onSubmit={async (data) => {
            try {
              const user = await createUser({
                fullName: data.fullName,
                email: data.email || undefined,
                phone: data.phone,
                password: 'Password123!',
                role: 'DRIVER',
              });
              await createDriver(user.id, {
                licensePlate: data.licensePlate,
                vehicleType: data.vehicleType,
                maxWeightKg: data.maxWeightKg,
                maxVolumeM3: data.maxVolumeM3,
              });
              void loadDrivers();
              setShowAddDriver(false);
            } catch (err) {
              console.error('Lỗi tạo tài xế', err);
              alert('Lỗi tạo tài xế: ' + (err instanceof Error ? err.message : 'Vui lòng thử lại'));
            }
          }}
        />
      )}

      {/* Edit Driver Modal — Bug #7 fix */}
      {editingDriver && (
        <EditDriverModal
          driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSubmit={async (payload) => {
            try {
              // Call API to update vehicle specs (does not accept shift status)
              await updateDriverSpecs(editingDriver.userId, {
                maxWeightKg: payload.maxWeightKg,
                maxVolumeM3: payload.maxVolumeM3,
              });
              
              // Call API to update shift status
              await updateShiftStatus(editingDriver.userId, payload.currentShiftStatus);

              void loadDrivers();
              setEditingDriver(null);
            } catch (err) {
              console.error('Lỗi cập nhật tài xế', err);
              alert('Lỗi cập nhật: ' + (err instanceof Error ? err.message : 'Vui lòng thử lại'));
            }
          }}
        />
      )}
    </div>
  );
}
