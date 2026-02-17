/**
 * SUPABASE TABLE BACKUP SCRIPT
 * Downloads all accessible table data
 * Run: node dump_supabase_data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://nfoarhurrdelgkrxnwnn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mb2FyaHVycmRlbGdrcnhud25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMzg0NzMsImV4cCI6MjA2NTYxNDQ3M30.7qXZVJuRggQJ6FE5xiP48Kbe8qMYzOKVGqcXIgI1ZMU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const timestamp = new Date().toISOString().split('T')[0];
const outputDir = `./supabase_backup_${timestamp}`;

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const TABLES = [
    'users', 'lecture_schedules', 'lecturer_attendance', 'lecturer_attendance_details',
    'rooms', 'study_programs', 'departments', 'attendance_payment_rates',
    'attendance_special_dates', 'attendance_week_settings', 'attendance_global_settings',
    'final_sessions', 'reschedule', 'equipment', 'equipment_details',
    'equipment_quantity_logs', 'bookings', 'checkout_items', 'checkouts',
    'borrowings', 'exam_bookings', 'buildings', 'campus_locations'
];

async function backupTable(tableName) {
    console.log(`\n📊 Backing up: ${tableName}`);

    try {
        const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact' });

        if (error) {
            console.error(`   ❌ Error: ${error.message}`);
            return { table: tableName, success: false, error: error.message };
        }

        const filename = `${outputDir}/${tableName}.json`;
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));

        console.log(`   ✅ Saved ${count} rows`);

        return {
            table: tableName,
            success: true,
            rowCount: count || 0,
            filename
        };
    } catch (err) {
        console.error(`   ❌ Exception: ${ERR.message}`);
        return { table: tableName, success: false, error: err.message };
    }
}

async function main() {
    console.log('🚀 Starting Supabase backup...');
    console.log(`📁 Output: ${outputDir}`);

    const results = [];

    for (const table of TABLES) {
        const result = await backupTable(table);
        results.push(result);
        await new Promise(r => setTimeout(r, 300));
    }

    const summary = {
        timestamp: new Date().toISOString(),
        database: SUPABASE_URL,
        tables: results
    };

    fs.writeFileSync(`${outputDir}/SUMMARY.json`, JSON.stringify(summary, null, 2));

    console.log('\n\n📋 BACKUP SUMMARY');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total rows: ${successful.reduce((sum, r) => sum + (r.rowCount || 0), 0)}`);

    if (failed.length > 0) {
        console.log('\n⚠️  Failed tables:');
        failed.forEach(f => console.log(`   - ${f.table}: ${f.error}`));
    }

    console.log(`\n✨ Backup completed! Check ${outputDir}/`);
}

main().catch(console.error);
