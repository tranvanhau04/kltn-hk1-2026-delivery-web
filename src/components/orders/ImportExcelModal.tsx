import React, { useState, useRef } from 'react';
import { Modal } from '@/components/common/Modal';
import { UploadCloud, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { importOrdersExcel } from '@/lib/api';

export default function ImportExcelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
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
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi upload file');
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
          <div className="flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-xl">
            <span className="text-sm font-500">Chưa có file mẫu?</span>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Cần cung cấp link tải template'); }} className="text-sm font-600 underline">
              Tải template Excel
            </a>
          </div>
        )}

        {/* Upload Area */}
        {!result ? (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
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
              <div className="flex flex-col items-center gap-2">
                <File size={32} className="text-green-500" />
                <p className="text-sm font-600 text-green-700">{file.name}</p>
                <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                <UploadCloud size={32} className="text-gray-400" />
                <p className="text-sm font-600 text-gray-700">Kéo thả file hoặc nhấn để chọn</p>
                <p className="text-xs text-gray-400">Hỗ trợ file .xlsx, .xls</p>
              </div>
            )}
          </div>
        ) : (
          /* Result Summary */
          <div className="space-y-3">
            <div className={`p-4 rounded-xl flex flex-col items-center gap-2 ${result.failedCount === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {result.failedCount === 0 ? <CheckCircle size={32} className="text-green-500" /> : <AlertCircle size={32} className="text-amber-500" />}
              <h3 className="font-600 text-lg">Hoàn tất nhập dữ liệu</h3>
              <p className="text-sm">Tổng số dòng: {result.totalRows}</p>
              <div className="flex gap-4 mt-2">
                <span className="text-sm font-600 text-green-600 bg-white px-3 py-1 rounded-full shadow-sm">Thành công: {result.importedCount}</span>
                <span className="text-sm font-600 text-red-600 bg-white px-3 py-1 rounded-full shadow-sm">Thất bại: {result.failedCount}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 max-h-40 overflow-y-auto">
                <p className="text-xs font-700 text-red-700 mb-2">Chi tiết lỗi:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-red-600">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-600 text-sm font-500 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}
      </div>
    </Modal>
  );
}
