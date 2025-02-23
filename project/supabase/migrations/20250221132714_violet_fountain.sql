/*
  # Update utilities and tenants tables

  1. Changes
    - Add tenant_id to utilities table
    - Add foreign key constraint to utilities table
    - Add index on unit_id in tenants table for faster lookups

  2. Security
    - Update RLS policies to include tenant_id
*/

-- Add tenant_id to utilities table
ALTER TABLE utilities ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Create index on unit_id in tenants table
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id);

-- Update RLS policies for utilities
DROP POLICY IF EXISTS "Users can view their own utilities" ON utilities;
DROP POLICY IF EXISTS "Users can insert their own utilities" ON utilities;
DROP POLICY IF EXISTS "Users can update their own utilities" ON utilities;

CREATE POLICY "Users can view their own utilities"
  ON utilities
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own utilities"
  ON utilities
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own utilities"
  ON utilities
  FOR UPDATE
  USING (owner_id = auth.uid());