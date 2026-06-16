
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'transfer');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE POLICY "user_roles_read_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Auto create profile + first user = admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ STORE SETTINGS ============
CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Muassal Pro',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
  currency TEXT NOT NULL DEFAULT 'SAR',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  purchase_prefix TEXT NOT NULL DEFAULT 'PO',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.store_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.store_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.store_settings (store_name) VALUES ('متجر المعسل برو');

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_cat_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES public.categories ON DELETE SET NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(12,2) NOT NULL DEFAULT 5,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_write" ON public.products FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_admin_write" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_supp_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_write_auth" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update_admin" ON public.customers FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "customers_delete_admin" ON public.customers FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_cust_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PURCHASES ============
CREATE SEQUENCE public.purchase_seq START 1000;
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_admin_all" ON public.purchases FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products,
  quantity NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_admin_all" ON public.purchase_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Auto increase stock on purchase item insert
CREATE OR REPLACE FUNCTION public.apply_purchase_stock() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET quantity = quantity + NEW.quantity WHERE id = NEW.product_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pi_stock AFTER INSERT ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_stock();

-- ============ SALES ============
CREATE SEQUENCE public.sale_seq START 10000;
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  cashier_id UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_read_auth" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_insert_auth" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = cashier_id);
CREATE POLICY "sales_admin_modify" ON public.sales FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "sales_admin_delete" ON public.sales FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products,
  quantity NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si_read_auth" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "si_insert_auth" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "si_admin_modify" ON public.sale_items FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "si_admin_delete" ON public.sale_items FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Auto decrease stock on sale item insert
CREATE OR REPLACE FUNCTION public.apply_sale_stock() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET quantity = quantity - NEW.quantity WHERE id = NEW.product_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_si_stock AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.apply_sale_stock();

-- ============ ATOMIC CREATE SALE RPC ============
CREATE OR REPLACE FUNCTION public.create_sale(
  _customer_id UUID,
  _discount NUMERIC,
  _tax NUMERIC,
  _payment public.payment_method,
  _items JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC;
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

  INSERT INTO public.sales (invoice_number, customer_id, subtotal, discount, tax, total, payment_method, cashier_id)
  VALUES (v_invoice, _customer_id, v_subtotal, COALESCE(_discount,0), COALESCE(_tax,0), v_total, _payment, auth.uid())
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_pid := (v_item->>'product_id')::UUID;
    SELECT purchase_price INTO v_cost FROM public.products WHERE id = v_pid;
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, subtotal)
    VALUES (v_sale_id, v_pid, v_qty, v_price, v_cost, v_qty * v_price);
  END LOOP;

  RETURN v_sale_id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_sale(UUID, NUMERIC, NUMERIC, public.payment_method, JSONB) TO authenticated;

-- ============ ATOMIC CREATE PURCHASE RPC ============
CREATE OR REPLACE FUNCTION public.create_purchase(
  _supplier_id UUID,
  _notes TEXT,
  _items JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_invoice TEXT;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_prefix TEXT;
  v_qty NUMERIC;
  v_cost NUMERIC;
  v_pid UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT purchase_prefix INTO v_prefix FROM public.store_settings LIMIT 1;
  v_invoice := COALESCE(v_prefix,'PO') || '-' || nextval('public.purchase_seq');

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_cost := (v_item->>'unit_cost')::NUMERIC;
    v_total := v_total + (v_qty * v_cost);
  END LOOP;

  INSERT INTO public.purchases (invoice_number, supplier_id, subtotal, total, notes, created_by)
  VALUES (v_invoice, _supplier_id, v_total, v_total, _notes, auth.uid())
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_cost := (v_item->>'unit_cost')::NUMERIC;
    v_pid := (v_item->>'product_id')::UUID;
    INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal)
    VALUES (v_id, v_pid, v_qty, v_cost, v_qty * v_cost);
    -- update product purchase price to latest
    UPDATE public.products SET purchase_price = v_cost WHERE id = v_pid;
  END LOOP;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_purchase(UUID, TEXT, JSONB) TO authenticated;

-- ============ SEED ============
INSERT INTO public.categories (name, description) VALUES
  ('معسل', 'أنواع المعسل والتبغ'),
  ('فحم', 'فحم الشيشة'),
  ('شيشة', 'الشيش والأرجيلة'),
  ('إكسسوارات', 'خراطيم، رؤوس، فويل');

INSERT INTO public.suppliers (name, phone, email) VALUES
  ('مصنع النخلة', '0501234567', 'sales@nakhla.example'),
  ('المورد الذهبي', '0559876543', 'info@golden.example');

INSERT INTO public.customers (name, phone) VALUES
  ('عميل نقدي', '-'),
  ('أحمد محمد', '0551112233');

INSERT INTO public.products (name, barcode, category_id, purchase_price, sale_price, quantity, low_stock_threshold)
SELECT * FROM (VALUES
  ('معسل تفاحتين 250غ', '6001001', (SELECT id FROM public.categories WHERE name='معسل'), 25.00, 45.00, 50, 10),
  ('معسل عنب نعناع 250غ', '6001002', (SELECT id FROM public.categories WHERE name='معسل'), 25.00, 45.00, 30, 10),
  ('معسل ليمون نعناع 1كغ', '6001003', (SELECT id FROM public.categories WHERE name='معسل'), 80.00, 140.00, 15, 5),
  ('فحم طبيعي 1كغ', '6002001', (SELECT id FROM public.categories WHERE name='فحم'), 12.00, 25.00, 100, 20),
  ('فحم سريع الاشتعال', '6002002', (SELECT id FROM public.categories WHERE name='فحم'), 8.00, 18.00, 80, 20),
  ('شيشة خليجي وسط', '6003001', (SELECT id FROM public.categories WHERE name='شيشة'), 180.00, 350.00, 8, 3),
  ('شيشة مصرية صغير', '6003002', (SELECT id FROM public.categories WHERE name='شيشة'), 120.00, 220.00, 12, 3),
  ('خرطوم شيشة سيلكون', '6004001', (SELECT id FROM public.categories WHERE name='إكسسوارات'), 15.00, 35.00, 40, 10),
  ('فويل ألمنيوم', '6004002', (SELECT id FROM public.categories WHERE name='إكسسوارات'), 5.00, 12.00, 200, 30),
  ('رأس شيشة سيراميك', '6004003', (SELECT id FROM public.categories WHERE name='إكسسوارات'), 8.00, 20.00, 60, 15)
) AS v(name, barcode, category_id, purchase_price, sale_price, quantity, low_stock_threshold);
