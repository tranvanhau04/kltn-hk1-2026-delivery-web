'use client';

import React, { useState } from 'react';
import { Search, Phone, Mail, User, ChevronDown, ChevronUp, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: 'Hướng dẫn import Excel đơn hàng',
    answer: 'Để import đơn hàng từ file Excel, hãy vào trang "Đơn hàng", chọn nút "Nhập Excel" ở góc trên bên phải. Hệ thống hỗ trợ file mẫu định dạng .xlsx. Sau khi tải lên, hệ thống sẽ tự động ánh xạ các cột dữ liệu.',
  },
  {
    question: 'Cách chạy giải thuật VRP gom tuyến',
    answer: 'Vào trang "VRP / Tối ưu tuyến". Chọn các đơn hàng có trạng thái "Mới" từ danh sách bên trái. Sau đó nhấn nút "Chạy VRP Optimization". Hệ thống sẽ tự động tính toán dựa trên số lượng tài xế khả dụng và trả về kết quả tuyến đường tối ưu trên bản đồ.',
  },
  {
    question: 'Quy trình đối soát nộp tiền COD cuối ca',
    answer: 'Truy cập trang "Báo cáo". Trong bảng "Hiệu suất tài xế", hệ thống sẽ thống kê tổng COD mà mỗi tài xế đã thu được. Admin kiểm tra số tiền thực tế nhận được từ tài xế và nhấn "Duyệt đối soát" để xác nhận.',
  },
  {
    question: 'Làm sao để tạo thêm tài xế mới?',
    answer: 'Vào trang "Tài xế", chọn "Thêm tài xế". Bạn cần nhập đầy đủ thông tin: Tên, SĐT, Biển số xe và tải trọng xe. Tài khoản tài xế sẽ tự động được tạo và mật khẩu mặc định sẽ được gửi qua SMS.',
  },
];

function FaqAccordion({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden transition-all bg-white hover:border-[#FA7070]/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
      >
        <span className="text-sm font-600 text-gray-800">{faq.question}</span>
        {isOpen ? <ChevronUp size={18} className="text-[#FA7070]" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          <p className="text-sm text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [ticketSent, setTicketSent] = useState(false);

  const [form, setForm] = useState({ subject: '', priority: 'normal', description: '' });

  const filteredFaqs = FAQS.filter(f => 
    f.question.toLowerCase().includes(search.toLowerCase()) || 
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketSent(true);
    setTimeout(() => {
      setTicketSent(false);
      setForm({ subject: '', priority: 'normal', description: '' });
    }, 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h2 className="text-xl font-700 text-gray-900">Trung tâm hỗ trợ</h2>
        <p className="text-sm text-gray-400 mt-0.5">Tài liệu hướng dẫn và liên hệ bộ phận kỹ thuật</p>
      </div>

      {/* Top Search */}
      <div className="relative w-full max-w-2xl">
        <div className="relative flex items-center">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm câu hỏi, hướng dẫn sử dụng..."
            className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#FA7070] focus:ring-4 focus:ring-[#FA7070]/10 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4 hover:border-blue-200 transition-colors cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Phone size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Hotline hỗ trợ kỹ thuật</p>
            <p className="text-base font-700 text-gray-900">1900 1234</p>
          </div>
        </div>
        
        <div className="card p-5 flex items-center gap-4 hover:border-[#FA7070]/30 transition-colors cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-[#FFF0F0] flex items-center justify-center group-hover:bg-[#FA7070]/20 transition-colors">
            <Mail size={20} className="text-[#FA7070]" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email vận hành & điều phối</p>
            <p className="text-base font-700 text-gray-900">support@smartexpress.vn</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4 hover:border-violet-200 transition-colors cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
            <User size={20} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Quản trị viên hệ thống</p>
            <p className="text-base font-700 text-gray-900">Admin IUH</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FAQs */}
        <div className="space-y-4">
          <h3 className="text-lg font-700 text-gray-900 mb-2">Hướng dẫn sử dụng hệ thống</h3>
          {filteredFaqs.length > 0 ? (
            <div className="space-y-3">
              {filteredFaqs.map((faq, i) => (
                <FaqAccordion
                  key={i}
                  faq={faq}
                  isOpen={openFaqIndex === i}
                  onToggle={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl">Không tìm thấy hướng dẫn phù hợp.</p>
          )}
        </div>

        {/* Support Ticket Form */}
        <div>
          <div className="card p-6">
            <h3 className="text-lg font-700 text-gray-900 mb-1">Gửi yêu cầu hỗ trợ (Ticket)</h3>
            <p className="text-xs text-gray-400 mb-5">Đội ngũ kỹ thuật sẽ phản hồi qua email trong vòng 24h làm việc.</p>

            {ticketSent ? (
              <div className="h-64 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h4 className="text-lg font-700 text-gray-900 mb-1">Đã gửi yêu cầu!</h4>
                <p className="text-sm text-gray-500">Mã ticket của bạn là #TCK-992. Chúng tôi sẽ sớm liên hệ lại.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-500 text-gray-700 mb-1.5">Chủ đề cần hỗ trợ *</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="VD: Lỗi thuật toán VRP không chạy"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-500 text-gray-700 mb-1.5">Mức độ ưu tiên</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="input-base cursor-pointer"
                  >
                    <option value="low">Thấp (Câu hỏi chung)</option>
                    <option value="normal">Bình thường (Vấn đề quy trình)</option>
                    <option value="high">Cao (Lỗi hệ thống)</option>
                    <option value="urgent">Khẩn cấp (Hệ thống ngừng hoạt động)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-500 text-gray-700 mb-1.5">Mô tả chi tiết vấn đề *</label>
                  <textarea
                    required
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Cung cấp chi tiết các bước dẫn đến lỗi hoặc yêu cầu cụ thể..."
                    className="input-base h-auto py-3 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="btn-primary w-full justify-center">
                    <Send size={16} /> Gửi yêu cầu hỗ trợ
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
