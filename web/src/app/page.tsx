'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileImage, Loader2, AlertCircle } from 'lucide-react';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
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
      files.forEach(f => formData.append('files', f));

      const res = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan image');
      }

      // data.id là ID của mslq_results
      router.push(`/review/${data.id}`);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message);
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
          <h1 className="text-2xl font-bold tracking-tight mb-1">Chấm Bài Online</h1>
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

            {error && (
              <div className="p-4 bg-red-50 rounded-xl flex gap-3 text-red-700 text-sm items-start">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Action */}
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || loading}
              className={`
                w-full py-3.5 px-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2
                transition-all duration-200
                ${files.length === 0 || loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'}
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

      </div>
    </div>
  );
}
