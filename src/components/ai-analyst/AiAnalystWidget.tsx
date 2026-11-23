'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot, Sparkles, X, Send, RotateCw, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Zap, MessageSquare, LineChart,
  Lightbulb, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { fetchAiInsights, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AiInsightsData, AiRecommendationItem } from '@/types/domain';

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  suggestedQuestions?: string[];
}

export interface AiAnalystWidgetProps {
  period?: string; // '7d' | '30d' | '90d'
}

function parseDays(period?: string): number {
  if (period === '30d' || period === 'month' || period === '30') return 30;
  if (period === '90d' || period === 'custom' || period === '90') return 90;
  return 7;
}

let msgSeq = 1;
function generateId(prefix: string): string {
  msgSeq += 1;
  return `${prefix}-${msgSeq}`;
}

const initialWelcomeMessage: Message = {
  id: 'welcome',
  sender: 'bot',
  text: `Xin chào! Tôi là **SmartExpress AI Analyst** — Trợ lý phân tích dữ liệu vận hành & tài chính cấp cao.\n\nTôi có thể giúp bạn:\n* 📈 **Dự báo sản lượng & doanh thu** bằng mô hình Hồi quy tuyến tính (OLS Linear Regression).\n* ⚡ **Cảnh báo ngày đỉnh tải** với chỉ số Z-Score.\n* 💡 **Tư vấn chiến lược tăng trưởng**, so sánh các tháng và tối ưu gom tuyến VRP.\n\nHãy chọn câu hỏi gợi ý bên dưới hoặc nhập câu hỏi tự do của bạn!`,
  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  suggestedQuestions: [
    'Doanh thu vậy thì các tháng sau nên làm gì để tăng doanh số',
    'Doanh thu tháng 11/2026 và top tài xế',
    'So sánh doanh thu giữa các tháng gần đây?',
    'Phân tích nguyên nhân giao thất bại & cách khắc phục?',
  ],
};

/**
 * Render inline text parsing **bold** into <strong className="font-semibold text-slate-900">...</strong>
 * and inline code `code` cleanly without exposing raw asterisks.
 */
function renderFormattedInline(lineText: string): React.ReactNode[] {
  const parts = lineText.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {inner}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="bg-slate-100 text-[#FA7070] px-1 py-0.5 rounded text-[11px] font-mono"
        >
          {inner}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Tách dòng theo \n và parse toàn bộ **...** thành thẻ strong,
 * hỗ trợ gạch đầu dòng, tiêu đề, blockquote và ghi chú 📌
 */
export function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((rawLine, idx) => {
    const line = rawLine.trimEnd();

    // Tiêu đề
    if (line.startsWith('#')) {
      const headingText = line.replace(/^#+\s*/, '');
      return (
        <div key={idx} className="font-bold text-slate-900 text-xs sm:text-sm mt-2.5 mb-1">
          {renderFormattedInline(headingText)}
        </div>
      );
    }

    // Trích dẫn / Khuyến nghị
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '');
      return (
        <blockquote
          key={idx}
          className="border-l-2 border-[#FA7070] pl-2.5 my-1.5 text-slate-700 text-xs italic bg-coral-50/20 py-1 rounded-r"
        >
          {renderFormattedInline(quoteText)}
        </blockquote>
      );
    }

    // Dòng ghi chú có icon ghim 📌
    if (line.includes('📌')) {
      return (
        <div
          key={idx}
          className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2 my-1.5 text-[11px] text-slate-800"
        >
          {renderFormattedInline(line)}
        </div>
      );
    }

    // Gạch đầu dòng (- / * / •)
    if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
      const itemText = line.replace(/^(\*|-|•)\s+/, '');
      return (
        <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 my-0.5 pl-1">
          <span className="text-[#FA7070] font-bold select-none">•</span>
          <span className="flex-1 leading-relaxed">{renderFormattedInline(itemText)}</span>
        </div>
      );
    }

    // Đường phân cách
    if (line === '---' || line === '***') {
      return <hr key={idx} className="my-2 border-slate-100" />;
    }

    // Dòng trống
    if (line.trim() === '') {
      return <div key={idx} className="h-1" />;
    }

    // Đoạn văn thông thường
    return (
      <p key={idx} className="text-xs text-slate-700 leading-relaxed my-0.5">
        {renderFormattedInline(line)}
      </p>
    );
  });
}

