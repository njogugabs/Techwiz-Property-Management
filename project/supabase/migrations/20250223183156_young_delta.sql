-- Create payments table
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

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;

-- Create policies
CREATE POLICY "Users can view their own payments"
  ON payments
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own payments"
  ON payments
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Function to update invoice status based on payments
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_invoice_status_trigger ON payments;

-- Create trigger for payment status updates
CREATE TRIGGER update_invoice_status_trigger
  AFTER INSERT OR UPDATE OF amount, status
  ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- Add new status options to invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'));