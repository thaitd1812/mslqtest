import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60; // Allow max 60s execution time on Vercel

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

export async function POST(req: Request) {
    try {
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
                    .from('mslq-uploads')
                    .upload(safeName, buffer, { contentType: file.type, upsert: true });
                if (uploadError) {
                    console.error("Supabase Storage Error:", uploadError);
                    return null;
                }
                return supabase.storage.from('mslq-uploads').getPublicUrl(safeName).data.publicUrl;
            }))
        ]);

        if (!workerRes.ok) {
            const errText = await workerRes.text();
            console.error("Worker Error:", errText);
            return NextResponse.json({ error: 'Worker OMR failed' }, { status: 500 });
        }

        const data = await workerRes.json();
        const fileUrls = uploadResults.filter((url): url is string => url !== null);
        
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
            console.error("Supabase error:", dbError);
            return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
        }
        
        return NextResponse.json({
            id: resultId,
            data
        });

    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
