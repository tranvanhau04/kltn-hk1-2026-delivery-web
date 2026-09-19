/**
 * API Client for IUH Logistics Web Dashboard
 * Connects to NestJS backend on localhost:3001
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== '')
  ? process.env.NEXT_PUBLIC_API_URL
  : 'http://localhost:3001/api';

// ─── Types ────────────────────────────────────────────────────────────────────

import type { OrderStatus, Driver } from '@/types/domain';

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
  status: OrderStatus;
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
  const fullUrl = `${API_BASE}${path}`;
  const res = await fetch(fullUrl, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${fullUrl} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Fetch all depots from the backend */
export async function fetchDepots(): Promise<ApiDepot[]> {
  return apiFetch<ApiDepot[]>('/depots');
}

/** Fetch all orders from the backend */
export async function fetchOrders(): Promise<ApiOrder[]> {
  return apiFetch<ApiOrder[]>('/orders');
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

/** Fetch all drivers from the backend */
export async function fetchDrivers(): Promise<Driver[]> {
  return apiFetch<Driver[]>('/drivers');
}

// ─── Orders – Coordinate Patch ────────────────────────────────────────────────

/**
 * PATCH /orders/:id/coordinates
 * Dispatcher-initiated coordinate correction.
 * Throws if order is in DELIVERED status (backend returns 400).
 */
export async function patchOrderCoordinates(
  orderId: string,
  latitude: number,
  longitude: number,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${orderId}/coordinates`, {
    method: 'PATCH',
    body: JSON.stringify({ latitude, longitude }),
  });
}

// ─── Zones ────────────────────────────────────────────────────────────────────

export interface ApiZoneMetrics {
  totalOrders: number;
  demandWeight: number;
  demandVolume: number;
  activeDriversCount: number;
  fleetCapacityWeight: number;
  fleetCapacityVolume: number;
  weightRatio: number;
  volumeRatio: number;
  isOverloaded: boolean;
  overloadSeverity: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface ApiZone {
  id: string;
  name: string;
  boundaryGeoJson: object | null;
  createdAt: string;
  assignedDriverIds: string[];
  metrics: ApiZoneMetrics;
}

/** GET /zones — all zones with live overload metrics */
export async function fetchZones(): Promise<ApiZone[]> {
  return apiFetch<ApiZone[]>('/zones');
}

/** GET /zones/:id — single zone with live metrics */
export async function fetchZone(id: string): Promise<ApiZone> {
  return apiFetch<ApiZone>(`/zones/${id}`);
}

/** POST /zones — create a new zone */
export async function createZone(name: string, boundaryGeoJson?: string): Promise<ApiZone> {
  return apiFetch<ApiZone>('/zones', {
    method: 'POST',
    body: JSON.stringify({ name, boundaryGeoJson }),
  });
}

/** PATCH /zones/:id/boundary — update GeoJSON polygon */
export async function updateZoneBoundary(
  zoneId: string,
  boundaryGeoJson: string,
): Promise<ApiZone> {
  return apiFetch<ApiZone>(`/zones/${zoneId}/boundary`, {
    method: 'PATCH',
    body: JSON.stringify({ boundaryGeoJson }),
  });
}

/**
 * POST /zones/:id/drivers — assign driver(s) to zone.
 * Idempotent: duplicates silently ignored by backend.
 */
export async function assignDriversToZone(
  zoneId: string,
  driverIds: string[],
): Promise<ApiZone> {
  return apiFetch<ApiZone>(`/zones/${zoneId}/drivers`, {
    method: 'POST',
    body: JSON.stringify({ driverIds }),
  });
}

/** DELETE /zones/:id/drivers/:driverId — remove driver from zone */
export async function unassignDriverFromZone(
  zoneId: string,
  driverId: string,
): Promise<ApiZone> {
  return apiFetch<ApiZone>(`/zones/${zoneId}/drivers/${driverId}`, {
    method: 'DELETE',
  });
}
