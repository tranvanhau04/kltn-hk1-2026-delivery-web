'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('@/components/TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[650px] flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-[#FA7070] border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Đang tải bản đồ theo dõi trực tuyến...</p>
      </div>
    </div>
  ),
});

export default function AdminTrackingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bản đồ Giám sát Thời gian thực</h1>
          <p className="text-sm text-gray-500">
            Theo dõi vị trí và mức pin của tài xế đang hoạt động qua WebSocket (Task 9.2)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <TrackingMap className="w-full h-[650px]" />
      </div>
    </div>
  );
}
