/*
  # Create properties and units tables

  1. New Tables
    - `properties`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `name` (text)
      - `units` (integer)
      - `city` (text)
      - `water_rate` (numeric, optional)
      - `electricity_rate` (numeric, optional)
      - `payment_method` (text)
      - `payment_number` (text)
      - `penalty_type` (text)
      - `penalty_amount` (numeric)
      - `auto_penalize` (boolean)
      - `tax_rate` (numeric)
      - `recurring_bills` (text[])
      - `management_fee_type` (text)
      - `management_fee_amount` (numeric)
      - `street_name` (text)
      - `company_name` (text)
      - `notes` (text)
      - `payment_instructions` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `units`
      - `id` (uuid, primary key)
      - `property_id` (uuid, foreign key to properties)
      - `name` (text)
      - `rent_amount` (numeric)
      - `is_occupied` (boolean)
      - `tax_rate` (numeric, optional)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `unit_bills`
      - `id` (uuid, primary key)
      - `unit_id` (uuid, foreign key to units)
      - `item` (text)
      - `month` (integer)
      - `year` (integer)
      - `rate` (numeric)
      - `previous_reading` (numeric, optional)
      - `current_reading` (numeric, optional)
      - `consumption` (numeric)
      - `amount` (numeric)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  units integer NOT NULL,
  city text NOT NULL,
  water_rate numeric,
  electricity_rate numeric,
  payment_method text,
  payment_number text,
  penalty_type text,
  penalty_amount numeric,
  auto_penalize boolean DEFAULT false,
  tax_rate numeric,
  recurring_bills text[],
  management_fee_type text,
  management_fee_amount numeric,
  street_name text,
  company_name text,
  notes text,
  payment_instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  rent_amount numeric NOT NULL,
  is_occupied boolean DEFAULT false,
  tax_rate numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unit_bills table
CREATE TABLE IF NOT EXISTS unit_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
  item text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  rate numeric NOT NULL,
  previous_reading numeric,
  current_reading numeric,
  consumption numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_bills ENABLE ROW LEVEL SECURITY;

-- Create policies for properties
CREATE POLICY "Users can view their own properties"
  ON properties
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own properties"
  ON properties
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own properties"
  ON properties
  FOR UPDATE
  USING (owner_id = auth.uid());

-- Create policies for units
CREATE POLICY "Users can view their own units"
  ON units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = units.property_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own units"
  ON units
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own units"
  ON units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = units.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Create policies for unit_bills
CREATE POLICY "Users can view their own unit bills"
  ON unit_bills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN properties ON units.property_id = properties.id
      WHERE unit_bills.unit_id = units.id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own unit bills"
  ON unit_bills
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM units
      JOIN properties ON units.property_id = properties.id
      WHERE unit_bills.unit_id = units.id
      AND properties.owner_id = auth.uid()
    )
  );

-- Create updated_at trigger for properties
CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Create updated_at trigger for units
CREATE TRIGGER set_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();