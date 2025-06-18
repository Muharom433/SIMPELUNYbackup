/*
  # Fix checkout violations RLS policy for insertions

  1. Security Policy Updates
    - Add INSERT policy for checkout_violations table
    - Allow authenticated users with admin roles to insert violations
    - Allow users to insert violations for their own checkouts

  This migration resolves the RLS policy violation error when trying to add new checkout violations.
*/

-- Add policy to allow admins to insert violations
CREATE POLICY "Admins can insert violations"
  ON checkout_violations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = ANY (ARRAY['super_admin'::text, 'department_admin'::text])
    )
  );

-- Add policy to allow users to insert violations for their own checkouts
CREATE POLICY "Users can insert violations for own checkouts"
  ON checkout_violations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );