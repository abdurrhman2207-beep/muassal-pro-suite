
-- =====================================================================
-- ABSENT OWNER MODE — INTELLIGENCE LAYER
-- Hybrid detection (rules + behavior baseline), role-based sensitivity,
-- alert grouping, confidence scoring, self-improving loop.
-- =====================================================================

-- 1) Detection rules (hard rules, configurable)
CREATE TABLE IF NOT EXISTS public.detection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  applies_to_role TEXT NOT NULL DEFAULT 'any', -- any|cashier|manager|admin
  threshold NUMERIC,
  window_minutes INT,
  max_count INT,
  base_risk INT NOT NULL DEFAULT 50,
  severity TEXT NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detection_rules TO authenticated;
GRANT ALL ON public.detection_rules TO service_role;
ALTER TABLE public.detection_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules read auth" ON public.detection_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules manage admin" ON public.detection_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) Role sensitivity thresholds
CREATE TABLE IF NOT EXISTS public.role_sensitivity (
  role TEXT PRIMARY KEY,
  sensitivity NUMERIC NOT NULL DEFAULT 1.0, -- multiplier applied to base risk
  max_discount_pct NUMERIC NOT NULL DEFAULT 10,
  max_refund_per_hour INT NOT NULL DEFAULT 3,
  allow_price_change BOOLEAN NOT NULL DEFAULT false,
  allow_offhours_adjust BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_sensitivity TO authenticated;
GRANT ALL ON public.role_sensitivity TO service_role;
ALTER TABLE public.role_sensitivity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs read auth" ON public.role_sensitivity FOR SELECT TO authenticated USING (true);
CREATE POLICY "rs manage admin" ON public.role_sensitivity FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.role_sensitivity(role, sensitivity, max_discount_pct, max_refund_per_hour, allow_price_change, allow_offhours_adjust)
VALUES
  ('cashier', 1.4, 10, 2, false, false),
  ('manager', 1.0, 25, 5, true, false),
  ('admin', 0.6, 50, 20, true, true)
ON CONFLICT (role) DO NOTHING;

-- 3) Per-employee behavior baseline
CREATE TABLE IF NOT EXISTS public.employee_baselines (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avg_discount_pct NUMERIC NOT NULL DEFAULT 0,
  stddev_discount_pct NUMERIC NOT NULL DEFAULT 0,
  refunds_per_hour NUMERIC NOT NULL DEFAULT 0,
  sales_per_hour NUMERIC NOT NULL DEFAULT 0,
  active_hour_start INT NOT NULL DEFAULT 8,
  active_hour_end INT NOT NULL DEFAULT 22,
  adjustments_per_day NUMERIC NOT NULL DEFAULT 0,
  sample_size INT NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_baselines TO authenticated;
GRANT ALL ON public.employee_baselines TO service_role;
ALTER TABLE public.employee_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "baseline self/admin" ON public.employee_baselines FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "baseline admin write" ON public.employee_baselines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) Alert clusters (event correlation)
CREATE TABLE IF NOT EXISTS public.alert_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  risk_score INT NOT NULL DEFAULT 0,
  confidence INT NOT NULL DEFAULT 0,  -- 0..100
  severity TEXT NOT NULL DEFAULT 'info', -- info|warning|high|critical
  status TEXT NOT NULL DEFAULT 'open',   -- open|reviewed|dismissed|action_taken
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_ids UUID[] NOT NULL DEFAULT '{}',
  recommended_action TEXT,
  context_tag TEXT, -- normal|suspicious|highly_suspicious
  ai_explanation TEXT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_clusters TO authenticated;
GRANT ALL ON public.alert_clusters TO service_role;
ALTER TABLE public.alert_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clusters admin read" ON public.alert_clusters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "clusters admin write" ON public.alert_clusters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5) Seed default rules
INSERT INTO public.detection_rules(code, name, event_type, applies_to_role, threshold, window_minutes, max_count, base_risk, severity, notes) VALUES
('high_discount','خصم مرتفع','discount','any', 20, NULL, NULL, 70, 'high','تجاوز نسبة الخصم المسموحة'),
('refund_burst','تكرار استرجاع','refund','any', NULL, 60, 3, 75, 'high','عدد استرجاعات يتجاوز الحد بالساعة'),
('price_change_unauth','تغيير سعر بدون صلاحية','price_change','cashier', NULL, NULL, NULL, 80, 'high','تغيير سعر من دور غير مصرح'),
('offhours_stock_adjust','تعديل مخزون خارج الدوام','stock_adjust','any', NULL, NULL, NULL, 65, 'medium','تعديل مخزون خارج ساعات العمل'),
('large_stock_adjust','تعديل مخزون كبير','stock_adjust','any', 20, NULL, NULL, 65, 'medium','حجم تعديل كبير'),
('cancel_burst','تكرار إلغاء فواتير','cancel','any', NULL, 60, 4, 60, 'medium','عدد إلغاءات يتجاوز الحد')
ON CONFLICT (code) DO NOTHING;

