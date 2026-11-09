'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import type { UserRole } from '@/types/domain';
import { ShieldAlert, Loader2 } from 'lucide-react';

/**
 * HOC to enforce role-based route protection on pages / workspaces.
 * For example: only ADMIN or DISPATCHER can access the /vrp workspace.
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: UserRole[] = ['ADMIN', 'DISPATCHER'],
  redirectPath = '/dashboard'
) {
  return function ProtectedRoute(props: P) {
    const { currentUser, isAuthenticated, isLoading } = useApp();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
      setIsMounted(true);
    }, []);

    const userRole = currentUser?.role;
    const isAuthorized = userRole ? allowedRoles.includes(userRole) : false;

    useEffect(() => {
      if (isMounted && !isLoading && isAuthenticated && currentUser && !isAuthorized) {
        const timer = setTimeout(() => {
          router.replace(redirectPath);
        }, 2200);
        return () => clearTimeout(timer);
      }
    }, [isMounted, isLoading, isAuthenticated, currentUser, isAuthorized, router]);

    // If still hydrating or checking session
    if (!isMounted || isLoading || !isAuthenticated) {
      return (
        <div className="min-h-[500px] flex items-center justify-center bg-canvas">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#FA7070]" />
            <p className="text-sm font-medium text-gray-500">Đang xác thực thông tin...</p>
          </div>
        </div>
      );
    }

    // Role check failure: render Access Denied guard screen
    if (!isAuthorized) {
      return (
        <div className="min-h-[500px] flex items-center justify-center p-6 animate-fade-in">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-rose-100 shadow-xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 shadow-xs">
              <ShieldAlert size={36} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Quyền truy cập bị từ chối</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Khu vực điều phối tuyến đường VRP yêu cầu vai trò{' '}
              <span className="font-semibold text-gray-800">
                {allowedRoles.join(' hoặc ')}
              </span>
              . Vai trò hiện tại của bạn ({userRole || 'DRIVER'}) không được phép thao tác.
            </p>
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg mb-6">
              <Loader2 size={13} className="animate-spin" />
              <span>Đang tự động chuyển hướng về Dashboard...</span>
            </div>
            <button
              onClick={() => router.replace(redirectPath)}
              className="btn-primary text-sm w-full bg-gray-900 hover:bg-gray-800"
            >
              Quay lại Bảng điều khiển
            </button>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
