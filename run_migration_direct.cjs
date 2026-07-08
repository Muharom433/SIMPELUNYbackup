const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env manually
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260707_fix_equipment_mutations_complete.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing migration on:', supabaseUrl);
  console.log('Query length:', sql.length, 'chars');

  // Try using RPC if it exists
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error('Migration failed via exec_sql RPC:', error);
  } else {
    console.log('Migration successful via exec_sql RPC! Data:', data);
  }
}

run().catch(err => {
  console.error('Execution error:', err);
});
