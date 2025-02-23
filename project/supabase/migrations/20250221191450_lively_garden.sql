/*
  # Update utilities table schema

  1. Changes
    - Add unique constraint to prevent duplicates
    - Update check constraints for metered vs non-metered utilities
    - Add status tracking for utilities

  2. Notes
    - Handles existing data safely
    - Maintains data integrity for different utility types
*/

-- First, clean up any existing duplicate records
WITH duplicates AS (
  SELECT DISTINCT ON (unit_id, month, year, item) 
    id,
    unit_id,
    month,
    year,
    item,
    created_at
  FROM utilities
  ORDER BY unit_id, month, year, item, created_at DESC
),
to_delete AS (
  SELECT u.id
  FROM utilities u
  LEFT JOIN duplicates d ON u.id = d.id
  WHERE d.id IS NULL
)
DELETE FROM utilities
WHERE id IN (SELECT id FROM to_delete);

-- Add unique constraint to prevent duplicates
ALTER TABLE utilities 
  DROP CONSTRAINT IF EXISTS utilities_unit_month_year_item_key;

ALTER TABLE utilities 
  ADD CONSTRAINT utilities_unit_month_year_item_key 
  UNIQUE (unit_id, month, year, item);

-- Update check constraint for readings
ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_readings_check;

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