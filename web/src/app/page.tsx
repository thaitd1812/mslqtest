'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileImage, Loader2, AlertCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import Link from 'next/link';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [studentName, setStudentName] = useState('');
  const [studentDob, setStudentDob] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      for (const f of files) {
        // Nén ảnh nếu là định dạng image
        if (f.type.startsWith('image/') && !f.type.includes('svg') && !f.type.includes('gif')) {
          try {
            const options = {
              maxSizeMB: 0.25,         // Ép dung lượng tối đa 250KB mỗi ảnh (tăng tốc độ mạng 3G/4G)
              maxWidthOrHeight: 1200,  // Giảm từ 1920 xuống 1200 (đủ nét cho AI đọc)
              useWebWorker: true,
            };
            const compressedBlob = await imageCompression(f, options);
            const compressedFile = new File([compressedBlob], f.name, { type: compressedBlob.type });
            formData.append('files', compressedFile);
          } catch (error) {
            console.error("Lỗi nén ảnh:", error);
            formData.append('files', f); // Fallback: dùng ảnh gốc
          }
        } else {
          formData.append('files', f);
        }
      }
      
      formData.append('studentName', studentName);
      formData.append('studentDob', studentDob);
      formData.append('parentPhone', parentPhone);

      const res = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        if (res.status === 413) {
          throw new Error('Dung lượng ảnh quá lớn (>4.5MB). Vui lòng thử từng ảnh một hoặc giảm dung lượng ảnh.');
        } else if (res.status === 504) {
          throw new Error('Hệ thống xử lý quá lâu (Timeout). Vui lòng thử lại.');
        } else {
          throw new Error(`Lỗi hệ thống (${res.status}): Không thể đọc dữ liệu trả về từ server.`);
        }
      }
      
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to scan image');
      }

      // data.id là ID của mslq_results
      router.push(`/review/${data.id}`);
      
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white text-center">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <UploadCloud className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Chấm MSLQ AI</h1>
          <p className="text-blue-100 text-sm">Hệ thống nhận diện OMR bằng AI</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="space-y-6">
            {/* Upload Box */}
            <label className={`
              flex flex-col items-center justify-center w-full h-48 
              border-2 border-dashed rounded-xl cursor-pointer 
              transition-all duration-200
              ${files.length > 0 ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}
            `}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                {files.length > 0 ? (
                  <>
                    <FileImage className="w-10 h-10 text-indigo-500 mb-3" />
                    <p className="mb-2 text-sm text-indigo-700 font-medium break-all">
                      {files.length === 1 ? files[0].name : `Đã chọn ${files.length} tệp`}
                    </p>
                    <p className="text-xs text-indigo-500/70">Nhấn để chọn ảnh khác</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="mb-2 text-sm text-slate-600"><span className="font-semibold">Bấm để tải file lên</span> hoặc chụp ngay</p>
                    <p className="text-xs text-slate-500">Hỗ trợ PNG, JPG, HEIC, PDF</p>
                  </>
                )}
              </div>
              <input 
                type="file" 
                multiple
                className="hidden" 
                accept=".png,.jpg,.jpeg,.pdf,.heic,.heif,image/png,image/jpeg,application/pdf" 
                onChange={handleFileChange}
              />
            </label>

            {/* Thông tin học sinh */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Họ và tên</label>
                <input 
                  type="text" 
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div className="w-1/3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Năm sinh</label>
                <input 
                  type="text" 
                  value={studentDob}
                  onChange={(e) => setStudentDob(e.target.value)}
                  placeholder="VD: 2008"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Số điện thoại phụ huynh</label>
              <input 
                type="tel" 
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="VD: 0987654321"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 rounded-xl flex gap-3 text-red-700 text-sm items-start">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Action */}
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || !studentName || !studentDob || loading}
              className={`
                w-full py-3.5 px-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2
                transition-all duration-200
                ${files.length === 0 || !studentName || !studentDob || loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'}
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang phân tích OMR...</span>
                </>
              ) : (
                <span>Quét và Chấm điểm</span>
              )}
            </button>
          </div>
        </div>

        {/* Footer Link to Dashboard */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <a href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1.5">
            <span>Truy cập trang Quản lý (Dashboard)</span>
          </a>
        </div>

      </div>
    </div>
  );
}
