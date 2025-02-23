/*
  # Update utilities table constraints

  1. Changes
    - Remove the CHECK constraint on the item column to allow all utility types
    - Add new valid utility types: garbage, security, cleaning, service, parking

  2. Security
    - Maintains existing RLS policies
*/

ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_item_check;
ALTER TABLE utilities ADD CONSTRAINT utilities_item_check 
  CHECK (item IN ('water', 'electricity', 'garbage', 'security', 'cleaning', 'service', 'parking'));