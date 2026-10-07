'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Truck, Users, Map,
  BarChart2, Route, Navigation, Settings, HelpCircle,
  LogOut, Plus, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Tổng quan', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Đơn hàng', href: '/orders', icon: <Package size={18} /> },
  { label: 'Tài xế', href: '/drivers', icon: <Truck size={18} /> },
  { label: 'Người dùng', href: '/users', icon: <Users size={18} /> },
  { label: 'VRP / Tối ưu tuyến', href: '/vrp', icon: <Route size={18} /> },
  { label: 'Theo dõi thực time', href: '/tracking', icon: <Navigation size={18} /> },
  { label: 'Báo cáo', href: '/reports', icon: <BarChart2 size={18} /> },
  { label: 'Khu vực', href: '/zones', icon: <Map size={18} /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, currentUser } = useApp();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <aside className="sidebar flex flex-col bg-white border-r border-slate-200 h-full overflow-hidden">
      {/* Brand */}
      <div className="px-4 pt-4 pb-3.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-600 shrink-0 shadow-xs">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 tracking-wider leading-none">IUH LOGISTICS</p>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight mt-1">SmartExpress Platform</p>
          </div>
        </div>
      </div>

      {/* New Shipment CTA */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={() => router.push('/orders')}
          className="btn-primary w-full justify-center text-xs font-medium h-8.5 rounded-md"
          id="sidebar-new-shipment"
        >
          <Plus size={14} />
          Đơn hàng mới
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-200 mb-2 shrink-0" />

      {/* Nav */}
      <nav className="flex-1 px-2.5 overflow-y-auto space-y-0.5">
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Menu chính</p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors relative group',
                isActive
                  ? 'bg-red-50 text-red-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <span className={cn(isActive ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-600')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto flex items-center justify-center px-1.5 min-w-4 h-4 text-[10px] font-semibold bg-red-600 text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2.5 pb-3.5 pt-2 border-t border-slate-200 space-y-0.5 shrink-0">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <Settings size={15} className="text-slate-400" />
          <span>Cài đặt</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <HelpCircle size={15} className="text-slate-400" />
          <span>Hỗ trợ</span>
        </Link>

        {/* User profile row */}
        <div className="mt-2 flex items-center gap-2 p-1.5 rounded-md border border-slate-200 bg-slate-50/70">
          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {currentUser?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate leading-tight">{currentUser?.fullName ?? 'Admin'}</p>
            <p className="text-[10px] text-slate-400 truncate">{currentUser?.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
