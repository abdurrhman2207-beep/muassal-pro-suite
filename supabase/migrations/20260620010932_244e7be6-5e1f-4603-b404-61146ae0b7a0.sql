
-- 1) Default currency to YER and add multi-currency support
ALTER TABLE public.store_settings ALTER COLUMN currency SET DEFAULT 'YER';
UPDATE public.store_settings SET currency = 'YER' WHERE currency = 'SAR';

CREATE TABLE IF NOT EXISTS public.currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  exchange_rate NUMERIC NOT NULL DEFAULT 1, -- value of 1 unit in base currency
  is_base BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currencies TO authenticated, anon;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "currencies readable by all" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "admins manage currencies" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.currencies(code,name,symbol,exchange_rate,is_base) VALUES
  ('YER','الريال اليمني','﷼',1,true),
  ('SAR','الريال السعودي','ر.س',66.5,false),
  ('USD','دولار أمريكي','$',250,false),
  ('AED','درهم إماراتي','د.إ',68,false),
  ('EUR','يورو','€',270,false)
ON CONFLICT (code) DO NOTHING;

-- 2) Customer credit/balance
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 0, -- positive = customer owes us
  ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;

-- 3) Sales: partial payment + currency
DO $$ BEGIN
  CREATE TYPE public.sale_status AS ENUM ('paid','partial','credit','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status public.sale_status NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;

-- 4) Customer payments ledger
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read payments" ON public.customer_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed write payments" ON public.customer_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins update payments" ON public.customer_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete payments" ON public.customer_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 5) New create_sale with paid/due + customer balance update
CREATE OR REPLACE FUNCTION public.create_sale(
  _customer_id uuid,
  _discount numeric,
  _tax numeric,
  _payment payment_method,
  _items jsonb,
  _paid_amount numeric DEFAULT NULL,
  _currency text DEFAULT 'YER',
  _exchange_rate numeric DEFAULT 1
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_due NUMERIC;
  v_status sale_status;
  v_item JSONB;
  v_prefix TEXT;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_cost NUMERIC;
  v_pid UUID;
  v_stock NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT invoice_prefix INTO v_prefix FROM public.store_settings LIMIT 1;
  v_invoice := COALESCE(v_prefix,'INV') || '-' || nextval('public.sale_seq');

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_pid := (v_item->>'product_id')::UUID;
    SELECT quantity, purchase_price INTO v_stock, v_cost FROM public.products WHERE id = v_pid;
    IF v_stock IS NULL THEN RAISE EXCEPTION 'product not found'; END IF;
    IF v_stock < v_qty THEN RAISE EXCEPTION 'insufficient stock for product %', v_pid; END IF;
    v_subtotal := v_subtotal + (v_qty * v_price);
  END LOOP;

  v_total := v_subtotal - COALESCE(_discount,0) + COALESCE(_tax,0);
  v_paid := COALESCE(_paid_amount, v_total);
  IF v_paid > v_total THEN v_paid := v_total; END IF;
  v_due := v_total - v_paid;

  IF _customer_id IS NULL AND v_due > 0 THEN
    RAISE EXCEPTION 'لا يمكن البيع بالآجل بدون عميل';
  END IF;

  v_status := CASE
    WHEN v_due <= 0 THEN 'paid'::sale_status
    WHEN v_paid > 0 THEN 'partial'::sale_status
    ELSE 'credit'::sale_status
  END;

  INSERT INTO public.sales (invoice_number, customer_id, subtotal, discount, tax, total,
                            payment_method, cashier_id, paid_amount, due_amount, status, currency, exchange_rate)
  VALUES (v_invoice, _customer_id, v_subtotal, COALESCE(_discount,0), COALESCE(_tax,0), v_total,
          _payment, auth.uid(), v_paid, v_due, v_status, COALESCE(_currency,'YER'), COALESCE(_exchange_rate,1))
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_pid := (v_item->>'product_id')::UUID;
    SELECT purchase_price INTO v_cost FROM public.products WHERE id = v_pid;
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, subtotal)
    VALUES (v_sale_id, v_pid, v_qty, v_price, v_cost, v_qty * v_price);
  END LOOP;

  IF _customer_id IS NOT NULL AND v_due > 0 THEN
    UPDATE public.customers SET balance = balance + v_due WHERE id = _customent_id; -- typo fix below
  END IF;

  RETURN v_sale_id;
