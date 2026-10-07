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
      <div className="p-3.5 border-b border-slate-200 space-y-3 shrink-0">
        {/* Filter tabs */}
        {filterTabs && (
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-slate-100 rounded-md w-fit max-w-full">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { onFilterChange?.(tab.value); setPage(1); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium whitespace-nowrap transition-all',
                  activeFilter === tab.value
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded font-semibold',
                    activeFilter === tab.value ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/70 text-slate-500'
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
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                className="input-base pl-8 h-8 text-xs w-full bg-slate-50/50 hover:bg-white focus:bg-white"
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
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-3.5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-left',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-slate-800',
                    col.width
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === String(col.key) ? (
                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )
                    )}
                  </span>
                </th>
              ))}
              {rowActions && (
                <th className="px-3.5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center w-16">
                  <SlidersHorizontal size={13} className="inline text-slate-400" />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-3.5 py-3">
                      <div className="h-3.5 bg-slate-200 rounded" style={{ width: '65%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={28} className="opacity-25" />
                    <span className="text-xs">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, ri) => (
                <tr
                  key={getRowKey ? getRowKey(row) : ri}
                  className={cn(
                    'transition-colors group hover:bg-slate-50/80',
                    onRowClick && 'cursor-pointer'
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
                          'px-3.5 py-2.5 text-slate-700',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                      >
                        {col.render ? col.render(raw, row, ri) : String(raw ?? '–')}
                      </td>
                    );
                  })}
                  {rowActions && (
                    <td className="px-3.5 py-2.5 text-center">
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
      <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-slate-200 shrink-0">
        <p className="text-xs text-slate-500">
          Hiển thị {Math.min((page - 1) * pageSize + 1, processed.length)}–{Math.min(page * pageSize, processed.length)} / {processed.length} bản ghi
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-7 h-7 rounded text-xs font-medium transition-colors border',
                  page === p
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
