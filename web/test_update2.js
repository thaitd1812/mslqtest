import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vocjtovsupecsfpzqzvk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

async function run() {
  const result_id = 'f7d8ac3f-a695-4931-96af-00d6f2029c1e';
  for (const s of ['reading', 'review', 'done', 'completed', 'FINISHED']) {
    const { data, error } = await supabase
        .from('mslq_results')
        .update({ status: s })
        .eq('id', result_id);
    console.log(`UPDATE status='${s}' -> error:`, error?.message);
  }
}

run();
