 -- Migration: Add technician_tasks table for Technician To-Do List System
-- Date: 2025-12-29

-- Create technician_tasks table
CREATE TABLE IF NOT EXISTS technician_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    notes TEXT,
    is_private BOOLEAN DEFAULT true,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    equipment_ids UUID[],
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_technician_tasks_technician ON technician_tasks(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_tasks_status ON technician_tasks(status);
CREATE INDEX IF NOT EXISTS idx_technician_tasks_report ON technician_tasks(report_id);

-- Add equipment_id column to reports table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'equipment_id'
    ) THEN
        ALTER TABLE reports ADD COLUMN equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add room_id column to reports table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'room_id'
    ) THEN
        ALTER TABLE reports ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add equipment_ids array column to reports table for multiple equipment
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'equipment_ids'
    ) THEN
        ALTER TABLE reports ADD COLUMN equipment_ids UUID[];
    END IF;
END $$;

-- Enable RLS
ALTER TABLE technician_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Technicians can see their own tasks
CREATE POLICY "technicians_view_own_tasks" ON technician_tasks
    FOR SELECT USING (
        auth.uid() = technician_id OR
        auth.uid() IN (SELECT id FROM users WHERE role = 'super_admin')
    );

-- Technicians can insert their own tasks
CREATE POLICY "technicians_insert_own_tasks" ON technician_tasks
    FOR INSERT WITH CHECK (
        auth.uid() = technician_id OR
        auth.uid() IN (SELECT id FROM users WHERE role = 'super_admin')
    );

-- Technicians can update their own tasks, super_admin can update any
CREATE POLICY "technicians_update_own_tasks" ON technician_tasks
    FOR UPDATE USING (
        auth.uid() = technician_id OR
        auth.uid() IN (SELECT id FROM users WHERE role = 'super_admin')
    );

-- Technicians can delete their own tasks
CREATE POLICY "technicians_delete_own_tasks" ON technician_tasks
    FOR DELETE USING (
        auth.uid() = technician_id OR
        auth.uid() IN (SELECT id FROM users WHERE role = 'super_admin')
    );

-- Grant permissions
GRANT ALL ON technician_tasks TO authenticated;
