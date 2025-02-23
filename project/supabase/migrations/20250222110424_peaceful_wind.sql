/*
  # Invoice System Improvements

  1. Changes
    - Add status field to invoice_items table
    - Add type field to invoice_items for categorizing items
    - Add reference_id field to link items to their source records
    - Add indexes for better query performance
    - Add constraints to ensure data integrity

  2. Security
    - Maintain existing RLS policies
    - Add check constraints for data validation
*/

-- Add new fields to invoice_items
ALTER TABLE invoice_items 
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD CONSTRAINT invoice_items_type_check 
    CHECK (type IN ('rent', 'utility', 'deposit', 'tax', 'other')),
  ADD CONSTRAINT invoice_items_status_check
    CHECK (status IN ('active', 'void'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON invoice_items(type);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_property_id ON invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_unit_id ON invoices(unit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Add function to update invoice totals
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

-- Create trigger to automatically update invoice totals
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;
CREATE TRIGGER update_invoice_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- Function to void invoice items
CREATE OR REPLACE FUNCTION void_invoice_item(item_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE invoice_items
  SET status = 'void'
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- Function to void entire invoice
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