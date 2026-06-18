'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { GROUPS } from '@/lib/mslq/groups';
import { getTierFromAvg } from '@/lib/mslq/score';
import { Loader2, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

const TIER_STYLE = [
    { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', bar: 'bg-red-400' },
    { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' },
    { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' },
];

const TIER_STYLE_ANXIETY = [
    { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' },
    { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' },
    { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', bar: 'bg-red-400' },
];

const LEVELS_POSITIVE = ['Cần ưu tiên', 'Cần hỗ trợ', 'Khá', 'Tốt'];
const LEVELS_ANXIETY = ['Áp lực thấp', 'Áp lực TB', 'Áp lực cao', 'Rất cao'];

export default function ResultPage() {
    const { id } = useParams();
    const [studentInfo, setStudentInfo] = useState<{ name: string; dob: string } | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        supabase
            .from('mslq_results')
            .select('omr_meta_jsonb, scores_jsonb, report_pdf_url')
            .eq('id', id)
            .single()
            .then(({ data }) => {
                if (data) {
                    setStudentInfo({
                        name: data.omr_meta_jsonb?.studentName || '',
                        dob: data.omr_meta_jsonb?.studentDob || '',
                    });
                    setScores(data.scores_jsonb || {});
                    if (data.report_pdf_url) {
                        setPdfUrl(data.report_pdf_url);
                    }
                }
                setPageLoading(false);
            });
    }, [id]);

    // Auto-generate PDF after scores are loaded (if not already done)
    useEffect(() => {
        if (pageLoading || pdfUrl) return;
        setPdfLoading(true);
        fetch('/api/render-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ result_id: id }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.pdf_url) {
                    setPdfUrl(data.pdf_url);
                } else {
                    setPdfError(data.error || 'Không thể tạo PDF');
                }
            })
            .catch(() => setPdfError('Không thể kết nối tạo PDF'))
            .finally(() => setPdfLoading(false));
    }, [pageLoading, id, pdfUrl]);

    const handleCopy = () => {
        if (!pdfUrl) return;
        navigator.clipboard.writeText(pdfUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (pageLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans">
            <div className="max-w-3xl mx-auto space-y-5">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-5 h-5 text-green-300" />
                        <span className="text-sm font-medium text-indigo-200">Kết quả đã được lưu</span>
                    </div>
                    <h1 className="text-2xl font-bold">{studentInfo?.name || 'Học sinh'}</h1>
                    <p className="text-indigo-200 text-sm mt-1">Năm sinh: {studentInfo?.dob || '---'}</p>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {GROUPS.map(group => {
                        const avg = scores[group.name] ?? 0;
                        const tier = getTierFromAvg(avg);
                        const style = group.reversed ? TIER_STYLE_ANXIETY[tier] : TIER_STYLE[tier];
                        const level = group.reversed ? LEVELS_ANXIETY[tier] : LEVELS_POSITIVE[tier];
                        const pct = Math.round(((avg - 1) / 4) * 100);

                        return (
                            <div key={group.key} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">{group.en}</p>
                                        <p className="font-semibold text-slate-800 text-sm leading-tight">{group.name}</p>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${style.badge}`}>{level}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 w-8 text-right">{avg.toFixed(1)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* PDF Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                        <div>
                            <h2 className="font-bold text-slate-800">Báo cáo chi tiết PDF</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Gửi link cho phụ huynh qua Zalo</p>
                        </div>
                        <div className="flex gap-2">
                            {pdfUrl ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white text-slate-700 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Đã copy!' : 'Copy link'}
                                    </button>
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-3 rounded-lg transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Tải PDF
                                    </a>
                                </>
                            ) : pdfLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang tạo PDF...
                                </div>
                            ) : pdfError ? (
                                <div className="flex items-center gap-2 text-sm text-red-600">
                                    <AlertCircle className="w-4 h-4" />
                                    {pdfError}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="h-[600px] bg-slate-50">
                        {pdfUrl ? (
                            <iframe src={pdfUrl} className="w-full h-full border-none" title="Báo cáo PDF" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <p className="text-sm">Đang tạo báo cáo PDF...</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center pb-4">
                    <a href="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        ← Chấm bài mới
                    </a>
                </div>

            </div>
        </div>
    );
}
