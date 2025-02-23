-- Create payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  property_id uuid REFERENCES properties ON DELETE CASCADE,
  unit_id uuid REFERENCES units ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('full', 'partial')),
  payment_mode text NOT NULL CHECK (payment_mode IN ('mpesa', 'cash', 'bank', 'cheque')),
  description text,
  transaction_id text,
  file_url text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'payments' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop and recreate policies to ensure they're up to date
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
  DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;

  CREATE POLICY "Users can view their own payments"
    ON payments
    FOR SELECT
    USING (owner_id = auth.uid());

  CREATE POLICY "Users can insert their own payments"
    ON payments
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());
END $$;

-- Update or create function for invoice status updates
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total numeric;
  total_paid numeric;
BEGIN
  -- Only proceed if payment is associated with an invoice
  IF NEW.invoice_id IS NOT NULL THEN
    -- Get invoice total
    SELECT total_amount INTO invoice_total
    FROM invoices
    WHERE id = NEW.invoice_id;

    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments
    WHERE invoice_id = NEW.invoice_id
    AND status = 'confirmed';

    -- Update invoice status based on payment amount
    IF total_paid >= invoice_total THEN
      UPDATE invoices
      SET status = 'paid'
      WHERE id = NEW.invoice_id;
    ELSIF total_paid > 0 THEN
      UPDATE invoices
      SET status = 'partially_paid'
      WHERE id = NEW.invoice_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_invoice_status_trigger ON payments;

CREATE TRIGGER update_invoice_status_trigger
  AFTER INSERT OR UPDATE OF amount, status
  ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- Update invoice status check constraint
DO $$ 
BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_status_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
      CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'));
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_property_id ON payments(property_id);
CREATE INDEX IF NOT EXISTS idx_payments_unit_id ON payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);