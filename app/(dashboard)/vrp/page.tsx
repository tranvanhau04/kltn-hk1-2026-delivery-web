'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Package, CheckCircle,
  ChevronRight, RefreshCw,
  Weight, Box, Send, MapPin, Truck, Phone, Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CascadingRegionHubSelect } from '@/components/common/CascadingRegionHubSelect';
import { useApp } from '@/context/AppContext';
import { formatCurrency, cn } from '@/lib/utils';
import { withRoleGuard } from '@/components/auth/withRoleGuard';
import {
  fetchOrderPool,
  fetchDepots,
  fetchOnlineDrivers,
  runVRPOptimize,
  confirmVRPDispatch,
  apiFetch,
  type ApiVrpSolution,
  type ApiOrder,
  type ApiDepot,
} from '@/lib/api';
import type { Order, Driver, Depot, VrpSolution, VrpRoute, Region } from '@/types/domain';
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
    <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 flex flex-col items-center animate-fade-in select-none">
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
      <div className="w-72 shrink-0 flex flex-col gap-3 h-[calc(100vh-140px)] min-h-0">
        {/* Real-time Hub Data status indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-600 bg-emerald-50 text-emerald-800 border border-emerald-100 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isLoadingData ? 'Đang tải...' : 'Dữ liệu thời gian thực'}
          </span>
          <span className="font-mono text-emerald-700">{newOrders.length} đơn</span>
        </div>

        {/* Orders Pool */}
        <div className="card flex-[3_3_0%] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 shrink-0">
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

          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5">
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs font-600 text-[#FA7070]">{order.code}</span>
                            {order.depot && (
                              <span
                                className="text-[9px] font-600 text-blue-700 bg-blue-50 px-1 py-0.5 rounded truncate max-w-[90px]"
                                title={order.depot.name}
                              >
                                {order.depot.name}
                              </span>
                            )}
                          </div>
                          {order.codAmount > 0 && (
                            <span className="text-[10px] text-green-600 font-500 shrink-0">
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
        <div className="card flex-[2_2_0%] flex flex-col min-h-0 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 shrink-0 flex items-center justify-between">
            <h3 className="text-sm font-700 text-gray-900">Đội xe khả dụng</h3>
            <span className="text-[11px] font-600 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {availableDrivers.length} online
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
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
                    <p className="text-[10px] text-gray-400 truncate">
                      {driver.depot ? `${driver.depot.name} · ` : ''}{driver.maxWeightKg}kg · {driver.licensePlate || 'N/A'}
                    </p>
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
        {/* Run VRP Button & Multi-Hub Dropdown */}
        <div className="card px-4 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 min-h-[60px]">
          <div className="flex items-center gap-4 flex-wrap min-h-[40px]">
            {/* Cascading Region -> Hub Selector: Default All, filter Region then Hub */}
            <CascadingRegionHubSelect
              selectedRegionId={selectedRegionId}
              selectedHubId={selectedHubId}
              onRegionChange={handleRegionChange}
              onHubChange={handleHubChange}
              allowAllRegions={true}
              allowAllHubs={true}
              size="md"
            />

            <div className="border-l border-gray-200 pl-4 py-1 hidden sm:flex flex-col justify-center">
              <p className="text-sm font-700 text-gray-800">Tối ưu hóa tuyến đường</p>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-700">{selectedOrderIds.length}</span>/{newOrders.length} đơn đã chọn · <span className="font-semibold text-emerald-600">{availableDrivers.length}</span> tài xế online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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
                'btn-primary text-sm flex items-center gap-2 transition-all duration-200 shadow-sm',
                (selectedOrderIds.length === 0 || isOptimizing) && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
              id="btn-run-vrp"
              aria-label="Tối ưu hóa tuyến đường (Optimize Routes)"
              aria-busy={isOptimizing}
            >
              {isOptimizing ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Đang tính toán tuyến đường (Optimizing)...</span>
                </>
              ) : (
                <>
                  <Zap size={15} />
                  <span>Tối ưu hóa tuyến đường (Optimize Routes)</span>
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

export default withRoleGuard(VrpPage, ['ADMIN', 'DISPATCHER']);
