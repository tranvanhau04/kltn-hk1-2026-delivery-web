'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Search, SlidersHorizontal, ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface FilterTab {
  label: string;
  value: string;
  count?: number;
}

interface DataTableProps<T extends object> {
  data: T[];
  columns: ColumnDef<T>[];
  filterTabs?: FilterTab[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  pageSize?: number;
  actions?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  getRowKey?: (row: T) => string;
  filterKey?: keyof T;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T extends object>({
  data,
  columns,
  filterTabs,
  activeFilter,
  onFilterChange,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  pageSize = 10,
  actions,
  rowActions,
  onRowClick,
  loading = false,
  emptyMessage = 'Không có dữ liệu',
  className,
  getRowKey,
  filterKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const processed = useMemo(() => {
    let result = [...data];

    // Filter by tab
    if (activeFilter && activeFilter !== 'ALL' && filterKey) {
      result = result.filter((row) => String((row as Record<string, unknown>)[filterKey as string]) === activeFilter);
    }

    // Sort
    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey] ?? '';
        const bv = (b as Record<string, unknown>)[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), 'vi');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, activeFilter, filterKey, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const paginated = processed.slice((page - 1) * pageSize, page * pageSize);

  const getCellValue = (row: T, key: string): unknown => {
    const r = row as Record<string, unknown>;
    if (key.includes('.')) {
      return key.split('.').reduce<unknown>((obj, k) => {
        if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k];
        return undefined;
      }, r);
    }
    return r[key];
  };

  return (
    <div className={cn('card flex flex-col overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
        {/* Filter tabs */}
        {filterTabs && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { onFilterChange?.(tab.value); setPage(1); }}
                className={cn(
                  'flex items-center gap-1.5 px-4 h-8 rounded-lg text-sm font-500 whitespace-nowrap transition-all',
                  activeFilter === tab.value
                    ? 'bg-[#FA7070] text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-600',
                    activeFilter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search + actions row */}
        <div className="flex items-center gap-3">
          {onSearchChange && (
            <div className="relative flex items-center flex-1 max-w-xs">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                className="input-base pl-10 h-9 text-sm w-full"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {actions}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide whitespace-nowrap',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                    col.width
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === String(col.key) ? (
                        sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-30" />
                      )
                    )}
                  </span>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3 text-xs font-600 text-gray-500 uppercase tracking-wide text-center">
                  <SlidersHorizontal size={14} className="inline" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3.5">
                      <div className="shimmer h-4 rounded" style={{ width: '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={32} className="opacity-20" />
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, ri) => (
                <tr
                  key={getRowKey ? getRowKey(row) : ri}
                  className={cn(
                    'border-b border-slate-50 transition-colors group',
                    onRowClick && 'cursor-pointer hover:bg-[#FFF0F0]/50'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => {
                    const key = String(col.key);
                    const raw = getCellValue(row, key);
                    return (
                      <td
                        key={key}
                        className={cn(
                          'px-4 py-3.5 text-gray-700',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                      >
                        {col.render ? col.render(raw, row, ri) : String(raw ?? '–')}
                      </td>
                    );
                  })}
                  {rowActions && (
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {rowActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 shrink-0">
        <p className="text-xs text-gray-400">
          Hiển thị {Math.min((page - 1) * pageSize + 1, processed.length)}–{Math.min(page * pageSize, processed.length)} / {processed.length} bản ghi
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-8 h-8 rounded-lg text-sm font-500 transition-colors',
                  page === p
                    ? 'bg-[#FA7070] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
