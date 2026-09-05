'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Package, Truck, CheckCircle, Clock, Route,
  ChevronRight, X, AlertCircle, RefreshCw, Play,
  MapPin, Weight, Box,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useApp } from '@/context/AppContext';
import { mockDrivers, mockDepots } from '@/lib/mock-data';
import { formatCurrency, cn } from '@/lib/utils';
import type { Order, Driver, VrpSolution, VrpRoute } from '@/types/domain';

const VrpMapView = dynamic(() => import('@/components/map/VrpMapView'), { ssr: false });

// ─── VRP Route Colors ───────────────────────────────────────────
const ROUTE_COLORS = ['#FA7070', '#6D28D9', '#1D4ED8', '#059669', '#D97706', '#DB2777'];

// ─── Mock VRP Solver ─────────────────────────────────────────────
function solveVRP(orders: Order[], drivers: Driver[]): VrpSolution {
  const availableDrivers = drivers.filter((d) => d.currentShiftStatus !== 'OFF_DUTY');
  const routes: VrpRoute[] = [];
  let orderIdx = 0;

  for (let i = 0; i < Math.min(availableDrivers.length, 3) && orderIdx < orders.length; i++) {
    const driver = availableDrivers[i];
    const driverOrders: Order[] = [];
    let totalWeight = 0;

    while (orderIdx < orders.length && totalWeight + (orders[orderIdx].weightKg ?? 0) <= driver.maxWeightKg) {
      totalWeight += orders[orderIdx].weightKg ?? 0;
      driverOrders.push(orders[orderIdx]);
      orderIdx++;
    }

    if (driverOrders.length > 0) {
      routes.push({
        driver,
        stops: driverOrders,
        totalDistanceKm: Math.round((8 + driverOrders.length * 3.5) * 10) / 10,
        totalEstimatedTimeMin: Math.round((20 + driverOrders.length * 12)),
        totalWeightKg: totalWeight,
        totalVolM3: driverOrders.reduce((s, o) => s + o.volumeM3, 0),
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      });
    }
  }

  return {
    routes,
    totalDistanceKm: routes.reduce((s, r) => s + r.totalDistanceKm, 0),
    totalOrders: orders.length,
    optimizationTimeMs: 850 + Math.random() * 400,
  };
}

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ onSelectAll }: { onSelectAll: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-10">
      <div className="w-24 h-24 rounded-3xl bg-[#FFF0F0] flex items-center justify-center">
        <Route size={40} className="text-[#FA7070]/50" />
      </div>
      <div>
        <h3 className="text-lg font-600 text-gray-700 mb-2">Chưa chọn đơn hàng</h3>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          Chọn ít nhất một đơn hàng từ danh sách bên trái để bắt đầu tối ưu hóa tuyến đường.
        </p>
      </div>
      <button onClick={onSelectAll} className="btn-primary">
        <CheckCircle size={15} /> Chọn tất cả đơn mới
      </button>
    </div>
  );
}

// ─── Loading Overlay ─────────────────────────────────────────────
function VrpLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-white/80 backdrop-blur-sm rounded-2xl">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-[#FA7070]/20 border-t-[#FA7070] animate-spin-slow" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap size={24} className="text-[#FA7070] animate-pulse-glow" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-600 text-gray-800 mb-1">Đang tối ưu hóa tuyến đường...</p>
        <p className="text-sm text-gray-400">Thuật toán VRP đang xử lý {Math.floor(Math.random() * 30) + 5} đơn hàng</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-[#FA7070] animate-pulse" /> Tính toán ma trận khoảng cách...
      </div>
    </div>
  );
}

