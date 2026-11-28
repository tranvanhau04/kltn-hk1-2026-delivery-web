'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Plus, Mail, Phone, Shield, UserCheck, Pencil, Truck, Lock, Download } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import { fetchUsers, createUser, updateUserStatus, forgotPassword } from '@/lib/api';
import type { User, UserRole } from '@/types/domain';
import { useToast } from '@/context/ToastContext';
import { useApp } from '@/context/AppContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime, cn } from '@/lib/utils';
import { withRoleGuard } from '@/components/auth/withRoleGuard';

const ImportUsersExcelModal = dynamic(
  () => import('@/components/users/ImportUsersExcelModal'),
  { ssr: false },
);

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  ADMIN:      { label: 'Quản trị viên', className: 'badge badge-failed' },
  DISPATCHER: { label: 'Điều phối',     className: 'badge badge-assigned' },
  DRIVER:     { label: 'Tài xế',        className: 'badge badge-delivered' },
};

function InviteUserModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (u: { fullName: string; email: string; phone: string; role: UserRole }) => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'DISPATCHER' as UserRole });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Tạo tài khoản mới"
      subtitle="Người dùng sẽ nhận được email để thiết lập mật khẩu"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button form="invite-user-form" type="submit" className="btn-primary">
            <UserCheck size={15} /> Tạo tài khoản
          </button>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Họ tên *</label>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Nguyễn Văn A"
            className="input-base"
            id="user-fullname"
          />
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="user@iuhlogistics.vn"
            className="input-base"
            id="user-email"
          />
        </div>
        <div>
          <label className="block text-sm font-500 text-gray-700 mb-1.5">Số điện thoại</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="0901234567"
            className="input-base"
            id="user-phone"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">Vai trò *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['ADMIN', 'DISPATCHER', 'DRIVER'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role }))}
                className={cn(
                  'px-3 py-2 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5',
                  form.role === role
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                )}
                id={`role-${role}`}
              >
                {role === 'ADMIN' ? <Shield size={14} /> : role === 'DISPATCHER' ? <UserCheck size={14} /> : <Truck size={14} />}
                {ROLE_CONFIG[role].label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function UsersPage() {
  const toast = useToast();
  const { currentUser } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showInvite, setShowInvite] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadUsers = React.useCallback(async () => {
    if (currentUser && currentUser.role !== 'ADMIN') return;
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to load users', error);
      toast.error('Lỗi kết nối máy chủ', 'Không thể tải danh sách người dùng. Vui lòng kiểm tra lại backend.');
    } finally {
      setLoading(false);
    }
  }, [toast, currentUser]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const roleCounts = useMemo(() => {
    const counts: Record<UserRole, number> = {
      ADMIN: 0,
      DISPATCHER: 0,
      DRIVER: 0,
    };
    for (const u of users) {
      if (u.role in counts) {
        counts[u.role] += 1;
      }
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q));
      const matchFilter = filter === 'ALL' || u.role === filter;
      return matchSearch && matchFilter;
    });
  }, [users, debouncedSearch, filter]);

  const userFilterTabs = useMemo(
    () => [
      { label: 'Tất cả',        value: 'ALL',        count: users.length },
      { label: 'Quản trị viên', value: 'ADMIN',      count: roleCounts.ADMIN },
      { label: 'Điều phối',     value: 'DISPATCHER', count: roleCounts.DISPATCHER },
      { label: 'Tài xế',        value: 'DRIVER',     count: roleCounts.DRIVER },
    ],
    [users.length, roleCounts],
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        key: 'fullName',
        header: 'Người dùng',
        sortable: true,
        render: (_v, row) => {
          const u = row as User;
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                {u.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{u.fullName}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Mail size={11} /> {u.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        key: 'phone',
        header: 'Điện thoại',
        render: (v) => (
          <span className="text-sm text-slate-600 flex items-center gap-1 tabular-nums">
            <Phone size={12} className="text-slate-400" /> {String(v)}
          </span>
        ),
      },
      {
        key: 'role',
        header: 'Vai trò',
        render: (v) => {
          const conf = ROLE_CONFIG[v as UserRole];
          return <span className={conf.className}>{conf.label}</span>;
        },
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (v) => <StatusBadge status={v as 'ACTIVE' | 'INACTIVE'} />,
      },
      {
        key: 'createdAt',
        header: 'Ngày tham gia',
        sortable: true,
        render: (v) => <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(String(v))}</span>,
      },
    ],
    [],
  );

  // Role Guard: Only ADMIN can view and manage users
  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center card bg-white space-y-4 my-8">
        <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 text-[#D92D20] flex items-center justify-center">
          <Lock size={22} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">Quyền truy cập bị từ chối (403 Forbidden)</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Tài khoản của bạn hiện tại có vai trò <span className="font-semibold text-slate-700">{currentUser.role === 'DISPATCHER' ? 'Điều phối viên (Dispatcher)' : currentUser.role}</span>. Phân hệ Quản lý người dùng hệ thống chỉ được cấp quyền cho Quản trị viên (ADMIN).
          </p>
        </div>
        <Link href="/dashboard" className="btn-primary text-xs">
          Quay lại Bảng điều khiển
        </Link>
      </div>
    );
  }

  const toggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateUserStatus(user.id, newStatus);
      void loadUsers();
      toast.success('Cập nhật trạng thái', `Đã chuyển tài khoản ${user.fullName} sang ${newStatus === 'ACTIVE' ? 'Hoạt động' : 'Khóa'}.`);
    } catch (error) {
      console.error('Failed to update user status', error);
      toast.error('Lỗi cập nhật', 'Không thể thay đổi trạng thái người dùng.');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Người dùng hệ thống</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{users.length} người dùng</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => setShowImportExcel(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-medium h-8 px-3 transition-colors"
              id="btn-import-users-excel"
            >
              <Download size={14} /> Nhập Excel
            </button>
          )}
          <button onClick={() => setShowInvite(true)} className="btn-primary text-xs h-8 px-3" id="btn-invite-user">
            <Plus size={14} /> Mời người dùng
          </button>
        </div>
      </div>

      {/* Role stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { role: 'ADMIN' as const, label: 'Quản trị viên', icon: <Shield size={16} />, color: 'bg-red-50 text-[#D92D20] border-red-200/80' },
          { role: 'DISPATCHER' as const, label: 'Điều phối', icon: <UserCheck size={16} />, color: 'bg-indigo-50 text-indigo-600 border-indigo-200/80' },
          { role: 'DRIVER' as const, label: 'Tài xế', icon: <Truck size={16} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-200/80' },
        ].map((r) => (
          <div key={r.role} className="card p-4 flex items-center gap-3.5 animate-fade-in">
            <div className={cn('w-9 h-9 rounded-md border flex items-center justify-center', r.color)}>
              {r.icon}
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900 tabular-nums">
                {loading ? '...' : roleCounts[r.role]}
              </p>
              <p className="text-xs text-slate-500">{r.label}</p>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns}
        loading={loading}
        filterTabs={userFilterTabs}
        activeFilter={filter}
        onFilterChange={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên, email..."
        getRowKey={(row) => row.id}
        rowActions={(row) => (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); toggleUserStatus(row); }}
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md transition-colors',
                row.status === 'ACTIVE' ? 'text-[#D92D20] hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
              )}
              title={row.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            >
              {row.status === 'ACTIVE' ? <Shield size={14} /> : <UserCheck size={14} />}
            </button>
            <button className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
              <Pencil size={14} />
            </button>
          </>
        )}
      />

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSubmit={async (data) => {
            try {
              // 1. Tạo tài khoản với mật khẩu tạm
              const randomTempPassword = `P@ss${Date.now()}`;
              await createUser({
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                role: data.role,
                password: randomTempPassword,
              });
              
              // 2. Tự động gửi email reset password để người dùng tự thiết lập
              if (data.email) {
                await forgotPassword(data.email);
              }
              
              void loadUsers();
              setShowInvite(false);
              toast.success('Tạo tài khoản thành công!', `Đã tạo tài khoản cho ${data.fullName} và gửi email kích hoạt.`);
            } catch (err) {
              console.error('Lỗi tạo user', err);
              toast.error('Lỗi tạo tài khoản', err instanceof Error ? err.message : 'Vui lòng kiểm tra lại thông tin.');
            }
          }}
        />
      )}

      {showImportExcel && currentUser?.role === 'ADMIN' && (
        <ImportUsersExcelModal
          onClose={() => setShowImportExcel(false)}
          onSuccess={() => {
            void loadUsers();
          }}
        />
      )}
    </div>
  );
}

export default withRoleGuard(UsersPage, ['ADMIN']);
