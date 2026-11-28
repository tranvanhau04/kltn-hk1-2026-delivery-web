'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Package, CheckCircle,
  ChevronRight, RefreshCw,
  Weight, Box, Send, MapPin, Truck, Phone, Loader2,
  ChevronUp, ChevronDown, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CascadingRegionHubSelect } from '@/components/common/CascadingRegionHubSelect';
import { useApp } from '@/context/AppContext';
import { formatCurrency, cn } from '@/lib/utils';
import { withRoleGuard } from '@/components/auth/withRoleGuard';
import {
  fetchOrderPool,
  fetchOnlineDrivers,
  runVRPOptimize,
  apiFetch,
  type ApiVrpSolution,
  type ApiOrder,
  type ApiDepot,
} from '@/lib/api';
import type { Order, Driver, Depot, VrpSolution, VrpRoute } from '@/types/domain';
import { useToast } from '@/context/ToastContext';

const VrpMapView = dynamic(() => import('@/components/map/VrpMapView'), { ssr: false });

// ─── Map API solution to frontend VrpSolution type ───────────────
function mapApiSolutionToVrp(
  apiSolution: ApiVrpSolution,
  driverPool?: Driver[],
): VrpSolution & { _api: ApiVrpSolution } {
  const driversToSearch = driverPool || [];

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
    depotId: o.depotId,
    depot: o.depot ? {
      id: o.depot.id,
      name: o.depot.name,
      address: o.depot.address,
      latitude: Number(o.depot.latitude),
      longitude: Number(o.depot.longitude),
    } : undefined,
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
            : 'Hiện tại hệ thống chưa ghi nhận đơn hàng mới nào phù hợp với bộ lọc hiện tại để lập tuyến giao hàng.'}
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
    <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl border border-slate-200 flex flex-col items-center animate-fade-in select-none">
      {/* Animated Icon */}
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin-slow flex items-center justify-center" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap size={18} className="text-[#D92D20]" />
        </div>
      </div>

      {/* Title & Subtitle */}
      <h3 className="text-sm font-semibold text-slate-900 mb-1 text-center">
        Đang tối ưu hóa tuyến đường VRP...
      </h3>
      <p className="text-xs text-slate-500 mb-5 text-center tabular-nums">
        Hệ thống đang xử lý và phân bổ <span className="font-semibold text-slate-900">{orderCount} đơn hàng</span> cho đội xe
      </p>

      {/* Step list */}
      <div className="w-full space-y-1.5 mb-5">
        {VRP_STEPS.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isPending = idx > currentStep;

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all duration-200',
                isDone && 'bg-emerald-50/70 text-emerald-700 font-medium border border-emerald-200/70',
                isCurrent && 'bg-slate-100 text-slate-900 font-medium border border-slate-200',
                isPending && 'text-slate-400 opacity-60'
              )}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {isDone ? (
                  <CheckCircle size={14} className="text-emerald-600 animate-checkmark" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-[#D92D20] animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
              </div>
              <span className="flex-1 truncate">{step}</span>
              {isCurrent && (
                <span className="text-[10px] text-slate-700 shrink-0 font-semibold">
                  Đang chạy...
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Elapsed Timer & Hint */}
      <div className="w-full pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Thời gian đã trôi:</span>
          <span className="font-mono font-semibold text-slate-800">{elapsedSeconds}s</span>
        </div>
        <span>Ước tính: ~3-8s</span>
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
  fuelLiters?: number;
  fuelCostVnd?: number;
  onMoveStop?: (routeIndex: number, stopIndex: number, direction: 'up' | 'down') => void;
}

function RouteSummaryCard({
  route,
  routeIndex,
  depot,
  availableDrivers,
  onChangeDriver,
  fuelLiters,
  fuelCostVnd,
  onMoveStop,
}: RouteSummaryCardProps) {
  const [open, setOpen] = useState(false);
  const isOverweight = route.driver?.maxWeightKg ? route.totalWeightKg > route.driver.maxWeightKg : false;

  return (
    <div
      className="card overflow-hidden shrink-0 transition-colors flex flex-col min-h-0 border shadow-2xs"
      style={{ borderColor: route.color + '40' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50/80 transition-colors text-left"
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: route.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-900 truncate">
              Tuyến {routeIndex + 1}: {route.driver.fullName}
            </p>
            {isOverweight && (
              <span className="px-1.5 py-0.5 rounded border border-red-200 text-[10px] font-medium bg-red-50 text-[#D92D20] shrink-0">
                Quá tải
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate tabular-nums">
            {route.stops.length} điểm · {route.totalDistanceKm.toFixed(1)} km · {route.totalEstimatedTimeMin.toFixed(0)} phút
            {fuelLiters ? ` · ~${fuelLiters}L` : ''}
            {fuelCostVnd ? ` (${formatCurrency(fuelCostVnd)})` : ''}
          </p>
        </div>
        <ChevronRight
          size={15}
          className={cn('text-slate-400 transition-transform shrink-0', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-slate-50/40" style={{ borderColor: route.color + '20' }}>
          {/* Driver change dropdown */}
          <div className="p-2.5 bg-white rounded-md border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 flex items-center gap-1.5">
                <Truck size={13} className="text-slate-500" /> Tài xế phụ trách:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {route.driver.licensePlate || 'N/A'}
              </span>
            </div>
            <select
              value={route.driver.userId}
              onChange={(e) => onChangeDriver(routeIndex, e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 cursor-pointer"
            >
              {availableDrivers.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.fullName} ({d.vehicleType || 'Xe'} · Max: {d.maxWeightKg}kg)
                </option>
              ))}
            </select>
            {isOverweight && (
              <p className="text-[10px] text-[#D92D20] font-medium tabular-nums">
                Tải hàng ({route.totalWeightKg.toFixed(1)}kg) vượt sức chở tài xế ({route.driver.maxWeightKg}kg)
              </p>
            )}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2 tabular-nums">
            <div className="p-2 bg-white rounded-md border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400">Khoảng cách</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">{route.totalDistanceKm.toFixed(1)} km</p>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400">Thời gian</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">{route.totalEstimatedTimeMin.toFixed(0)} phút</p>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400">Tải trọng</p>
              <p className={cn('text-xs font-semibold mt-0.5', isOverweight ? 'text-[#D92D20]' : 'text-slate-900')}>
                {route.totalWeightKg.toFixed(1)} / {route.driver.maxWeightKg} kg
              </p>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400">Tổng COD</p>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {formatCurrency(route.stops.reduce((s, o) => s + (o.codAmount || 0), 0))}
              </p>
            </div>
          </div>

          {/* Timeline of Stops 1 -> N */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-800 tabular-nums">
                Lộ trình di chuyển (1 → {route.stops.length})
              </p>
              <span className="text-[10px] text-slate-400">Khứ hồi</span>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
              {/* Departure Depot Stop */}
              <div className="timeline-item flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-[10px] font-semibold shrink-0 z-10">
                  HUB
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Xuất phát: {depot.name}</span>
                    <span className="text-[9px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 rounded">Kho</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{depot.address}</p>
                </div>
              </div>

              {/* Customer Delivery Stops 1 to N */}
              {route.stops.map((stop, si) => (
                <div key={stop.id} className="timeline-item flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white font-semibold text-xs shrink-0 tabular-nums z-10"
                    style={{ background: route.color }}
                  >
                    {si + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5 bg-white p-2 rounded-md border border-slate-200/80">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-medium text-xs text-slate-900 truncate">
                        {stop.receiverName}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-mono text-[10px] font-medium text-slate-700 bg-slate-100 px-1.5 rounded tabular-nums">
                          {stop.code}
                        </span>
                        {onMoveStop && (
                          <div className="flex items-center bg-slate-100 rounded p-0.5 ml-1">
                            <button
                              type="button"
                              disabled={si === 0}
                              onClick={(e) => { e.stopPropagation(); onMoveStop(routeIndex, si, 'up'); }}
                              className="text-slate-500 hover:text-slate-900 disabled:opacity-20 p-0.5 transition-colors"
                              title="Đổi thứ tự lên trước"
                            >
                              <ChevronUp size={11} />
                            </button>
                            <button
                              type="button"
                              disabled={si === route.stops.length - 1}
                              onClick={(e) => { e.stopPropagation(); onMoveStop(routeIndex, si, 'down'); }}
                              className="text-slate-500 hover:text-slate-900 disabled:opacity-20 p-0.5 transition-colors"
                              title="Đổi thứ tự xuống sau"
                            >
                              <ChevronDown size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                      <MapPin size={9} className="shrink-0" /> {stop.deliveryAddress}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 tabular-nums">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Phone size={9} /> {stop.receiverPhone || 'N/A'}
                      </span>
                      <span className="font-medium">{stop.weightKg} kg</span>
                    </div>
                    {stop.codAmount > 0 && (
                      <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] tabular-nums">
                        <span className="text-slate-400">COD thu:</span>
                        <span className="font-semibold text-emerald-700">{formatCurrency(stop.codAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Return to Depot Stop */}
              <div className="timeline-item flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-700 text-white flex items-center justify-center text-[10px] font-semibold shrink-0 z-10">
                  END
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Kết thúc: Về lại {depot.name}</span>
                    <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 rounded">Đích</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">Hoàn tất tuyến đường</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main VRP Page ─────────────────────────────────────────────
function VrpPage() {
  const { selectedOrderIds, toggleOrderSelection, clearSelection, setSelectedOrderIds } = useApp();
  const toast = useToast();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [solution, setSolution] = useState<(VrpSolution & { _api?: ApiVrpSolution }) | null>(null);
  const [orderPool, setOrderPool] = useState<Order[]>([]);
  const [depots, setDepots] = useState<ApiDepot[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedHubId, setSelectedHubId] = useState<string>('');
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[]>([]);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  const handleMoveStop = useCallback(
    (routeIndex: number, stopIndex: number, direction: 'up' | 'down') => {
      setSolution((prev) => {
        if (!prev) return null;
        const targetIndex = direction === 'up' ? stopIndex - 1 : stopIndex + 1;
        const route = prev.routes[routeIndex];
        if (!route || targetIndex < 0 || targetIndex >= route.stops.length) return prev;

        const newStops = [...route.stops];
        const temp = newStops[stopIndex];
        newStops[stopIndex] = newStops[targetIndex];
        newStops[targetIndex] = temp;

        const updatedRoutes = [...prev.routes];
        updatedRoutes[routeIndex] = { ...route, stops: newStops };

        return {
          ...prev,
          routes: updatedRoutes,
        };
      });
    },
    []
  );

  // Helper to load order pool and online drivers: defaults to all, or filtered by region, then by hub
  const loadData = useCallback(async (regionId?: string, hubId?: string) => {
    setIsLoadingData(true);
    try {
      const [ordersData, driversData] = await Promise.all([
        fetchOrderPool(hubId || undefined, !hubId && regionId ? regionId : undefined),
        fetchOnlineDrivers(hubId || undefined, !hubId && regionId ? regionId : undefined),
      ]);
      setOrderPool(ordersData.map(mapApiOrderToOrder));
      setOnlineDrivers(driversData);
    } catch (err: unknown) {
      console.error('API fetch failed:', err);
      toast.error(
        'Lỗi kết nối máy chủ',
        (err as Error).message || 'Không thể tải dữ liệu đơn hàng và tài xế từ API.',
      );
      setOrderPool([]);
      setOnlineDrivers([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [toast]);

  // Load data whenever selectedRegionId or selectedHubId changes
  useEffect(() => {
    void loadData(selectedRegionId, selectedHubId);
  }, [selectedRegionId, selectedHubId, loadData]);

  // Handle Cascading Hub/Depot dropdown change
  const handleHubChange = useCallback(
    (newHubId: string, depot?: ApiDepot) => {
      setSelectedHubId(newHubId);
      if (depot) {
        setDepots((prev) => {
          const exists = prev.some((d) => d.id === depot.id);
          return exists ? prev.map((d) => (d.id === depot.id ? depot : d)) : [depot, ...prev];
        });
      }
      setSolution(null);
      clearSelection();
    },
    [clearSelection]
  );

  const handleRegionChange = useCallback(
    (newRegionId: string) => {
      setSelectedRegionId(newRegionId);
      setSelectedHubId('');
      setSolution(null);
      clearSelection();
    },
    [clearSelection]
  );

  const newOrders = orderPool;
  const availableDrivers = onlineDrivers;
  const selectedOrders = useMemo(
    () => newOrders.filter((o) => selectedOrderIds.includes(o.id)),
    [newOrders, selectedOrderIds]
  );

  const handleSelectAllNew = useCallback(() => {
    setSelectedOrderIds(newOrders.map((o) => o.id));
  }, [newOrders, setSelectedOrderIds]);

  const displayDepot = useMemo<Depot>(() => {
    const found = depots.find((d) => d.id === selectedHubId);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        address: found.address,
        latitude: Number(found.latitude),
        longitude: Number(found.longitude),
      };
    }
    // If user selected orders, prefer the depot of selected orders
    const orderWithDepot = selectedOrders.find((o) => o.depot);
    if (orderWithDepot?.depot) {
      return orderWithDepot.depot;
    }
    // Fallback to first known depot
    if (depots.length > 0) {
      return {
        id: depots[0].id,
        name: depots[0].name,
        address: depots[0].address,
        latitude: Number(depots[0].latitude),
        longitude: Number(depots[0].longitude),
      };
    }
    return {
      id: selectedHubId || '',
      name: 'Kho điều phối',
      address: '',
      latitude: 10.822,
      longitude: 106.687,
    };
  }, [depots, selectedHubId, selectedOrders]);

  const handleDriverChange = useCallback(
    (routeIndex: number, newDriverId: string) => {
      const newDriver = availableDrivers.find((d) => d.userId === newDriverId);
      if (!newDriver) return;

      const currentRoute = solution?.routes[routeIndex];

      // STEP 2: Prevent Accidental Duplication (UI Warning)
      const isAlreadyAssigned = solution?.routes.some(
        (r, idx) => idx !== routeIndex && (r.driver?.userId === newDriverId || r.driverId === newDriverId)
      );

      if (isAlreadyAssigned) {
        toast.warning(
          'Cảnh báo trùng tài xế',
          'Cảnh báo: Tài xế này đang được gán cho một tuyến khác trong lần điều phối này!',
        );
      }

      if (currentRoute) {
        if (currentRoute.totalWeightKg > newDriver.maxWeightKg) {
          toast.warning(
            'Cảnh báo quá tải',
            `Tải trọng tuyến (${currentRoute.totalWeightKg.toFixed(1)}kg) vượt quá sức chở của ${newDriver.fullName} (${newDriver.maxWeightKg}kg)`,
          );
        } else if (!isAlreadyAssigned) {
          toast.info(
            'Đã đổi tài xế',
            `Tuyến ${routeIndex + 1} chuyển sang ${newDriver.fullName}`,
          );
        }
      }

      setSolution((prev) => {
        if (!prev) return null;
        const updatedRoutes = [...prev.routes];
        const routeToUpdate = updatedRoutes[routeIndex];
        if (!routeToUpdate) return prev;

        // STEP 1: Update specific route in routes state array with all new driver properties
        updatedRoutes[routeIndex] = {
          ...routeToUpdate,
          driver: newDriver,
          driverId: newDriver.userId,
          driverName: newDriver.fullName,
          vehicleType: newDriver.vehicleType,
          licensePlate: newDriver.licensePlate,
          maxWeightAllowedKg: newDriver.maxWeightKg,
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
    [availableDrivers, solution, toast]
  );

  const handleChangeDriver = handleDriverChange;

  const handleRunVRP = useCallback(async () => {
    if (selectedOrders.length === 0 || isOptimizing) return;

    // Check if selected orders span multiple different depots
    const distinctDepotIds = Array.from(
      new Set(selectedOrders.map((o) => o.depotId).filter(Boolean)),
    );
    if (distinctDepotIds.length > 1) {
      toast.warning(
        'Đơn hàng thuộc nhiều kho khác nhau',
        'Các đơn hàng đã chọn thuộc nhiều Kho khác nhau. Vui lòng chọn một Kho cụ thể ở thanh bộ lọc để tối ưu hóa tuyến đường cho từng kho riêng biệt.',
      );
      return;
    }

    const targetDepotId = selectedHubId || (distinctDepotIds.length === 1 ? distinctDepotIds[0] : displayDepot?.id);

    if (!targetDepotId) {
      toast.warning('Chưa chọn Hub', 'Vui lòng chọn Kho điều phối hợp lệ.');
      return;
    }
    setSolution(null);
    setIsOptimizing(true);

    try {
      // Filter drivers that match target depot or have no depot restriction
      const eligibleDrivers = availableDrivers.filter(
        (d) => !targetDepotId || !d.depotId || d.depotId === targetDepotId,
      );
      const driverPool = eligibleDrivers.length > 0 ? eligibleDrivers : availableDrivers;
      const driverIds = driverPool.map((d) => d.userId);

      const result = await runVRPOptimize(
        selectedOrders.map((o) => o.id),
        targetDepotId,
        driverIds.length > 0 ? driverIds : undefined
      );
      setSolution(mapApiSolutionToVrp(result, driverPool));
      toast.success(
        'Tối ưu hóa hoàn tất!',
        `Đã lập thành công ${result.routes.length} tuyến giao hàng.`,
      );
    } catch (err: unknown) {
      console.error('VRP optimize API error:', err);
      toast.error(
        'Lỗi tối ưu hóa tuyến đường',
        (err as Error).message || 'Máy chủ VRP gặp sự cố khi giải toán.',
      );
    } finally {
      setIsOptimizing(false);
    }
  }, [selectedOrders, availableDrivers, displayDepot, isOptimizing, selectedHubId, toast]);

  const handleConfirm = useCallback(async () => {
    if (!solution || solution.routes.length === 0) return;
    setIsConfirming(true);
    try {
      // Build payload strictly from updated solution.routes so manual overrides are guaranteed
      const targetDepotId = solution._api?.depot?.id || displayDepot.id;
      const routesToConfirm = solution.routes.map((r) => ({
        depotId: targetDepotId,
        driverId: r.driver.userId || r.driverId || '',
        stops: r.stops.map((s, idx) => ({
          orderId: s.id,
          sequenceNo: idx + 1,
          latitude: s.latitude,
          longitude: s.longitude,
        })),
        totalDistanceKm: r.totalDistanceKm,
        totalEstimatedTimeMin: r.totalEstimatedTimeMin,
        polyline: r.polyline || [],
      }));

      await apiFetch<{ message: string; routeIds: string[] }>('/vrp/confirm', {
        method: 'POST',
        body: JSON.stringify({ routes: routesToConfirm }),
      });

      toast.success(
        'Điều phối thành công!',
        `Đã điều phối ${solution.routes.length} tuyến tới các tài xế.`,
      );
      setSolution(null);
      clearSelection();
      // Refresh order pool and drivers for current selection
      await loadData(selectedRegionId, selectedHubId);
    } catch (err: unknown) {
      console.error('Confirm dispatch error:', err);
      toast.error(
        'Xác nhận điều phối thất bại',
        (err as Error).message || 'Vui lòng kiểm tra lại.',
      );
    } finally {
      setIsConfirming(false);
    }
  }, [solution, displayDepot, clearSelection, toast, loadData, selectedRegionId, selectedHubId]);

  return (
    <div className="flex gap-5 h-full animate-fade-in min-h-0 relative" style={{ minHeight: 'calc(100vh - 128px)' }}>
      {/* ── Visual Loading State Overlay for OR-Tools / VRP Optimization ── */}
      {isOptimizing && (
        <div className="fixed inset-0 z-[9999] bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
          <VrpLoadingOverlay orderCount={selectedOrders.length} />
        </div>
      )}

      {/* ── Left Panel ── */}
      {isLeftPanelOpen ? (
        <div className="w-72 shrink-0 flex flex-col gap-3 h-[calc(100vh-140px)] min-h-0 transition-all duration-300">
          {/* Real-time Hub Data status indicator */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50/70 text-emerald-800 border border-emerald-200 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isLoadingData ? 'Đang tải...' : 'Dữ liệu thời gian thực'}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-emerald-700 tabular-nums">{newOrders.length} đơn</span>
              <button
                type="button"
                onClick={() => setIsLeftPanelOpen(false)}
                className="text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60 p-1 rounded-md transition-colors"
                title="Thu gọn panel để mở rộng bản đồ"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>

          {/* Orders Pool */}
          <div className="card flex-[3_3_0%] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Đơn hàng chờ phân công</h3>
              <button
                onClick={() => clearSelection()}
                className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
              >
                Bỏ chọn
              </button>
            </div>
            <p className="text-xs text-slate-500 tabular-nums">{selectedOrderIds.length}/{newOrders.length} đã chọn</p>
            <button
              onClick={handleSelectAllNew}
              className="w-full mt-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors tabular-nums"
            >
              Chọn tất cả ({newOrders.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5">
            {newOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-400">
                <Package size={24} className="opacity-30" />
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
                      'w-full text-left p-2.5 rounded-md border transition-colors text-sm',
                      selected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/50'
                    )}
                    id={`vrp-order-${order.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        selected ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
                      )}>
                        {selected && <CheckCircle size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">{order.code}</span>
                            {order.depot && (
                              <span
                                className="text-[9px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-1 py-0.2 rounded truncate max-w-[90px]"
                                title={order.depot.name}
                              >
                                {order.depot.name}
                              </span>
                            )}
                          </div>
                          {order.codAmount > 0 && (
                            <span className="text-[10px] text-emerald-700 font-medium shrink-0 tabular-nums">
                              {formatCurrency(order.codAmount)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-800 font-medium mt-0.5 truncate">{order.receiverName}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{order.deliveryAddress}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 tabular-nums">
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
        <div className="card flex-[2_2_0%] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 shrink-0 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Đội xe khả dụng</h3>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded tabular-nums">
              {availableDrivers.length} online
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5">
            {availableDrivers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-md">
                Không có tài xế nào đang sẵn sàng
              </div>
            ) : (
              availableDrivers.map((driver) => (
                <div key={driver.userId} className="flex items-center gap-2.5 p-2 rounded-md bg-slate-50/70 border border-slate-200/60 hover:bg-slate-100/70 transition-colors">
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                    {driver.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{driver.fullName}</p>
                    <p className="text-[10px] text-slate-500 truncate tabular-nums">
                      {driver.depot ? `${driver.depot.name} · ` : ''}{driver.maxWeightKg}kg · {driver.licensePlate || 'N/A'}
                    </p>
                  </div>
                  <StatusBadge status={driver.currentShiftStatus} showDot={false} className="text-[10px] px-1.5 py-0.5" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="w-12 shrink-0 flex flex-col items-center py-3 bg-white rounded-lg border border-slate-200/80 shadow-xs h-[calc(100vh-140px)] gap-4 transition-all duration-300">
          <button
            type="button"
            onClick={() => setIsLeftPanelOpen(true)}
            className="w-8 h-8 rounded-md bg-slate-50 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center text-slate-600 transition-colors"
            title="Mở rộng danh sách đơn hàng & tài xế"
          >
            <PanelLeftOpen size={16} />
          </button>
          <div className="w-6 h-px bg-slate-200" />
          <div className="flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-600 tabular-nums" title="Đơn đã chọn">
            <Package size={15} className="text-slate-700" />
            <span className="font-mono">{selectedOrderIds.length}</span>
            <span className="text-[9px] text-slate-400">/{newOrders.length}</span>
          </div>
          <div className="w-6 h-px bg-slate-200" />
          <div className="flex flex-col items-center gap-1 text-[11px] font-semibold text-emerald-600 tabular-nums" title="Tài xế online">
            <Truck size={15} />
            <span className="font-mono">{availableDrivers.length}</span>
          </div>
        </div>
      )}

      {/* ── Center Map ── */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Run VRP Button & Multi-Hub Dropdown */}
        <div className="card px-4 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 min-h-[56px]">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Cascading Region -> Hub Selector: Default All, filter Region then Hub */}
            <CascadingRegionHubSelect
              selectedRegionId={selectedRegionId}
              selectedHubId={selectedHubId}
              onRegionChange={handleRegionChange}
              onHubChange={handleHubChange}
              allowAllRegions={true}
              allowAllHubs={true}
              size="sm"
            />

            <div className="border-l border-slate-200 pl-4 py-0.5 hidden sm:flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-900">Tối ưu hóa tuyến đường</p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                <span className="font-semibold text-slate-800">{selectedOrderIds.length}</span>/{newOrders.length} đơn đã chọn · <span className="font-semibold text-emerald-600">{availableDrivers.length}</span> tài xế online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {solution && (
              <button
                onClick={() => { setSolution(null); clearSelection(); }}
                className="btn-secondary text-xs h-8 px-3"
              >
                <RefreshCw size={13} /> Đặt lại
              </button>
            )}
            {solution && !isOptimizing && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="btn-primary text-xs h-8 px-3 bg-emerald-600 border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-50"
                id="btn-confirm-dispatch"
              >
                {isConfirming ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                    Đang xác nhận...
                  </>
                ) : (
                  <>
                    <Send size={13} /> Xác nhận & Điều phối
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleRunVRP}
              disabled={selectedOrderIds.length === 0 || isOptimizing}
              className={cn(
                'btn-brand text-xs h-8 px-3.5 flex items-center gap-2 transition-colors',
                (selectedOrderIds.length === 0 || isOptimizing) && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
              id="btn-run-vrp"
              aria-label="Tối ưu hóa tuyến đường (Optimize Routes)"
              aria-busy={isOptimizing}
            >
              {isOptimizing ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span>Đang tính toán tuyến đường...</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>Tối ưu hóa tuyến đường</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Map area */}
        <div className="relative flex-1 card overflow-hidden" style={{ minHeight: '400px' }}>
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
            <div className={cn(
              "grid gap-4 text-center tabular-nums",
              solution._api?.totalFuelLiters ? "grid-cols-5" : "grid-cols-4"
            )}>
              {[
                { label: 'Tổng tuyến', value: solution.routes.length },
                { label: 'Tổng đơn', value: solution.totalOrders },
                { label: 'Tổng quãng đường', value: `${solution.totalDistanceKm.toFixed(1)} km` },
                ...(solution._api?.totalFuelLiters
                  ? [
                      {
                        label: 'Nhiên liệu ước tính',
                        value: `${solution._api.totalFuelLiters.toFixed(1)} L`,
                      },
                    ]
                  : []),
                { label: 'Thời gian tối ưu', value: `${solution.optimizationTimeMs.toFixed(0)} ms` },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-lg font-semibold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
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
            <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Tóm tắt tuyến đường</h3>
            <p className="text-xs text-slate-500 tabular-nums">{solution.routes.length} tuyến được tạo tối ưu</p>
          </div>
          {solution.routes.map((route, idx) => (
            <RouteSummaryCard
              key={`${route.driver.userId}-${idx}`}
              route={route}
              routeIndex={idx}
              depot={displayDepot}
              availableDrivers={availableDrivers}
              onChangeDriver={handleChangeDriver}
              fuelLiters={solution._api?.routes[idx]?.estimatedFuelLiters}
              fuelCostVnd={solution._api?.routes[idx]?.estimatedFuelCostVnd}
              onMoveStop={handleMoveStop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default withRoleGuard(VrpPage, ['ADMIN', 'DISPATCHER']);
