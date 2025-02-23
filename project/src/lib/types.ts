import { Database } from './database.types';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  units: number;
  city: string;
  water_rate: number | null;
  electricity_rate: number | null;
  payment_method: 'paybill' | 'till';
  payment_number: string | null;
  penalty_type: 'fixed' | 'percentage_rent' | 'percentage_balance';
  penalty_amount: number | null;
  auto_penalize: boolean;
  tax_rate: number | null;
  recurring_bills: RecurringBill[];
  management_fee_type: 'fixed' | 'percentage';
  management_fee_amount: number | null;
  street_name: string | null;
  company_name: string | null;
  notes: string | null;
  payment_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  name: string;
  rent_amount: number;
  is_occupied: boolean;
  tax_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitBill {
  id: string;
  unit_id: string;
  item: string;
  month: number;
  year: number;
  rate: number;
  previous_reading: number | null;
  current_reading: number | null;
  consumption: number;
  amount: number;
  created_at: string;
}

export interface Tenant {
  id: string;
  owner_id: string;
  property_id: string;
  unit_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  deposit_amount: number | null;
  deposit_type: string | null;
  amount_paid: number | null;
  amount_returned: number | null;
  account_number: string | null;
  national_id: string | null;
  email: string | null;
  kra_pin: string | null;
  penalty_type: 'fixed' | 'percentage' | null;
  penalty_amount: number | null;
  notes: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  other_phones: string | null;
  bank_payer_names: string | null;
  lease_start_date: string | null;
  lease_expiry_date: string | null;
  created_at: string;
}

export interface Lease {
  id: string;
  owner_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: 'active' | 'expired' | 'terminated';
  created_at: string;
}

export interface Deposit {
  id: string;
  owner_id: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  type: DepositType;
  amount: number;
  date: string;
  status: 'pending' | 'saved';
  created_at: string;
}

export interface Invoice {
  id: string;
  owner_id: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Utility {
  id: string;
  owner_id: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  item: 'water' | 'electricity' | 'garbage' | 'security' | 'cleaning' | 'service' | 'parking';
  month: number;
  year: number;
  previous_reading: number | null;
  current_reading: number | null;
  consumption: number | null;
  rate: number;
  amount: number;
  status: 'pending' | 'saved';
  created_at: string;
}

export type ProfileUpdate = Partial<Pick<Profile, 'username' | 'full_name' | 'avatar_url'>>;

export const RECURRING_BILLS = [
  'water',
  'electricity',
  'garbage',
  'security',
  'cleaning',
  'service',
  'parking_fee',
  'penalty',
  'VAT'
] as const;

export type RecurringBill = typeof RECURRING_BILLS[number];

export const DEPOSIT_TYPES = [
  'rent',
  'water',
  'electricity',
  'security',
  'garbage'
] as const;

export type DepositType = typeof DEPOSIT_TYPES[number];