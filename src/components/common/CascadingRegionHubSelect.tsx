'use client';

import React, { useState, useEffect } from 'react';
import { Globe, MapPin, Loader2 } from 'lucide-react';
import { fetchRegions, fetchDepots, type ApiDepot } from '@/lib/api';
import type { Region } from '@/types/domain';
import { cn } from '@/lib/utils';

export interface CascadingRegionHubSelectProps {
  selectedRegionId?: string;
  selectedHubId?: string;
  onRegionChange?: (regionId: string, region?: Region) => void;
  onHubChange: (hubId: string, depot?: ApiDepot, region?: Region) => void;
  allowAllRegions?: boolean;
  allowAllHubs?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function CascadingRegionHubSelect({
  selectedRegionId = '',
  selectedHubId = '',
  onRegionChange,
  onHubChange,
  allowAllRegions = true,
  allowAllHubs = true,
  className = '',
  size = 'md',
}: CascadingRegionHubSelectProps) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [depots, setDepots] = useState<ApiDepot[]>([]);
  const [loadingRegions, setLoadingRegions] = useState<boolean>(true);
  const [loadingDepots, setLoadingDepots] = useState<boolean>(false);

  // 1. Load regions once on mount
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadingRegions(true);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const data = await fetchRegions();
          if (!active) return;
          setRegions(data);
          break;
        } catch (err) {
          if (attempt === 3) {
            console.error('Failed to fetch regions after 3 attempts:', err);
          } else {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }
      if (active) setLoadingRegions(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch depots whenever selectedRegionId changes (strictly independent of selectedHubId)
  useEffect(() => {
    let active = true;

    const loadDepots = async () => {
      setLoadingDepots(true);
      try {
        const depotList = await fetchDepots(selectedRegionId || undefined);
        if (!active) return;
        setDepots(depotList);
      } catch (err) {
        console.error(`Failed to fetch depots for region ${selectedRegionId}:`, err);
        if (active) setDepots([]);
      } finally {
        if (active) setLoadingDepots(false);
      }
    };

    void loadDepots();

    return () => {
      active = false;
    };
  }, [selectedRegionId]);

  // 3. If "All Hubs" is disallowed and no hub is currently selected, select the first available depot
  useEffect(() => {
    if (!allowAllHubs && depots.length > 0 && !selectedHubId) {
      const firstDepot = depots[0];
      const currentRegion = regions.find((r) => r.id === selectedRegionId);
      onHubChange(firstDepot.id, firstDepot, currentRegion);
    }
  }, [allowAllHubs, depots, selectedHubId, selectedRegionId, regions, onHubChange]);

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRegionId = e.target.value;
    const currentRegion = regions.find((r) => r.id === newRegionId);
    onRegionChange?.(newRegionId, currentRegion);
    // Explicit user action: reset hub selection when region changes
    onHubChange('', undefined, currentRegion);
  };

  const handleHubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHubId = e.target.value;
    const currentRegion = regions.find((r) => r.id === selectedRegionId);
    const matchedDepot = depots.find((d) => d.id === newHubId);
    onHubChange(newHubId, matchedDepot, currentRegion);
  };

  const isSmall = size === 'sm';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* 1. Region Selector */}
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="region-select"
          className={cn(
            'font-700 text-gray-500 whitespace-nowrap flex items-center gap-1',
            isSmall ? 'text-[11px]' : 'text-xs',
          )}
        >
          <Globe size={isSmall ? 13 : 14} className="text-blue-500 shrink-0" />
          Khu vực:
        </label>
        <div className="relative">
          <select
            id="region-select"
            value={selectedRegionId || ''}
            onChange={handleRegionChange}
            disabled={loadingRegions}
            className={cn(
              'bg-white border border-gray-300 text-gray-800 font-600 rounded-lg focus:ring-[#FA7070] focus:border-[#FA7070] cursor-pointer shadow-2xs hover:border-gray-400 transition-colors pr-7',
              isSmall ? 'text-xs py-1.5 px-2.5 h-8' : 'text-xs py-2 px-3 h-9',
              loadingRegions && 'opacity-60 cursor-not-allowed',
            )}
            aria-label="Chọn khu vực quản lý"
          >
            {loadingRegions ? (
              <option value="">Đang tải khu vực...</option>
            ) : (
              <>
                {allowAllRegions && <option value="">Tất cả khu vực</option>}
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      {/* 2. Hub / Depot Selector */}
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="hub-select"
          className={cn(
            'font-700 text-gray-500 whitespace-nowrap flex items-center gap-1',
            isSmall ? 'text-[11px]' : 'text-xs',
          )}
        >
          <MapPin size={isSmall ? 13 : 14} className="text-[#FA7070] shrink-0" />
          Kho / Hub:
        </label>
        <div className="relative">
          <select
            id="hub-select"
            value={selectedHubId || ''}
            onChange={handleHubChange}
            disabled={loadingDepots || (!allowAllHubs && depots.length === 0)}
            className={cn(
              'bg-white border border-gray-300 text-gray-800 font-600 rounded-lg focus:ring-[#FA7070] focus:border-[#FA7070] cursor-pointer shadow-2xs hover:border-gray-400 transition-colors pr-7 max-w-[220px] truncate',
              isSmall ? 'text-xs py-1.5 px-2.5 h-8' : 'text-xs py-2 px-3 h-9',
              loadingDepots && 'opacity-60 cursor-not-allowed',
            )}
            aria-label="Chọn Hub / Kho điều phối"
          >
            {loadingDepots ? (
              <option value="">Đang tải kho...</option>
            ) : (
              <>
                {allowAllHubs && (
                  <option value="">
                    Tất cả kho ({depots.length})
                  </option>
                )}
                {depots.length === 0 && !allowAllHubs ? (
                  <option value="">Không có kho nào</option>
                ) : (
                  depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                )}
              </>
            )}
          </select>
          {loadingDepots && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 size={12} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default CascadingRegionHubSelect;
