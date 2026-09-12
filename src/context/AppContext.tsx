'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, Order, Driver } from '@/types/domain';
import { mockUsers, mockOrders } from '@/lib/mock-data';

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
      createdAt: new Date().toISOString(),
    },
    {
      id: 'n2',
      message: 'Tài xế Võ Thanh Hải đã hoàn thành tuyến đường RT-001',
      type: 'success',
      read: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'n3',
      message: 'Đơn SE240901005 giao thất bại – cần xử lý',
      type: 'warning',
      read: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'n4',
      message: 'Khu vực Bình Thạnh vượt tải (18/15 đơn)',
      type: 'error',
      read: true,
      createdAt: new Date(Date.now() - 10800000).toISOString(),
    },
  ]);

  // Restore session from localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('iuh_user') : null;
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('iuh_user');
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Mock authentication
    const user = mockUsers.find((u) => u.email === email);
    if (user && password === 'Admin@123') {
      setCurrentUser(user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('iuh_user', JSON.stringify(user));
      }
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iuh_user');
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
