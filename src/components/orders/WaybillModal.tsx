'use client';

import React, { useRef } from 'react';
import { Printer, X, Package, MapPin, Phone, User, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order } from '@/types/domain';

// ─── Code 128B Barcode Patterns Table ─────────────────────────────
// Standard 107 patterns (characters 0 to 106)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is Stop)
];

function generateCode128Svg(text: string): React.ReactNode {
  // Use Code 128B (Start Code B is index 104)
  const startCode = 104;
  const codes: number[] = [startCode];

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // ASCII 32-126 maps to values 0-94
    const val = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(val);
  }

  // Calculate Checksum: (StartCode + Sum(i * val)) % 103
  let checksum = startCode;
  for (let i = 1; i < codes.length; i++) {
    checksum += i * codes[i];
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop code

  // Convert pattern digits into bar segments
  const bars: { width: number; isBlack: boolean }[] = [];
  codes.forEach((c) => {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    for (let p = 0; p < pattern.length; p++) {
      const w = parseInt(pattern[p], 10);
      const isBlack = p % 2 === 0;
      bars.push({ width: w, isBlack });
    }
  });

  const totalWidth = bars.reduce((acc, b) => acc + b.width, 0);
  let currentX = 0;

  return (
    <svg viewBox={`0 0 ${totalWidth} 60`} className="w-full h-14 max-w-[280px]" preserveAspectRatio="none">
      {bars.map((bar, idx) => {
        const x = currentX;
        currentX += bar.width;
        if (!bar.isBlack) return null;
        return <rect key={idx} x={x} y={0} width={bar.width} height={60} fill="#000000" />;
      })}
    </svg>
  );
}

interface WaybillModalProps {
  order: Order;
  onClose: () => void;
}

