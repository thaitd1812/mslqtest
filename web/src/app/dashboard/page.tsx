import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, CheckCircle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
  );

  const statusFilter = searchParams.status === 'review' ? 'review' : (searchParams.status === 'all' ? 'all' : 'done');

  let query = supabase
    .from('mslq_results')
    .select('id, created_at, status, omr_meta_jsonb, scores_jsonb, report_pdf_url')
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  // Fetch only needed columns (Projection)
  const { data: results, error } = await query;

  if (error) {
    console.error('Error fetching dashboard data:', error);
  }

  const getScore = (scores: any, key: string) => {
    if (!scores || !scores[key]) return '-';
    return Number(scores[key]).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Tổng hợp Dữ liệu</h1>
            </div>
            <div className="flex items-center gap-4 text-sm mt-3 ml-11">
              <span className="text-gray-500">Lọc theo:</span>
              <div className="flex gap-2">
                <Link href="/dashboard?status=done" className={`px-3 py-1 rounded-full transition-colors ${statusFilter === 'done' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Hoàn thành
                </Link>
                <Link href="/dashboard?status=review" className={`px-3 py-1 rounded-full transition-colors ${statusFilter === 'review' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Chờ duyệt
                </Link>
                <Link href="/dashboard?status=all" className={`px-3 py-1 rounded-full transition-colors ${statusFilter === 'all' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Tất cả
                </Link>
              </div>
            </div>
          </div>
          
          <Link 
            href="/api/export"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel (CSV)</span>
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Thời gian</th>
                  <th className="px-6 py-4">Học sinh</th>
                  <th className="px-6 py-4 text-center">Năng lực</th>
                  <th className="px-6 py-4 text-center">Hứng thú</th>
                  <th className="px-6 py-4 text-center">Lo âu</th>
                  <th className="px-6 py-4 text-center">Chiến lược</th>
                  <th className="px-6 py-4 text-center">Tự điều chỉnh</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results?.map((row) => {
                  const meta = row.omr_meta_jsonb || {};
                  const scores = row.scores_jsonb || {};
                  const isDone = row.status === 'done';
                  
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {new Date(row.created_at).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{meta.studentName || 'Chưa nhập tên'}</div>
                        <div className="text-xs text-gray-500">NS: {meta.studentDob || '---'} | SĐT: {meta.parentPhone || '---'}</div>
                      </td>
                      
                      {/* 5 Group Scores */}
                      <td className="px-6 py-4 text-center font-medium text-gray-700">{getScore(scores, 'Niềm tin vào năng lực học tập')}</td>
                      <td className="px-6 py-4 text-center font-medium text-gray-700">{getScore(scores, 'Giá trị và hứng thú học tập')}</td>
                      <td className="px-6 py-4 text-center font-medium text-gray-700">{getScore(scores, 'Lo âu khi kiểm tra')}</td>
                      <td className="px-6 py-4 text-center font-medium text-gray-700">{getScore(scores, 'Chiến lược học tập')}</td>
                      <td className="px-6 py-4 text-center font-medium text-gray-700">{getScore(scores, 'Khả năng tự điều chỉnh việc học')}</td>
                      
                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5" /> Hoàn thành
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <Clock className="w-3.5 h-3.5" /> Chờ duyệt
                          </span>
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link 
                          href={isDone ? `/result/${row.id}?pdf=${encodeURIComponent(row.report_pdf_url || '')}` : `/review/${row.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          <span>{isDone ? 'Xem điểm' : 'Duyệt bài'}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {(!results || results.length === 0) && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      Chưa có dữ liệu bài kiểm tra nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
}
