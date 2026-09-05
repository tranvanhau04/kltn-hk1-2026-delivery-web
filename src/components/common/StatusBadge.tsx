import { cn } from '@/lib/utils';
import type { OrderStatus, StopStatus, RouteStatus, ShiftStatus, DriverShiftStatus } from '@/types/domain';

type StatusValue =
  | OrderStatus
  | StopStatus
  | RouteStatus
  | ShiftStatus
  | DriverShiftStatus
  | 'ACTIVE'
  | 'INACTIVE';

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  // Order statuses
  NEW:          { label: 'Mới',        className: 'badge badge-new',        dot: 'bg-zinc-400' },
  ASSIGNED:     { label: 'Đã giao',   className: 'badge badge-assigned',   dot: 'bg-violet-500' },
  IN_TRANSIT:   { label: 'Đang giao', className: 'badge badge-transit',    dot: 'bg-blue-500' },
  DELIVERED:    { label: 'Hoàn thành',className: 'badge badge-delivered',  dot: 'bg-green-500' },
  FAILED:       { label: 'Thất bại',  className: 'badge badge-failed',     dot: 'bg-red-500' },
  RESCHEDULED:  { label: 'Dời lịch',  className: 'badge badge-rescheduled',dot: 'bg-yellow-500' },

  // Stop statuses
  PENDING:      { label: 'Chờ',       className: 'badge badge-new',        dot: 'bg-zinc-400' },
  ARRIVED:      { label: 'Đã đến',    className: 'badge badge-transit',    dot: 'bg-blue-500' },
  COMPLETED:    { label: 'Xong',      className: 'badge badge-delivered',  dot: 'bg-green-500' },
  SKIPPED:      { label: 'Bỏ qua',   className: 'badge badge-rescheduled',dot: 'bg-yellow-500' },

  // Route statuses
  PLANNED:      { label: 'Kế hoạch',  className: 'badge badge-assigned',  dot: 'bg-violet-500' },
  IN_PROGRESS:  { label: 'Đang chạy', className: 'badge badge-transit',   dot: 'bg-blue-500' },
  CANCELLED:    { label: 'Hủy',       className: 'badge badge-failed',    dot: 'bg-red-500' },

  // Shift statuses
  ACTIVE:       { label: 'Hoạt động', className: 'badge badge-delivered', dot: 'bg-green-500' },
  INACTIVE:     { label: 'Không HĐ',  className: 'badge badge-failed',    dot: 'bg-red-500' },

  // Driver shift
  ON_DUTY:      { label: 'On Duty',   className: 'badge badge-delivered', dot: 'bg-green-500' },
  OFF_DUTY:     { label: 'Off Duty',  className: 'badge badge-new',       dot: 'bg-zinc-400' },
  ON_BREAK:     { label: 'Nghỉ giữa',className: 'badge badge-rescheduled',dot: 'bg-yellow-500' },
};

interface StatusBadgeProps {
  status: StatusValue;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'badge badge-new',
    dot: 'bg-zinc-400',
  };

  return (
    <span className={cn(config.className, className)}>
      {showDot && (
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', config.dot)} />
      )}
      {config.label}
    </span>
  );
}
