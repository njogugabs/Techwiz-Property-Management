/*
  # Unit Occupancy Status Trigger

  1. Changes
    - Add trigger to automatically update unit occupancy status when:
      - A tenant is added (sets to true)
      - A tenant is removed (sets to false if no other tenants)
      - A tenant's move_out_date is set (sets to false if no other active tenants)

  2. Security
    - No changes to RLS policies required
    - Trigger runs with security definer to ensure it can update units table

  Note: This trigger ensures unit occupancy status is always accurate based on tenant assignments
*/

-- Function to update unit occupancy status
CREATE OR REPLACE FUNCTION update_unit_occupancy()
RETURNS TRIGGER AS $$
DECLARE
  tenant_count INTEGER;
BEGIN
  -- For INSERT or UPDATE operations
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Count active tenants for the unit (excluding those who have moved out)
    SELECT COUNT(*)
    INTO tenant_count
    FROM tenants
    WHERE unit_id = NEW.unit_id
    AND (move_out_date IS NULL OR move_out_date > CURRENT_DATE);

    -- Update unit occupancy status
    UPDATE units
    SET is_occupied = (tenant_count > 0)
    WHERE id = NEW.unit_id;

  -- For DELETE operations
  ELSIF (TG_OP = 'DELETE') THEN
    -- Count remaining active tenants for the unit
    SELECT COUNT(*)
    INTO tenant_count
    FROM tenants
    WHERE unit_id = OLD.unit_id
    AND (move_out_date IS NULL OR move_out_date > CURRENT_DATE);

    -- Update unit occupancy status
    UPDATE units
    SET is_occupied = (tenant_count > 0)
    WHERE id = OLD.unit_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_unit_occupancy_trigger ON tenants;

-- Create trigger for tenant changes
CREATE TRIGGER update_unit_occupancy_trigger
  AFTER INSERT OR UPDATE OF unit_id, move_out_date OR DELETE
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_unit_occupancy();

-- Update all units' occupancy status to ensure consistency
DO $$
BEGIN
  UPDATE units u
  SET is_occupied = (
    SELECT COUNT(*) > 0
    FROM tenants t
    WHERE t.unit_id = u.id
    AND (t.move_out_date IS NULL OR t.move_out_date > CURRENT_DATE)
  );
END $$;