export function WaybillModal({ order, onClose }: WaybillModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const hubName = order.depot?.name || 'Hub 01 - Trung Tâm Gò Vấp';
  const hubAddress = order.depot?.address || '12 Nguyễn Văn Bảo, Phường 4, Quận Gò Vấp, TP.HCM';
  const hubPhone = order.depot?.contactPhone || '028 3800 0999';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Print CSS styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-waybill-content, #printable-waybill-content * {
            visibility: visible;
          }
          #printable-waybill-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            border: 2px solid #000 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scale-in my-8">
        {/* Modal Control Bar (Excluded from print) */}
        <div className="px-4 py-3 bg-slate-950 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-slate-300" />
            <span className="font-medium text-xs">Xem & In Phiếu Gửi Vận Đơn (AWB)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D92D20] text-white hover:bg-[#B42318] font-medium text-xs transition-colors cursor-pointer"
              id="btn-trigger-print"
            >
              <Printer size={13} /> In phiếu (Print)
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Waybill Sheet */}
        <div id="printable-waybill-content" ref={printRef} className="p-6 bg-white text-gray-900 text-xs space-y-4">
          {/* Header Row */}
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-900 tracking-tight text-red-600 uppercase">SMART EXPRESS</span>
                <span className="px-1.5 py-0.5 text-[9px] font-700 bg-black text-white rounded">IUH LOGISTICS</span>
              </div>
              <p className="text-[10px] text-gray-600">Nền tảng Tối ưu Lộ trình Giao hàng & Điều phối Thông minh</p>
              <p className="text-[10px] text-gray-500">Hotline: 1900 6868 · www.smartexpress.vn</p>
            </div>
            {/* Barcode & Code */}
            <div className="flex flex-col items-end">
              {generateCode128Svg(order.code)}
              <span className="font-mono text-sm font-900 tracking-widest mt-1">{order.code}</span>
              <span className="text-[10px] text-gray-500">Ngày tạo: {formatDateTime(order.createdAt)}</span>
            </div>
          </div>

          {/* Sender & Receiver Dual Columns */}
          <div className="grid grid-cols-2 gap-3 border-b border-black pb-3">
            {/* Sender */}
            <div className="border-r border-dashed border-gray-300 pr-3 space-y-1">
              <p className="font-800 text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <Package size={11} /> 1. Bưu cục gửi (Sender Hub)
              </p>
              <p className="font-700 text-xs text-gray-900">{hubName}</p>
              <p className="text-[11px] text-gray-600 flex items-start gap-1">
                <MapPin size={11} className="shrink-0 mt-0.5 text-gray-400" />
                <span>{hubAddress}</span>
              </p>
              <p className="text-[11px] text-gray-600 flex items-center gap-1">
                <Phone size={11} className="shrink-0 text-gray-400" />
                <span>ĐT: {hubPhone}</span>
              </p>
            </div>

            {/* Receiver */}
            <div className="space-y-1 pl-1">
              <p className="font-800 text-[11px] uppercase tracking-wider text-red-600 flex items-center gap-1">
                <User size={11} /> 2. Người nhận (Recipient)
              </p>
              <p className="font-800 text-sm text-gray-900">{order.receiverName}</p>
              <p className="font-700 text-xs text-blue-700 flex items-center gap-1">
                <Phone size={11} className="shrink-0" />
                <span>SĐT: {order.receiverPhone}</span>
              </p>
              <p className="text-[11px] font-600 text-gray-800 flex items-start gap-1 leading-relaxed">
                <MapPin size={11} className="shrink-0 mt-0.5 text-red-500" />
                <span>{order.deliveryAddress}</span>
              </p>
            </div>
          </div>

          {/* Package details & COD Box */}
          <div className="grid grid-cols-12 gap-2 border-b border-black pb-3 items-center">
            <div className="col-span-7 space-y-1">
              <p className="font-700 text-[11px] uppercase text-gray-500">Thông tin kiện hàng</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <p>Khối lượng: <span className="font-700">{order.weightKg} kg</span></p>
                <p>Thể tích: <span className="font-700">{order.volumeM3} m³</span></p>
                <p className="col-span-2">
                  Cước vận chuyển: <span className="font-600">{formatCurrency(order.deliveryFee ?? 25000)}</span>
                </p>
              </div>
              {order.notes && (
                <div className="p-1.5 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-900 font-500">
                  ⚠️ Ghi chú: {order.notes}
                </div>
              )}
            </div>

            {/* COD Highlight Block */}
            <div className="col-span-5 p-2.5 rounded-xl border-2 border-red-500 bg-red-50/60 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-800 uppercase tracking-wide text-red-700">Tiền thu hộ (COD)</span>
              <span className="text-base font-900 text-red-600 mt-0.5">
                {Number(order.codAmount) > 0 ? formatCurrency(Number(order.codAmount)) : 'KHÔNG THU COD (0đ)'}
              </span>
              <span className="text-[9px] text-gray-500 mt-0.5">Người nhận kiểm tra hàng trước khi ký</span>
            </div>
          </div>

          {/* Signature and Confirmation Boxes */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="border border-dashed border-gray-400 rounded-lg p-3 text-center h-28 flex flex-col justify-between">
              <div>
                <p className="font-700 text-[10px] uppercase">Chữ ký người nhận</p>
                <p className="text-[9px] text-gray-400 italic">(Ký, ghi rõ họ tên và số tiền đã thanh toán)</p>
              </div>
              <p className="text-[9px] text-gray-300">Ngày ...... tháng ...... năm 2026</p>
            </div>

            <div className="border border-dashed border-gray-400 rounded-lg p-3 text-center h-28 flex flex-col justify-between">
              <div>
                <p className="font-700 text-[10px] uppercase">Chữ ký bưu tá giao hàng</p>
                <p className="text-[9px] text-gray-400 italic">
                  {order.driverName ? `Tài xế: ${order.driverName}` : '(Xác nhận giao hàng thành công)'}
                </p>
              </div>
              <p className="text-[9px] text-gray-300">SmartExpress Courier</p>
            </div>
          </div>

          {/* Footer Commitment */}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[9px] text-gray-400">
            <div className="flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-500" />
              <span>Cam kết giao hàng đúng cam kết SLA · Bảo hiểm hàng hóa tiêu chuẩn</span>
            </div>
            <span>Mẫu vận đơn số 01/SE-KLTN</span>
          </div>
        </div>
      </div>
    </div>
  );
}
