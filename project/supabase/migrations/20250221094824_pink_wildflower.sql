/*
  # Create tenants and leases tables

  1. New Tables
    - `tenants`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `property_id` (uuid, references properties)
      - `full_name` (text)
      - `email` (text)
      - `phone` (text)
      - `created_at` (timestamptz)

    - `leases`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `property_id` (uuid, references properties)
      - `tenant_id` (uuid, references tenants)
      - `start_date` (date)
      - `end_date` (date)
      - `monthly_rent` (numeric)
      - `status` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create tenants table first
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create policies for tenants
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

-- Create leases table
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for leases
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

-- Create policies for leases
CREATE POLICY "Users can view their own leases"
  ON leases
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own leases"
  ON leases
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own leases"
  ON leases
  FOR UPDATE
  USING (owner_id = auth.uid());