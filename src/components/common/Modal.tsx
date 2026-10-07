'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm:         'max-w-sm',
  md:         'max-w-lg',
  lg:         'max-w-2xl',
  xl:         'max-w-4xl',
  fullscreen: 'max-w-[95vw] max-h-[95vh]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-white rounded-lg shadow-modal border border-slate-200 animate-scale-in flex flex-col outline-none overflow-hidden',
          sizeClasses[size],
          size === 'fullscreen' ? 'h-[90vh]' : 'max-h-[90vh]',
          className
        )}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
            <div>
              {title && (
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-3 flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Close button (no title) */}
        {!title && !subtitle && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-700">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex justify-end gap-2 bg-slate-50/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
