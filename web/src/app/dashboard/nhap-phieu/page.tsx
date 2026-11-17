'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';

/**
 * Nhập hàng loạt phiếu MSLQ 1 trang.
 * Giáo viên chọn 1 file PDF cả lớp (máy photo / app scan) hoặc nhiều ảnh chụp.
 * Trình duyệt tách từng trang thành ảnh JPEG rồi gửi lần lượt tới /api/scan-sheet,
 * nên không vướng giới hạn 60 giây và ~4,5 MB mỗi request của Vercel.
 */

type RowState = 'waiting' | 'working' | 'completed' | 'review' | 'error';
type Row = {
    key: string;
    label: string;
    source: { file: File; page?: number };
    state: RowState;
    id?: string;
    code?: string | null;
    round?: number | null;
    issues?: string[];
    error?: string;
};

const TARGET_PX = 2000; // cạnh dài của ảnh gửi đi (~170 dpi cho A4), đủ nét cho OMR

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/jpeg', 0.85)
    );
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
    if (!pdfjsPromise) {
        pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
            return pdfjs;
        });
    }
    return pdfjsPromise;
}

async function pdfPageCount(file: File): Promise<number> {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const n = doc.numPages;
    await doc.destroy();
    return n;
}

async function renderPdfPage(file: File, pageNo: number): Promise<Blob> {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
        const page = await doc.getPage(pageNo);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: TARGET_PX / Math.max(base.width, base.height) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvasToJpeg(canvas);
    } finally {
        await doc.destroy();
    }
}

async function resizeImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file; // HEIC trên trình duyệt không đọc được: gửi nguyên, worker tự xử lý
    const scale = Math.min(1, TARGET_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvasToJpeg(canvas);
}

export default function BatchImportPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [running, setRunning] = useState(false);
    const [fatal, setFatal] = useState<string | null>(null);

    const patch = (key: string, p: Partial<Row>) =>
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

    const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length === 0) return;
        setFatal(null);
        setPreparing(true);
        try {
            const next: Row[] = [];
            for (const file of files) {
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    const n = await pdfPageCount(file);
                    for (let p = 1; p <= n; p++) {
                        next.push({ key: `${file.name}#${p}#${Math.random()}`, label: `${file.name} · trang ${p}`, source: { file, page: p }, state: 'waiting' });
                    }
                } else {
                    next.push({ key: `${file.name}#${Math.random()}`, label: file.name, source: { file }, state: 'waiting' });
                }
            }
            setRows((prev) => [...prev, ...next]);
        } catch (err) {
            setFatal(`Không mở được file: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setPreparing(false);
        }
    };

    const processRow = async (row: Row) => {
        patch(row.key, { state: 'working', error: undefined });
        try {
            const blob = row.source.page
                ? await renderPdfPage(row.source.file, row.source.page)
                : await resizeImage(row.source.file);
            const form = new FormData();
            form.append('file', blob, 'page.jpg');
            form.append('label', row.label);
            const res = await fetch('/api/scan-sheet', { method: 'POST', body: form });
            const data = await res.json().catch(() => ({}));
            if (res.status === 403) throw new Error('Phiên đăng nhập đã hết. Tải lại trang để đăng nhập.');
            if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
            patch(row.key, {
                state: data.status === 'completed' ? 'completed' : 'review',
                id: data.id,
                code: data.studentCode ?? data.studentCodeRaw,
                round: data.round,
                issues: data.issues || [],
            });
        } catch (err) {
            patch(row.key, { state: 'error', error: err instanceof Error ? err.message : String(err) });
        }
    };

    const runAll = async (only: RowState[]) => {
        setRunning(true);
        // Chạy tuần tự: tránh làm quá tải worker OMR và giữ thứ tự dễ theo dõi.
        for (const row of rows.filter((r) => only.includes(r.state))) {
            await processRow(row);
        }
        setRunning(false);
    };

    const count = (s: RowState) => rows.filter((r) => r.state === s).length;
    const pending = count('waiting');
    const failed = count('error');

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Nhập phiếu hàng loạt</h1>
                        <p className="text-gray-600 text-sm mt-1">
                            Phiếu MSLQ 1 trang. Chọn 1 file PDF cả lớp hoặc nhiều ảnh chụp — mỗi trang là một học sinh.
                        </p>
                    </div>
                    <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Về danh sách</Link>
                </div>

                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 bg-white cursor-pointer ${running ? 'opacity-50 pointer-events-none' : 'border-gray-300 hover:border-indigo-400'}`}>
                    {preparing ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /> : <UploadCloud className="w-10 h-10 text-indigo-500" />}
                    <span className="mt-3 font-medium text-gray-800">{preparing ? 'Đang mở file…' : 'Chọn file PDF hoặc ảnh'}</span>
                    <span className="text-xs text-gray-500 mt-1">Có thể chọn nhiều file một lúc</span>
                    <input type="file" multiple accept="application/pdf,image/*,.heic,.heif" className="hidden" onChange={onPick} disabled={running || preparing} />
                </label>

                {fatal && <p className="mt-4 text-sm text-red-700">{fatal}</p>}

                {rows.length > 0 && (
                    <>
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => runAll(['waiting'])}
                                disabled={running || pending === 0}
                                className="rounded-lg bg-indigo-600 text-white px-5 py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {running && <Loader2 className="w-4 h-4 animate-spin" />}
                                Chấm {pending} trang
                            </button>
                            {failed > 0 && (
                                <button
                                    onClick={() => runAll(['error'])}
                                    disabled={running}
                                    className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" /> Chấm lại {failed} trang lỗi
                                </button>
                            )}
                            <span className="text-sm text-gray-600">
                                Xong <strong className="text-green-700">{count('completed')}</strong> · Cần duyệt{' '}
                                <strong className="text-amber-700">{count('review')}</strong> · Lỗi{' '}
                                <strong className="text-red-700">{failed}</strong> / {rows.length}
                            </span>
                        </div>

                        <div className="mt-4 bg-white rounded-2xl border border-gray-200 divide-y">
                            {rows.map((r) => (
                                <div key={r.key} className="p-3 flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {r.state === 'waiting' && <span className="block w-5 h-5 rounded-full border-2 border-gray-300" />}
                                        {r.state === 'working' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                                        {r.state === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                        {r.state === 'review' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                                        {r.state === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-baseline gap-x-3">
                                            <span className="text-sm text-gray-500 truncate">{r.label}</span>
                                            {r.code && (
                                                <span className="text-sm font-semibold text-gray-900">
                                                    Mã {r.code}{r.round ? ` · Lần ${r.round}` : ''}
                                                </span>
                                            )}
                                        </div>
                                        {r.issues && r.issues.length > 0 && (
                                            <p className="text-xs text-amber-800 mt-1">{r.issues.join(' · ')}</p>
                                        )}
                                        {r.error && <p className="text-xs text-red-700 mt-1">{r.error}</p>}
                                    </div>
                                    {r.id && (
                                        <Link
                                            href={r.state === 'review' ? `/review/${r.id}` : `/result/${r.id}`}
                                            target="_blank"
                                            className={`text-sm font-medium whitespace-nowrap ${r.state === 'review' ? 'text-amber-700' : 'text-indigo-600'} hover:underline`}
                                        >
                                            {r.state === 'review' ? 'Duyệt →' : 'Xem →'}
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
