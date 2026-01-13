-- Migration: Create attendance management tables
-- Created: 2026-01-12
-- Purpose: Support enhanced attendance report with special dates, week settings, and payment rates

-- Table 1: Week Settings per Month
-- Finance can configure which weeks are active and the dates for each week
CREATE TABLE IF NOT EXISTS attendance_week_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 5),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, year, week_number)
);

-- Table 2: Special Dates (Holidays, Red Dates)
-- Finance marks specific dates as holidays with reason
CREATE TABLE IF NOT EXISTS attendance_special_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Payment Rates per Lecturer Type
-- HBV (Homebase Vokasi) and NHBV (Non Homebase Vokasi) rates
CREATE TABLE IF NOT EXISTS attendance_payment_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecturer_type VARCHAR(10) NOT NULL CHECK (lecturer_type IN ('HBV', 'NHBV')),
    rate DECIMAL(12, 2) NOT NULL DEFAULT 75000,
    effective_month INTEGER NOT NULL CHECK (effective_month >= 1 AND effective_month <= 12),
    effective_year INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lecturer_type, effective_month, effective_year)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_week_settings_month_year ON attendance_week_settings(month, year);
CREATE INDEX IF NOT EXISTS idx_special_dates_month_year ON attendance_special_dates(month, year);
CREATE INDEX IF NOT EXISTS idx_special_dates_date ON attendance_special_dates(date);
CREATE INDEX IF NOT EXISTS idx_payment_rates_month_year ON attendance_payment_rates(effective_month, effective_year);

-- Enable RLS (Row Level Security)
ALTER TABLE attendance_week_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_special_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_payment_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Finance and Super Admin can manage (full access)
-- Need both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT/UPDATE)
CREATE POLICY "Finance and Super Admin can manage week settings"
    ON attendance_week_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    );

CREATE POLICY "Finance and Super Admin can manage special dates"
    ON attendance_special_dates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    );

CREATE POLICY "Finance and Super Admin can manage payment rates"
    ON attendance_payment_rates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    );

-- Allow all authenticated users to read (for DosenPresensi to check special dates)
CREATE POLICY "Authenticated users can read week settings"
    ON attendance_week_settings
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read special dates"
    ON attendance_special_dates
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read payment rates"
    ON attendance_payment_rates
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
