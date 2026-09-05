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
    <header className="header flex items-center gap-4 px-6 bg-white border-b border-slate-100 z-30">
      {/* Title & Breadcrumb */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-700 text-gray-900 leading-tight truncate">{pageInfo.title}</h1>
        <nav className="flex items-center gap-1 mt-0.5">
          {pageInfo.breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-gray-300 text-xs">/</span>}
              <span className={cn(
                'text-xs',
                i === pageInfo.breadcrumb.length - 1 ? 'text-[#FA7070] font-500' : 'text-gray-400'
              )}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Global Search */}
      <div className="relative hidden md:flex items-center w-60">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm đơn hàng, tài xế..."
          className="input-base pl-10 h-9 text-sm w-full"
          id="header-global-search"
        />
      </div>

      {/* Notifications */}
      <div ref={notifsRef} className="relative">
        <button
          id="header-notifications"
          onClick={() => { setShowNotifs((v) => !v); setShowProfile(false); }}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[9px] font-700 bg-[#FA7070] text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden animate-scale-in z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-600 text-gray-900">Thông báo</p>
                <p className="text-xs text-gray-400">{unreadCount} chưa đọc</p>
              </div>
              <button
                onClick={() => { markAllRead(); }}
                className="flex items-center gap-1 text-xs text-[#FA7070] font-500 hover:underline"
              >
                <Check size={12} /> Đánh dấu đã đọc
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer',
                    !n.read ? 'bg-[#FFF0F0]/30' : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5', NOTIF_COLORS[n.type])}>
                    {NOTIF_ICONS[n.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-500 text-gray-700 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-[#FA7070] shrink-0 mt-1.5" />}
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
        className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Settings size={18} />
      </button>

      {/* Profile dropdown */}
      <div ref={profileRef} className="relative">
        <button
          id="header-profile"
          onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FA7070] to-[#8B2626] flex items-center justify-center text-white text-xs font-700 shrink-0">
            {currentUser?.fullName?.charAt(0) ?? 'A'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-600 text-gray-800 leading-tight">{currentUser?.fullName ?? 'Admin'}</p>
            <p className="text-[10px] text-gray-400">{currentUser?.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối'}</p>
          </div>
          <ChevronDown size={14} className="text-gray-400 ml-1" />
        </button>

        {showProfile && (
          <div className="absolute right-0 top-11 w-48 bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden animate-scale-in z-50 py-1.5">
            <button
              onClick={() => { router.push('/settings'); setShowProfile(false); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Settings size={15} /> Cài đặt tài khoản
            </button>
            <div className="border-t border-slate-100 mx-2 my-1" />
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
