const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = 'https://vocjtovsupecsfpzqzvk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const resultId = uuidv4();
    const { error: dbError } = await supabase
        .from('mslq_results')
        .insert({
            id: resultId,
            tenant_id: 'tenant_1',
            omr_meta_jsonb: { studentName: 'Test' },
            answers_jsonb: [],
            photo_url: "[]",
            status: 'review'
        });
    console.log("mslq_results insert error:", dbError);
}
test();
