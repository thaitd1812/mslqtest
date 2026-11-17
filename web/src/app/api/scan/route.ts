import { NextResponse } from 'next/server';
import { getSupabaseServer, describeDbError } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60; // Allow max 60s execution time on Vercel

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';
const UPLOAD_BUCKET = 'mslq-uploads';

export async function POST(req: Request) {
    try {
        const supabase = getSupabaseServer();
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const studentName = formData.get('studentName') as string || '';
        const studentDob = formData.get('studentDob') as string || '';
        const parentPhone = formData.get('parentPhone') as string || '';
        
        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'Missing files' }, { status: 400 });
        }

        const fileBuffers = await Promise.all(
            files.map(async (file, i) => ({
                file,
                buffer: Buffer.from(await file.arrayBuffer()),
                safeName: `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            }))
        );

        // Chạy song song: gửi base64 tới worker + upload ảnh lên Supabase
        const workerPayload = fileBuffers.map(({ file, buffer }) => ({
            filename: file.name,
            content_b64: buffer.toString('base64')
        }));

        const [workerRes, uploadResults] = await Promise.all([
            // Gửi thẳng bytes tới worker (không cần worker download lại từ Supabase)
            fetch(`${WORKER_URL}/omr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${WORKER_SECRET}`
                },
                body: JSON.stringify({ files: workerPayload })
            }),
            // Upload lên Supabase để lưu ảnh gốc (chạy song song với worker)
            Promise.all(fileBuffers.map(async ({ file, buffer, safeName }) => {
                const { error: uploadError } = await supabase.storage
                    .from(UPLOAD_BUCKET)
                    .upload(safeName, buffer, { contentType: file.type, upsert: true });
                if (uploadError) {
                    console.error(`Supabase Storage Error (${file.name}):`, uploadError);
                    return { url: null as string | null, fileName: file.name, reason: uploadError.message };
                }
                const url = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(safeName).data.publicUrl;
                return { url: url as string | null, fileName: file.name, reason: null as string | null };
            }))
        ]);

        if (!workerRes.ok) {
            const errText = await workerRes.text();
            console.error("Worker Error:", errText);
            return NextResponse.json({ error: 'Worker OMR failed' }, { status: 500 });
        }

        const data = await workerRes.json();
        const fileUrls = uploadResults.map(r => r.url).filter((url): url is string => url !== null);
        const failedUploads = uploadResults.filter(r => r.url === null);
        if (failedUploads.length > 0) {
            console.error(
                `Upload ảnh gốc thất bại ${failedUploads.length}/${uploadResults.length} tệp:`,
                failedUploads.map(f => `${f.fileName}: ${f.reason}`).join('; ')
            );
        }
        
        if (!data.success) {
            return NextResponse.json({ error: data.error || 'Worker OMR failed to extract' }, { status: 400 });
        }
        
        const resultId = uuidv4();
        const tenantId = 'tenant_1';

        const { error: dbError } = await supabase
            .from('mslq_results')
            .insert({
                id: resultId,
                tenant_id: tenantId,
                answers_jsonb: data.answers,
                omr_meta_jsonb: { studentName: studentName || 'Chưa nhập tên', studentDob, parentPhone },
                photo_url: JSON.stringify(fileUrls), // Lưu mảng các link ảnh gốc
                status: 'review'
            });

        if (dbError) {
            console.error("Supabase insert error:", dbError);
            return NextResponse.json(
                { error: `Không lưu được kết quả vào database: ${describeDbError(dbError)}` },
                { status: 500 }
            );
        }
        
        return NextResponse.json({
            id: resultId,
            data,
            ...(failedUploads.length > 0 && {
                photoWarning: `Không lưu được ${failedUploads.length}/${uploadResults.length} ảnh gốc lên storage. Kết quả chấm vẫn hợp lệ.`
            })
        });

    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
