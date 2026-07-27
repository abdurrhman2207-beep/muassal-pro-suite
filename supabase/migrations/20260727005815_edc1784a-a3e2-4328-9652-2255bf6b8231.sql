CREATE OR REPLACE FUNCTION public.calculate_business_health()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_rev_30 NUMERIC := 0; v_rev_prev_30 NUMERIC := 0; v_profit_30 NUMERIC := 0;
  v_low_stock INT := 0; v_total_products INT := 0; v_customers_active INT := 0;
  v_customers_total INT := 0; v_growth NUMERIC := 0; v_margin NUMERIC := 0;
  v_inventory NUMERIC := 0; v_retention NUMERIC := 0; v_employees NUMERIC := 70;
  v_branches NUMERIC := 70; v_score NUMERIC := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(SUM(total),0) INTO v_rev_30 FROM public.sales WHERE created_at >= now() - INTERVAL '30 days';
  SELECT COALESCE(SUM(total),0) INTO v_rev_prev_30 FROM public.sales WHERE created_at >= now() - INTERVAL '60 days' AND created_at < now() - INTERVAL '30 days';
  SELECT COALESCE(SUM((unit_price-unit_cost)*quantity),0) INTO v_profit_30 FROM public.sale_items WHERE created_at >= now() - INTERVAL '30 days';
  SELECT COUNT(*) INTO v_total_products FROM public.products;
  SELECT COUNT(*) INTO v_low_stock FROM public.products WHERE quantity <= low_stock_threshold;
  SELECT COUNT(*) INTO v_customers_total FROM public.customers;
  SELECT COUNT(DISTINCT customer_id) INTO v_customers_active FROM public.sales WHERE created_at >= now() - INTERVAL '60 days' AND customer_id IS NOT NULL;
  IF v_rev_prev_30 > 0 THEN
    v_growth := LEAST(100, GREATEST(0, 50 + ((v_rev_30 - v_rev_prev_30) / v_rev_prev_30) * 100));
  ELSE
    v_growth := CASE WHEN v_rev_30 > 0 THEN 75 ELSE 50 END;
  END IF;
  IF v_rev_30 > 0 THEN v_margin := LEAST(100, (v_profit_30 / v_rev_30) * 200); END IF;
  IF v_total_products > 0 THEN v_inventory := LEAST(100, 100 - (v_low_stock::NUMERIC / v_total_products * 100)); ELSE v_inventory := 50; END IF;
  IF v_customers_total > 0 THEN v_retention := LEAST(100, v_customers_active::NUMERIC / v_customers_total * 100); ELSE v_retention := 50; END IF;
  v_score := ROUND((v_growth*0.25 + v_margin*0.25 + v_inventory*0.2 + v_retention*0.15 + v_employees*0.075 + v_branches*0.075)::NUMERIC, 1);
  RETURN jsonb_build_object(
    'score', v_score,
    'breakdown', jsonb_build_object('revenue_growth', ROUND(v_growth,1),'profitability', ROUND(v_margin,1),'inventory_health', ROUND(v_inventory,1),'customer_retention', ROUND(v_retention,1),'employee_performance', v_employees,'branch_performance', v_branches),
    'metrics', jsonb_build_object('revenue_30d', v_rev_30,'revenue_prev_30d', v_rev_prev_30,'profit_30d', v_profit_30,'low_stock_count', v_low_stock,'total_products', v_total_products,'active_customers', v_customers_active,'total_customers', v_customers_total)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.record_health_snapshot()
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_data JSONB; v_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_data := public.calculate_business_health();
  INSERT INTO public.health_score_snapshots (score, breakdown)
  VALUES ((v_data->>'score')::NUMERIC, v_data->'breakdown') RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.intelligence_summary()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'open_clusters', (SELECT COUNT(*) FROM public.alert_clusters WHERE status='open'),
    'critical_clusters', (SELECT COUNT(*) FROM public.alert_clusters WHERE status='open' AND severity='critical'),
    'events_24h', (SELECT COUNT(*) FROM public.activity_events WHERE created_at >= now() - INTERVAL '24 hours'),
    'flagged_24h', (SELECT COUNT(*) FROM public.activity_events WHERE flagged AND created_at >= now() - INTERVAL '24 hours'),
    'avg_risk_24h', (SELECT COALESCE(ROUND(AVG(risk_score),1),0) FROM public.activity_events WHERE created_at >= now() - INTERVAL '24 hours'),
    'top_risky_users', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT p.id, p.full_name, COUNT(e.*) AS events, COALESCE(AVG(e.risk_score),0)::INT AS avg_risk
        FROM public.profiles p
        LEFT JOIN public.activity_events e ON e.user_id = p.id AND e.flagged AND e.created_at >= now() - INTERVAL '7 days'
        GROUP BY p.id, p.full_name HAVING COUNT(e.*) > 0 ORDER BY avg_risk DESC LIMIT 5
      ) x
    )
  ) INTO v;
  RETURN v;
