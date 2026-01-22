
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import Papa from 'papaparse';

// Load environment variables manually since we might not have dotenv configured for this script context
// Using values found in your files
const SUPABASE_URL = 'https://nfoarhurrdelgkrxnwnn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mb2FyaHVycmRlbGdrcnhud25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMzg0NzMsImV4cCI6MjA2NTYxNDQ3M30.7qXZVJuRggQJ6FE5xiP48Kbe8qMYzOKVGqcXIgI1ZMU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = `./supabase_csv_export_${timestamp}`;

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// List of tables to export
const TABLES = [
    'users', 'lecture_schedules', 'lecturer_attendance', 'lecturer_attendance_details',
    'rooms', 'study_programs', 'departments', 'attendance_payment_rates',
    'attendance_special_dates', 'attendance_week_settings', 'attendance_global_settings',
    'final_sessions', 'reschedule', 'equipment', 'equipment_details',
    'equipment_quantity_logs', 'bookings', 'checkout_items', 'checkouts',
    'borrowings', 'exam_bookings', 'buildings', 'campus_locations',
    'system_settings' // Added system_settings as I saw it earlier
];

async function exportTableToCSV(tableName) {
    console.log(`Processing ${tableName}...`);
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*');

        if (error) {
            console.error(`Error fetching ${tableName}:`, error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.log(`No data in ${tableName}, creating empty file.`);
            fs.writeFileSync(`${outputDir}/${tableName}.csv`, '');
            return;
        }

        const csv = Papa.unparse(data);
        fs.writeFileSync(`${outputDir}/${tableName}.csv`, csv);
        console.log(`Saved ${tableName}.csv (${data.length} rows)`);

    } catch (err) {
        console.error(`Exception export ${tableName}:`, err);
    }
}

async function main() {
    console.log(`Starting CSV Export to ${outputDir}...`);

    for (const table of TABLES) {
        await exportTableToCSV(table);
    }

    console.log('Export completed.');
}

main();
