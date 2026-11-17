import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseServer, describeDbError } from '@/lib/supabase/server';
import { grade } from '@/lib/mslq/score';

/**
 * Nhận bài làm MSLQ điền trực tiếp trên web (trang /khao-sat).
 *
 * Lưu vào cùng bảng mslq_results với phiếu quét OMR, nên dashboard, trang kết quả
 * và file CSV dùng chung được. Không cần bước duyệt ảnh vì đáp án đã chính xác,
 * nên bản ghi vào thẳng trạng thái 'completed'.
 *
 * Nếu đặt biến môi trường SURVEY_PIN, học sinh phải nhập đúng mã PIN thầy cô phát
 * thì mới nộp được (chặn người ngoài có link gửi rác vào dữ liệu nghiên cứu).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const studentCode = String(body.studentCode ?? '').trim();
        const round = Number(body.round);
        const studentName = String(body.studentName ?? '').trim().slice(0, 80);
        const answers = body.answers;

        const pin = process.env.SURVEY_PIN;
        if (pin && String(body.pin ?? '').trim() !== pin) {
            return NextResponse.json({ error: 'Mã PIN không đúng. Hỏi lại thầy cô.' }, { status: 403 });
        }
        if (!/^\d{3}$/.test(studentCode)) {
            return NextResponse.json({ error: 'Mã học sinh phải gồm đúng 3 chữ số, ví dụ 107.' }, { status: 400 });
        }
        if (round !== 1 && round !== 2) {
            return NextResponse.json({ error: 'Chọn Lần 1 hoặc Lần 2.' }, { status: 400 });
        }
        if (
            !Array.isArray(answers) ||
            answers.length !== 44 ||
            answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)
        ) {
            return NextResponse.json({ error: 'Cần trả lời đủ 44 câu, mỗi câu một mức từ 1 đến 5.' }, { status: 400 });
        }

        const supabase = getSupabaseServer();

        // Một mã chỉ nộp một lần cho mỗi đợt, tránh trùng dữ liệu khi phân tích.
        const { data: existing, error: lookupError } = await supabase
            .from('mslq_results')
            .select('id')
            .eq('omr_meta_jsonb->>studentCode', studentCode)
            .eq('omr_meta_jsonb->>round', String(round))
            // Phiếu giấy quét lỗi đang chờ duyệt không được chặn em làm lại trên web;
            // nếu cả hai cùng tồn tại, bước chốt phiếu giấy sẽ báo trùng.
            .eq('status', 'completed')
            .limit(1);
        if (lookupError) {
            return NextResponse.json({ error: `Không kiểm tra được dữ liệu: ${describeDbError(lookupError)}` }, { status: 500 });
        }
        if (existing && existing.length > 0) {
            return NextResponse.json(
                { error: `Mã ${studentCode} đã nộp Lần ${round} rồi. Nếu nhập nhầm mã, hãy báo thầy cô.` },
                { status: 409 }
            );
        }

        const results = grade(answers);
        const scores_jsonb: Record<string, number> = {};
        for (const r of results) scores_jsonb[r.name] = r.avg;

        const { error: dbError } = await supabase.from('mslq_results').insert({
            id: uuidv4(),
            tenant_id: 'tenant_1',
            status: 'completed',
            answers_jsonb: answers.map((v: number, i: number) => ({ q: i + 1, v, flag: 'web' })),
            scores_jsonb,
            omr_meta_jsonb: {
                studentName: studentName || `HS ${studentCode} · Lần ${round}`,
                studentCode,
                round: String(round),
                source: 'web',
            },
            photo_url: '[]',
        });

        if (dbError) {
            return NextResponse.json({ error: `Không lưu được bài làm: ${describeDbError(dbError)}` }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
