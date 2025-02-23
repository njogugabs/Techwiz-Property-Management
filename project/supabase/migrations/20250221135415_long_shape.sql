/*
  # Add status and total amount fields to utilities table

  1. Changes
    - Add status field to utilities table to track saved/final state
    - Add total_amount field to utilities table
    - Add constraints to ensure valid status values
*/

-- Add status field to utilities table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'utilities' AND column_name = 'status'
  ) THEN
    ALTER TABLE utilities ADD COLUMN status text DEFAULT 'pending';
    ALTER TABLE utilities ADD CONSTRAINT utilities_status_check 
      CHECK (status IN ('pending', 'saved'));
  END IF;
END $$;

-- Add total_amount field to utilities table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'utilities' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE utilities ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;
END $$;