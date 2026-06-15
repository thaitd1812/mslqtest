import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { grade, buildReportPayload } from '@/lib/mslq/score';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';

export async function POST(req: Request) {
    try {
        const { result_id, answers, studentInfo } = await req.json();
        
        if (!result_id || !answers || answers.length !== 44) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Fetch student info from DB
        let dbStudentInfo = studentInfo;
        const { data: dbData } = await supabase
            .from('mslq_results')
            .select('omr_meta_jsonb')
            .eq('id', result_id)
            .single();
            
        if (dbData && dbData.omr_meta_jsonb) {
            dbStudentInfo = {
                name: dbData.omr_meta_jsonb.studentName || '',
                dob: dbData.omr_meta_jsonb.studentDob || ''
            };
        }

        // 1. Grade the answers
        const results = grade(answers);
        
        // 2. Build LaTeX payload
        const placeholders = buildReportPayload(dbStudentInfo || { name: "", dob: "" }, results);
        
        // 3. Call Worker to Render
        const upload_path = `tenant_1/result_${result_id}_${Date.now()}.pdf`; // Hardcoded tenant for MVP
        
        const res = await fetch(`${WORKER_URL}/render`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WORKER_SECRET}`
            },
            body: JSON.stringify({ placeholders, upload_path })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Worker Render Error:", errText);
            return NextResponse.json({ error: 'Worker Render failed' }, { status: 500 });
        }

        const data = await res.json();
        
        // Return the PDF URL
        return NextResponse.json({
            pdf_url: data.pdf_url
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
