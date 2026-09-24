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
  
  // Retrieve token from localStorage if available
  let token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  
  // Fallback dev token for testing if no token is found
  if (!token && process.env.NODE_ENV === 'development') {
    token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3ODk4MjU1ODcsImV4cCI6MTgyMTM4MzE4N30.-nGTW1elOIaxLav_V2C6u6DdDjY3HPn8n_5bXc6gDbc';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      // Auto-redirect to login on token expiry — Bug #8 fix
      localStorage.removeItem('accessToken');
      localStorage.removeItem('iuh_user');
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
      // Throw so callers don't try to process undefined data
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(`API ${fullUrl} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string, email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword, email }),
  });
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Fetch all depots from the backend */
export async function fetchDepots(): Promise<ApiDepot[]> {
  return apiFetch<ApiDepot[]>('/depots');
}

/** Fetch all orders from the backend */
export async function fetchOrders(query?: { status?: string | string[], zoneId?: string, search?: string, page?: number, limit?: number }): Promise<{ data: ApiOrder[], total: number }> {
  const params = new URLSearchParams();
  if (query) {
    if (query.status) {
      if (Array.isArray(query.status)) query.status.forEach(s => params.append('status', s));
      else params.append('status', query.status);
    }
    if (query.zoneId) params.append('zoneId', query.zoneId);
    if (query.search) params.append('search', query.search);
    if (query.page) params.append('page', String(query.page));
    if (query.limit) params.append('limit', String(query.limit));
  }
  const qs = params.toString();
  return apiFetch<{ data: ApiOrder[], total: number }>(`/orders${qs ? `?${qs}` : ''}`);
}

/** Create a new order */
export async function createOrder(data: Partial<ApiOrder>): Promise<ApiOrder> {
  return apiFetch<ApiOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  const res = await apiFetch<{ data: unknown[] }>('/drivers?limit=100');
  type RawDriver = Driver & { user?: { fullName?: string; phone?: string; email?: string } };
  return (res.data as RawDriver[]).map(d => ({
    ...d,
    fullName: d.user?.fullName || '',
    phone: d.user?.phone || '',
    email: d.user?.email || '',
  }));
}

/** Create Driver profile */
export async function createDriver(userId: string, data: Partial<Driver>): Promise<Driver> {
  return apiFetch<Driver>(`/drivers/${userId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update Driver specs */
export async function updateDriverSpecs(userId: string, data: Partial<Driver>): Promise<Driver> {
  return apiFetch<Driver>(`/drivers/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Update Driver shift status */
export async function updateShiftStatus(userId: string, currentShiftStatus: string): Promise<Driver> {
  return apiFetch<Driver>(`/drivers/${userId}/shift-status`, {
    method: 'PATCH',
    body: JSON.stringify({ currentShiftStatus }),
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<unknown[]> {
  const res = await apiFetch<{ data: unknown[] }>('/users?limit=100');
  return res.data;
}

export async function createUser(data: unknown): Promise<unknown> {
  return apiFetch<unknown>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUserStatus(userId: string, status: string): Promise<unknown> {
  return apiFetch<unknown>(`/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function importOrdersExcel(file: File): Promise<unknown> {
  const fullUrl = `${API_BASE}/orders/import-excel`;
  const formData = new FormData();
  formData.append('file', file);
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body: formData,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API failed: ${res.statusText} - ${text}`);
  }
  return res.json();
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
