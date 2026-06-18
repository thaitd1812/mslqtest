import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { grade } from '@/lib/mslq/score';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vocjtovsupecsfpzqzvk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

export async function POST(req: Request) {
    try {
        const { result_id, answers } = await req.json();

        if (!result_id || !answers || answers.length !== 44) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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