END $function$;

CREATE OR REPLACE FUNCTION public.employee_trust_scores()
 RETURNS TABLE(user_id uuid, full_name text, events integer, flagged integer, avg_risk numeric, trust_score numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name,
    COUNT(e.id)::INT,
    COUNT(e.id) FILTER (WHERE e.flagged)::INT,
    COALESCE(AVG(e.risk_score),0)::NUMERIC,
    GREATEST(0, 100 - COALESCE(AVG(e.risk_score),0) - COUNT(e.id) FILTER (WHERE e.flagged) * 3)::NUMERIC
  FROM public.profiles p
  LEFT JOIN public.activity_events e ON e.user_id = p.id AND e.created_at >= now() - INTERVAL '30 days'
  GROUP BY p.id, p.full_name
  ORDER BY 6 ASC;
END $function$;

CREATE OR REPLACE FUNCTION public.store_risk_score()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_total INT; v_flag INT; v_avg NUMERIC; v_score INT; v_level TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE flagged), COALESCE(AVG(risk_score),0)
    INTO v_total, v_flag, v_avg
  FROM public.activity_events WHERE created_at >= now() - INTERVAL '24 hours';
  v_score := LEAST(100, COALESCE(v_avg,0)::INT + v_flag * 5);
  v_level := CASE WHEN v_score >= 75 THEN 'critical' WHEN v_score >= 50 THEN 'high' WHEN v_score >= 25 THEN 'medium' ELSE 'low' END;
  RETURN jsonb_build_object('score', v_score, 'level', v_level, 'events_24h', v_total, 'flagged_24h', v_flag, 'avg_risk', ROUND(v_avg,1));
END $function$;