END $function$;

-- Fix typo by re-creating clean
CREATE OR REPLACE FUNCTION public.create_sale(
  _customer_id uuid,
  _discount numeric,
  _tax numeric,
  _payment payment_method,
  _items jsonb,
  _paid_amount numeric DEFAULT NULL,
  _currency text DEFAULT 'YER',
  _exchange_rate numeric DEFAULT 1
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_due NUMERIC;
  v_status sale_status;
  v_item JSONB;
  v_prefix TEXT;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_cost NUMERIC;
  v_pid UUID;
  v_stock NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT invoice_prefix INTO v_prefix FROM public.store_settings LIMIT 1;
  v_invoice := COALESCE(v_prefix,'INV') || '-' || nextval('public.sale_seq');

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_pid := (v_item->>'product_id')::UUID;
    SELECT quantity, purchase_price INTO v_stock, v_cost FROM public.products WHERE id = v_pid;
    IF v_stock IS NULL THEN RAISE EXCEPTION 'product not found'; END IF;
    IF v_stock < v_qty THEN RAISE EXCEPTION 'insufficient stock'; END IF;
    v_subtotal := v_subtotal + (v_qty * v_price);
  END LOOP;

  v_total := v_subtotal - COALESCE(_discount,0) + COALESCE(_tax,0);
  v_paid := COALESCE(_paid_amount, v_total);
  IF v_paid > v_total THEN v_paid := v_total; END IF;
  v_due := v_total - v_paid;

  IF _customer_id IS NULL AND v_due > 0 THEN
    RAISE EXCEPTION 'لا يمكن البيع بالآجل بدون عميل';
  END IF;

  v_status := CASE
    WHEN v_due <= 0 THEN 'paid'::sale_status
    WHEN v_paid > 0 THEN 'partial'::sale_status
    ELSE 'credit'::sale_status
  END;

  INSERT INTO public.sales (invoice_number, customer_id, subtotal, discount, tax, total,
                            payment_method, cashier_id, paid_amount, due_amount, status, currency, exchange_rate)
  VALUES (v_invoice, _customer_id, v_subtotal, COALESCE(_discount,0), COALESCE(_tax,0), v_total,
          _payment, auth.uid(), v_paid, v_due, v_status, COALESCE(_currency,'YER'), COALESCE(_exchange_rate,1))
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_pid := (v_item->>'product_id')::UUID;
    SELECT purchase_price INTO v_cost FROM public.products WHERE id = v_pid;
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, subtotal)
    VALUES (v_sale_id, v_pid, v_qty, v_price, v_cost, v_qty * v_price);
  END LOOP;

  IF _customer_id IS NOT NULL AND v_due > 0 THEN
    UPDATE public.customers SET balance = balance + v_due WHERE id = _customer_id;
  END IF;

  RETURN v_sale_id;
END $function$;

-- 6) Record customer payment + reduce balance + update sale
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  _customer_id uuid,
  _sale_id uuid,
  _amount numeric,
  _method text DEFAULT 'cash',
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_id UUID;
  v_due NUMERIC;
  v_apply NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  INSERT INTO public.customer_payments(customer_id, sale_id, amount, method, notes, created_by)
  VALUES (_customer_id, _sale_id, _amount, COALESCE(_method,'cash'), _notes, auth.uid())
  RETURNING id INTO v_id;

  UPDATE public.customers SET balance = balance - _amount WHERE id = _customer_id;

  IF _sale_id IS NOT NULL THEN
    SELECT due_amount INTO v_due FROM public.sales WHERE id = _sale_id;
    v_apply := LEAST(_amount, COALESCE(v_due,0));
    UPDATE public.sales
      SET paid_amount = paid_amount + v_apply,
          due_amount = GREATEST(0, due_amount - v_apply),
          status = CASE WHEN (due_amount - v_apply) <= 0 THEN 'paid'::sale_status ELSE 'partial'::sale_status END
    WHERE id = _sale_id;
  END IF;

  RETURN v_id;
END $function$;