-- 6) updated_at trigger
DROP TRIGGER IF EXISTS trg_clusters_updated ON public.alert_clusters;
CREATE TRIGGER trg_clusters_updated BEFORE UPDATE ON public.alert_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_rules_updated ON public.detection_rules;
CREATE TRIGGER trg_rules_updated BEFORE UPDATE ON public.detection_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Refresh baseline for a user from last 30 days
CREATE OR REPLACE FUNCTION public.refresh_employee_baseline(_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_avg NUMERIC := 0; v_std NUMERIC := 0;
  v_refund NUMERIC := 0; v_sales NUMERIC := 0; v_adj NUMERIC := 0;
  v_h_start INT := 8; v_h_end INT := 22; v_n INT := 0;
BEGIN
  SELECT COALESCE(AVG(amount),0), COALESCE(STDDEV_POP(amount),0), COUNT(*)
    INTO v_avg, v_std, v_n
  FROM public.activity_events
  WHERE user_id = _uid AND event_type = 'discount'
    AND created_at >= now() - INTERVAL '30 days';

  SELECT COALESCE(COUNT(*)::NUMERIC / 30.0 / 24.0, 0) INTO v_refund
  FROM public.activity_events
  WHERE user_id = _uid AND event_type = 'refund'
    AND created_at >= now() - INTERVAL '30 days';

  SELECT COALESCE(COUNT(*)::NUMERIC / 30.0 / 24.0, 0) INTO v_sales
  FROM public.sales WHERE cashier_id = _uid AND created_at >= now() - INTERVAL '30 days';

  SELECT COALESCE(COUNT(*)::NUMERIC / 30.0, 0) INTO v_adj
  FROM public.activity_events
  WHERE user_id = _uid AND event_type = 'stock_adjust'
    AND created_at >= now() - INTERVAL '30 days';

  SELECT COALESCE(MIN(EXTRACT(HOUR FROM created_at))::INT, 8),
         COALESCE(MAX(EXTRACT(HOUR FROM created_at))::INT, 22)
    INTO v_h_start, v_h_end
  FROM public.activity_events
  WHERE user_id = _uid AND created_at >= now() - INTERVAL '30 days';

  INSERT INTO public.employee_baselines(user_id, avg_discount_pct, stddev_discount_pct, refunds_per_hour, sales_per_hour, active_hour_start, active_hour_end, adjustments_per_day, sample_size, last_computed_at)
  VALUES (_uid, v_avg, v_std, v_refund, v_sales, v_h_start, v_h_end, v_adj, v_n, now())
  ON CONFLICT (user_id) DO UPDATE SET
    avg_discount_pct = EXCLUDED.avg_discount_pct,
    stddev_discount_pct = EXCLUDED.stddev_discount_pct,
    refunds_per_hour = EXCLUDED.refunds_per_hour,
    sales_per_hour = EXCLUDED.sales_per_hour,
    active_hour_start = EXCLUDED.active_hour_start,
    active_hour_end = EXCLUDED.active_hour_end,
    adjustments_per_day = EXCLUDED.adjustments_per_day,
    sample_size = EXCLUDED.sample_size,
    last_computed_at = now();
END $$;

-- Refresh all baselines (for cron / manual)
CREATE OR REPLACE FUNCTION public.refresh_all_baselines()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.refresh_employee_baseline(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- 8) Hybrid evaluation: rules + baseline deviation + role sensitivity
-- Returns risk(0-100), confidence(0-100), severity, reason, recommendation
CREATE OR REPLACE FUNCTION public.evaluate_event_intelligence(_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e RECORD; b RECORD; rs RECORD;
  v_role TEXT := 'cashier';
  v_risk INT := 0; v_conf INT := 30;
  v_signals JSONB := '[]'::jsonb;
  v_reason TEXT := '';
  v_rec TEXT := 'مراجعة';
  v_sev TEXT := 'info';
  v_dev NUMERIC := 0;
  v_hour INT;
  v_recent_count INT;
  v_rule RECORD;
BEGIN
  SELECT * INTO e FROM public.activity_events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- pick highest role
  SELECT CASE WHEN bool_or(role='admin') THEN 'admin'
              WHEN bool_or(role='manager') THEN 'manager'
              ELSE 'cashier' END INTO v_role
  FROM public.user_roles WHERE user_id = e.user_id;
  v_role := COALESCE(v_role,'cashier');

  SELECT * INTO rs FROM public.role_sensitivity WHERE role = v_role;
  IF NOT FOUND THEN
    rs.sensitivity := 1.0; rs.max_discount_pct := 10;
    rs.max_refund_per_hour := 3; rs.allow_price_change := false; rs.allow_offhours_adjust := false;
  END IF;

  SELECT * INTO b FROM public.employee_baselines WHERE user_id = e.user_id;
  v_hour := EXTRACT(HOUR FROM e.created_at)::INT;

  -- A) RULE-BASED
  FOR v_rule IN SELECT * FROM public.detection_rules
                 WHERE is_active AND event_type = e.event_type
                   AND (applies_to_role = 'any' OR applies_to_role = v_role) LOOP
    IF v_rule.threshold IS NOT NULL AND e.amount IS NOT NULL AND ABS(e.amount) >= v_rule.threshold THEN
      v_risk := GREATEST(v_risk, v_rule.base_risk);
      v_signals := v_signals || jsonb_build_object('type','rule','code',v_rule.code,'name',v_rule.name,'weight',v_rule.base_risk);
      v_conf := LEAST(100, v_conf + 25);
    END IF;
    IF v_rule.window_minutes IS NOT NULL AND v_rule.max_count IS NOT NULL THEN
      SELECT COUNT(*) INTO v_recent_count FROM public.activity_events
       WHERE user_id = e.user_id AND event_type = e.event_type
         AND created_at >= e.created_at - (v_rule.window_minutes || ' minutes')::interval
         AND created_at <= e.created_at;
      IF v_recent_count > v_rule.max_count THEN
        v_risk := GREATEST(v_risk, v_rule.base_risk);
        v_signals := v_signals || jsonb_build_object('type','rule','code',v_rule.code,'name',v_rule.name,'count',v_recent_count,'weight',v_rule.base_risk);
        v_conf := LEAST(100, v_conf + 25);
      END IF;
    END IF;
  END LOOP;

  -- discount cap by role
  IF e.event_type = 'discount' AND e.amount IS NOT NULL AND e.amount > rs.max_discount_pct THEN
    v_risk := GREATEST(v_risk, 60 + LEAST(30, (e.amount - rs.max_discount_pct)::INT));
    v_signals := v_signals || jsonb_build_object('type','role_cap','code','role_discount_cap','limit',rs.max_discount_pct,'actual',e.amount);
    v_conf := LEAST(100, v_conf + 20);
  END IF;

  -- price change permission
  IF e.event_type = 'price_change' AND NOT rs.allow_price_change THEN
    v_risk := GREATEST(v_risk, 75);
    v_signals := v_signals || jsonb_build_object('type','role_cap','code','price_change_forbidden');
    v_conf := LEAST(100, v_conf + 25);
  END IF;

  -- off-hours stock adjust
  IF e.event_type = 'stock_adjust' AND NOT rs.allow_offhours_adjust AND b IS NOT NULL
     AND (v_hour < b.active_hour_start OR v_hour > b.active_hour_end) THEN
    v_risk := GREATEST(v_risk, 55);
    v_signals := v_signals || jsonb_build_object('type','offhours','hour',v_hour,'active_start',b.active_hour_start,'active_end',b.active_hour_end);
    v_conf := LEAST(100, v_conf + 15);
  END IF;

  -- B) BEHAVIOR BASELINE deviation
  IF e.event_type = 'discount' AND e.amount IS NOT NULL AND b IS NOT NULL AND b.sample_size >= 5 THEN
    IF b.stddev_discount_pct > 0 THEN
      v_dev := ABS(e.amount - b.avg_discount_pct) / b.stddev_discount_pct;
    ELSIF b.avg_discount_pct > 0 THEN
      v_dev := (e.amount - b.avg_discount_pct) / b.avg_discount_pct;
    END IF;
    IF v_dev >= 2 THEN
      v_risk := GREATEST(v_risk, 50 + LEAST(40, (v_dev*10)::INT));
      v_signals := v_signals || jsonb_build_object('type','baseline','metric','discount_deviation','sigma',ROUND(v_dev,2),'baseline',ROUND(b.avg_discount_pct,2),'actual',e.amount);
      v_conf := LEAST(100, v_conf + 20);
    END IF;
  END IF;

  -- apply role sensitivity multiplier
  v_risk := LEAST(100, GREATEST(0, (v_risk * rs.sensitivity)::INT));

  -- severity
  v_sev := CASE WHEN v_risk >= 85 THEN 'critical'
                WHEN v_risk >= 65 THEN 'high'
                WHEN v_risk >= 35 THEN 'warning'
                ELSE 'info' END;

  v_reason := CASE WHEN jsonb_array_length(v_signals) = 0 THEN 'سلوك ضمن الطبيعي'
                   ELSE 'تم رصد ' || jsonb_array_length(v_signals)::TEXT || ' إشارات مخاطر' END;

  v_rec := CASE v_sev
    WHEN 'critical' THEN 'تطلب موافقة المالك وقفل مؤقت للمستخدم'
    WHEN 'high' THEN 'يوصى بإيقاف الإجراء حتى مراجعة المدير'
    WHEN 'warning' THEN 'مراجعة لاحقة موصى بها'
    ELSE 'تسجيل فقط' END;

  -- update event
  UPDATE public.activity_events SET
    risk_score = v_risk,
    risk_level = v_sev,
    flagged = (v_risk >= 35),
    reason = v_reason
  WHERE id = _event_id;

  RETURN jsonb_build_object(
    'event_id', _event_id,
    'risk', v_risk,
    'confidence', v_conf,
    'severity', v_sev,
    'signals', v_signals,
    'reason', v_reason,
    'recommendation', v_rec,
    'role', v_role,
    'baseline', CASE WHEN b IS NULL THEN NULL ELSE
      jsonb_build_object('avg_discount',b.avg_discount_pct,'stddev',b.stddev_discount_pct,'sample',b.sample_size) END
  );
