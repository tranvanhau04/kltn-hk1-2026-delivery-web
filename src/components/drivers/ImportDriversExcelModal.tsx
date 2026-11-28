'use client';

import React, { useState, useRef } from 'react';
import { Modal } from '@/components/common/Modal';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
} from 'lucide-react';
import {
  importDriversExcel,
  downloadDriversTemplate,
  type BulkExcelImportResult,
} from '@/lib/api';
import { useToast } from '@/context/ToastContext';

export default function ImportDriversExcelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<BulkExcelImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelectFile = (selected: File | undefined) => {
    if (!selected) return;
    const lowerName = selected.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setErrorMsg('Định dạng file không hợp lệ. Vui lòng chọn file .xlsx hoặc .xls.');
      return;
    }
    setFile(selected);
    setResult(null);
    setErrorMsg(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await downloadDriversTemplate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải file mẫu';
      toast.error('Lỗi tải file mẫu', msg);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await importDriversExcel(file);
      setResult(res);
      if (res.successCount > 0) {
        toast.success(
          'Nhập tài xế thành công',
          `Đã khởi tạo ${res.successCount} hồ sơ tài xế và phương tiện.`,
        );
        onSuccess();
      }
      if (res.failedCount > 0) {
        toast.warning(
          'Cảnh báo dữ liệu nhập',
          `${res.failedCount} dòng không hợp lệ đã được bỏ qua.`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải file lên máy chủ';
      setErrorMsg(msg);
      toast.error('Nhập file thất bại', msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nhập tài xế từ Excel"
      subtitle="Khởi tạo đồng thời tài khoản đăng nhập và hồ sơ phương tiện theo Kho / Hub"
      size="md"
      footer={
        result ? (
          <>
            <button onClick={handleReset} className="btn-secondary">
              Nhập file khác
            </button>
            <button onClick={onClose} className="btn-primary">
              Đóng
            </button>
          </>
        ) : (
          <>
            <button onClick={onClose} className="btn-secondary" disabled={isUploading}>
              Hủy
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="btn-primary"
              id="btn-confirm-import-drivers"
            >
              {isUploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UploadCloud size={15} />
              )}
              {isUploading ? 'Đang nhập dữ liệu...' : 'Xác nhận tải lên'}
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Sample Template Banner */}
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-800">Chưa có file mẫu chuẩn định dạng?</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Bao gồm thông tin tài xế, biển số, loại xe, tải trọng và Tên Kho / Hub
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate || isUploading}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
            id="btn-download-drivers-template"
          >
            {isDownloadingTemplate ? (
              <Loader2 size={13} className="animate-spin text-slate-500" />
            ) : (
              <Download size={13} className="text-slate-600" />
            )}
            Tải file mẫu (.xlsx)
          </button>
        </div>

        {/* Upload Dropzone or Result Summary */}
        {!result ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-8 text-center transition-colors ${
              isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
              isDragging
                ? 'border-slate-900 bg-slate-100/70'
                : file
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <FileSpreadsheet size={28} className="text-emerald-600" />
                <p className="text-sm font-medium text-emerald-900">{file.name}</p>
                <p className="text-xs text-emerald-700 tabular-nums">
                  {(file.size / 1024).toFixed(1)} KB · Nhấn để đổi file khác
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <UploadCloud size={28} className="text-slate-400" />
                <p className="text-sm font-medium text-slate-700">
                  Kéo thả file vào đây hoặc nhấn để chọn
                </p>
                <p className="text-xs text-slate-400">Hỗ trợ định dạng .xlsx, .xls</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary Banner */}
            <div
              className={`p-4 rounded-lg border flex flex-col items-center gap-1.5 ${
                result.failedCount === 0
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : result.successCount > 0
                    ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                    : 'bg-red-50/60 border-red-200 text-red-900'
              }`}
            >
              {result.failedCount === 0 ? (
                <CheckCircle size={26} className="text-emerald-600" />
              ) : (
                <AlertCircle
                  size={26}
                  className={result.successCount > 0 ? 'text-amber-600' : 'text-[#D92D20]'}
                />
              )}
              <h3 className="font-semibold text-sm">Hoàn tất xử lý file Excel</h3>
              <p className="text-xs font-medium tabular-nums">
                Thành công {result.successCount} dòng · Lỗi {result.failedCount} dòng
              </p>
              <div className="flex gap-2.5 mt-1.5 tabular-nums">
                <span className="text-xs font-medium text-emerald-700 bg-white border border-emerald-200 px-2.5 py-0.5 rounded">
                  Thành công: {result.successCount}
                </span>
                <span className="text-xs font-medium text-[#D92D20] bg-white border border-red-200 px-2.5 py-0.5 rounded">
                  Lỗi: {result.failedCount}
                </span>
              </div>
            </div>

            {/* Per-row Error List */}
            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50/60 rounded-lg border border-red-200">
                <p className="text-xs font-semibold text-red-900 mb-2 tabular-nums">
                  Chi tiết dòng lỗi ({result.errors.length}):
                </p>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {result.errors.map((err, idx) => (
                    <div
                      key={`${err.row}-${idx}`}
                      className="flex items-start gap-2 text-xs bg-white border border-red-100 rounded px-2.5 py-1.5"
                    >
                      <span className="shrink-0 font-mono font-semibold text-[#D92D20] bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[11px] tabular-nums">
                        Dòng {err.row}
                      </span>
                      <span className="text-slate-700 leading-relaxed">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-[#D92D20] text-xs font-medium rounded-md flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
