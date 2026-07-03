import { supabase } from './src/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260703_add_equipment_mutations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running migration: 20260703_add_equipment_mutations.sql');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Migration failed:', error);
    } else {
        console.log('Migration successful!');
    }
}

runMigration();
