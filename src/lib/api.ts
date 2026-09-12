/**
 * API Client for IUH Logistics Web Dashboard
 * Connects to NestJS backend on localhost:3001
 */

const API_BASE = 'http://localhost:3001/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiOrder {
  id: string;
  code: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  weightKg: number;
  volumeM3: number;
  codAmount: number;
  status: string;
  createdAt: string;
}

export interface ApiDepot {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface ApiVrpStopResult {
  sequenceNo: number;
  orderId: string;
  code: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  weightKg: number;
  codAmount: number;
}

export interface ApiVrpRouteResult {
  driverId: string;
  driverName: string;
  licensePlate: string;
  vehicleType: string;
  color: string;
  stops: ApiVrpStopResult[];
  totalDistanceKm: number;
  totalEstimatedTimeMin: number;
  totalWeightKg: number;
  polyline: [number, number][];
}

export interface ApiVrpSolution {
  routes: ApiVrpRouteResult[];
  totalDistanceKm: number;
  totalOrders: number;
  optimizationTimeMs: number;
  depot: ApiDepot;
}

export interface ApiLiveDriver {
  driverId: string;
  fullName: string;
  phone: string;
  licensePlate: string;
  vehicleType: string;
  currentShiftStatus: string;
  currentLat: number | null;
  currentLng: number | null;
  /** true when the backend has no real GPS log for this driver */
  positionUnknown: boolean;
  lastUpdated: string | null;
  activeRoute: {
    routeId: string;
    totalDistanceKm: number;
    totalEstimatedTimeMin: number;
    status: string;
    polyline: [number, number][];
  } | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Fetch all depots from the backend */
export async function fetchDepots(): Promise<ApiDepot[]> {
  return apiFetch<ApiDepot[]>('/depots');
}

/** Fetch all unassigned (NEW) orders from the backend */
export async function fetchOrderPool(): Promise<ApiOrder[]> {
  return apiFetch<ApiOrder[]>('/orders/pool');
}

/** Run VRP optimization on selected orders/drivers */
export async function runVRPOptimize(
  orderIds: string[],
  depotId?: string,
  driverIds?: string[],
): Promise<ApiVrpSolution> {
  return apiFetch<ApiVrpSolution>('/vrp/optimize', {
    method: 'POST',
    body: JSON.stringify({ orderIds, depotId, driverIds }),
  });
}

/** Confirm and dispatch VRP solution — writes routes/stops to DB */
export async function confirmVRPDispatch(solution: ApiVrpSolution): Promise<{ message: string; routeIds: string[] }> {
  const routes = solution.routes.map((r) => ({
    depotId: solution.depot.id,
    driverId: r.driverId,
    stops: r.stops.map((s) => ({
      orderId: s.orderId,
      sequenceNo: s.sequenceNo,
      latitude: s.latitude,
      longitude: s.longitude,
    })),
    totalDistanceKm: r.totalDistanceKm,
    totalEstimatedTimeMin: r.totalEstimatedTimeMin,
    polyline: r.polyline,
  }));

  return apiFetch<{ message: string; routeIds: string[] }>('/vrp/confirm', {
    method: 'POST',
    body: JSON.stringify({ routes }),
  });
}

/** Fetch live driver positions + active route polylines */
export async function fetchLiveTracking(): Promise<ApiLiveDriver[]> {
  return apiFetch<ApiLiveDriver[]>('/tracking/live');
}
