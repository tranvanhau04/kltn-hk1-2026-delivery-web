'use client';

import React from 'react';
import { Smartphone, LogOut, ShieldAlert } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, currentUser, logout } = useApp();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin-slow" />
          <p className="text-xs font-medium text-slate-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Block Driver role from accessing Web Admin monitoring pages
  if (currentUser?.role === 'DRIVER') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="max-w-md w-full bg-white rounded-lg p-8 border border-slate-200/80 shadow-xs flex flex-col items-center text-center animate-fade-in">
          <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mb-4">
            <Smartphone size={24} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-medium mb-3 border border-amber-200">
            <ShieldAlert size={13} />
            Tài khoản Tài xế
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Tài khoản Tài xế chỉ sử dụng trên ứng dụng SmartExpress Mobile App
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Hệ thống Web Admin này dành riêng cho <strong>Quản trị viên</strong> và{' '}
            <strong>Điều phối viên</strong>. Vui lòng đăng nhập trên ứng dụng{' '}
            <strong>SmartExpress Driver Mobile App</strong> để nhận chuyến và giao hàng.
          </p>
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="btn-primary w-full justify-center text-sm bg-slate-900 hover:bg-slate-800"
            id="btn-admin-driver-logout"
          >
            <LogOut size={15} /> Đăng xuất & Đổi tài khoản
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout bg-[#F8FAFC]">
      <Sidebar />
      <Header />
      <main className="main-content bg-[#F8FAFC] p-6">{children}</main>
    </div>
  );
}
