/*
  # Add utilities table

  1. New Tables
    - `utilities`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `property_id` (uuid, references properties)
      - `unit_id` (uuid, references units)
      - `item` (text, either 'water' or 'electricity')
      - `month` (integer)
      - `year` (integer)
      - `previous_reading` (numeric)
      - `current_reading` (numeric)
      - `consumption` (numeric)
      - `rate` (numeric)
      - `amount` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `utilities` table
    - Add policies for authenticated users to manage their own utilities
*/

CREATE TABLE IF NOT EXISTS utilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  unit_id uuid REFERENCES units ON DELETE CASCADE,
  item text NOT NULL CHECK (item IN ('water', 'electricity')),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  previous_reading numeric,
  current_reading numeric NOT NULL,
  consumption numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE utilities ENABLE ROW LEVEL SECURITY;

-- Create policies
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