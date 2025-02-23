-- Create invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  unit_id uuid REFERENCES units ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  tax_amount numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  due_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoice_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('rent', 'utility', 'deposit', 'tax', 'other')),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  reference_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'invoices' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'invoice_items' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop and recreate policies to ensure they're up to date
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;

  DROP POLICY IF EXISTS "Users can view their own invoice items" ON invoice_items;
  DROP POLICY IF EXISTS "Users can insert their own invoice items" ON invoice_items;
  DROP POLICY IF EXISTS "Users can update their own invoice items" ON invoice_items;
  DROP POLICY IF EXISTS "Users can delete their own invoice items" ON invoice_items;

  -- Create policies for invoices
  CREATE POLICY "Users can view their own invoices"
    ON invoices
    FOR SELECT
    USING (owner_id = auth.uid());

  CREATE POLICY "Users can insert their own invoices"
    ON invoices
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

  CREATE POLICY "Users can update their own invoices"
    ON invoices
    FOR UPDATE
    USING (owner_id = auth.uid());

  CREATE POLICY "Users can delete their own invoices"
    ON invoices
    FOR DELETE
    USING (owner_id = auth.uid());

  -- Create policies for invoice items
  CREATE POLICY "Users can view their own invoice items"
    ON invoice_items
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_items.invoice_id
        AND invoices.owner_id = auth.uid()
      )
    );

  CREATE POLICY "Users can insert their own invoice items"
    ON invoice_items
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_id
        AND invoices.owner_id = auth.uid()
      )
    );

  CREATE POLICY "Users can update their own invoice items"
    ON invoice_items
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_items.invoice_id
        AND invoices.owner_id = auth.uid()
      )
    );

  CREATE POLICY "Users can delete their own invoice items"
    ON invoice_items
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_items.invoice_id
        AND invoices.owner_id = auth.uid()
      )
    );
END $$;

-- Create sequence for invoice numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- Create or replace function to generate invoice numbers
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

-- Create or replace trigger function for invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger for invoice numbers
DROP TRIGGER IF EXISTS set_invoice_number_trigger ON invoices;

CREATE TRIGGER set_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Create or replace function to update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update totals for active items
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE invoices
    SET 
      subtotal = (
        SELECT COALESCE(SUM(amount), 0)
        FROM invoice_items
        WHERE invoice_id = NEW.invoice_id
        AND status = 'active'
      )
    WHERE id = NEW.invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE invoices
    SET 
      subtotal = (
        SELECT COALESCE(SUM(amount), 0)
        FROM invoice_items
        WHERE invoice_id = OLD.invoice_id
        AND status = 'active'
      )
    WHERE id = OLD.invoice_id;
  END IF;
  
  -- Update total_amount based on subtotal and tax_amount
  UPDATE invoices
  SET total_amount = subtotal + tax_amount
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger for invoice totals
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;

CREATE TRIGGER update_invoice_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- Create or replace function to void invoice items
CREATE OR REPLACE FUNCTION void_invoice_item(item_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE invoice_items
  SET status = 'void'
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- Create or replace function to void entire invoice
CREATE OR REPLACE FUNCTION void_invoice(invoice_id uuid)
RETURNS void AS $$
BEGIN
  -- Void all items
  UPDATE invoice_items
  SET status = 'void'
  WHERE invoice_id = $1;
  
  -- Update invoice status
  UPDATE invoices
  SET 
    status = 'cancelled',
    subtotal = 0,
    tax_amount = 0,
    total_amount = 0
  WHERE id = $1;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_property_id ON invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_unit_id ON invoices(unit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON invoice_items(type);
CREATE INDEX IF NOT EXISTS idx_invoice_items_status ON invoice_items(status);