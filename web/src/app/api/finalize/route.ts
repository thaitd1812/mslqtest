import { NextResponse } from 'next/server';
import { grade, buildReportPayload } from '@/lib/mslq/score';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev_secret';

export async function POST(req: Request) {
    try {
        const { result_id, answers, studentInfo } = await req.json();
        
        if (!result_id || !answers || answers.length !== 44) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // 1. Grade the answers
        const results = grade(answers);
        
        // 2. Build LaTeX payload
        const placeholders = buildReportPayload(studentInfo || { name: "Nguyễn Văn A", dob: "2012" }, results);
        
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
