'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, Package, Route, Navigation, Mail, Lock, ArrowRight, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setStep('sent');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] animate-scale-in p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={18} />
        </button>

        {step === 'email' ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-[#FFF0F0] flex items-center justify-center mb-4">
              <Lock size={22} className="text-[#FA7070]" />
            </div>
            <h2 className="text-xl font-700 text-gray-900 mb-1">Quên mật khẩu?</h2>
            <p className="text-sm text-gray-500 mb-6">Nhập email của bạn để nhận liên kết đặt lại mật khẩu.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-500 text-gray-700 mb-1.5">Địa chỉ email</label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@iuhlogistics.vn"
                    required
                    className="input-base pl-11 w-full"
                    id="forgot-email"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-60"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                ) : (
                  <>Gửi liên kết đặt lại <ArrowRight size={16} /></>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-green-500" />
            </div>
            <h2 className="text-xl font-700 text-gray-900 mb-2">Email đã được gửi!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Kiểm tra hộp thư của <strong>{email}</strong> và làm theo hướng dẫn.
            </p>
            <button onClick={onClose} className="btn-primary w-full justify-center">
              Quay lại đăng nhập
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: <Package size={20} />, text: 'Quản lý 1000+ đơn hàng mỗi ngày' },
  { icon: <Route size={20} />, text: 'Tối ưu tuyến đường với thuật toán VRP' },
  { icon: <Navigation size={20} />, text: 'Theo dõi tài xế thực time GPS' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useApp();
  const [email, setEmail] = useState('admin@iuhlogistics.vn');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      router.replace('/orders');
    } else {
      setError('Email hoặc mật khẩu không chính xác. Thử: Admin@123');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ---- Left Hero Panel ---- */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#8B2626] via-[#C0392B] to-[#FA7070]">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-40 -right-32 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-black/10" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20">
              <Zap size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-800 text-base tracking-wide">IUH LOGISTICS</p>
              <p className="text-white/60 text-xs">SmartExpress Platform</p>
            </div>
          </div>

          {/* Main hero text */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-white/70 text-sm font-400 mb-4 uppercase tracking-widest">
              Hệ thống quản lý giao vận
            </p>
            <h2 className="text-4xl xl:text-5xl font-800 text-white leading-tight mb-6">
              Precision in<br />
              <span className="text-white/80">every movement.</span>
            </h2>
            <p className="text-white/70 text-base leading-relaxed max-w-sm mb-10">
              Nền tảng tối ưu hóa logistics thông minh – từ đơn hàng đến cánh cửa khách hàng, mọi chuyến đi đều được tính toán hoàn hảo.
            </p>

            {/* Feature pills */}
            <div className="space-y-3">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 text-white shrink-0">
                    {f.icon}
                  </div>
                  <span className="text-white/80 text-sm">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer text */}
          <p className="text-white/40 text-xs">© 2026 IUH Logistics. KLTN – Hệ thống quản lý giao vận thông minh.</p>
        </div>
      </div>

      {/* ---- Right Auth Panel ---- */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center p-8 bg-[#F5F6F8]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#FA7070] to-[#8B2626]">
              <Zap size={20} className="text-white" />
            </div>
            <p className="font-800 text-[#8B2626] text-base tracking-wide">IUH LOGISTICS</p>
          </div>

          {/* Card */}
          <div className="card p-8 animate-fade-in">
            <div className="mb-7">
              <h1 className="text-2xl font-700 text-gray-900">Đăng nhập</h1>
              <p className="text-sm text-gray-500 mt-1">Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-sm font-500 text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@iuhlogistics.vn"
                    required
                    autoComplete="email"
                    className="input-base pl-11 w-full"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="text-sm font-500 text-gray-700">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-[#FA7070] hover:text-[#E85D5D] font-500 hover:underline"
                    id="btn-forgot-password"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="input-base pl-11 pr-10 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    id="toggle-password"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl animate-fade-in">
                  <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px] shrink-0">!</span>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Remember me */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#FA7070] rounded"
                  id="remember-me"
                  defaultChecked
                />
                <span className="text-sm text-gray-600">Ghi nhớ đăng nhập</span>
              </label>

              {/* Submit */}
              <button
                id="btn-sign-in"
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center mt-2 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>Đăng nhập <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Hint */}
            <div className="mt-5 p-3 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600 font-500">Demo credentials:</p>
              <p className="text-xs text-blue-500 mt-0.5">admin@iuhlogistics.vn / Admin@123</p>
            </div>
          </div>

          {/* Bottom note */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © 2026 IUH Logistics · Hệ thống nội bộ
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
