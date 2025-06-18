/*
  # Create Checkout System

  1. New Tables
    - `checkouts` - Equipment checkout records
    - `checkout_items` - Individual items in a checkout
    - `checkout_violations` - Track violations and warnings

  2. Security
    - Enable RLS on all new tables
    - Add policies for different user roles

  3. Indexes
    - Performance indexes for common queries
*/

-- Checkouts table for equipment lending
CREATE TABLE IF NOT EXISTS checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  checkout_date timestamptz DEFAULT now(),
  expected_return_date timestamptz NOT NULL,
  actual_return_date timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost', 'damaged')),
  checkout_notes text,
  return_notes text,
  condition_on_checkout text DEFAULT 'good' CHECK (condition_on_checkout IN ('excellent', 'good', 'fair', 'poor')),
  condition_on_return text CHECK (condition_on_return IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'lost')),
  approved_by uuid REFERENCES users(id),
  returned_to uuid REFERENCES users(id),
  total_items integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Individual items in a checkout
CREATE TABLE IF NOT EXISTS checkout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id uuid REFERENCES checkouts(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id),
  quantity integer DEFAULT 1,
  condition_notes text,
  serial_numbers text[],
  created_at timestamptz DEFAULT now()
);

-- Violations and warnings system
CREATE TABLE IF NOT EXISTS checkout_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id uuid REFERENCES checkouts(id),
  user_id uuid REFERENCES users(id),
  violation_type text NOT NULL CHECK (violation_type IN ('late_return', 'damage', 'loss', 'misuse', 'other')),
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  title text NOT NULL,
  description text NOT NULL,
  penalty_amount decimal(10,2) DEFAULT 0,
  penalty_paid boolean DEFAULT false,
  reported_by uuid REFERENCES users(id),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'disputed', 'waived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_violations ENABLE ROW LEVEL SECURITY;

-- Policies for checkouts
CREATE POLICY "Users can view own checkouts" ON checkouts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all checkouts" ON checkouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'department_admin')
    )
  );

CREATE POLICY "Allow checkout creation" ON checkouts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for checkout_items
CREATE POLICY "Users can view own checkout items" ON checkout_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checkouts
      WHERE checkouts.id = checkout_items.checkout_id
      AND checkouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all checkout items" ON checkout_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'department_admin')
    )
  );

-- Policies for violations
CREATE POLICY "Users can view own violations" ON checkout_violations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage violations" ON checkout_violations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'department_admin')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkouts_user_id ON checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_booking_id ON checkouts(booking_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_status ON checkouts(status);
CREATE INDEX IF NOT EXISTS idx_checkouts_return_date ON checkouts(expected_return_date);

CREATE INDEX IF NOT EXISTS idx_checkout_items_checkout_id ON checkout_items(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_items_equipment_id ON checkout_items(equipment_id);

CREATE INDEX IF NOT EXISTS idx_checkout_violations_user_id ON checkout_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_violations_checkout_id ON checkout_violations(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_violations_status ON checkout_violations(status);

-- Triggers for updated_at
CREATE TRIGGER update_checkouts_updated_at BEFORE UPDATE ON checkouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_checkout_violations_updated_at BEFORE UPDATE ON checkout_violations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update checkout status based on return date
CREATE OR REPLACE FUNCTION update_checkout_status()
RETURNS void AS $$
BEGIN
  UPDATE checkouts
  SET status = 'overdue'
  WHERE status = 'active'
    AND expected_return_date < now()
    AND actual_return_date IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update total_items in checkout
CREATE OR REPLACE FUNCTION update_checkout_total_items()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE checkouts
    SET total_items = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM checkout_items
      WHERE checkout_id = NEW.checkout_id
    )
    WHERE id = NEW.checkout_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE checkouts
    SET total_items = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM checkout_items
      WHERE checkout_id = OLD.checkout_id
    )
    WHERE id = OLD.checkout_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update total_items
CREATE TRIGGER update_checkout_total_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON checkout_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checkout_total_items();