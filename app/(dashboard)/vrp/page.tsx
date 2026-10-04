'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Package, CheckCircle, Route,
  ChevronRight, X, AlertCircle, RefreshCw,
  Weight, Box, Send, MapPin, Truck, Phone,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useApp } from '@/context/AppContext';
import { mockDrivers, mockDepots } from '@/lib/mock-data';
import { formatCurrency, cn } from '@/lib/utils';
import {
  fetchOrderPool,
  fetchDepots,
  fetchOnlineDrivers,
  runVRPOptimize,
  confirmVRPDispatch,
  type ApiVrpSolution,
  type ApiOrder,
  type ApiDepot,
} from '@/lib/api';
import type { Order, Driver, Depot, VrpSolution, VrpRoute } from '@/types/domain';

const VrpMapView = dynamic(() => import('@/components/map/VrpMapView'), { ssr: false });

// ─── VRP Route Colors ───────────────────────────────────────────
const ROUTE_COLORS = ['#FA7070', '#6D28D9', '#1D4ED8', '#059669', '#D97706', '#DB2777'];

// ─── Mock VRP Solver (fallback when API is unreachable) ──────────
function solveVRP(orders: Order[], drivers: Driver[]): VrpSolution {
  const availableDrivers = drivers.filter((d) => d.currentShiftStatus !== 'OFFLINE');
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
        polyline: [],
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

// ─── Map API solution to frontend VrpSolution type ───────────────
function mapApiSolutionToVrp(
  apiSolution: ApiVrpSolution,
  driverPool?: Driver[]
): VrpSolution & { _api: ApiVrpSolution } {
  const driversToSearch = driverPool && driverPool.length > 0 ? driverPool : mockDrivers;

  const routes: VrpRoute[] = apiSolution.routes.map((r) => {
    const matchedDriver = driversToSearch.find((d) => d.userId === r.driverId) ?? {
      userId: r.driverId,
      fullName: r.driverName,
      phone: '',
      email: '',
      licensePlate: r.licensePlate,
      vehicleType: (r.vehicleType as Driver['vehicleType']) || 'MOTORBIKE',
      maxWeightKg: 1000,
      maxVolumeM3: 10,
      currentShiftStatus: 'ONLINE_READY' as const,
    };

    const stops: Order[] = r.stops.map((s) => ({
      id: s.orderId,
      code: s.code,
      dispatcherId: '',
      receiverName: s.receiverName,
      receiverPhone: s.receiverPhone,
      deliveryAddress: s.deliveryAddress,
      latitude: s.latitude,
      longitude: s.longitude,
      weightKg: s.weightKg,
      volumeM3: 0,
      codAmount: s.codAmount,
      status: 'NEW' as const,
      createdAt: new Date().toISOString(),
    }));

    return {
      driver: matchedDriver,
      stops,
      totalDistanceKm: r.totalDistanceKm,
      totalEstimatedTimeMin: r.totalEstimatedTimeMin,
      totalWeightKg: r.totalWeightKg,
      totalVolM3: 0,
      color: r.color,
      polyline: r.polyline,
    };
  });

  return {
    routes,
    totalDistanceKm: apiSolution.totalDistanceKm,
    totalOrders: apiSolution.totalOrders,
    optimizationTimeMs: apiSolution.optimizationTimeMs,
    _api: apiSolution,
  };
}

// ─── Map API orders to domain Order type ─────────────────────────
function mapApiOrderToOrder(o: ApiOrder): Order {
  return {
    id: o.id,
    code: o.code,
    dispatcherId: '',
    receiverName: o.receiverName,
    receiverPhone: o.receiverPhone,
    deliveryAddress: o.deliveryAddress,
    latitude: o.latitude,
    longitude: o.longitude,
    weightKg: Number(o.weightKg),
    volumeM3: Number(o.volumeM3),
    codAmount: Number(o.codAmount),
    status: 'NEW' as const,
    createdAt: o.createdAt,
  };
}

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ onSelectAll, hasOrders }: { onSelectAll: () => void; hasOrders: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10 select-none">
      <div className="relative flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/empty-vrp.svg"
          alt="Lập tuyến giao hàng"
          className="w-56 h-auto animate-floating drop-shadow-sm"
        />
      </div>
      <div className="max-w-sm">
        <h3 className="text-lg font-700 text-gray-800 mb-1.5">
          {hasOrders ? 'Đã có đơn nhưng chưa chọn đơn nào' : 'Chưa có đơn hàng mới'}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          {hasOrders
            ? 'Vui lòng chọn ít nhất một đơn hàng từ danh sách bên trái để bắt đầu tính toán lộ trình tối ưu.'
            : 'Hiện tại hệ thống chưa ghi nhận đơn hàng mới nào phù hợp để lập tuyến giao hàng.'}
        </p>
      </div>
      {hasOrders && (
        <button onClick={onSelectAll} className="btn-primary animate-fade-in shadow-sm hover:shadow-md transition-shadow">
          <CheckCircle size={15} /> Chọn tất cả đơn mới
        </button>
      )}
    </div>
  );
}

