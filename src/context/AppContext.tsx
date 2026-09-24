'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, Order } from '@/types/domain';
import { mockOrders } from '@/lib/mock-data';

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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Orders
  orders: Order[];
  updateOrderStatus: (orderId: string, status: Order['status']) => void;

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
  const [orders, setOrders] = useState<Order[]>(mockOrders);
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

  // Restore session from localStorage
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('iuh_user') : null;
    if (token && savedUser) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('iuh_user');
        localStorage.removeItem('accessToken');
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // Assuming API_BASE is defined in environment or using default
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
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('iuh_user', JSON.stringify(data.user));
        }
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iuh_user');
      localStorage.removeItem('accessToken');
    }
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: Order['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
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
