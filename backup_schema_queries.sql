-- =====================================================
-- FULL DATABASE SCHEMA DUMP
-- Generated: 2026-01-21
-- Source: nfoarhurrdelgkrxnwnn.supabase.co
-- =====================================================

-- This file should be run against your .env credentials
-- Usage: Connect to Supabase dashboard SQL Editor and run this query

-- =====================================================
-- 1. DUMP ALL TABLES STRUCTURE
-- =====================================================

-- Get all table definitions
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- 2. DUMP ALL TRIGGERS
-- =====================================================

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- 3. DUMP ALL FOREIGN KEYS
-- =====================================================

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
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- 4. DUMP ALL INDEXES
-- =====================================================

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- 5. DUMP ALL VIEWS
-- =====================================================

SELECT
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- =====================================================
-- 6. DUMP ALL FUNCTIONS/STORED PROCEDURES
-- =====================================================

SELECT
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- =====================================================
-- 7. DUMP RLS POLICIES
-- =====================================================

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

-- =====================================================
-- 8. DUMP TABLE COLUMN DETAILS
-- =====================================================

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

-- =====================================================
-- 9. DUMP CONSTRAINTS
-- =====================================================

SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;

-- =====================================================
-- 10. DUMP SEQUENCES
-- =====================================================

SELECT
    sequence_schema,
    sequence_name,
    data_type,
    start_value,
    minimum_value,
    maximum_value,
    increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
