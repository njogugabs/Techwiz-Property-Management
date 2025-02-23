/*
  # Update tenants table schema

  1. Changes
    - Add new columns to tenants table:
      - unit_id (uuid)
      - first_name (text)
      - last_name (text)
      - deposit_amount (numeric)
      - deposit_type (text)
      - amount_paid (numeric)
      - amount_returned (numeric)
      - account_number (text)
      - national_id (text)
      - kra_pin (text)
      - penalty_type (text)
      - penalty_amount (numeric)
      - move_in_date (date)
      - move_out_date (date)
      - other_phones (text)
      - bank_payer_names (text)
      - lease_start_date (date)
      - lease_expiry_date (date)

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing tenants table
DROP TABLE IF EXISTS tenants CASCADE;

-- Recreate tenants table with new schema
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  unit_id uuid REFERENCES units ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text,
  deposit_amount numeric,
  deposit_type text,
  amount_paid numeric,
  amount_returned numeric,
  account_number text,
  national_id text,
  kra_pin text,
  penalty_type text,
  penalty_amount numeric,
  notes text,
  move_in_date date,
  move_out_date date,
  other_phones text,
  bank_payer_names text,
  lease_start_date date,
  lease_expiry_date date,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tenants"
  ON tenants
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own tenants"
  ON tenants
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own tenants"
  ON tenants
  FOR UPDATE
  USING (owner_id = auth.uid());