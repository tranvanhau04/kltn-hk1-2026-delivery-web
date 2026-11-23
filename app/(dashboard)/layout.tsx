'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, LogOut, ShieldAlert } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useApp } from '@/context/AppContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, currentUser, logout } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#FA7070] border-t-transparent animate-spin-slow" />
          <p className="text-sm text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Intercept Driver role: Drivers cannot access Web Admin dispatching dashboards
  if (currentUser?.role === 'DRIVER') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl flex flex-col items-center text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 shadow-xs">
            <Smartphone size={36} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 text-amber-800 text-xs font-semibold mb-3 border border-amber-200">
            <ShieldAlert size={14} />
            Tài khoản Tài xế
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Tài khoản Tài xế chỉ sử dụng trên ứng dụng SmartExpress Mobile App
          </h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Hệ thống Web Admin này dành riêng cho <strong>Quản trị viên</strong> và <strong>Điều phối viên</strong>. Tài xế không có quyền truy cập vào các trang quản trị vận hành trên web. Vui lòng mở và đăng nhập trên ứng dụng <strong>SmartExpress Driver Mobile App</strong> để nhận chuyến, xem đơn và giao hàng.
          </p>

          <div className="w-full space-y-3">
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="btn-primary w-full justify-center text-sm py-2.5 bg-gray-900 hover:bg-gray-800"
              id="btn-driver-logout"
            >
              <LogOut size={16} /> Đăng xuất & Đổi tài khoản
            </button>
            <p className="text-[11px] text-gray-400">
              💡 Hãy đăng nhập với Admin (admin@smartexpress.vn) hoặc Điều phối (dieupoi01@smartexpress.vn) để quản trị.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <Header />
      <main className="main-content bg-canvas p-6">
        {children}
      </main>
    </div>
  );
}
