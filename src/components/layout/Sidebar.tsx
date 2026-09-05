'use client';

import React, { useState } from 'react';
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
  const [showNewShipment, setShowNewShipment] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <aside className="sidebar flex flex-col bg-white border-r border-slate-100 h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#FA7070] to-[#8B2626] shrink-0 shadow-md">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-800 text-[#8B2626] leading-tight tracking-wide">IUH LOGISTICS</p>
            <p className="text-[10px] text-gray-400 font-400">SmartExpress Platform</p>
          </div>
        </div>
      </div>

      {/* New Shipment CTA */}
      <div className="px-4 pb-4 shrink-0">
        <button
          onClick={() => router.push('/orders')}
          className="btn-primary w-full justify-center text-sm"
          id="sidebar-new-shipment"
        >
          <Plus size={16} />
          Đơn hàng mới
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100 mb-3 shrink-0" />

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-0.5">
        <p className="px-2 pb-2 text-[10px] font-700 text-gray-400 uppercase tracking-widest">Menu chính</p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 transition-all relative group',
                isActive
                  ? 'bg-[#FFF0F0] text-[#FA7070] font-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FA7070] rounded-r-full" />
              )}
              <span className={cn(isActive ? 'text-[#FA7070]' : 'text-gray-400 group-hover:text-gray-600')}>
                {item.icon}
              </span>
              {item.label}
              {item.badge !== undefined && (
                <span className="ml-auto flex items-center justify-center w-5 h-5 text-[10px] font-700 bg-[#FA7070] text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 pt-3 border-t border-slate-100 space-y-0.5 shrink-0">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
        >
          <Settings size={18} className="text-gray-400" />
          Cài đặt
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
        >
          <HelpCircle size={18} className="text-gray-400" />
          Hỗ trợ
        </Link>

        {/* User pill */}
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FA7070] to-[#8B2626] flex items-center justify-center text-white text-xs font-700 shrink-0">
            {currentUser?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-600 text-gray-700 truncate">{currentUser?.fullName ?? 'Admin'}</p>
            <p className="text-[10px] text-gray-400 truncate">{currentUser?.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