// ─── Loading Overlay ─────────────────────────────────────────────
const VRP_STEPS = [
  'Thu thập dữ liệu đơn hàng & kho bãi',
  'Tính toán ma trận khoảng cách & thời gian (OSRM)',
  'Phân bổ tải trọng & cấu hình đội xe',
  'Tối ưu hóa thứ tự dừng giao hàng (VRP Solver)',
  'Hoàn thiện lộ trình & vẽ đường chi tiết',
];

function VrpLoadingOverlay({ orderCount }: { orderCount: number }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => (prev < VRP_STEPS.length - 2 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(stepTimer);
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-white/85 backdrop-blur-md rounded-2xl animate-fade-in select-none">
      <div className="max-w-md w-full bg-white/95 rounded-2xl p-6 shadow-xl border border-gray-100 flex flex-col items-center">
        {/* Animated Icon */}
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-[#FA7070]/20 border-t-[#FA7070] animate-spin-slow flex items-center justify-center" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={22} className="text-[#FA7070] animate-pulse" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-base font-700 text-gray-900 mb-1 text-center">
          Đang tối ưu hóa tuyến đường VRP...
        </h3>
        <p className="text-xs text-gray-500 mb-5 text-center">
          Hệ thống đang xử lý và phân bổ <span className="font-semibold text-gray-800">{orderCount} đơn hàng</span> cho đội xe
        </p>

        {/* Step list */}
        <div className="w-full space-y-2 mb-5">
          {VRP_STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isPending = idx > currentStep;

            return (
              <div
                key={step}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-300',
                  isDone && 'bg-emerald-50/70 text-emerald-700 font-medium',
                  isCurrent && 'bg-[#FFF0F0] text-[#8B2626] font-semibold shadow-xs',
                  isPending && 'text-gray-400 opacity-60'
                )}
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {isDone ? (
                    <CheckCircle size={15} className="text-emerald-500 animate-checkmark" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FA7070] animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </div>
                <span className="flex-1 truncate">{step}</span>
                {isCurrent && (
                  <span className="text-[10px] text-[#FA7070] animate-pulse shrink-0 font-bold">
                    Đang chạy...
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Elapsed Timer & Hint */}
        <div className="w-full pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Thời gian đã trôi:</span>
            <span className="font-mono font-600 text-gray-700">{elapsedSeconds}s</span>
          </div>
          <span>Ước tính: ~3-8s</span>
        </div>
      </div>
    </div>
  );
}

// ─── Route Summary Card ──────────────────────────────────────────
interface RouteSummaryCardProps {
  route: VrpRoute;
  routeIndex: number;
  depot: Depot;
  availableDrivers: Driver[];
  onChangeDriver: (routeIndex: number, newDriverId: string) => void;
}

function RouteSummaryCard({
  route,
  routeIndex,
  depot,
  availableDrivers,
  onChangeDriver,
}: RouteSummaryCardProps) {
  const [open, setOpen] = useState(false);
  const isOverweight = route.driver?.maxWeightKg ? route.totalWeightKg > route.driver.maxWeightKg : false;

  return (
    <div
      className="card overflow-hidden shrink-0 transition-all flex flex-col min-h-0 border shadow-xs"
      style={{ borderColor: route.color + '40' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-gray-50/80 transition-colors text-left"
      >
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
          style={{ background: route.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-700 text-gray-900 truncate">
              Tuyến {routeIndex + 1}: {route.driver.fullName}
            </p>
            {isOverweight && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-700 bg-red-100 text-red-700 shrink-0">
                Quá tải
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {route.stops.length} điểm · {route.totalDistanceKm.toFixed(1)} km · {route.totalEstimatedTimeMin.toFixed(0)} phút
          </p>
        </div>
        <ChevronRight
          size={16}
          className={cn('text-gray-400 transition-transform shrink-0', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3.5 bg-slate-50/30" style={{ borderColor: route.color + '20' }}>
          {/* Driver change dropdown */}
          <div className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-600 text-gray-700 flex items-center gap-1.5">
                <Truck size={13} className="text-[#FA7070]" /> Tài xế phụ trách:
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {route.driver.licensePlate || 'N/A'}
              </span>
            </div>
            <select
              value={route.driver.userId}
              onChange={(e) => onChangeDriver(routeIndex, e.target.value)}
              className="w-full text-xs font-500 text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FA7070] cursor-pointer"
            >
              {availableDrivers.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.fullName} ({d.vehicleType || 'Xe'} · Max: {d.maxWeightKg}kg)
                </option>
              ))}
            </select>
            {isOverweight && (
              <p className="text-[10px] text-red-600 font-medium">
                ⚠️ Tải hàng ({route.totalWeightKg.toFixed(1)}kg) vượt sức chở tài xế ({route.driver.maxWeightKg}kg)
              </p>
            )}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white rounded-xl border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Khoảng cách</p>
              <p className="text-xs font-700 text-gray-800 mt-0.5">{route.totalDistanceKm.toFixed(1)} km</p>
            </div>
            <div className="p-2 bg-white rounded-xl border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Thời gian</p>
              <p className="text-xs font-700 text-gray-800 mt-0.5">{route.totalEstimatedTimeMin.toFixed(0)} phút</p>
            </div>
            <div className="p-2 bg-white rounded-xl border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Tải trọng</p>
              <p className={cn('text-xs font-700 mt-0.5', isOverweight ? 'text-red-600' : 'text-gray-800')}>
                {route.totalWeightKg.toFixed(1)} / {route.driver.maxWeightKg} kg
              </p>
            </div>
            <div className="p-2 bg-white rounded-xl border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Tổng COD</p>
              <p className="text-xs font-700 text-emerald-700 mt-0.5">
                {formatCurrency(route.stops.reduce((s, o) => s + (o.codAmount || 0), 0))}
              </p>
            </div>
          </div>

          {/* Timeline of Stops 1 -> N */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-700 text-gray-800">
                Lộ trình di chuyển (1 → {route.stops.length})
              </p>
              <span className="text-[10px] text-gray-400">Khứ hồi</span>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 space-y-2.5">
              {/* Departure Depot Stop */}
              <div className="timeline-item flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs shrink-0 shadow-xs z-10">
                  🏭
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-700 text-gray-800">Xuất phát: {depot.name}</span>
                    <span className="text-[9px] font-600 text-slate-500 bg-slate-100 px-1 rounded">Kho</span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{depot.address}</p>
                </div>
              </div>

              {/* Customer Delivery Stops 1 to N */}
              {route.stops.map((stop, si) => (
                <div key={stop.id} className="timeline-item flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-700 text-xs shrink-0 shadow-xs z-10"
                    style={{ background: route.color }}
                  >
                    {si + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5 bg-white p-2 rounded-xl border border-gray-100 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-600 text-xs text-gray-800 truncate">
                        {stop.receiverName}
                      </span>
                      <span className="font-mono text-[9px] font-600 text-[#FA7070] bg-[#FFF0F0] px-1 rounded shrink-0">
                        {stop.code}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                      <MapPin size={9} className="shrink-0" /> {stop.deliveryAddress}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Phone size={9} /> {stop.receiverPhone || 'N/A'}
                      </span>
                      <span className="font-500">{stop.weightKg} kg</span>
                    </div>
                    {stop.codAmount > 0 && (
                      <div className="mt-1 pt-1 border-t border-gray-50 flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">COD thu:</span>
                        <span className="font-600 text-emerald-600">{formatCurrency(stop.codAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Return to Depot Stop */}
              <div className="timeline-item flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs shrink-0 shadow-xs z-10">
                  🏁
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-700 text-gray-800">Kết thúc: Về lại {depot.name}</span>
                    <span className="text-[9px] font-600 text-emerald-600 bg-emerald-50 px-1 rounded">Đích</span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">Hoàn tất tuyến đường</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toast notification ──────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-white text-sm font-500 animate-fade-in',
      type === 'success' ? 'bg-green-600' : 'bg-red-500'
    )}>
      {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Main VRP Page ─────────────────────────────────────────────
export default function VrpPage() {
  const { orders: ctxOrders, selectedOrderIds, toggleOrderSelection, clearSelection, setSelectedOrderIds } = useApp();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [solution, setSolution] = useState<(VrpSolution & { _api?: ApiVrpSolution }) | null>(null);
  const [apiOrders, setApiOrders] = useState<Order[] | null>(null);
  const [apiDepot, setApiDepot] = useState<ApiDepot | null>(null);
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[] | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [usingRealApi, setUsingRealApi] = useState(false);

  // Fetch real orders, depots, and online drivers from backend on mount
  useEffect(() => {
    fetchOrderPool()
      .then((data) => {
        setApiOrders(data.map(mapApiOrderToOrder));
        setUsingRealApi(true);
      })
      .catch(() => {
        // Fallback to mock data silently on network failure
        setApiOrders(null);
        setUsingRealApi(false);
      });

    fetchDepots()
      .then((depots) => {
        if (depots.length > 0) setApiDepot(depots[0]);
      })
      .catch(() => setApiDepot(null));

    fetchOnlineDrivers()
      .then((drivers) => {
        // Real API call succeeded (can be empty array [] if no driver is currently online)
        setOnlineDrivers(drivers);
      })
      .catch(() => {
        // Fallback to mockDrivers ONLY on API error / network failure
        setOnlineDrivers(mockDrivers.filter((d) => d.currentShiftStatus !== 'OFFLINE'));
      });
  }, []);

  const displayOrders = apiOrders ?? ctxOrders.filter((o) => o.status === 'NEW');
  const newOrders = displayOrders;
  const selectedOrders = useMemo(
    () => newOrders.filter((o) => selectedOrderIds.includes(o.id)),
    [newOrders, selectedOrderIds]
  );

  const handleSelectAllNew = useCallback(() => {
    setSelectedOrderIds(newOrders.map((o) => o.id));
  }, [newOrders, setSelectedOrderIds]);

  const availableDrivers = onlineDrivers !== null
    ? onlineDrivers
    : mockDrivers.filter((d) => d.currentShiftStatus !== 'OFFLINE');

  const displayDepot = apiDepot
    ? { id: apiDepot.id, name: apiDepot.name, address: apiDepot.address, latitude: apiDepot.latitude, longitude: apiDepot.longitude }
    : mockDepots[0];

  const handleChangeDriver = useCallback(
    (routeIndex: number, newDriverId: string) => {
      const newDriver = availableDrivers.find((d) => d.userId === newDriverId);
      if (!newDriver) return;

      setSolution((prev) => {
        if (!prev) return null;
        const updatedRoutes = [...prev.routes];
        const currentRoute = updatedRoutes[routeIndex];
        if (!currentRoute) return prev;

        if (currentRoute.totalWeightKg > newDriver.maxWeightKg) {
          setToast({
            message: `⚠️ Cảnh báo: Tải trọng tuyến (${currentRoute.totalWeightKg.toFixed(1)}kg) vượt quá sức chở của ${newDriver.fullName} (${newDriver.maxWeightKg}kg)`,
            type: 'error',
          });
        } else {
          setToast({
            message: `Đã đổi tài xế tuyến ${routeIndex + 1} sang ${newDriver.fullName}`,
            type: 'success',
          });
        }

        updatedRoutes[routeIndex] = {
          ...currentRoute,
          driver: newDriver,
        };

        // CRITICAL: Synchronize _api solution so confirmVRPDispatch sends the correct driverId to DB
        let updatedApi = prev._api;
        if (updatedApi && updatedApi.routes && updatedApi.routes[routeIndex]) {
          const updatedApiRoutes = [...updatedApi.routes];
          updatedApiRoutes[routeIndex] = {
            ...updatedApiRoutes[routeIndex],
            driverId: newDriver.userId,
            driverName: newDriver.fullName,
            licensePlate: newDriver.licensePlate,
            vehicleType: newDriver.vehicleType,
          };
          updatedApi = {
            ...updatedApi,
            routes: updatedApiRoutes,
          };
        }

        return {
          ...prev,
          routes: updatedRoutes,
          _api: updatedApi,
        };
      });
    },
    [availableDrivers]
  );

  const handleRunVRP = useCallback(async () => {
    if (selectedOrders.length === 0) return;
    setSolution(null);
    setIsOptimizing(true);

    try {
      if (usingRealApi) {
        const driverIds = availableDrivers.map((d) => d.userId);
        const result = await runVRPOptimize(
          selectedOrders.map((o) => o.id),
          displayDepot?.id,
          driverIds.length > 0 ? driverIds : undefined
        );
        setSolution(mapApiSolutionToVrp(result, availableDrivers));
      } else {
        // Fallback mock solver with artificial delay
        await new Promise((r) => setTimeout(r, 2000));
        setSolution(solveVRP(selectedOrders, availableDrivers));
      }
    } catch {
      // If API call fails mid-way, fallback to mock
      await new Promise((r) => setTimeout(r, 500));
      setSolution(solveVRP(selectedOrders, availableDrivers));
    } finally {
      setIsOptimizing(false);
    }
  }, [selectedOrders, availableDrivers, usingRealApi, displayDepot]);

  const handleConfirm = useCallback(async () => {
    if (!solution) return;
    setIsConfirming(true);
    try {
      if (solution._api) {
        await confirmVRPDispatch(solution._api);
        setToast({ message: `✅ Đã điều phối ${solution.routes.length} tuyến thành công!`, type: 'success' });
        setSolution(null);
        clearSelection();
        // Refresh order pool
        const fresh = await fetchOrderPool().catch(() => null);
        if (fresh) setApiOrders(fresh.map(mapApiOrderToOrder));
      } else {
        setToast({ message: '✅ Đã xác nhận phân công (chế độ demo)', type: 'success' });
        setSolution(null);
        clearSelection();
      }
    } catch {
      setToast({ message: 'Xác nhận thất bại, vui lòng thử lại', type: 'error' });
    } finally {
      setIsConfirming(false);
    }
  }, [solution, clearSelection]);

  return (
    <div className="flex gap-5 h-full animate-fade-in min-h-0" style={{ minHeight: 'calc(100vh - 128px)' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Left Panel ── */}
      <div className="w-72 shrink-0 flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
        {/* API status indicator */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-500',
          usingRealApi ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        )}>
          <span className={cn('w-2 h-2 rounded-full', usingRealApi ? 'bg-green-500' : 'bg-amber-500')} />
          {usingRealApi ? `🟢 ${newOrders.length} đơn mới` : '🟡 Chế độ demo (không có API)'}
        </div>

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
              onClick={handleSelectAllNew}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-700 text-gray-900">Đội xe khả dụng</h3>
            <span className="text-[11px] font-600 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {availableDrivers.length} online
            </span>
          </div>
          <div className="space-y-2">
            {availableDrivers.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                Không có tài xế nào đang sẵn sàng
              </div>
            ) : (
              availableDrivers.map((driver) => (
                <div key={driver.userId} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FA7070]/20 to-[#8B2626]/20 flex items-center justify-center text-[#FA7070] font-700 text-xs shrink-0">
                    {driver.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-600 text-gray-700 truncate">{driver.fullName}</p>
                    <p className="text-[10px] text-gray-400">{driver.maxWeightKg}kg · {driver.licensePlate || 'N/A'}</p>
                  </div>
                  <StatusBadge status={driver.currentShiftStatus} showDot={false} className="text-[9px] px-1.5 py-0.5" />
                </div>
              ))
            )}
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
              {selectedOrderIds.length} đơn hàng · {availableDrivers.length} tài xế · Depot: {displayDepot.name}
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
            {solution && !isOptimizing && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="btn-primary text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
                id="btn-confirm-dispatch"
              >
                {isConfirming ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                    Đang xác nhận...
                  </>
                ) : (
                  <>
                    <Send size={15} /> Xác nhận & Điều phối
                  </>
                )}
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
          {isOptimizing && <VrpLoadingOverlay orderCount={selectedOrders.length} />}

          {!solution && !isOptimizing && selectedOrders.length === 0 ? (
            <EmptyState onSelectAll={handleSelectAllNew} hasOrders={newOrders.length > 0} />
          ) : (
            <VrpMapView
              orders={selectedOrders}
              solution={solution}
              depot={displayDepot}
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
        <div className="w-80 shrink-0 h-[calc(100vh-140px)] flex flex-col gap-3 overflow-y-auto pr-1 pb-16 min-h-0 animate-slide-right">
          <div className="card p-4 shrink-0">
            <h3 className="text-sm font-700 text-gray-900 mb-1">Tóm tắt tuyến đường</h3>
            <p className="text-xs text-gray-400">{solution.routes.length} tuyến được tạo tối ưu</p>
          </div>
          {solution.routes.map((route, idx) => (
            <RouteSummaryCard
              key={`${route.driver.userId}-${idx}`}
              route={route}
              routeIndex={idx}
              depot={displayDepot}
              availableDrivers={availableDrivers}
              onChangeDriver={handleChangeDriver}
            />
          ))}
        </div>
      )}
    </div>
  );
}
