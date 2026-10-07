'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, Bell, Settings, ChevronDown, Check,
  Package, Truck, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { formatTime } from '@/lib/utils';

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  '/dashboard':  { title: 'Tổng quan',              breadcrumb: ['Trang chủ'] },
  '/orders':     { title: 'Quản lý đơn hàng',       breadcrumb: ['Trang chủ', 'Đơn hàng'] },
  '/drivers':    { title: 'Quản lý tài xế',         breadcrumb: ['Trang chủ', 'Tài xế'] },
  '/users':      { title: 'Quản lý người dùng',     breadcrumb: ['Trang chủ', 'Người dùng'] },
  '/vrp':        { title: 'Tối ưu hóa tuyến đường', breadcrumb: ['Trang chủ', 'VRP'] },
  '/tracking':   { title: 'Theo dõi thực time',     breadcrumb: ['Trang chủ', 'Tracking'] },
  '/reports':    { title: 'Báo cáo & Thống kê',    breadcrumb: ['Trang chủ', 'Báo cáo'] },
  '/zones':      { title: 'Quản lý khu vực',        breadcrumb: ['Trang chủ', 'Khu vực'] },
  '/settings':   { title: 'Cài đặt hệ thống',       breadcrumb: ['Trang chủ', 'Cài đặt'] },
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  info:    <Package size={14} />,
  success: <CheckCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  error:   <Truck size={14} />,
};

const NOTIF_COLORS: Record<string, string> = {
  info:    'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-600',
  error:   'bg-red-50 text-red-600',
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, currentUser, logout } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState('');
  const notifsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const pageInfo = PAGE_TITLES[pathname] ?? { title: 'Dashboard', breadcrumb: ['Trang chủ'] };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="header flex items-center gap-4 px-6 bg-white border-b border-slate-200 z-30">
      {/* Title & Breadcrumb */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Trang chủ</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium truncate">{pageInfo.title}</span>
        </div>
        <h1 className="text-base font-semibold text-slate-900 leading-tight truncate mt-0.5">{pageInfo.title}</h1>
      </div>

      {/* Global Search */}
      <div className="relative hidden md:flex items-center w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm đơn hàng, tài xế..."
          className="input-base pl-8.5 h-8.5 text-xs w-full bg-slate-50/60 hover:bg-white focus:bg-white transition-colors"
          id="header-global-search"
        />
      </div>

      {/* Notifications */}
      <div ref={notifsRef} className="relative">
        <button
          id="header-notifications"
          onClick={() => { setShowNotifs((v) => !v); setShowProfile(false); }}
          className="relative flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center px-1 min-w-3.5 h-3.5 text-[9px] font-semibold bg-red-600 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-10 w-80 bg-white rounded-lg shadow-dropdown border border-slate-200 overflow-hidden animate-scale-in z-50">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-900">Thông báo</p>
                <p className="text-[11px] text-slate-400">{unreadCount} chưa đọc</p>
              </div>
              <button
                onClick={() => { markAllRead(); }}
                className="flex items-center gap-1 text-xs text-red-600 font-medium hover:underline"
              >
                <Check size={12} /> Đánh dấu đã đọc
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-2.5 px-3.5 py-2.5 transition-colors cursor-pointer',
                    !n.read ? 'bg-red-50/40' : 'hover:bg-slate-50'
                  )}
                >
                  <div className={cn('flex items-center justify-center w-6 h-6 rounded shrink-0 mt-0.5', NOTIF_COLORS[n.type])}>
                    {NOTIF_ICONS[n.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 mt-1.5" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <button
        id="header-settings"
        onClick={() => router.push('/settings')}
        className="flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
      >
        <Settings size={16} />
      </button>

      {/* Profile dropdown */}
      <div ref={profileRef} className="relative">
        <button
          id="header-profile"
          onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
          className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {currentUser?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-slate-900 leading-tight">{currentUser?.fullName ?? 'Admin'}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{currentUser?.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối'}</p>
          </div>
          <ChevronDown size={13} className="text-slate-400 ml-0.5" />
        </button>

        {showProfile && (
          <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-dropdown border border-slate-200 overflow-hidden animate-scale-in z-50 py-1">
            <button
              onClick={() => { router.push('/settings'); setShowProfile(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings size={14} className="text-slate-400" />
              <span>Cài đặt tài khoản</span>
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
