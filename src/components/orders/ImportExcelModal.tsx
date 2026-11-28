import React, { useState, useRef } from 'react';
import { Modal } from '@/components/common/Modal';
import { UploadCloud, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { importOrdersExcel } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

export default function ImportExcelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    totalRows: number;
    importedCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await importOrdersExcel(file);
      setResult(res);
      if (res.importedCount > 0) {
        toast.success('Nhập file thành công', `Đã nhập ${res.importedCount} đơn hàng vào hệ thống.`);
        onSuccess();
      }
      if (res.failedCount > 0) {
        toast.warning('Cảnh báo nhập đơn', `${res.failedCount} dòng dữ liệu không hợp lệ.`);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Lỗi khi upload file';
      setErrorMsg(msg);
      toast.error('Nhập file thất bại', msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nhập đơn hàng từ Excel"
      size="md"
      footer={
        result ? (
          <button onClick={onClose} className="btn-primary w-full justify-center">Đóng</button>
        ) : (
          <>
            <button onClick={onClose} className="btn-secondary" disabled={isUploading}>Hủy</button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="btn-primary"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Xác nhận tải lên
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Sample Template */}
        {!result && (
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg">
            <span className="text-xs font-medium">Chưa có file mẫu theo đúng cấu trúc?</span>
            <a
              href="/templates/mau_nhap_don_hang.xlsx"
              download="mau_nhap_don_hang.xlsx"
              className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1 transition-colors"
            >
              Tải file mẫu (.xlsx)
            </a>
          </div>
        )}

        {/* Upload Area */}
        {!result ? (
          <div
            className={`border border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <File size={28} className="text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">{file.name}</p>
                <p className="text-xs text-emerald-600 tabular-nums">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 cursor-pointer">
                <UploadCloud size={28} className="text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Kéo thả file hoặc nhấn để chọn</p>
                <p className="text-xs text-slate-400">Hỗ trợ file .xlsx, .xls</p>
              </div>
            )}
          </div>
        ) : (
          /* Result Summary */
          <div className="space-y-3">
            <div className={`p-4 rounded-lg border flex flex-col items-center gap-1.5 ${result.failedCount === 0 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-amber-50/60 border-amber-200 text-amber-800'}`}>
              {result.failedCount === 0 ? <CheckCircle size={28} className="text-emerald-600" /> : <AlertCircle size={28} className="text-amber-600" />}
              <h3 className="font-semibold text-base">Hoàn tất nhập dữ liệu</h3>
              <p className="text-xs tabular-nums">Tổng số dòng: {result.totalRows}</p>
              <div className="flex gap-3 mt-2 tabular-nums">
                <span className="text-xs font-medium text-emerald-700 bg-white border border-emerald-200 px-2.5 py-1 rounded">Thành công: {result.importedCount}</span>
                <span className="text-xs font-medium text-[#D92D20] bg-white border border-red-200 px-2.5 py-1 rounded">Thất bại: {result.failedCount}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50/70 rounded-lg border border-red-200 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-red-800 mb-1.5">Chi tiết lỗi:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-red-700">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-[#D92D20] text-xs font-medium rounded-md flex items-center gap-2">
            <AlertCircle size={15} /> {errorMsg}
          </div>
        )}
      </div>
    </Modal>
  );
}
