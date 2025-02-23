/*
  # Add deposits table

  1. New Tables
    - `deposits`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `property_id` (uuid, references properties)
      - `unit_id` (uuid, references units)
      - `tenant_id` (uuid, references tenants)
      - `type` (text, check constraint for deposit types)
      - `amount` (numeric)
      - `date` (date)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `deposits` table
    - Add policies for authenticated users to manage their own deposits
*/

CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  unit_id uuid REFERENCES units ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('rent', 'water', 'electricity', 'security', 'garbage')),
  amount numeric NOT NULL CHECK (amount >= 0),
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own deposits"
  ON deposits
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own deposits"
  ON deposits
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own deposits"
  ON deposits
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own deposits"
  ON deposits
  FOR DELETE
  USING (owner_id = auth.uid());