END $$;

-- 9) Auto-evaluate on activity_events insert
CREATE OR REPLACE FUNCTION public.trg_evaluate_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.evaluate_event_intelligence(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_eval ON public.activity_events;
CREATE TRIGGER trg_activity_eval AFTER INSERT ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_evaluate_event();

-- 10) Correlate alerts within a window into clusters (group similar)
CREATE OR REPLACE FUNCTION public.correlate_alerts(_window_minutes INT DEFAULT 60)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_ids UUID[]; v_risk INT; v_conf INT; v_sev TEXT;
        v_signals JSONB; v_summary TEXT; v_count INT := 0; v_user UUID;
        v_ctx TEXT;
BEGIN
  FOR r IN
    SELECT user_id, MIN(created_at) AS win_start, MAX(created_at) AS win_end,
           array_agg(id ORDER BY created_at) AS ids,
           AVG(risk_score)::INT AS avg_risk,
           MAX(risk_score) AS max_risk,
           COUNT(*) AS n
    FROM public.activity_events
    WHERE flagged AND created_at >= now() - (_window_minutes || ' minutes')::interval
      AND id NOT IN (SELECT unnest(event_ids) FROM public.alert_clusters WHERE created_at >= now() - INTERVAL '1 day')
    GROUP BY user_id
    HAVING COUNT(*) >= 1
  LOOP
    v_ids := r.ids;
    -- aggregate signals
    SELECT jsonb_agg(jsonb_build_object('event_type',event_type,'amount',amount,'risk',risk_score,'reason',reason))
      INTO v_signals FROM public.activity_events WHERE id = ANY(v_ids);

    v_risk := LEAST(100, ((r.avg_risk + r.max_risk) / 2)::INT + LEAST(20, (r.n - 1) * 5));
    v_conf := LEAST(100, 40 + r.n * 12);
    v_sev := CASE WHEN v_risk >= 85 THEN 'critical'
                  WHEN v_risk >= 65 THEN 'high'
                  WHEN v_risk >= 35 THEN 'warning'
                  ELSE 'info' END;
    v_ctx := CASE WHEN v_risk >= 80 THEN 'highly_suspicious'
                  WHEN v_risk >= 50 THEN 'suspicious'
                  ELSE 'normal' END;
    v_summary := 'مجموعة من ' || r.n::TEXT || ' أحداث، أعلى مخاطر: ' || r.max_risk::TEXT;

    INSERT INTO public.alert_clusters(user_id, title, summary, risk_score, confidence, severity, signals, event_ids,
                                       recommended_action, context_tag, window_start, window_end)
    VALUES (r.user_id,
            'مجموعة نشاط مشبوه',
            v_summary,
            v_risk, v_conf, v_sev, v_signals, v_ids,
            CASE v_sev WHEN 'critical' THEN 'قفل حساب وطلب موافقة فورية'
                       WHEN 'high' THEN 'إخطار المالك ومراجعة عاجلة'
                       WHEN 'warning' THEN 'مراجعة وتحقق'
                       ELSE 'متابعة' END,
            v_ctx, r.win_start, r.win_end);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- 11) Dashboard summary
CREATE OR REPLACE FUNCTION public.intelligence_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
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
        LEFT JOIN public.activity_events e ON e.user_id = p.id AND e.flagged
          AND e.created_at >= now() - INTERVAL '7 days'
        GROUP BY p.id, p.full_name
        HAVING COUNT(e.*) > 0
        ORDER BY avg_risk DESC LIMIT 5
      ) x
    )
  ) INTO v;
  RETURN v;
END $$;
