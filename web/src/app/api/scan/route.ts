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
        
        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'Missing files' }, { status: 400 });
        }

        const uploadPromises = files.map(async (file, i) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            const safeName = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            
            // Upload lên Supabase Storage bucket 'mslq-uploads'
            const { error: uploadError } = await supabase.storage
                .from('mslq-uploads')
                .upload(safeName, buffer, {
                    contentType: file.type,
                    upsert: true
                });

            if (uploadError) {
                console.error("Supabase Storage Error:", uploadError);
                throw new Error('Failed to upload to Supabase Storage');
            }
            
            // Lấy public URL
            const { data: publicUrlData } = supabase.storage.from('mslq-uploads').getPublicUrl(safeName);
            return publicUrlData.publicUrl;
        });

        let fileUrls: string[];
        try {
            fileUrls = await Promise.all(uploadPromises);
        } catch (e) {
            return NextResponse.json({ error: 'Failed to upload to Supabase Storage' }, { status: 500 });
        }
        
        const tempPaths = fileUrls; // Truyền URL HTTP thật cho Python Worker

        // Gọi sang python worker
        const res = await fetch(`${WORKER_URL}/omr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WORKER_SECRET}`
            },
            body: JSON.stringify({ file_urls: tempPaths })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Worker Error:", errText);
            return NextResponse.json({ error: 'Worker OMR failed' }, { status: 500 });
        }

        const data = await res.json();
        
        if (!data.success) {
            return NextResponse.json({ error: data.error || 'Worker OMR failed to extract' }, { status: 400 });
        }
        
        // MVP: Insert vào db
        const resultId = uuidv4();
        // Insert DB mock:
        // Thực tế ở MVP ta sẽ push mock vào
        
        // Wait, review page calls supabase.from('mslq_results').select() !
        // Nên ta BẮT BUỘC phải insert vào Supabase để trang review đọc được!
        
        const tenantId = 'tenant_1'; // Mock tenant for MVP
        
        // 2. Tạo mslq_results
        const { error: dbError } = await supabase
            .from('mslq_results')
            .insert({
                id: resultId,
                tenant_id: tenantId,
                answers_jsonb: data.answers,
                omr_meta_jsonb: { studentName: studentName || 'Chưa nhập tên', studentDob },
                photo_url: JSON.stringify(fileUrls), // Lưu mảng các link ảnh gốc
                status: 'review'
            });

        if (dbError) {
            console.error("Supabase error:", dbError);
            return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
        }
        
        // Không cần xoá file tạm vì đã lưu thẳng lên đám mây

        return NextResponse.json({
            id: resultId,
            data
        });

    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
