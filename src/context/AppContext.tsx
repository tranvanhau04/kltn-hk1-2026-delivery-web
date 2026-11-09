'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, Order } from '@/types/domain';
import { updateOrderStatusApi } from '@/lib/api';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

interface AppContextValue {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Orders
  orders: Order[];
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<boolean>;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;

  // VRP Selection
  selectedOrderIds: string[];
  toggleOrderSelection: (orderId: string) => void;
  clearSelection: () => void;
  setSelectedOrderIds: (ids: string[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'n1',
      message: 'Tài xế Ngô Văn Tài đã hoàn thành tuyến RT-GVA-01 (10/10 đơn hàng)',
      type: 'success',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'n2',
      message: 'Đơn hàng ORD-20261109-042 bị giao thất bại: Khách hàng hẹn lại ca chiều',
      type: 'warning',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'n3',
      message: 'Tối ưu hóa VRP thành công: 35 đơn hàng mới đã được phân tuyến cho 4 tài xế Hub Gò Vấp',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: 'n4',
      message: 'Cảnh báo quá tải: Khu vực Bình Thạnh đạt 118% tải trọng tối đa của đội xe',
      type: 'error',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 105).toISOString(),
    },
    {
      id: 'n5',
      message: 'Tài xế Phạm Hoàng Nam đã bắt đầu ca làm việc tại Hub 02 - Bình Thạnh',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    },
    {
      id: 'n6',
      message: 'Đối soát COD hoàn tất: 14.850.000đ đã được nộp cho Điều phối viên Lê Thu Hà',
      type: 'success',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    },
    {
      id: 'n7',
      message: 'Đơn hàng hỏa tốc ORD-20261109-001 vừa được tạo tại Quận 1 - Cần gán ngay',
      type: 'warning',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    },
    {
      id: 'n8',
      message: 'Tài xế Vũ Quốc Bảo (Xe Van 500kg) đã rời kho Bến Thành với 18 kiện hàng cồng kềnh',
      type: 'info',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    },
    {
      id: 'n9',
      message: 'Hệ thống tự động cân bằng tải VRP giữa Hub 01 (Gò Vấp) và Hub 05 (Tân Bình)',
      type: 'info',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    },
    {
      id: 'n10',
      message: 'Báo cáo doanh thu & KPI tuần 45 đã sẵn sàng xuất ra định dạng Excel',
      type: 'success',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    },
    {
      id: 'n11',
      message: 'Tài xế Bùi Anh Tuấn đã cập nhật vị trí GPS realtime trên bản đồ',
      type: 'info',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    },
    {
      id: 'n12',
      message: 'Đơn hàng ORD-20261108-015 xác nhận POD ảnh chụp giao thành công 1.200.000đ COD',
      type: 'success',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 750).toISOString(),
    },
    {
      id: 'n13',
      message: 'Cảnh báo pin yếu: Thiết bị tài xế Đỗ Thành Đạt còn dưới 15%',
      type: 'warning',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
    },
    {
      id: 'n14',
      message: 'Tài xế Lý Quốc Trọng đã hoàn thành giao hàng toàn tuyến xe tải 1.5 Tấn',
      type: 'success',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 1100).toISOString(),
    },
    {
      id: 'n15',
      message: 'Đơn hàng ORD-20261108-099 hủy bởi người gửi trước khi xuất kho',
      type: 'error',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 1300).toISOString(),
    },
    {
      id: 'n16',
      message: 'Hệ thống SmartExpress vừa hoàn tất đồng bộ hóa cơ sở dữ liệu quy mô lớn',
      type: 'info',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 1500).toISOString(),
    },
  ]);

  // Helper to persist auth in cookies & localStorage
  const persistAuth = (token: string, user: User, refreshToken?: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', token);
    localStorage.setItem('iuh_user', JSON.stringify(user));
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    // Save cookies so SSR, middleware, and Leaflet maps can access token
    document.cookie = `accessToken=${token}; path=/; max-age=604800; SameSite=Lax`;
    document.cookie = `iuh_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800; SameSite=Lax`;
  };

  const clearAuth = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('iuh_user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'iuh_user=; path=/; max-age=0; SameSite=Lax';
  };

  // Restore session on initial mount
  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }

        let token = localStorage.getItem('accessToken');
        let savedUser = localStorage.getItem('iuh_user');

        // Fallback to cookies if localStorage was cleared
        if (!token) {
          const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
          if (match) token = decodeURIComponent(match[1]);
        }
        if (!savedUser) {
          const match = document.cookie.match(/(?:^|;\s*)iuh_user=([^;]+)/);
          if (match) savedUser = decodeURIComponent(match[1]);
        }

        if (token && savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setCurrentUser(parsedUser);
          persistAuth(token, parsedUser);
        } else if (token && !savedUser) {
          // Token exists, fetch profile from backend
          const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/auth/profile';
          const res = await fetch(apiUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const profile = await res.json();
            const user: User = {
              id: profile.sub || profile.id,
              email: profile.email,
              fullName: profile.fullName || profile.email?.split('@')[0] || 'User',
              phone: profile.phone || '',
              role: profile.role,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
            };
            setCurrentUser(user);
            persistAuth(token, user);
          } else {
            clearAuth();
          }
        }
      } catch (err) {
        console.error('Session hydration failed:', err);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    hydrateAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/auth/login';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      
      if (data.accessToken && data.user) {
        setCurrentUser(data.user);
        persistAuth(data.accessToken, data.user, data.refreshToken);
        setIsLoading(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    clearAuth();
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: Order['status']): Promise<boolean> => {
    try {
      await updateOrderStatusApi(orderId, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      return true;
    } catch (error) {
      console.error(`[AppContext] Lỗi khi cập nhật trạng thái đơn hàng ${orderId}:`, error);
      return false;
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedOrderIds([]), []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        logout,
        orders,
        updateOrderStatus,
        notifications,
        unreadCount,
        markAllRead,
        selectedOrderIds,
        toggleOrderSelection,
        clearSelection,
        setSelectedOrderIds,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
