'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

export default function ReviewPage() {
    const { id } = useParams();
    const router = useRouter();
    
    const [answers, setAnswers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    useEffect(() => {
        if (!id) return;
        supabase.from('mslq_results').select('*').eq('id', id).single().then(({data, error}) => {
            if (data && data.answers_jsonb) {
                const mapped = data.answers_jsonb.map((a: any) => ({
                    cau: a.q,
                    chon: a.v,
                    flag: a.v === 3 // if missing/blank, mark as flag
                }));
                // Sort by question number
                mapped.sort((a: any, b: any) => a.cau - b.cau);
                setAnswers(mapped);

                if (data.raw_image_url) {
                    try {
                        const urls = JSON.parse(data.raw_image_url);
                        setImageUrls(urls);
                    } catch (e) {
                        setImageUrls([data.raw_image_url]);
                    }
                }
            } else {
                console.error("Fetch error", error);
            }
            setLoading(false);
        });
    }, [id]);

    const handleFinalize = async () => {
        if (answers.length === 0) return;
        setIsFinalizing(true);
        try {
            const rawAnswers = answers.map(a => a.chon);
            const res = await fetch('/api/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    result_id: id,
                    answers: rawAnswers
                })
            });
            const data = await res.json();
            if (res.ok && data.pdf_url) {
                router.push(`/result/${id}?pdf=${encodeURIComponent(data.pdf_url)}`);
            } else {
                alert('Có lỗi xảy ra: ' + data.error);
                setIsFinalizing(false);
            }
        } catch (e: any) {
            alert('Có lỗi xảy ra: ' + e.message);
            setIsFinalizing(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Đang tải dữ liệu...</div>;
    }

    return (
        <div className="flex h-screen bg-gray-100 p-4 gap-4 font-sans">
            {/* Cột trái: Ảnh */}
            <div className="flex-1 bg-white rounded-xl shadow p-4 overflow-hidden flex flex-col">
                <h2 className="text-xl font-bold mb-4">Ảnh gốc đã upload</h2>
                <div className="flex-1 bg-gray-200 rounded border border-gray-300 overflow-y-auto">
                    {imageUrls.length > 0 ? (
                        imageUrls.map((url, idx) => (
                            <div key={idx} className="w-full h-full min-h-[500px]">
                                {url.toLowerCase().endsWith('.pdf') ? (
                                    <iframe src={url} title={`Original file ${idx}`} className="w-full h-full min-h-[800px] border-none" />
                                ) : (
                                    <img src={url} alt={`Upload ${idx}`} className="w-full h-auto object-contain" />
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full p-4 text-center">
                            <p className="text-gray-500">
                                Không tìm thấy file gốc hoặc file đã bị xóa ở Server.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Cột phải: Đối soát */}
            <div className="w-[450px] bg-white rounded-xl shadow p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold">Đối soát kết quả</h2>
                        <p className="text-sm text-gray-500">Kiểm tra lại đáp án AI đọc được</p>
                    </div>
                    <button
                        onClick={handleFinalize}
                        disabled={isFinalizing || answers.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-6 rounded-lg shadow-md transition flex items-center gap-2"
                    >
                        {isFinalizing ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Đang tạo PDF...
                            </>
                        ) : (
                            "Chốt kết quả"
                        )}
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {answers.map((ans, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${ans.flag ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-slate-50'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-slate-700">Câu {ans.cau}</span>
                                {ans.flag && <span className="text-xs font-bold text-amber-700 bg-amber-200 px-2 py-1 rounded-md">Thiếu đáp án</span>}
                            </div>
                            <div className="flex justify-between">
                                {[1, 2, 3, 4, 5].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => {
                                            const newAns = [...answers];
                                            newAns[idx].chon = val;
                                            newAns[idx].flag = false; // Xóa cờ sau khi sửa tay
                                            setAnswers(newAns);
                                        }}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 font-semibold text-lg transition-colors
                                            ${ans.chon === val 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                                : 'bg-white border-gray-300 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50'}`}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
