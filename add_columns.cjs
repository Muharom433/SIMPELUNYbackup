const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nfoarhurrdelgkrxnwnn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mb2FyaHVycmRlbGdrcnhud25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMzg0NzMsImV4cCI6MjA2NTYxNDQ3M30.7qXZVJuRggQJ6FE5xiP48Kbe8qMYzOKVGqcXIgI1ZMU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sql = `
    ALTER TABLE final_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    ALTER TABLE final_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
  `;

  console.log('Executing migration...');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Migration failed via exec_sql RPC:', error);
  } else {
    console.log('Migration successful!', data);
  }
}

run().catch(err => {
  console.error('Execution error:', err);
});
