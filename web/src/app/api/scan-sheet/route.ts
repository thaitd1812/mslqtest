import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseServer, describeDbError } from '@/lib/supabase/server';
import { grade } from '@/lib/mslq/score';

/**
 * Nhập hàng loạt phiếu MSLQ 1 trang: mỗi request = MỘT trang = một học sinh.
 * Trình duyệt tự tách PDF/nhiều ảnh thành từng trang rồi gọi lần lượt, nên không
 * vướng giới hạn thời gian và dung lượng request của Vercel.
 *
 * Trang đọc sạch (mã, lần, 44 câu đều chắc chắn, không trùng) -> 'completed'.
 * Còn lại -> 'review' để giáo viên soát ở /review/[id].
 */
export const maxDuration = 60;

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';
const UPLOAD_BUCKET = 'mslq-uploads';

type SheetAnswer = { q: number; v: number | null; flag: string };
type SheetResult = {
    success: boolean;
    error?: string;
    studentCode: string | null;
    studentCodeRaw: string;
    round: 1 | 2 | null;
    answers: SheetAnswer[];
    needsReview: boolean;
};

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get('file');
        const label = String(form.get('label') || '').slice(0, 120);   // vd "lop9a.pdf · trang 3"
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Thiếu file ảnh.' }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());

        const supabase = getSupabaseServer();
        const safeName = `sheet_${Date.now()}_${uuidv4().slice(0, 8)}.jpg`;

        const [workerRes, upload] = await Promise.all([
            fetch(`${WORKER_URL}/omr/sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WORKER_SECRET}` },
                body: JSON.stringify({ filename: file.name, content_b64: buffer.toString('base64') }),
            }),
            supabase.storage.from(UPLOAD_BUCKET).upload(safeName, buffer, {
                contentType: file.type || 'image/jpeg',
                upsert: true,
            }),
        ]);

        if (!workerRes.ok) {
            console.error('Worker /omr/sheet error:', await workerRes.text());
            return NextResponse.json({ error: 'Máy chấm OMR đang lỗi, thử lại sau.' }, { status: 502 });
        }
        const sheet = (await workerRes.json()) as SheetResult;
        if (!sheet.success) {
            return NextResponse.json({ error: sheet.error || 'Không đọc được trang này.' }, { status: 422 });
        }

        const issues: string[] = [];
        if (!sheet.studentCode) issues.push(`Mã học sinh đọc không rõ (${sheet.studentCodeRaw})`);
        if (!sheet.round) issues.push('Chưa tô hoặc tô cả hai ô Lần khảo sát');
        const blank = sheet.answers.filter((a) => a.flag === 'blank').map((a) => a.q);
        const multi = sheet.answers.filter((a) => a.flag === 'multi').map((a) => a.q);
        const soft = sheet.answers.filter((a) => a.flag === 'dominant' || a.flag === 'check').map((a) => a.q);
        if (blank.length) issues.push(`Bỏ trống câu ${blank.join(', ')}`);
        if (multi.length) issues.push(`Tô nhiều ô câu ${multi.join(', ')}`);
        if (soft.length) issues.push(`Nên soát lại câu ${soft.join(', ')}`);

        if (sheet.studentCode && sheet.round) {
            const { data: dup, error: dupError } = await supabase
                .from('mslq_results')
                .select('id')
                .eq('omr_meta_jsonb->>studentCode', sheet.studentCode)
                .eq('omr_meta_jsonb->>round', String(sheet.round))
                .limit(1);
            if (dupError) {
                return NextResponse.json({ error: `Không kiểm tra được trùng mã: ${describeDbError(dupError)}` }, { status: 500 });
            }
            if (dup && dup.length > 0) issues.push(`Mã ${sheet.studentCode} đã có bài Lần ${sheet.round} — kiểm tra trùng phiếu hoặc tô nhầm mã`);
        }

        // Lưới an toàn: chỉ chấm điểm khi đủ đúng 44 câu, mỗi câu 1..5 (grade() sẽ ném lỗi nếu không).
        const complete =
            sheet.answers.length === 44 &&
            sheet.answers.every((a, i) => a.q === i + 1 && Number.isInteger(a.v) && (a.v as number) >= 1 && (a.v as number) <= 5);
        if (!complete && issues.length === 0) issues.push('Dữ liệu đáp án không đủ 44 câu hợp lệ');

        const status = issues.length === 0 ? 'completed' : 'review';
        let scores_jsonb: Record<string, number> | null = null;
        if (status === 'completed') {
            scores_jsonb = {};
            for (const r of grade(sheet.answers.map((a) => a.v as number))) scores_jsonb[r.name] = r.avg;
        }

        const photoUrl = upload.error ? null : supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(safeName).data.publicUrl;
        if (upload.error) console.error('Upload ảnh phiếu thất bại:', upload.error.message);

        const id = uuidv4();
        const code = sheet.studentCode ?? '';
        const round = sheet.round ? String(sheet.round) : '';
        const { error: dbError } = await supabase.from('mslq_results').insert({
            id,
            tenant_id: 'tenant_1',
            status,
            answers_jsonb: sheet.answers,
            scores_jsonb,
            omr_meta_jsonb: {
                studentName: code ? `HS ${code}${round ? ` · Lần ${round}` : ''}` : `Chưa rõ mã (${label || 'phiếu quét'})`,
                studentCode: code,
                round,
                source: 'omr',
                batchLabel: label,
                issues,
            },
            photo_url: JSON.stringify(photoUrl ? [photoUrl] : []),
        });
        if (dbError) {
            return NextResponse.json({ error: `Không lưu được kết quả: ${describeDbError(dbError)}` }, { status: 500 });
        }

        return NextResponse.json({ id, status, studentCode: sheet.studentCode, studentCodeRaw: sheet.studentCodeRaw, round: sheet.round, issues });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
