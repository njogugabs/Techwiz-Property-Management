/*
  # Update utilities table schema

  1. Changes
    - Make current_reading and consumption nullable
    - Add check constraint to ensure proper data based on utility type
    - Add status column with default 'pending'

  2. Notes
    - Allows non-metered utilities to be stored without readings
    - Maintains data integrity by enforcing readings for water and electricity
    - Ensures proper status tracking for all utilities
*/

-- First, drop any existing constraints that might conflict
ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_readings_check;
ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_current_reading_check;
ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_consumption_check;

-- Make current_reading nullable
ALTER TABLE utilities ALTER COLUMN current_reading DROP NOT NULL;

-- Make consumption nullable
ALTER TABLE utilities ALTER COLUMN consumption DROP NOT NULL;

-- Add check constraint for readings based on utility type
ALTER TABLE utilities ADD CONSTRAINT utilities_readings_check
  CHECK (
    (item IN ('water', 'electricity') AND current_reading IS NOT NULL AND consumption IS NOT NULL)
    OR
    (item NOT IN ('water', 'electricity'))
  );

-- Add status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'utilities' AND column_name = 'status'
  ) THEN
    ALTER TABLE utilities ADD COLUMN status text DEFAULT 'pending';
    ALTER TABLE utilities ADD CONSTRAINT utilities_status_check 
      CHECK (status IN ('pending', 'saved'));
  END IF;
END $$;