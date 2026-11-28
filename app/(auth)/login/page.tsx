'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, Package, Route, Navigation, Mail, Lock, ArrowRight, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { forgotPassword } from '@/lib/api';

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setStep('sent');
    } catch (err: unknown) {
      setError((err as Error).message || 'Lỗi gửi yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[2px]">
      <div className="relative w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-lg animate-scale-in p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={16} />
        </button>

        {step === 'email' ? (
          <>
            <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
              <Lock size={18} className="text-slate-700" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Quên mật khẩu?</h2>
            <p className="text-xs text-slate-500 mb-5">Nhập email của bạn để nhận liên kết đặt lại mật khẩu.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Địa chỉ email</label>
                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@iuhlogistics.vn"
                    required
                    className="input-base pl-9 w-full"
                    id="forgot-email"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-[#D92D20]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-60"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                ) : (
                  <>Gửi liên kết đặt lại <ArrowRight size={15} /></>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
              <Mail size={22} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">Email đã được gửi</h2>
            <p className="text-xs text-slate-500 mb-5">
              Kiểm tra hộp thư của <strong className="text-slate-800">{email}</strong> và làm theo hướng dẫn.
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
  const { login, isAuthenticated, isLoading } = useApp();
  const [email, setEmail] = useState('admin@smartexpress.vn');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/orders');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      router.replace('/orders');
    } else {
      setError('Email hoặc mật khẩu không chính xác.');
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* ---- Left Branding Panel ---- */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-slate-950 border-r border-slate-800">
        {/* Subtle architectural grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[#D92D20] border border-white/10">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm tracking-tight">IUH LOGISTICS</p>
              <p className="text-slate-400 text-xs">SmartExpress Enterprise</p>
            </div>
          </div>

          {/* Main hero text */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-slate-800 bg-slate-900/80 w-fit mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D92D20]" />
              <span className="text-slate-300 text-[11px] font-medium uppercase tracking-wider">
                Hệ thống quản lý giao vận
              </span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-semibold text-white tracking-tight leading-tight mb-4">
              Precision in<br />
              <span className="text-slate-400">every movement.</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md mb-8">
              Nền tảng điều phối và tối ưu hóa lộ trình giao hàng cấp doanh nghiệp — kiểm soát đơn hàng, đội xe và đối soát COD theo thời gian thực.
            </p>

            {/* Feature list */}
            <div className="space-y-2.5">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/70 border border-slate-800/90 animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-800 text-slate-200 shrink-0">
                    {f.icon}
                  </div>
                  <span className="text-slate-300 text-xs font-medium tabular-nums">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer text */}
          <p className="text-slate-500 text-xs tabular-nums">© 2026 IUH Logistics · SmartExpress Dispatch Console</p>
        </div>
      </div>

      {/* ---- Right Form Panel ---- */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-900">
              <Zap size={16} className="text-white" />
            </div>
            <p className="font-semibold text-slate-900 text-sm tracking-tight">IUH LOGISTICS</p>
          </div>

          {/* Form container */}
          <div className="animate-fade-in">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Đăng nhập</h1>
              <p className="text-xs text-slate-500 mt-1">Nhập thông tin tài khoản điều hành để tiếp tục.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@iuhlogistics.vn"
                    required
                    autoComplete="email"
                    className="input-base pl-9 h-9 w-full"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="text-xs font-medium text-slate-700">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium hover:underline"
                    id="btn-forgot-password"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="input-base pl-9 pr-9 h-9 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    id="toggle-password"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md animate-fade-in">
                  <span className="w-4 h-4 rounded bg-red-100 flex items-center justify-center text-[#D92D20] text-[10px] font-bold shrink-0">!</span>
                  <p className="text-xs text-[#D92D20]">{error}</p>
                </div>
              )}

              {/* Remember me */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-slate-900 rounded"
                  id="remember-me"
                  defaultChecked
                />
                <span className="text-xs text-slate-600">Ghi nhớ đăng nhập</span>
              </label>

              {/* Submit */}
              <button
                id="btn-sign-in"
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-9 justify-center mt-1 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin-slow" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>Đăng nhập <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            {/* Quick Demo Accounts */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">Tài khoản dùng thử nhanh</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@smartexpress.vn');
                    setPassword('123456');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-md text-slate-700 transition-colors"
                  id="btn-quick-admin"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('dieupoi01@smartexpress.vn');
                    setPassword('123456');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-md text-slate-700 transition-colors"
                  id="btn-quick-dispatcher"
                >
                  Điều phối
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('driver01@smartexpress.vn');
                    setPassword('123456');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-md text-slate-700 transition-colors"
                  id="btn-quick-driver"
                >
                  Tài xế
                </button>
              </div>
            </div>
          </div>

          {/* Bottom note */}
          <p className="text-center text-[11px] text-slate-400 mt-8 tabular-nums">
            © 2026 IUH Logistics · Hệ thống nội bộ
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
