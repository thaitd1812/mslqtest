import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseServer();

  const { data: results, error } = await supabase
    .from('mslq_results')
    .select('id, created_at, status, omr_meta_jsonb, scores_jsonb, answers_jsonb')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate CSV Header
  const header = [
    'Thoi gian', 
    'Ho va ten', 
    'Nam sinh', 
    'SDT phu huynh',
    'Ma HS',
    'Lan',
    'Nguon',
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
      meta.parentPhone ? `="""${meta.parentPhone}"""` : '""',
      meta.studentCode ? `="""${meta.studentCode}"""` : '""',
      `"${meta.round || ''}"`,
      `"${meta.source || 'omr'}"`,
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
