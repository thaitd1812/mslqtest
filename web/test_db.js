import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vocjtovsupecsfpzqzvk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvY2p0b3ZzdXBlY3NmcHpxenZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTkxMTMsImV4cCI6MjA5NzA3NTExM30.ZKtQMrF2YDKKMfeTFfbj89rKy9J1TJ2TYNG5_2e9SXI'
);

async function run() {
  const { data, error } = await supabase.from('mslq_results').select('id, tenant_id, status').limit(5);
  console.log("SELECT:", data, error);
}

run();