export function AiAnalystWidget({ period = '7d' }: AiAnalystWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'chat'>('insights');
  const [insights, setInsights] = useState<AiInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'HYBRID_LLM_RAG' | 'LOCAL_MATH_ENGINE'>('LOCAL_MATH_ENGINE');

  const [chatMessages, setChatMessages] = useState<Message[]>([initialWelcomeMessage]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const days = parseDays(period);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tải dữ liệu insights từ API
  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAiInsights(days);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load AI Insights:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (isOpen) {
      loadInsights();
    }
  }, [isOpen, loadInsights]);

  // Tự động cuộn xuống đáy khung chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Reset Chat về ban đầu và làm mới tab Dự báo & Đề xuất
  const handleResetChat = async () => {
    setChatMessages([initialWelcomeMessage]);
    setAiMode('LOCAL_MATH_ENGINE');
    await loadInsights();
  };

  // Gửi tin nhắn chat kèm lịch sử hội thoại
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isSending) return;

    const userMsg: Message = {
      id: generateId('user'),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);

    // Chuẩn bị tối đa 8 tin nhắn gần nhất (loại tin nhắn chào mặc định)
    const historyPayload: ChatHistoryMessage[] = chatMessages
      .filter((m) => m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    try {
      const res = await apiFetch<{
        answer?: string;
        reply?: string;
        suggestedQuestions?: string[];
        mode?: 'HYBRID_LLM_RAG' | 'LOCAL_MATH_ENGINE';
        engine?: string;
      }>('/ai-analyst/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: textToSend,
          message: textToSend,
          period,
          days,
          history: historyPayload,
        }),
      });

      if (res?.mode) {
        setAiMode(res.mode);
      }

      const botReply = res?.answer || res?.reply || 'Đã xử lý thông tin thành công.';

      const botMsg: Message = {
        id: generateId('bot'),
        sender: 'bot',
        text: botReply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: res?.suggestedQuestions,
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: Message = {
        id: generateId('bot-err'),
        sender: 'bot',
        text: 'Xin lỗi, không thể kết nối tới máy chủ phân tích AI. Vui lòng thử lại sau giây lát.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const renderRecommendationIcon = (category: string) => {
    switch (category) {
      case 'OPERATIONS':
        return <AlertTriangle size={16} className="text-amber-500" />;
      case 'REVENUE':
        return <Zap size={16} className="text-emerald-500" />;
      case 'CUSTOMERS':
        return <ShieldCheck size={16} className="text-blue-500" />;
      case 'FLEET':
        return <CheckCircle2 size={16} className="text-coral-500 text-[#FA7070]" />;
      default:
        return <Lightbulb size={16} className="text-[#FA7070]" />;
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ─── 1. Floating Robot Button with Glowing Pulse ──────────────── */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center group">
          <div className="hidden group-hover:flex items-center mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-500 shadow-lg backdrop-blur-sm transition-all whitespace-nowrap animate-in fade-in">
            <Sparkles size={12} className="text-[#FA7070] mr-1.5 animate-spin-slow" />
            Trợ lý AI Phân tích ({period})
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="relative p-[2.5px] rounded-full transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none"
            style={{
              background: 'linear-gradient(135deg, #FA7070, #FF5E7E, #06B6D4)',
              boxShadow: '0 0 20px rgba(250, 112, 112, 0.55), 0 0 35px rgba(6, 182, 212, 0.35)',
            }}
            title="Mở Trợ lý SmartExpress AI Analyst"
            id="btn-ai-analyst"
          >
            <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center text-white relative">
              <Bot size={26} className="text-[#FA7070] group-hover:rotate-12 transition-transform duration-300" />
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-[10px] font-800 px-1.5 py-0.2 rounded-full border-2 border-slate-900 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                AI
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ─── 2. Floating AI Analyst Modal / Drawer ─────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 w-[430px] sm:w-[470px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.2), 0 0 30px rgba(250, 112, 112, 0.15)',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center relative p-[1.5px]"
                style={{
                  background: 'linear-gradient(135deg, #FA7070, #06B6D4)',
                  boxShadow: '0 0 12px rgba(250, 112, 112, 0.4)',
                }}
              >
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Bot size={20} className="text-[#FA7070]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-700 text-white">SmartExpress AI Analyst</h3>
                  <span className="text-[10px] bg-[#FA7070]/20 text-[#FA7070] font-600 px-1.5 py-0.2 rounded">
                    Core v2.5
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      aiMode === 'HYBRID_LLM_RAG' ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400',
                    )}
                  />
                  {aiMode === 'HYBRID_LLM_RAG'
                    ? 'Hybrid RAG • Live AI & OLS'
                    : 'Local AI • OLS & Z-Score'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                disabled={loading || isSending}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Làm mới hội thoại & phân tích (Reset)"
              >
                <RotateCw size={15} className={cn((loading || isSending) && 'animate-spin-slow text-[#FA7070]')} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Đóng cửa sổ"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex border-b border-slate-100 bg-slate-50/80 px-3 pt-2 gap-2 text-xs">
            <button
              onClick={() => setActiveTab('insights')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-t-xl font-600 transition-all border-b-2',
                activeTab === 'insights'
                  ? 'border-[#FA7070] text-[#FA7070] bg-white shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <LineChart size={14} />
              Dự báo & Đề xuất
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-t-xl font-600 transition-all border-b-2',
                activeTab === 'chat'
                  ? 'border-[#FA7070] text-[#FA7070] bg-white shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <MessageSquare size={14} />
              Trợ lý Chat AI
            </button>
          </div>

          {/* ─── TAB 1: INSIGHTS & FORECAST ─────────────────────────────────── */}
          {activeTab === 'insights' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-50/40">
              {loading && !insights && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <RotateCw size={24} className="animate-spin-slow mb-2 text-[#FA7070]" />
                  <p className="text-xs">Đang chạy thuật toán OLS & Z-Score...</p>
                </div>
              )}

              {insights && (
                <>
                  {/* Linear Regression Forecast Card */}
                  <div className="bg-white rounded-xl p-3.5 border border-slate-100 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-coral-50 text-[#FA7070]">
                          <TrendingUp size={16} />
                        </span>
                        <div>
                          <p className="font-700 text-slate-900 text-xs">Dự báo Hồi quy tuyến tính (OLS)</p>
                          <p className="text-[11px] text-slate-400">Độ tin cậy R² = {insights.forecast.rSquared}%</p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] font-700 flex items-center gap-1',
                          insights.forecast.trend === 'UP'
                            ? 'bg-emerald-50 text-emerald-600'
                            : insights.forecast.trend === 'DOWN'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {insights.forecast.trend === 'UP' && <TrendingUp size={12} />}
                        {insights.forecast.trend === 'DOWN' && <TrendingDown size={12} />}
                        {insights.forecast.trend === 'UP'
                          ? `TĂNG TRƯỞNG (+${insights.forecast.growthRatePercent}%)`
                          : insights.forecast.trend === 'DOWN'
                          ? `SUY GIẢM (${insights.forecast.growthRatePercent}%)`
                          : 'ỔN ĐỊNH'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-50 text-slate-600">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <p className="text-[10px] text-slate-400 uppercase font-500">Trung bình kỳ</p>
                        <p className="text-sm font-700 text-slate-800 mt-0.5">
                          {insights.forecast.historicalAvg} <span className="text-[10px] font-normal">đơn/ngày</span>
                        </p>
                      </div>
                      <div className="bg-[#FFF0F0] p-2 rounded-lg border border-[#FA7070]/20">
                        <p className="text-[10px] text-[#FA7070] uppercase font-600">Dự báo kỳ kế tiếp</p>
                        <p className="text-sm font-800 text-[#FA7070] mt-0.5">
                          ~{insights.forecast.predictedNext} <span className="text-[10px] font-normal">đơn/ngày</span>
                        </p>
                      </div>
                    </div>

                    {/* Timeline dự báo các bước */}
                    <div className="flex items-center justify-between text-[11px] pt-1 px-1 text-slate-500">
                      {insights.forecast.nextPoints.map((pt, i) => (
                        <div key={i} className="text-center">
                          <span className="text-[10px] text-slate-400 block">{pt.label}</span>
                          <span className="font-700 text-slate-700">~{pt.predicted} đơn</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Z-Score Peak Day Alert Card */}
                  <div className="bg-white rounded-xl p-3.5 border border-slate-100 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
                          <Zap size={16} />
                        </span>
                        <div>
                          <p className="font-700 text-slate-900 text-xs">Phát hiện đỉnh tải (Z-Score)</p>
                          <p className="text-[11px] text-slate-400">Độ lệch chuẩn σ = {insights.forecast.peakDayAnalysis.stdDev}</p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] font-700',
                          insights.forecast.peakDayAnalysis.isAbnormal
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-emerald-50 text-emerald-600',
                        )}
                      >
                        {insights.forecast.peakDayAnalysis.isAbnormal ? '🔴 Cảnh báo cao điểm' : '🟢 Ngưỡng an toàn'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg">
                      {insights.forecast.peakDayAnalysis.alertMessage}
                    </p>

                    {/* Mini bar per day */}
                    <div className="grid grid-cols-7 gap-1 pt-1 text-center">
                      {insights.forecast.peakDayAnalysis.details.map((d, i) => (
                        <div
                          key={i}
                          className={cn(
                            'p-1 rounded text-[10px] transition-colors',
                            d.isPeak ? 'bg-[#FA7070] text-white font-700' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          <span className="block text-[9px] opacity-80">{d.label}</span>
                          <span>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expert Recommendations */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="font-700 text-slate-900 text-xs flex items-center gap-1.5">
                        <Lightbulb size={14} className="text-[#FA7070]" />
                        Đề xuất từ Hệ chuyên gia
                      </p>
                      <span className="text-[10px] text-slate-400">{insights.recommendations.length} giải pháp</span>
                    </div>

                    {insights.recommendations.map((rec: AiRecommendationItem) => (
                      <div
                        key={rec.id}
                        className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm space-y-1.5 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-600 text-slate-700">
                            {renderRecommendationIcon(rec.category)}
                            {rec.categoryLabel}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-700 px-1.5 py-0.2 rounded',
                              rec.priority === 'HIGH' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
                            )}
                          >
                            {rec.priority}
                          </span>
                        </div>

                        <p className="font-700 text-slate-900 text-xs">{rec.title}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{rec.description}</p>

                        <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-700 space-y-1 mt-1">
                          <p>
                            <strong className="text-slate-900">Hành động:</strong> {rec.actionableStep}
                          </p>
                          <p className="text-emerald-600 font-500">
                            <strong>Hiệu quả:</strong> {rec.impact}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── TAB 2: CHATBOT ASSISTANT ───────────────────────────────────── */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
              {/* Message scroll area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex flex-col', msg.sender === 'user' ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl p-3 shadow-sm leading-relaxed',
                        msg.sender === 'user'
                          ? 'bg-[#FA7070] text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-100 rounded-bl-xs',
                      )}
                    >
                      {msg.sender === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div className="space-y-1">{renderFormattedText(msg.text)}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>

                    {/* Suggested question chips from bot */}
                    {msg.sender === 'bot' && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            disabled={isSending}
                            className="text-[11px] bg-white border border-slate-200 text-slate-700 hover:border-[#FA7070] hover:text-[#FA7070] px-2.5 py-1 rounded-full shadow-xs transition-colors text-left flex items-center gap-1"
                          >
                            <span>{q}</span>
                            <ChevronRight size={10} className="opacity-50" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isSending && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                    <Bot size={16} className="text-[#FA7070] animate-bounce" />
                    <span>AI đang phân tích số liệu từ Database...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Box */}
              <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Hỏi tự do: Doanh thu tháng 11, so sánh tháng 10, chiến lược tăng đơn..."
                  disabled={isSending}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FA7070] transition-colors"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isSending}
                  className="btn-primary w-9 h-9 p-0 flex items-center justify-center rounded-xl disabled:opacity-50 cursor-pointer"
                  title="Gửi tin nhắn"
                >
                  {isSending ? (
                    <RotateCw size={14} className="animate-spin-slow" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}

export const AiAnalystChatWidget = AiAnalystWidget;
