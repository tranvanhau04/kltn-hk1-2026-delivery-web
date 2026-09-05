'use client';

import React, { useState } from 'react';
import { Plus, Mail, Phone, Shield, UserCheck, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import { mockUsers } from '@/lib/mock-data';
import type { User, UserRole } from '@/types/domain';
import { formatDateTime, cn } from '@/lib/utils';

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  ADMIN:      { label: 'Quản trị viên', className: 'badge badge-failed' },
  DISPATCHER: { label: 'Điều phối',     className: 'badge badge-assigned' },
};

function InviteUserModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (u: Partial<User>) => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'DISPATCHER' as UserRole });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, status: 'ACTIVE', createdAt: new Date().toISOString() });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Mời người dùng mới"
      subtitle="Gửi lời mời qua email"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button form="invite-user-form" type="submit" className="btn-primary">
            <Mail size={15} /> Gửi lời mời
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
          <label className="block text-sm font-500 text-gray-700 mb-2">Vai trò *</label>
          <div className="grid grid-cols-2 gap-2">
            {(['ADMIN', 'DISPATCHER'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role }))}
                className={cn(
                  'px-3 py-2.5 rounded-xl border text-sm font-500 transition-all flex items-center gap-2',
                  form.role === role
                    ? 'border-[#FA7070] bg-[#FFF0F0] text-[#FA7070]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
                id={`role-${role}`}
              >
                {role === 'ADMIN' ? <Shield size={15} /> : <UserCheck size={15} />}
                {ROLE_CONFIG[role].label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const filteredUsers = users.filter((u) => {
    const matchSearch = !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || u.role === filter;
    return matchSearch && matchFilter;
  });

  const columns: ColumnDef<User>[] = [
    {
      key: 'fullName',
      header: 'Người dùng',
      sortable: true,
      render: (v, row) => {
        const u = row as User;
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center text-violet-700 font-700 text-sm shrink-0">
              {u.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-600 text-gray-800">{u.fullName}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
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
        <span className="text-sm text-gray-600 flex items-center gap-1">
          <Phone size={12} className="text-gray-400" /> {String(v)}
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
      render: (v) => <span className="text-xs text-gray-400">{formatDateTime(String(v))}</span>,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-700 text-gray-900">Người dùng hệ thống</h2>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} người dùng</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary" id="btn-invite-user">
          <Plus size={15} /> Mời người dùng
        </button>
      </div>

      {/* Role stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { role: 'ADMIN', label: 'Quản trị viên', icon: <Shield size={18} />, color: 'bg-red-50 text-red-600' },
          { role: 'DISPATCHER', label: 'Điều phối', icon: <UserCheck size={18} />, color: 'bg-violet-50 text-violet-600' },
        ].map((r) => (
          <div key={r.role} className="card p-4 flex items-center gap-4 animate-fade-in">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', r.color)}>
              {r.icon}
            </div>
            <div>
              <p className="text-2xl font-700 text-gray-900">
                {users.filter((u) => u.role === r.role).length}
              </p>
              <p className="text-xs text-gray-500">{r.label}</p>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns}
        filterTabs={[
          { label: 'Tất cả', value: 'ALL', count: users.length },
          { label: 'Quản trị viên', value: 'ADMIN', count: users.filter((u) => u.role === 'ADMIN').length },
          { label: 'Điều phối', value: 'DISPATCHER', count: users.filter((u) => u.role === 'DISPATCHER').length },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên, email..."
        getRowKey={(row) => row.id}
        rowActions={() => (
          <>
            <button className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <Pencil size={14} />
            </button>
          </>
        )}
      />

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSubmit={(data) => {
            const newUser: User = {
              id: `u${Date.now()}`,
              fullName: data.fullName ?? '',
              email: data.email ?? '',
              phone: data.phone ?? '',
              passwordHash: '',
              role: data.role ?? 'DISPATCHER',
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
            };
            setUsers((prev) => [newUser, ...prev]);
            setShowInvite(false);
          }}
        />
      )}
    </div>
  );
}
