-- Helper: staff check
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- currencies
DROP POLICY IF EXISTS "currencies readable by all" ON public.currencies;
CREATE POLICY "currencies_read_staff" ON public.currencies FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
REVOKE SELECT ON public.currencies FROM anon;

-- white_label_settings
DROP POLICY IF EXISTS "wl_read_all" ON public.white_label_settings;
CREATE POLICY "wl_read_auth" ON public.white_label_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
REVOKE SELECT ON public.white_label_settings FROM anon;

-- customers
DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read_staff" ON public.customers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "customers_write_auth" ON public.customers;
CREATE POLICY "customers_write_staff" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- products
DROP POLICY IF EXISTS "products_read" ON public.products;
CREATE POLICY "products_read_staff" ON public.products FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "profiles_read_all_auth" ON public.profiles;
CREATE POLICY "profiles_read_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- suppliers
DROP POLICY IF EXISTS "suppliers_read" ON public.suppliers;
CREATE POLICY "suppliers_read_admin" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- stock_adjustments
DROP POLICY IF EXISTS "auth read adjustments" ON public.stock_adjustments;
CREATE POLICY "adjustments_read_admin" ON public.stock_adjustments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- sales
DROP POLICY IF EXISTS "sales_read_auth" ON public.sales;
CREATE POLICY "sales_read_own_or_admin" ON public.sales FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

-- sale_items
DROP POLICY IF EXISTS "si_read_auth" ON public.sale_items;
CREATE POLICY "si_read_own_or_admin" ON public.sale_items FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.cashier_id = auth.uid()));
DROP POLICY IF EXISTS "si_insert_auth" ON public.sale_items;
CREATE POLICY "si_insert_own_sale" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.cashier_id = auth.uid()));

-- customer_payments
DROP POLICY IF EXISTS "authed read payments" ON public.customer_payments;
CREATE POLICY "payments_read_own_or_admin" ON public.customer_payments FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "authed write payments" ON public.customer_payments;
CREATE POLICY "payments_insert_staff" ON public.customer_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

-- purchases: replace broad ALL policy with explicit per-command admin policies
DROP POLICY IF EXISTS "purchases_admin_all" ON public.purchases;
CREATE POLICY "purchases_select_admin" ON public.purchases FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "purchases_insert_admin" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "purchases_update_admin" ON public.purchases FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "purchases_delete_admin" ON public.purchases FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "pi_admin_all" ON public.purchase_items;
CREATE POLICY "pi_select_admin" ON public.purchase_items FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "pi_insert_admin" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pi_update_admin" ON public.purchase_items FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pi_delete_admin" ON public.purchase_items FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- chat channels / messages
DROP POLICY IF EXISTS "channels_read" ON public.chat_channels;
CREATE POLICY "channels_read_scoped" ON public.chat_channels FOR SELECT TO authenticated
  USING ((is_private = false AND public.is_staff(auth.uid())) OR created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "messages_read" ON public.chat_messages;
CREATE POLICY "messages_read_scoped" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = chat_messages.channel_id
      AND ((c.is_private = false AND public.is_staff(auth.uid())) OR c.created_by = auth.uid() OR public.is_admin(auth.uid()))));

-- task_comments
DROP POLICY IF EXISTS "task_comments_read" ON public.task_comments;
CREATE POLICY "task_comments_read_scoped" ON public.task_comments FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id
      AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())));

-- SECURITY DEFINER function execution hardening
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- re-grant only the functions the app legitimately invokes as a signed-in user
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, numeric, numeric, payment_method, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, numeric, numeric, payment_method, jsonb, numeric, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(uuid, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_business_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_health_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.intelligence_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.correlate_alerts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_baselines() TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_trust_scores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_risk_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;