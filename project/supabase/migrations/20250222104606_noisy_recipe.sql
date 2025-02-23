/*
  # Update utilities and deposits status

  1. Changes
    - Add 'invoiced' status to utilities and deposits tables
    - Update existing status check constraints
*/

-- Update utilities status check
ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_status_check;
ALTER TABLE utilities ADD CONSTRAINT utilities_status_check 
  CHECK (status IN ('pending', 'saved', 'invoiced'));

-- Update deposits status check
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
  CHECK (status IN ('pending', 'saved', 'invoiced'));