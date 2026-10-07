'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useApp } from '@/context/AppContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-red-600 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Đang tải...</p>
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
