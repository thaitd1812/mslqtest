import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { grade } from '@/lib/mslq/score';

export async function POST(req: Request) {
    try {
        const supabase = getSupabaseServer();
        const { result_id, answers, studentCode, round } = await req.json();

        if (!result_id || !answers || answers.length !== 44) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const missing = answers.findIndex((a: unknown) => a === null || a === undefined);
        if (missing !== -1) {
            return NextResponse.json({ error: `Câu ${missing + 1} chưa có đáp án.` }, { status: 400 });
        }

        // Phiếu nhập hàng loạt: giáo viên có thể sửa mã học sinh / lần khảo sát khi máy đọc sai.
        let metaUpdate: Record<string, unknown> | undefined;
        if (studentCode !== undefined || round !== undefined) {
            const code = String(studentCode ?? '').trim();
            const rnd = String(round ?? '').trim();
            if (!/^\d{3}$/.test(code)) {
                return NextResponse.json({ error: 'Mã học sinh phải gồm đúng 3 chữ số.' }, { status: 400 });
            }
            if (rnd !== '1' && rnd !== '2') {
                return NextResponse.json({ error: 'Chọn Lần 1 hoặc Lần 2.' }, { status: 400 });
            }
            const { data: dup } = await supabase
                .from('mslq_results')
                .select('id')
                .eq('omr_meta_jsonb->>studentCode', code)
                .eq('omr_meta_jsonb->>round', rnd)
                // Chỉ chặn khi bài kia đã chốt; hai bài cùng mã đang chờ duyệt không được khoá chéo nhau.
                .eq('status', 'completed')
                .neq('id', result_id)
                .limit(1);
            if (dup && dup.length > 0) {
                return NextResponse.json({ error: `Mã ${code} đã có bài Lần ${rnd} khác. Kiểm tra lại mã.` }, { status: 409 });
            }
            const { data: current } = await supabase
                .from('mslq_results')
                .select('omr_meta_jsonb')
                .eq('id', result_id)
                .single();
            const meta = (current?.omr_meta_jsonb as Record<string, unknown>) || {};
            const autoName = !meta.studentName || /^HS \d{3}|^Chưa rõ mã/.test(String(meta.studentName));
            metaUpdate = {
                ...meta,
                studentCode: code,
                round: rnd,
                issues: [],
                ...(autoName && { studentName: `HS ${code} · Lần ${rnd}` }),
            };
        }

        const results = grade(answers);

        const scores_jsonb: Record<string, number> = {};
        for (const r of results) {
            scores_jsonb[r.name] = r.avg;
        }

        const final_answers_jsonb = answers.map((val: number, idx: number) => ({ q: idx + 1, v: val }));

        const { error: updateError } = await supabase
            .from('mslq_results')
            .update({
                status: 'completed',
                scores_jsonb,
                answers_jsonb: final_answers_jsonb,
                ...(metaUpdate && { omr_meta_jsonb: metaUpdate }),
            })
            .eq('id', result_id);

        if (updateError) {
            console.error('Database Update Error:', updateError);
            return NextResponse.json({ error: `Failed to update database: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({ ok: true });

    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
