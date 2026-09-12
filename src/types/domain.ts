// ============================================================
// SmartExpress / IUH Logistics — Domain Types
// Maps 1:1 to the ERD / Class Diagram
// ============================================================

// --------------- Enums ---------------

export type UserRole = 'ADMIN' | 'DISPATCHER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type VehicleType = 'MOTORBIKE' | 'VAN_500KG' | 'TRUCK_1TON' | 'TRUCK_2TON';
export type ShiftStatus = 'ACTIVE' | 'COMPLETED' | 'PENDING';
export type DriverShiftStatus = 'ON_DUTY' | 'OFF_DUTY' | 'ON_BREAK';

export type OrderStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'RESCHEDULED';

export type StopStatus = 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type RouteStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// --------------- Core Entities ---------------

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO datetime
}

export interface Driver {
  userId: string; // FK → USER.id
  licensePlate: string;
  vehicleType: VehicleType;
  maxWeightKg: number;
  maxVolumeM3: number;
  currentShiftStatus: DriverShiftStatus;
  // Denormalized from User for convenience
  fullName: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  // Live tracking (populated from TrackingLog)
  currentLat?: number;
  currentLng?: number;
  currentSpeedKmh?: number;
}

export interface Depot {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Zone {
  id: string;
  name: string;
  boundaryGeoJson: string; // GeoJSON polygon string
  createdAt: string;
  // Derived
  drivers?: Driver[];
  orderCount?: number;
  capacity?: number; // max orders
}

export interface Order {
  id: string;
  code: string;
  dispatcherId: string; // FK → USER.id
  zoneId?: string; // FK → ZONE.id (nullable)
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
  // Denormalized for display
  driverName?: string;
  driverId?: string;
  estimatedDelivery?: string;
  notes?: string;
}

export interface Shift {
  id: string;
  driverId: string; // FK → DRIVER.user_id
  startTime: string;
  endTime?: string;
  status: ShiftStatus;
  codCollected: number;
  codSubmitted: number;
  reconciledBy?: string; // FK → USER.id (nullable)
  reconciledAt?: string; // nullable
}

export interface Route {
  id: string;
  depotId: string;
  driverId: string;
  shiftId?: string; // nullable
  dispatcherId: string;
  routeDate: string;
  totalDistanceKm: number;
  totalEstimatedTimeMin: number;
  status: RouteStatus;
  polyline: string; // encoded polyline or GeoJSON
  stops?: Stop[];
}

export interface Stop {
  id: string;
  routeId: string;
  orderId: string;
  sequenceNo: number;
  arrivedAt?: string;
  status: StopStatus;
  // Denormalized
  order?: Order;
}

export interface ProofOfDelivery {
  id: string;
  stopId: string; // FK → STOP.id
  photoUrl?: string;
  codCollected: number;
  failureReason?: string;
  rescheduledDate?: string;
  confirmedAt?: string;
}

export interface TrackingLog {
  id: string;
  driverId: string; // FK → DRIVER.user_id
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

// --------------- Reports ---------------

export interface Report {
  id: string;
  dispatcherId: string;
  fromDate: string;
  toDate: string;
  totalOrders: number;
  successfulOrders: number;
  totalCodCollected: number;
  createdAt: string;
}

export interface DriverPerformance {
  driver: Driver;
  totalOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  successRate: number;
  codCollected: number;
  codSubmitted: number;
  isReconciled: boolean;
  shiftId?: string;
}

// --------------- VRP (Frontend-only) ---------------

export interface VrpSolution {
  routes: VrpRoute[];
  totalDistanceKm: number;
  totalOrders: number;
  optimizationTimeMs: number;
}

export interface VrpRoute {
  driver: Driver;
  stops: Order[];
  totalDistanceKm: number;
  totalEstimatedTimeMin: number;
  totalWeightKg: number;
  totalVolM3: number;
  color: string; // hex color for map polyline
  polyline?: [number, number][];
}

// --------------- Navigation ---------------

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name
  badge?: number;
}
