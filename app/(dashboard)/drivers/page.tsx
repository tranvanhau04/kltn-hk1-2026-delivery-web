'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Plus, Phone, Eye, Pencil, Navigation, Download } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import { CascadingRegionHubSelect } from '@/components/common/CascadingRegionHubSelect';
import type { Driver, VehicleType, DriverShiftStatus } from '@/types/domain';
import { fetchDrivers, fetchDepots, createDriverAccount, updateDriverSpecs, updateShiftStatus, type ApiDepot } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

const ImportDriversExcelModal = dynamic(
  () => import('@/components/drivers/ImportDriversExcelModal'),
  { ssr: false },
);

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

const DriverAvatarCell = React.memo(function DriverAvatarCell({ driver }: { driver: Driver }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
        {driver.fullName.charAt(0)}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">{driver.fullName}</p>
        <p className="text-xs text-slate-500">{driver.email}</p>
      </div>
    </div>
  );
});

// ─── Add Driver Modal ─────────────────────────────────────────────────────────

function AddDriverModal({ onClose, onSubmit, depots }: {
  onClose: () => void;
  onSubmit: (driver: {
    fullName: string;
    phone: string;
    email: string;
    licensePlate: string;
    vehicleType: VehicleType;
    depotId?: string;
    maxWeightKg: number;
    maxVolumeM3: number;
    currentShiftStatus: string;
  }) => void;
  depots: ApiDepot[];
}) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    licensePlate: '',
    vehicleType: 'MOTORBIKE' as VehicleType,
    depotId: depots[0]?.id || '',
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
      depotId: form.depotId || undefined,
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="driver@iuhlogistics.vn" className="input-base" id="driver-email" />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1.5">Kho trực thuộc (Hub)</label>
            <select
              value={form.depotId}
              onChange={(e) => setForm((f) => ({ ...f, depotId: e.target.value }))}
              className="input-base"
              id="driver-depot"
            >
              <option value="">-- Chưa gán kho --</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Biển số xe *</label>
          <input required value={form.licensePlate} onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value }))} placeholder="59G1-234.56" className="input-base" id="driver-plate" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">Loại phương tiện *</label>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLE_TYPES.map((vt) => (
              <button key={vt} type="button" onClick={() => handleVehicleChange(vt)} id={`vehicle-type-${vt}`}
                className={cn('px-3 py-2 rounded-md border text-xs font-medium transition-colors text-left',
                  form.vehicleType === vt ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50')}>
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

function EditDriverModal({ driver, depots, onClose, onSubmit }: {
  driver: Driver;
  depots: ApiDepot[];
  onClose: () => void;
  onSubmit: (payload: { maxWeightKg: number; maxVolumeM3: number; currentShiftStatus: DriverShiftStatus; depotId?: string }) => void;
}) {
  const [form, setForm] = useState({
    maxWeightKg: String(driver.maxWeightKg),
    maxVolumeM3: String(driver.maxVolumeM3),
    depotId: driver.depotId || driver.depot?.id || '',
    currentShiftStatus: driver.currentShiftStatus,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      maxWeightKg: parseFloat(form.maxWeightKg) || 0,
      maxVolumeM3: parseFloat(form.maxVolumeM3) || 0,
      depotId: form.depotId || undefined,
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
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Kho trực thuộc (Hub)</label>
          <select
            value={form.depotId}
            onChange={(e) => setForm((f) => ({ ...f, depotId: e.target.value }))}
            className="input-base"
            id="edit-driver-depot"
          >
            <option value="">-- Chưa gán kho --</option>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
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
          <label className="block text-xs font-medium text-slate-700 mb-2">Trạng thái ca làm việc</label>
          <div className="flex flex-col gap-2">
            {SHIFT_STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, currentShiftStatus: s }))} id={`edit-shift-${s}`}
                className={cn('px-3 py-2 rounded-md border text-xs font-medium transition-colors text-left',
                  form.currentShiftStatus === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50')}>
                {SHIFT_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Driver Detail Modal ──────────────────────────────────────────────────────

function DriverDetailModal({
  driver,
  onClose,
  onEdit,
}: {
  driver: Driver;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const depotName = driver.depot?.name || 'Chưa gán kho';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Hồ sơ tài xế — ${driver.fullName}`}
      subtitle={`Biển số: ${driver.licensePlate}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Đóng</button>
          <button
            onClick={() => {
              onClose();
              router.push('/tracking');
            }}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Navigation size={14} className="text-slate-600" />
            Giám sát trực tiếp
          </button>
          <button
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Pencil size={14} />
            Chỉnh sửa thông số
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Top Header Card */}
        <div className="flex items-center gap-3.5 p-4 bg-slate-50/80 rounded-lg border border-slate-200/80">
          <div className="w-12 h-12 rounded-md bg-slate-900 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {driver.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{driver.fullName}</h3>
              <StatusBadge status={driver.currentShiftStatus} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{driver.email || 'Chưa cập nhật email'}</p>
            <p className="text-xs font-medium text-slate-700 mt-1 flex items-center gap-1 tabular-nums">
              <Phone size={12} className="text-slate-400" />
              {driver.phone || 'Chưa có SĐT'}
            </p>
          </div>
        </div>

        {/* Vehicle and Capacity Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block mb-1">Phương tiện</span>
            <p className="text-sm font-semibold text-slate-900">{VEHICLE_TYPE_LABELS[driver.vehicleType]}</p>
            <span className="text-xs font-mono font-medium text-slate-500 mt-0.5 block">{driver.licensePlate}</span>
          </div>

          <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block mb-1">Kho trực thuộc (Depot)</span>
            <p className="text-sm font-semibold text-slate-900 truncate">{depotName}</p>
            <span className="text-xs text-slate-500 mt-0.5 block">{driver.depot?.address || 'Khu vực TP.HCM'}</span>
          </div>

          <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block mb-1">Tải trọng tối đa</span>
            <p className="text-base font-semibold text-slate-900 tabular-nums">{driver.maxWeightKg} <span className="text-xs font-normal text-slate-500">kg</span></p>
          </div>

          <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block mb-1">Thể tích thùng xe</span>
            <p className="text-base font-semibold text-slate-900 tabular-nums">{driver.maxVolumeM3} <span className="text-xs font-normal text-slate-500">m³</span></p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const toast = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [depots, setDepots] = useState<ApiDepot[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [hubFilter, setHubFilter] = useState('');
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [filter, setFilter] = useState('ALL');

  React.useEffect(() => {
    fetchDepots().then(setDepots).catch(console.error);
  }, []);

  const loadDrivers = React.useCallback(async (hubId?: string) => {
    try {
      const data = await fetchDrivers(hubId || undefined);
      setDrivers(data);
    } catch (err) {
      console.error('Failed to load drivers', err);
    }
  }, []);

  React.useEffect(() => {
    void loadDrivers(hubFilter);
  }, [loadDrivers, hubFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<DriverShiftStatus, number> = {
      ONLINE_READY: 0,
      BUSY: 0,
      OFFLINE: 0,
    };
    for (const d of drivers) {
      if (d.currentShiftStatus in counts) {
        counts[d.currentShiftStatus] += 1;
      }
    }
    return counts;
  }, [drivers]);

  const filteredDrivers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return drivers.filter((d) => {
      const matchSearch =
        !q ||
        d.fullName.toLowerCase().includes(q) ||
        d.licensePlate.toLowerCase().includes(q) ||
        d.phone.includes(q);
      const matchFilter = filter === 'ALL' || d.currentShiftStatus === filter;
      return matchSearch && matchFilter;
    });
  }, [drivers, debouncedSearch, filter]);

  const driverFilterTabs = useMemo(
    () => [
      { label: 'Tất cả',     value: 'ALL',          count: drivers.length },
      { label: 'Sẵn sàng',  value: 'ONLINE_READY', count: statusCounts.ONLINE_READY },
      { label: 'Đang giao', value: 'BUSY',         count: statusCounts.BUSY },
      { label: 'Offline',   value: 'OFFLINE',      count: statusCounts.OFFLINE },
    ],
    [drivers.length, statusCounts],
  );

  const columns = useMemo<ColumnDef<Driver>[]>(
    () => [
      {
        key: 'fullName',
        header: 'Tài xế',
        sortable: true,
        render: (_, row) => <DriverAvatarCell driver={row as Driver} />,
      },
      {
        key: 'depotId',
        header: 'Kho trực thuộc',
        render: (_, row) => {
          const d = row as Driver;
          return d.depot ? (
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50/70 border border-indigo-200/80 px-2 py-0.5 rounded">
              {d.depot.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">Chưa gán</span>
          );
        },
      },
      {
        key: 'licensePlate',
        header: 'Biển số',
        render: (v) => (
          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded">{String(v)}</span>
        ),
      },
      {
        key: 'vehicleType',
        header: 'Phương tiện',
        render: (v) => <span className="text-sm text-slate-700">{VEHICLE_TYPE_LABELS[v as VehicleType]}</span>,
      },
      {
        key: 'maxWeightKg',
        header: 'Tải trọng',
        align: 'center',
        render: (v) => <span className="text-sm text-slate-700 tabular-nums">{Number(v).toLocaleString()} kg</span>,
      },
      {
        key: 'maxVolumeM3',
        header: 'Thể tích',
        align: 'center',
        render: (v) => <span className="text-sm text-slate-700 tabular-nums">{String(v)} m³</span>,
      },
      {
        key: 'phone',
        header: 'Liên hệ',
        render: (v) => (
          <div className="flex items-center gap-1 text-sm text-slate-600 tabular-nums">
            <Phone size={12} className="text-slate-400" /> {String(v)}
          </div>
        ),
      },
      {
        key: 'currentShiftStatus',
        header: 'Ca làm việc',
        render: (v) => <StatusBadge status={v as DriverShiftStatus} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Tài xế</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{drivers.length} tài xế trong hệ thống</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <CascadingRegionHubSelect
            selectedHubId={hubFilter}
            onHubChange={(hubId) => setHubFilter(hubId)}
            allowAllRegions
            allowAllHubs
            size="sm"
          />
          <button
            onClick={() => setShowImportExcel(true)}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-medium h-8 px-3 transition-colors"
            id="btn-import-drivers-excel"
          >
            <Download size={14} /> Nhập Excel
          </button>
          <button onClick={() => setShowAddDriver(true)} className="btn-primary text-xs h-8 px-3" id="btn-add-driver">
            <Plus size={14} /> Thêm tài xế
          </button>
        </div>
      </div>

      {/* Quick stats — aligned with backend: OFFLINE / ONLINE_READY / BUSY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        {[
          { label: 'Sẵn sàng', key: 'ONLINE_READY' as const, dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Đang giao', key: 'BUSY' as const,         dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700 border-sky-200' },
          { label: 'Offline',   key: 'OFFLINE' as const,      dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-700 border-slate-200' },
        ].map((s) => (
          <div key={s.key} className="card p-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className={cn('w-2 h-2 rounded-full', s.dot)} />
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">{s.label}</p>
            </div>
            <div className={cn('px-2.5 py-1 rounded border text-lg font-semibold tabular-nums', s.badge)}>
              {statusCounts[s.key]}
            </div>
          </div>
        ))}
      </div>

      <DataTable
        data={filteredDrivers}
        columns={columns}
        filterTabs={driverFilterTabs}
        activeFilter={filter}
        onFilterChange={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên, biển số, SĐT..."
        getRowKey={(row) => row.userId}
        onRowClick={(row) => setSelectedDriver(row as Driver)}
        rowActions={(row) => (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedDriver(row as Driver); }}
              className="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Xem chi tiết"
              id={`btn-view-driver-${(row as Driver).userId}`}
            >
              <Eye size={14} />
            </button>
            {/* Pencil now opens EditDriverModal — Bug #7 fix */}
            <button
              onClick={(e) => { e.stopPropagation(); setEditingDriver(row as Driver); }}
              className="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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
          depots={depots}
          onClose={() => setShowAddDriver(false)}
          onSubmit={async (data) => {
            try {
              await createDriverAccount({
                fullName: data.fullName,
                email: data.email || undefined,
                phone: data.phone,
                password: 'Password123!',
                licensePlate: data.licensePlate,
                vehicleType: data.vehicleType,
                depotId: data.depotId,
                maxWeightKg: data.maxWeightKg,
                maxVolumeM3: data.maxVolumeM3,
              });
              void loadDrivers(hubFilter);
              setShowAddDriver(false);
              toast.success('Thêm tài xế thành công!', `Tài xế ${data.fullName} (${data.licensePlate}) đã sẵn sàng.`);
            } catch (err) {
              console.error('Lỗi tạo tài xế', err);
              toast.error('Lỗi tạo tài xế', err instanceof Error ? err.message : 'Vui lòng thử lại');
            }
          }}
        />
      )}

      {/* Edit Driver Modal — Bug #7 fix */}
      {editingDriver && (
        <EditDriverModal
          driver={editingDriver}
          depots={depots}
          onClose={() => setEditingDriver(null)}
          onSubmit={async (payload) => {
            try {
              // Call API to update vehicle specs and depot assignment
              await updateDriverSpecs(editingDriver.userId, {
                maxWeightKg: payload.maxWeightKg,
                maxVolumeM3: payload.maxVolumeM3,
                depotId: payload.depotId,
              });
              
              // Call API to update shift status
              await updateShiftStatus(editingDriver.userId, payload.currentShiftStatus);

              void loadDrivers(hubFilter);
              setEditingDriver(null);
              toast.success('Cập nhật thành công!', `Đã lưu thông số xe của ${editingDriver.fullName}.`);
            } catch (err) {
              console.error('Lỗi cập nhật tài xế', err);
              toast.error('Lỗi cập nhật', err instanceof Error ? err.message : 'Vui lòng thử lại');
            }
          }}
        />
      )}

      {/* Driver Detail Modal */}
      {selectedDriver && (
        <DriverDetailModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onEdit={() => {
            const target = selectedDriver;
            setSelectedDriver(null);
            setEditingDriver(target);
          }}
        />
      )}

      {/* Import Drivers Excel Modal */}
      {showImportExcel && (
        <ImportDriversExcelModal
          onClose={() => setShowImportExcel(false)}
          onSuccess={() => {
            void loadDrivers(hubFilter);
          }}
        />
      )}
    </div>
  );
}
