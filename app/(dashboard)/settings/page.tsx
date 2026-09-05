'use client';

import React, { useState } from 'react';
import { Save, Building2, Sliders, Bell, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [form, setForm] = useState({
    companyName: 'IUH Logistics',
    hubAddress: '12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP.HCM',
    currency: 'VND',
    maxStops: 15,
    maxCapacity: 90,
    serviceTime: 10,
    systemAlerts: true,
    lowCapacityAlerts: true,
    delayAlerts: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 800);
  };

  const tabs = [
    { id: 'general', label: 'Thông tin chung', icon: <Building2 size={16} /> },
    { id: 'vrp', label: 'Tham số thuật toán', icon: <Sliders size={16} /> },
    { id: 'notifications', label: 'Thông báo', icon: <Bell size={16} /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h2 className="text-xl font-700 text-gray-900">Cài đặt hệ thống</h2>
        <p className="text-sm text-gray-400 mt-0.5">Tùy chỉnh thông tin và cấu hình hoạt động</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-500 transition-colors w-full text-left',
                activeTab === tab.id
                  ? 'bg-[#FFF0F0] text-[#FA7070] font-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full card p-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {activeTab === 'general' && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-700 text-gray-900 border-b border-slate-100 pb-3 mb-5">Thông tin doanh nghiệp</h3>
                
                <div>
                  <label className="block text-sm font-500 text-gray-700 mb-1.5">Tên công ty / Tổ chức</label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className="input-base max-w-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-500 text-gray-700 mb-1.5">Địa chỉ Hub chính (Trạm trung chuyển)</label>
                  <input
                    type="text"
                    value={form.hubAddress}
                    onChange={(e) => setForm(f => ({ ...f, hubAddress: e.target.value }))}
                    className="input-base max-w-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-500 text-gray-700 mb-1.5">Đơn vị tiền tệ mặc định</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="input-base max-w-md cursor-pointer"
                  >
                    <option value="VND">VND - Việt Nam Đồng</option>
                    <option value="USD">USD - Đô la Mỹ</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'vrp' && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-700 text-gray-900 border-b border-slate-100 pb-3 mb-5">Tham số thuật toán tối ưu (VRP)</h3>
                
                <div className="bg-blue-50 p-4 rounded-xl flex gap-3 text-blue-700 text-sm mb-6">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>Các tham số này sẽ ảnh hưởng trực tiếp đến kết quả tính toán gom tuyến và phân tài xế. Thay đổi có thể làm thay đổi thời gian chạy thuật toán.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-500 text-gray-700 mb-1.5">Số điểm dừng tối đa / 1 tuyến</label>
                    <input
                      type="number"
                      min="1" max="100"
                      value={form.maxStops}
                      onChange={(e) => setForm(f => ({ ...f, maxStops: parseInt(e.target.value) || 0 }))}
                      className="input-base"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Giới hạn số đơn giao tối đa cho mỗi tài xế.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-500 text-gray-700 mb-1.5">Hệ số sử dụng tải trọng (%)</label>
                    <input
                      type="number"
                      min="10" max="100"
                      value={form.maxCapacity}
                      onChange={(e) => setForm(f => ({ ...f, maxCapacity: parseInt(e.target.value) || 0 }))}
                      className="input-base"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">VD: 90% nghĩa là chỉ xếp hàng tới 90% tải trọng xe.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-500 text-gray-700 mb-1.5">Thời gian phục vụ dự kiến (Phút/Đơn)</label>
                    <input
                      type="number"
                      min="1" max="60"
                      value={form.serviceTime}
                      onChange={(e) => setForm(f => ({ ...f, serviceTime: parseInt(e.target.value) || 0 }))}
                      className="input-base"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Thời gian tài xế dừng xe, gọi điện và giao hàng.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-700 text-gray-900 border-b border-slate-100 pb-3 mb-5">Tùy chọn cảnh báo</h3>
                
                <div className="space-y-4 max-w-md">
                  <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-600 text-gray-800">Cảnh báo hệ thống</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Bật thông báo popup khi có lỗi hệ thống</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.systemAlerts}
                      onChange={(e) => setForm(f => ({ ...f, systemAlerts: e.target.checked }))}
                      className="w-4 h-4 accent-[#FA7070] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-600 text-gray-800">Thiếu tài xế / Quá tải</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Cảnh báo khi khu vực có số đơn vượt quá số tài xế</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.lowCapacityAlerts}
                      onChange={(e) => setForm(f => ({ ...f, lowCapacityAlerts: e.target.checked }))}
                      className="w-4 h-4 accent-[#FA7070] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-600 text-gray-800">Cảnh báo chậm trễ (Delay)</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Báo khi tài xế dừng quá lâu tại một điểm giao</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.delayAlerts}
                      onChange={(e) => setForm(f => ({ ...f, delayAlerts: e.target.checked }))}
                      className="w-4 h-4 accent-[#FA7070] rounded"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 flex items-center justify-end">
              <button type="submit" disabled={isSaving} className="btn-primary">
                {isSaving ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                ) : (
                  <Save size={16} />
                )}
                Lưu cấu hình
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl animate-slide-up">
          <CheckCircle size={18} className="text-green-400" />
          <span className="text-sm font-500">Đã lưu cấu hình thành công!</span>
        </div>
      )}
    </div>
  );
}