CREATE OR REPLACE FUNCTION public.refresh_all_baselines()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r RECORD; n INT := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.refresh_employee_baseline(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.correlate_alerts(_window_minutes integer DEFAULT 60)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r RECORD; v_ids UUID[]; v_risk INT; v_conf INT; v_sev TEXT;
        v_signals JSONB; v_summary TEXT; v_count INT := 0; v_ctx TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR r IN
    SELECT user_id, MIN(created_at) AS win_start, MAX(created_at) AS win_end,
           array_agg(id ORDER BY created_at) AS ids,
           AVG(risk_score)::INT AS avg_risk, MAX(risk_score) AS max_risk, COUNT(*) AS n
    FROM public.activity_events
    WHERE flagged AND created_at >= now() - (_window_minutes || ' minutes')::interval
      AND id NOT IN (SELECT unnest(event_ids) FROM public.alert_clusters WHERE created_at >= now() - INTERVAL '1 day')
    GROUP BY user_id HAVING COUNT(*) >= 1
  LOOP
    v_ids := r.ids;
    SELECT jsonb_agg(jsonb_build_object('event_type',event_type,'amount',amount,'risk',risk_score,'reason',reason))
      INTO v_signals FROM public.activity_events WHERE id = ANY(v_ids);
    v_risk := LEAST(100, ((r.avg_risk + r.max_risk) / 2)::INT + LEAST(20, (r.n - 1) * 5));
    v_conf := LEAST(100, 40 + r.n * 12);
    v_sev := CASE WHEN v_risk >= 85 THEN 'critical' WHEN v_risk >= 65 THEN 'high' WHEN v_risk >= 35 THEN 'warning' ELSE 'info' END;
    v_ctx := CASE WHEN v_risk >= 80 THEN 'highly_suspicious' WHEN v_risk >= 50 THEN 'suspicious' ELSE 'normal' END;
    v_summary := 'مجموعة من ' || r.n::TEXT || ' أحداث، أعلى مخاطر: ' || r.max_risk::TEXT;
    INSERT INTO public.alert_clusters(user_id, title, summary, risk_score, confidence, severity, signals, event_ids, recommended_action, context_tag, window_start, window_end)
    VALUES (r.user_id, 'مجموعة نشاط مشبوه', v_summary, v_risk, v_conf, v_sev, v_signals, v_ids,
            CASE v_sev WHEN 'critical' THEN 'قفل حساب وطلب موافقة فورية' WHEN 'high' THEN 'إخطار المالك ومراجعة عاجلة' WHEN 'warning' THEN 'مراجعة وتحقق' ELSE 'متابعة' END,
            v_ctx, r.win_start, r.win_end);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.log_activity(_type text, _entity_type text, _entity_id uuid, _amount numeric, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id UUID; v_score INT := 0; v_level TEXT := 'low'; v_flag BOOLEAN := false; v_reason TEXT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _type = 'discount' AND _amount IS NOT NULL AND _amount >= 20 THEN v_score := 70; v_level := 'high'; v_flag := true; v_reason := 'خصم مرتفع'; END IF;
  IF _type = 'refund' AND _amount IS NOT NULL AND _amount >= 50000 THEN v_score := 75; v_level := 'high'; v_flag := true; v_reason := 'استرجاع كبير'; END IF;
  IF _type = 'cancel' THEN v_score := 50; v_level := 'medium'; END IF;
  IF _type = 'price_change' THEN v_score := 40; v_level := 'medium'; END IF;
  IF _type = 'stock_adjust' AND _amount IS NOT NULL AND ABS(_amount) >= 20 THEN v_score := 65; v_level := 'high'; v_flag := true; v_reason := 'تعديل مخزون كبير'; END IF;
  INSERT INTO public.activity_events(user_id, event_type, entity_type, entity_id, amount, metadata, risk_score, risk_level, flagged, reason)
  VALUES (auth.uid(), _type, _entity_type, _entity_id, _amount, COALESCE(_metadata,'{}'::jsonb), v_score, v_level, v_flag, v_reason)
  RETURNING id INTO v_id;
  IF v_flag THEN
    INSERT INTO public.security_alerts(kind, severity, title, message, user_id, related_event_id, metadata)
    VALUES (_type, v_level, COALESCE(v_reason,'تنبيه نشاط'), 'نشاط غير اعتيادي: ' || _type || COALESCE(' بقيمة ' || _amount::TEXT, ''), auth.uid(), v_id, COALESCE(_metadata,'{}'::jsonb));
  END IF;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.record_customer_payment(_customer_id uuid, _sale_id uuid, _amount numeric, _method text DEFAULT 'cash'::text, _notes text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id UUID; v_due NUMERIC; v_apply NUMERIC;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
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

CREATE OR REPLACE FUNCTION public.create_sale(_customer_id uuid, _discount numeric, _tax numeric, _payment payment_method, _items jsonb, _paid_amount numeric DEFAULT NULL::numeric, _currency text DEFAULT 'YER'::text, _exchange_rate numeric DEFAULT 1)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID; v_invoice TEXT; v_subtotal NUMERIC := 0; v_total NUMERIC;
  v_paid NUMERIC; v_due NUMERIC; v_status sale_status; v_item JSONB; v_prefix TEXT;
  v_qty NUMERIC; v_price NUMERIC; v_cost NUMERIC; v_pid UUID; v_stock NUMERIC;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
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
  IF _customer_id IS NULL AND v_due > 0 THEN RAISE EXCEPTION 'لا يمكن البيع بالآجل بدون عميل'; END IF;
  v_status := CASE WHEN v_due <= 0 THEN 'paid'::sale_status WHEN v_paid > 0 THEN 'partial'::sale_status ELSE 'credit'::sale_status END;
  INSERT INTO public.sales (invoice_number, customer_id, subtotal, discount, tax, total, payment_method, cashier_id, paid_amount, due_amount, status, currency, exchange_rate)
  VALUES (v_invoice, _customer_id, v_subtotal, COALESCE(_discount,0), COALESCE(_tax,0), v_total, _payment, auth.uid(), v_paid, v_due, v_status, COALESCE(_currency,'YER'), COALESCE(_exchange_rate,1))
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