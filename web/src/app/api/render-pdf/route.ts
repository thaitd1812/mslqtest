import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { grade, buildReportPayload } from '@/lib/mslq/score';

export const maxDuration = 60;

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';

export async function POST(req: Request) {
    try {
        const supabase = getSupabaseServer();
        const { result_id } = await req.json();

        if (!result_id) {
            return NextResponse.json({ error: 'Missing result_id' }, { status: 400 });
        }

        const { data: dbData, error: fetchError } = await supabase
            .from('mslq_results')
            .select('omr_meta_jsonb, answers_jsonb')
            .eq('id', result_id)
            .single();

        if (fetchError || !dbData) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const studentInfo = {
            name: dbData.omr_meta_jsonb?.studentName || '',
            dob: dbData.omr_meta_jsonb?.studentDob || '',
        };

        const answers: number[] = (dbData.answers_jsonb as { q: number; v: number }[]).map(a => a.v);
        const results = grade(answers);
        const placeholders = buildReportPayload(studentInfo, results);

        const upload_path = `tenant_1/result_${result_id}_${Date.now()}.pdf`;

        const res = await fetch(`${WORKER_URL}/render`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WORKER_SECRET}`,
            },
            body: JSON.stringify({ placeholders, upload_path }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Worker Render Error:', errText);
            return NextResponse.json({ error: 'Worker render failed' }, { status: 500 });
        }

        const data = await res.json();

        await supabase
            .from('mslq_results')
            .update({ report_pdf_url: data.pdf_url })
            .eq('id', result_id);

        return NextResponse.json({ pdf_url: data.pdf_url });

    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
