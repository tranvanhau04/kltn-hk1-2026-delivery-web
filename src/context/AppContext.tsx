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
      message: '3 đơn hàng mới cần phân công hôm nay',
      type: 'info',
      read: false,
      createdAt: "2026-09-12T06:00:00.000Z",
    },
    {
      id: 'n2',
      message: 'Tài xế Võ Thanh Hải đã hoàn thành tuyến đường RT-001',
      type: 'success',
      read: false,
      createdAt: "2026-09-12T05:00:00.000Z",
    },
    {
      id: 'n3',
      message: 'Đơn SE240901005 giao thất bại – cần xử lý',
      type: 'warning',
      read: false,
      createdAt: "2026-09-12T04:00:00.000Z",
    },
    {
      id: 'n4',
      message: 'Khu vực Bình Thạnh vượt tải (18/15 đơn)',
      type: 'error',
      read: true,
      createdAt: "2026-09-12T03:00:00.000Z",
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
