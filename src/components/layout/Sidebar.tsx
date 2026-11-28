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

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/users') {
      return currentUser?.role === 'ADMIN';
    }
    return true;
  });

  return (
    <aside className="sidebar flex flex-col bg-white border-r border-slate-200 h-full overflow-hidden">
      {/* Brand */}
      <div className="h-14 px-4 flex items-center border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-900 shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 leading-tight tracking-tight">IUH LOGISTICS</p>
            <p className="text-[11px] text-slate-500 font-normal">SmartExpress Enterprise</p>
          </div>
        </div>
      </div>

      {/* New Shipment CTA */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={() => router.push('/orders')}
          className="w-full h-9 px-3 inline-flex items-center justify-center gap-2 rounded-md bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
          id="sidebar-new-shipment"
        >
          <Plus size={15} />
          Đơn hàng mới
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Điều hành</p>
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors relative group',
                isActive
                  ? 'bg-slate-100 text-slate-900 font-medium border-l-2 border-[#D92D20] rounded-l-none'
                  : 'text-slate-600 font-normal hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <span className={cn(isActive ? 'text-[#D92D20]' : 'text-slate-400 group-hover:text-slate-600')}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-semibold tabular-nums bg-slate-900 text-white rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 pt-2.5 border-t border-slate-200 space-y-0.5 shrink-0">
        {currentUser?.role === 'ADMIN' && (
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors',
              pathname === '/settings'
                ? 'bg-slate-100 text-slate-900 font-medium border-l-2 border-[#D92D20] rounded-l-none'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Settings size={17} className={pathname === '/settings' ? 'text-[#D92D20]' : 'text-slate-400'} />
            Cài đặt
          </Link>
        )}
        <Link
          href="/support"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors',
            pathname === '/support'
              ? 'bg-slate-100 text-slate-900 font-medium border-l-2 border-[#D92D20] rounded-l-none'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          <HelpCircle size={17} className={pathname === '/support' ? 'text-[#D92D20]' : 'text-slate-400'} />
          Hỗ trợ
        </Link>

        {/* User row */}
        <div className="mt-2 flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-slate-50 border border-slate-200/80">
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {currentUser?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{currentUser?.fullName ?? 'Admin'}</p>
            <p className="text-[11px] text-slate-500 truncate">{currentUser?.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-[#D92D20] hover:bg-red-50 transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
