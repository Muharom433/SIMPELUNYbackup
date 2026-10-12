const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sql = `
    ALTER TABLE public.final_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    ALTER TABLE public.final_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
    CREATE INDEX IF NOT EXISTS idx_final_sessions_deleted_at ON public.final_sessions(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_final_sessions_status ON public.final_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_final_sessions_date ON public.final_sessions(date);
  `;

  console.log('Executing migration on', supabaseUrl, '...');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Migration failed via exec_sql RPC:', error);
  } else {
    console.log('Migration successful!');
  }
}

run().catch(err => {
  console.error('Execution error:', err);
});
