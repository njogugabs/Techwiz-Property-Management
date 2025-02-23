-- Update utilities status check
ALTER TABLE utilities DROP CONSTRAINT IF EXISTS utilities_status_check;
ALTER TABLE utilities ADD CONSTRAINT utilities_status_check 
  CHECK (status IN ('pending', 'saved', 'invoiced'));

-- Update deposits status check
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
  CHECK (status IN ('pending', 'saved', 'invoiced'));

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  next_val integer;
  invoice_number text;
BEGIN
  -- Get next value from sequence
  SELECT nextval('invoice_number_seq') INTO next_val;
  
  -- Format as INV-YYYYMMDD-XXXX
  invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || 
                    lpad(next_val::text, 4, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically generate invoice number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();