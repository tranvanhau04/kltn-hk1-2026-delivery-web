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
  serverPagination?: boolean;
  currentPage?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
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
  serverPagination = false,
  currentPage = 1,
  totalItems,
  onPageChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);

  const activePage = serverPagination ? currentPage : page;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    if (serverPagination) {
      onPageChange?.(1);
    } else {
      setPage(1);
    }
  };

  const processed = useMemo(() => {
    const needFilter = Boolean(!serverPagination && activeFilter && activeFilter !== 'ALL' && filterKey);
    const needSort = Boolean(sortKey && sortDir);

    if (!needFilter && !needSort) {
      return data;
    }

    const result = needFilter
      ? data.filter((row) => String((row as Record<string, unknown>)[filterKey as string]) === activeFilter)
      : [...data];

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
  }, [data, activeFilter, filterKey, sortKey, sortDir, serverPagination]);

  const activeTotal = serverPagination ? (totalItems !== undefined ? totalItems : data.length) : processed.length;
  const totalPages = Math.max(1, Math.ceil(activeTotal / pageSize));
  const displayRows = serverPagination ? processed : processed.slice((page - 1) * pageSize, page * pageSize);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (serverPagination) {
      onPageChange?.(newPage);
    } else {
      setPage(newPage);
    }
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (activePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (activePage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages);
      }
    }
    return pages;
  }, [totalPages, activePage]);

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
    <div className={cn('bg-white rounded-lg border border-slate-200/80 shadow-xs flex flex-col overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="p-3.5 space-y-3 shrink-0">
        {/* Filter tabs */}
        {filterTabs && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { onFilterChange?.(tab.value); setPage(1); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                  activeFilter === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    'text-[11px] px-1.5 py-0.2 rounded font-semibold tabular-nums',
                    activeFilter === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
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
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                className="input-base pl-9 h-8 text-xs w-full"
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
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-y border-slate-200">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap text-left',
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
                        sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-35" />
                      )
                    )}
                  </span>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">
                  <SlidersHorizontal size={13} className="inline" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-2.5">
                      <div className="shimmer h-4 rounded" style={{ width: '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={28} className="opacity-25" />
                    <span className="text-xs font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayRows.map((row, ri) => (
                <tr
                  key={getRowKey ? getRowKey(row) : ri}
                  className={cn(
                    'py-2.5 text-sm text-slate-700 border-b border-slate-100 hover:bg-slate-50/70 transition-colors group',
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
                          'px-4 py-2.5 text-sm text-slate-700',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right tabular-nums'
                        )}
                      >
                        {col.render ? col.render(raw, row, ri) : String(raw ?? '–')}
                      </td>
                    );
                  })}
                  {rowActions && (
                    <td className="px-4 py-2.5 text-center">
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
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/40 shrink-0">
        <p className="text-xs text-slate-500 tabular-nums">
          Hiển thị {activeTotal === 0 ? 0 : (activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, activeTotal)} / {activeTotal} bản ghi
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(activePage - 1)}
            disabled={activePage === 1}
            className="flex items-center justify-center w-7 h-7 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Trang trước"
          >
            <ChevronLeft size={15} />
          </button>
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 select-none">
                  ...
                </span>
              );
            }
            const pageNum = Number(p);
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={cn(
                  'w-7 h-7 rounded-md text-xs font-medium tabular-nums transition-colors',
                  activePage === pageNum
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => handlePageChange(activePage + 1)}
            disabled={activePage === totalPages}
            className="flex items-center justify-center w-7 h-7 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Trang sau"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
