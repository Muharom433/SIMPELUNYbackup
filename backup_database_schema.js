/**
 * EMERGENCY DATABASE SCHEMA BACKUP SCRIPT
 * 
 * This script connects to your Supabase database and dumps:
 * - All table structures
 * - All triggers
 * - All foreign keys
 * - All indexes
 * - All RLS policies
 * - All views and functions
 * 
 * Usage: node backup_database_schema.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nfoarhurrdelgkrxnwnn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mb2FyaHVycmRlbGdrcnhud25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMzg0NzMsImV4cCI6MjA2NTYxNDQ3M30.7qXZVJuRggQJ6FE5xiP48Kbe8qMYzOKVGqcXIgI1ZMU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OUTPUT_DIR = './database_backup';
const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runQuery(name, query) {
    console.log(`\n📊 Fetching ${name}...`);
    try {
        const { data, error } = await supabase.rpc('exec_sql', { query });

        if (error) {
            console.error(`❌ Error fetching ${name}:`, error.message);
            return null;
        }

        const filename = path.join(OUTPUT_DIR, `${timestamp}_${name.replace(/\s+/g, '_')}.json`);
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${name} to ${filename}`);
        return data;
    } catch (err) {
        console.error(`❌ Exception in ${name}:`, err.message);
        return null;
    }
}

async function dumpSchema() {
    console.log('🚀 Starting database schema backup...');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

    const queries = {
        'tables': `
            SELECT 
                schemaname,
                tablename,
                tableowner
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        `,
        'columns': `
            SELECT
                table_name,
                column_name,
                data_type,
                character_maximum_length,
                column_default,
                is_nullable,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `,
        'triggers': `
            SELECT 
                trigger_name,
                event_manipulation,
                event_object_table,
                action_statement,
                action_timing
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name;
        `,
        'foreign_keys': `
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule,
                rc.update_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            LEFT JOIN information_schema.referential_constraints AS rc
                ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
            ORDER BY tc.table_name, kcu.column_name;
        `,
        'indexes': `
            SELECT
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname;
        `,
        'views': `
            SELECT
                table_name as view_name,
                view_definition
            FROM information_schema.views
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `,
        'functions': `
            SELECT
                routine_name,
                routine_type,
                routine_definition
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            ORDER BY routine_name;
        `,
        'rls_policies': `
            SELECT
                schemaname,
                tablename,
                policyname,
                permissive,
                roles,
                cmd,
                qual,
                with_check
            FROM pg_policies
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname;
        `,
        'constraints': `
            SELECT
                tc.table_name,
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_type;
        `
    };

    const results = {};

    for (const [name, query] of Object.entries(queries)) {
        results[name] = await runQuery(name, query);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    }

    // Save comprehensive summary
    const summaryFile = path.join(OUTPUT_DIR, `${timestamp}_SUMMARY.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Complete backup saved to ${summaryFile}`);

    console.log('\n📋 Backup Summary:');
    console.log(`   Tables: ${results.tables?.length || 0}`);
    console.log(`   Triggers: ${results.triggers?.length || 0}`);
    console.log(`   Foreign Keys: ${results.foreign_keys?.length || 0}`);
    console.log(`   Indexes: ${results.indexes?.length || 0}`);
    console.log(`   Views: ${results.views?.length || 0}`);
    console.log(`   Functions: ${results.functions?.length || 0}`);
    console.log(`   RLS Policies: ${results.rls_policies?.length || 0}`);

    console.log('\n🎉 Backup completed successfully!');
}

// Alternative: Direct table content backup for critical tables
async function backupTableData(tableName) {
    console.log(`\n💾 Backing up data from table: ${tableName}...`);
    try {
        const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact' });

        if (error) {
            console.error(`❌ Error backing up ${tableName}:`, error.message);
            return;
        }

        const filename = path.join(OUTPUT_DIR, `${timestamp}_DATA_${tableName}.json`);
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${count} rows from ${tableName} to ${filename}`);
    } catch (err) {
        console.error(`❌ Exception backing up ${tableName}:`, err.message);
    }
}

// Main execution
(async () => {
    await dumpSchema();

    // Backup critical tables data (optional)
    console.log('\n\n📦 Backing up critical table data...');
    const criticalTables = [
        'users',
        'lecture_schedules',
        'lecturer_attendance',
        'lecturer_attendance_details',
        'rooms',
        'study_programs',
        'departments'
    ];

    for (const table of criticalTables) {
        await backupTableData(table);
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n\n🎊 ALL BACKUPS COMPLETED!');
    console.log(`📁 Check the ${OUTPUT_DIR} directory for all backup files.`);
})();
