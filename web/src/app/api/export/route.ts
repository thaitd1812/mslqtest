import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
  );

  const { data: results, error } = await supabase
    .from('mslq_results')
    .select('id, created_at, status, omr_meta_jsonb, scores_jsonb, answers_jsonb')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate CSV Header
  const header = [
    'Thoi gian', 
    'Ho va ten', 
    'Nam sinh', 
    'Niem tin nang luc', 
    'Gia tri va hung thu', 
    'Lo au kiem tra', 
    'Chien luoc hoc tap', 
    'Tu dieu chinh', 
    'Trang thai', 
    'ID'
  ];
  
  // Create 44 columns for Q1 -> Q44
  for (let i = 1; i <= 44; i++) {
    header.push(`Cau ${i}`);
  }

  const rows = results.map(row => {
    const meta = row.omr_meta_jsonb || {};
    const scores = row.scores_jsonb || {};
    const answers = row.answers_jsonb || [];
    
    // Map answers by question number
    const answerMap: Record<number, number> = {};
    if (Array.isArray(answers)) {
      answers.forEach(a => {
        if (a && a.q && a.v) {
          answerMap[a.q] = a.v;
        }
      });
    }

    const rowData = [
      `"${new Date(row.created_at).toLocaleString('vi-VN')}"`,
      `"${meta.studentName || ''}"`,
      `"${meta.studentDob || ''}"`,
      scores['Niềm tin vào năng lực học tập'] ? Number(scores['Niềm tin vào năng lực học tập']).toFixed(1) : '',
      scores['Giá trị và hứng thú học tập'] ? Number(scores['Giá trị và hứng thú học tập']).toFixed(1) : '',
      scores['Lo âu khi kiểm tra'] ? Number(scores['Lo âu khi kiểm tra']).toFixed(1) : '',
      scores['Chiến lược học tập'] ? Number(scores['Chiến lược học tập']).toFixed(1) : '',
      scores['Khả năng tự điều chỉnh việc học'] ? Number(scores['Khả năng tự điều chỉnh việc học']).toFixed(1) : '',
      `"${row.status}"`,
      `"${row.id}"`
    ];

    // Append 44 answers
    for (let i = 1; i <= 44; i++) {
      rowData.push(answerMap[i] ? answerMap[i].toString() : '');
    }

    return rowData.join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');

  // Add BOM for Excel UTF-8 support
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mslq_export.csv"',
    },
  });
}
