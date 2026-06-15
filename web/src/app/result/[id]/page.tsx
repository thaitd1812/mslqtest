'use client';
import { useSearchParams } from 'next/navigation';

export default function ResultPage() {
    const searchParams = useSearchParams();
    const pdfUrl = searchParams.get('pdf');

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col p-8 items-center">
            <h1 className="text-3xl font-bold mb-8">Báo Cáo Đã Hoàn Tất</h1>
            
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl flex flex-col gap-6">
                <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div>
                        <h2 className="font-bold text-lg text-blue-900">Chia sẻ báo cáo</h2>
                        <p className="text-sm text-blue-700">Gửi link này cho phụ huynh qua Zalo hoặc copy link trực tiếp.</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => navigator.clipboard.writeText(pdfUrl || '')}
                            className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded hover:bg-gray-50"
                        >
                            Copy Link
                        </button>
                        <a 
                            href={pdfUrl || '#'} 
                            target="_blank"
                            rel="noreferrer"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Tải file PDF
                        </a>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg h-[800px] overflow-hidden bg-gray-50">
                    {pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full" title="Báo cáo PDF" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Đang tải báo cáo...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
