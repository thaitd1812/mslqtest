import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { grade, buildReportPayload } from '@/lib/mslq/score';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';

export async function POST(req: Request) {
    try {
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
