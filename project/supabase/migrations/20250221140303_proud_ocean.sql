/*
  # Add status field to deposits table

  1. Changes
    - Add status field to deposits table to track pending/saved state
    - Add constraint to ensure valid status values
*/

-- Add status field to deposits table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deposits' AND column_name = 'status'
  ) THEN
    ALTER TABLE deposits ADD COLUMN status text DEFAULT 'pending';
    ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
      CHECK (status IN ('pending', 'saved'));
  END IF;
END $$;