import { cn } from '@/lib/utils';
import type { OrderStatus, StopStatus, RouteStatus, ShiftStatus, DriverShiftStatus } from '@/types/domain';

type StatusValue =
  | OrderStatus
  | StopStatus
  | RouteStatus
  | ShiftStatus
  | DriverShiftStatus
  | 'ACTIVE'
  | 'INACTIVE'
  | 'LOCKED';

const BASE_BADGE = 'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap';

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  // Order statuses
  NEW:          { label: 'Mới',         className: 'bg-slate-50 text-slate-700 border-slate-200',       dot: 'bg-slate-400' },
  ASSIGNED:     { label: 'Đã giao',     className: 'bg-indigo-50/70 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  IN_TRANSIT:   { label: 'Đang giao',   className: 'bg-sky-50/70 text-sky-700 border-sky-200',          dot: 'bg-sky-500' },
  DELIVERED:    { label: 'Hoàn thành',  className: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  FAILED:       { label: 'Thất bại',    className: 'bg-red-50/70 text-red-700 border-red-200',          dot: 'bg-red-500' },
  RESCHEDULED:  { label: 'Dời lịch',    className: 'bg-amber-50/70 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },

  // Stop statuses
  PENDING:      { label: 'Chờ',         className: 'bg-slate-50 text-slate-700 border-slate-200',       dot: 'bg-slate-400' },
  ARRIVED:      { label: 'Đã đến',      className: 'bg-sky-50/70 text-sky-700 border-sky-200',          dot: 'bg-sky-500' },
  COMPLETED:    { label: 'Xong',        className: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  SKIPPED:      { label: 'Bỏ qua',      className: 'bg-amber-50/70 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },

  // Route statuses
  PLANNED:      { label: 'Kế hoạch',    className: 'bg-indigo-50/70 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  IN_PROGRESS:  { label: 'Đang chạy',   className: 'bg-sky-50/70 text-sky-700 border-sky-200',          dot: 'bg-sky-500' },
  CANCELLED:    { label: 'Hủy',         className: 'bg-red-50/70 text-red-700 border-red-200',          dot: 'bg-red-500' },

  // User account statuses
  ACTIVE:       { label: 'Hoạt động',   className: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  INACTIVE:     { label: 'Không HĐ',    className: 'bg-red-50/70 text-red-700 border-red-200',          dot: 'bg-red-500' },
  LOCKED:       { label: 'Đã khóa',     className: 'bg-red-50/70 text-red-800 border-red-200',          dot: 'bg-red-600' },

  // Driver shift (aligned with backend: OFFLINE, ONLINE_READY, BUSY + legacy ON_DUTY/OFF_DUTY)
  OFFLINE:      { label: 'Offline',     className: 'bg-slate-50 text-slate-600 border-slate-200',       dot: 'bg-slate-400' },
  ONLINE_READY: { label: 'Sẵn sàng',    className: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  BUSY:         { label: 'Đang giao',   className: 'bg-sky-50/70 text-sky-700 border-sky-200',          dot: 'bg-sky-500' },
  ON_DUTY:      { label: 'Đang trực',   className: 'bg-emerald-50/70 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  OFF_DUTY:     { label: 'Nghỉ ca',     className: 'bg-slate-50 text-slate-600 border-slate-200',       dot: 'bg-slate-400' },
};

interface StatusBadgeProps {
  status: StatusValue;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span className={cn(BASE_BADGE, config.className, className)}>
      {showDot && (
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
      )}
      {config.label}
    </span>
  );
}
