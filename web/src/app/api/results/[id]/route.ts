import { NextResponse } from 'next/server';
import { getSupabaseServer, describeDbError } from '@/lib/supabase/server';

// Các cột được phép trả ra ngoài. Không bao giờ trả tenant_id hay cột nội bộ khác.
const PUBLIC_COLUMNS =
  'id, status, created_at, answers_jsonb, omr_meta_jsonb, scores_jsonb, photo_url, report_pdf_url';

/**
 * Đọc một bài kiểm tra.
 *
 * Mở cho mọi người vì phụ huynh xem kết quả bằng link chứa UUID (không đoán được).
 * Trước đây trình duyệt gọi thẳng Supabase bằng anon key — nghĩa là ai cũng liệt kê
 * được toàn bộ bảng. Giờ mọi truy vấn đi qua đây và chỉ lấy đúng 1 bản ghi theo id.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('mslq_results')
      .select(PUBLIC_COLUMNS)
      .eq('id', id)
      .single();

    if (error || !data) {
      if (error) console.error('Supabase select error:', error);
      return NextResponse.json(
        { error: 'Không tìm thấy bài kiểm tra này.' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/** Xoá một bài kiểm tra. Middleware chặn route này với người chưa đăng nhập dashboard. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from('mslq_results')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase Delete Error:', error);
      return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
