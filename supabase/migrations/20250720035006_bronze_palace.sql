/*
  # Equipment Quantity Management Enhancement

  1. Schema Updates
    - Add original_quantity column to equipment table
    - Create equipment_quantity_logs table for audit trail
    
  2. Data Migration
    - Set original_quantity = quantity for existing equipment
    
  3. Security
    - Enable RLS on equipment_quantity_logs
    - Add appropriate policies
*/

-- Add original_quantity column to equipment table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'original_quantity'
  ) THEN
    ALTER TABLE equipment ADD COLUMN original_quantity INTEGER;
  END IF;
END $$;

-- Set original_quantity = quantity for existing data where original_quantity is null
UPDATE equipment 
SET original_quantity = quantity 
WHERE original_quantity IS NULL;

-- Create equipment_quantity_logs table for audit trail
CREATE TABLE IF NOT EXISTS equipment_quantity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  from_quantity INTEGER NOT NULL,
  to_quantity INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('borrow', 'return', 'restore')),
  reference_id VARCHAR(255),
  reference_type VARCHAR(10) CHECK (reference_type IN ('booking', 'lending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_quantity_logs_equipment_id 
ON equipment_quantity_logs(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_quantity_logs_created_at 
ON equipment_quantity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_quantity_logs_reference 
ON equipment_quantity_logs(reference_id, reference_type);

-- Enable RLS on equipment_quantity_logs
ALTER TABLE equipment_quantity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for equipment_quantity_logs
CREATE POLICY "equipment_quantity_logs_select_policy" 
ON equipment_quantity_logs FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "equipment_quantity_logs_insert_policy" 
ON equipment_quantity_logs FOR INSERT 
TO authenticated WITH CHECK (true);

-- Add comment to equipment table about quantity management
COMMENT ON COLUMN equipment.original_quantity IS 'Original quantity when equipment was first added - used as maximum limit for returns';
COMMENT ON COLUMN equipment.quantity IS 'Current available quantity - managed by EquipmentQuantityManager';

-- Add comment to equipment_quantity_logs table
COMMENT ON TABLE equipment_quantity_logs IS 'Audit trail for all equipment quantity changes - tracks borrowing, returns, and restores';