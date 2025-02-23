/*
  # Add tax management functionality

  1. New Tables
    - `taxes`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `name` (text)
      - `percentage` (numeric)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `taxes` table
    - Add policies for authenticated users to manage their taxes
*/

-- Create taxes table
CREATE TABLE IF NOT EXISTS taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  percentage numeric NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own taxes"
  ON taxes
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own taxes"
  ON taxes
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own taxes"
  ON taxes
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own taxes"
  ON taxes
  FOR DELETE
  USING (owner_id = auth.uid());