// ─── Route Summary Card ──────────────────────────────────────────
function RouteSummaryCard({ route, idx }: { route: VrpRoute; idx: number }) {
  const [open, setOpen] = useState(idx === 0);
  return (
    <div
      className="card border overflow-hidden"
      style={{ borderColor: route.color + '40' }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: route.color }}
        />
        <div className="flex-1 text-left">
          <p className="text-sm font-600 text-gray-800">{route.driver.fullName}</p>
          <p className="text-xs text-gray-400">{route.stops.length} điểm · {route.totalDistanceKm}km · {route.totalEstimatedTimeMin}ph</p>
        </div>
        <ChevronRight
          size={16}
          className={cn('text-gray-400 transition-transform', open && 'rotate-90')}
        />
      </button>

      {/* Stats */}
      {open && (
        <div className="border-t px-4 pb-4 space-y-3" style={{ borderColor: route.color + '20' }}>
          <div className="grid grid-cols-2 gap-2 pt-3">
            <div className="p-2 bg-gray-50 rounded-xl text-center">
              <p className="text-xs text-gray-400">Khoảng cách</p>
              <p className="text-sm font-600 text-gray-800">{route.totalDistanceKm} km</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl text-center">
              <p className="text-xs text-gray-400">Thời gian</p>
              <p className="text-sm font-600 text-gray-800">{route.totalEstimatedTimeMin} phút</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl text-center">
              <p className="text-xs text-gray-400">Tải trọng</p>
              <p className="text-sm font-600 text-gray-800">{route.totalWeightKg.toFixed(1)} kg</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl text-center">
              <p className="text-xs text-gray-400">COD tổng</p>
              <p className="text-sm font-600 text-gray-800">
                {formatCurrency(route.stops.reduce((s, o) => s + o.codAmount, 0))}
              </p>
            </div>
          </div>

          {/* Stop list */}
          <div className="space-y-1.5">
            {route.stops.map((stop, si) => (
              <div key={stop.id} className="flex items-center gap-2 text-xs text-gray-600">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white font-700 text-[10px] shrink-0"
                  style={{ background: route.color }}
                >
                  {si + 1}
                </div>
                <span className="truncate flex-1">{stop.receiverName}</span>
                {stop.codAmount > 0 && (
                  <span className="text-green-600 font-500">{formatCurrency(stop.codAmount)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main VRP Page ─────────────────────────────────────────────
export default function VrpPage() {
  const { orders, selectedOrderIds, toggleOrderSelection, clearSelection, selectAllNew } = useApp();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [solution, setSolution] = useState<VrpSolution | null>(null);

  const newOrders = useMemo(() => orders.filter((o) => o.status === 'NEW'), [orders]);
  const selectedOrders = useMemo(
    () => newOrders.filter((o) => selectedOrderIds.includes(o.id)),
    [newOrders, selectedOrderIds]
  );

  const availableDrivers = mockDrivers.filter((d) => d.currentShiftStatus !== 'OFF_DUTY');

  const handleRunVRP = useCallback(async () => {
    if (selectedOrders.length === 0) return;
    setSolution(null);
    setIsOptimizing(true);
    await new Promise((r) => setTimeout(r, 2500));
    const result = solveVRP(selectedOrders, availableDrivers);
    setSolution(result);
    setIsOptimizing(false);
  }, [selectedOrders, availableDrivers]);

  return (
    <div className="flex gap-5 h-full animate-fade-in" style={{ minHeight: 'calc(100vh - 128px)' }}>
      {/* ── Left Panel ── */}
      <div className="w-72 shrink-0 flex flex-col gap-4">
        {/* Orders Pool */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-700 text-gray-900">Đơn hàng chờ phân công</h3>
              <button
                onClick={() => clearSelection()}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Bỏ chọn
              </button>
            </div>
            <p className="text-xs text-gray-400">{selectedOrderIds.length}/{newOrders.length} đã chọn</p>
            <button
              onClick={selectAllNew}
              className="w-full mt-2 py-1.5 text-xs font-500 text-[#FA7070] border border-[#FA7070]/30 rounded-lg hover:bg-[#FFF0F0] transition-colors"
            >
              Chọn tất cả ({newOrders.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {newOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
                <Package size={28} className="opacity-30" />
                <p className="text-xs">Không có đơn hàng mới</p>
              </div>
            ) : (
              newOrders.map((order) => {
                const selected = selectedOrderIds.includes(order.id);
                return (
                  <button
                    key={order.id}
                    onClick={() => toggleOrderSelection(order.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all text-sm',
                      selected
                        ? 'border-[#FA7070] bg-[#FFF0F0]'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-gray-50'
                    )}
                    id={`vrp-order-${order.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        selected ? 'border-[#FA7070] bg-[#FA7070]' : 'border-gray-300'
                      )}>
                        {selected && <CheckCircle size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-600 text-[#FA7070]">{order.code}</span>
                          {order.codAmount > 0 && (
                            <span className="text-[10px] text-green-600 font-500">
                              {formatCurrency(order.codAmount)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 font-500 mt-0.5 truncate">{order.receiverName}</p>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{order.deliveryAddress}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5"><Weight size={9} /> {order.weightKg}kg</span>
                          <span className="flex items-center gap-0.5"><Box size={9} /> {order.volumeM3}m³</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Available Fleet */}
        <div className="card p-4">
          <h3 className="text-sm font-700 text-gray-900 mb-3">Đội xe khả dụng</h3>
          <div className="space-y-2">
            {availableDrivers.map((driver) => (
              <div key={driver.userId} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-xs shrink-0">
                  {driver.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-600 text-gray-700 truncate">{driver.fullName}</p>
                  <p className="text-[10px] text-gray-400">{driver.maxWeightKg}kg · {driver.licensePlate}</p>
                </div>
                <StatusBadge status={driver.currentShiftStatus} showDot={false} className="text-[9px] px-1.5 py-0.5" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Center Map ── */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Run VRP Button */}
        <div className="card p-4 flex items-center gap-4 shrink-0">
          <div className="flex-1">
            <p className="text-sm font-600 text-gray-800">Tối ưu hóa tuyến đường</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedOrderIds.length} đơn hàng · {availableDrivers.length} tài xế · Depot: {mockDepots[0].name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {solution && (
              <button
                onClick={() => { setSolution(null); clearSelection(); }}
                className="btn-secondary text-sm"
              >
                <RefreshCw size={14} /> Đặt lại
              </button>
            )}
            <button
              onClick={handleRunVRP}
              disabled={selectedOrderIds.length === 0 || isOptimizing}
              className={cn(
                'btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed',
                selectedOrderIds.length === 0 && 'opacity-40'
              )}
              id="btn-run-vrp"
            >
              {isOptimizing ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                  Đang tính toán...
                </>
              ) : (
                <>
                  <Zap size={15} /> Chạy VRP Optimization
                </>
              )}
            </button>
          </div>
        </div>

        {/* Map area */}
        <div className="relative flex-1 card overflow-hidden" style={{ minHeight: '400px' }}>
          {isOptimizing && <VrpLoadingOverlay />}

          {!solution && !isOptimizing ? (
            <EmptyState onSelectAll={selectAllNew} />
          ) : (
            <VrpMapView
              orders={selectedOrders}
              solution={solution}
              depot={mockDepots[0]}
            />
          )}
        </div>

        {/* Solution stats */}
        {solution && !isOptimizing && (
          <div className="card p-4 shrink-0 animate-fade-in">
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { label: 'Tổng tuyến', value: solution.routes.length },
                { label: 'Tổng đơn', value: solution.totalOrders },
                { label: 'Tổng quãng đường', value: `${solution.totalDistanceKm.toFixed(1)} km` },
                { label: 'Thời gian tối ưu', value: `${solution.optimizationTimeMs.toFixed(0)} ms` },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xl font-700 text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel ── */}
      {solution && !isOptimizing && (
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto animate-slide-right">
          <div className="card p-4 shrink-0">
            <h3 className="text-sm font-700 text-gray-900 mb-1">Tóm tắt tuyến đường</h3>
            <p className="text-xs text-gray-400">{solution.routes.length} tuyến được tạo</p>
          </div>
          {solution.routes.map((route, i) => (
            <RouteSummaryCard key={route.driver.userId} route={route} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}
