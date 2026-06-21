
-- Absent Owner Mode
CREATE TABLE IF NOT EXISTS public.owner_mode (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  notes TEXT,
  require_approval_discount_pct NUMERIC NOT NULL DEFAULT 15,
  require_approval_refund_amount NUMERIC NOT NULL DEFAULT 50000,
  freeze_discounts BOOLEAN NOT NULL DEFAULT false,
  freeze_returns BOOLEAN NOT NULL DEFAULT false,
  freeze_inventory BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = true)
);
GRANT SELECT ON public.owner_mode TO authenticated;
GRANT ALL ON public.owner_mode TO service_role;
ALTER TABLE public.owner_mode ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed read owner mode" ON public.owner_mode FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage owner mode" ON public.owner_mode FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.owner_mode (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Activity / audit events
CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- sale, discount, refund, cancel, price_change, stock_adjust, login, override
  entity_type TEXT,
  entity_id UUID,
  amount NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}',
  risk_score INT NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low', -- low|medium|high|critical
  flagged BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth insert events" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "admin read all events" ON public.activity_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_flagged ON public.activity_events(flagged) WHERE flagged = true;

-- Security alerts (anomaly detections)
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_event_id UUID REFERENCES public.activity_events(id) ON DELETE SET NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage alerts" ON public.security_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.security_alerts(created_at DESC);

-- Employee account lock flags
CREATE TABLE IF NOT EXISTS public.account_restrictions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  disabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  restricted_by UUID,
  restricted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_restrictions TO authenticated;
GRANT ALL ON public.account_restrictions TO service_role;
ALTER TABLE public.account_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage restrictions" ON public.account_restrictions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read own restriction" ON public.account_restrictions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Log activity helper
CREATE OR REPLACE FUNCTION public.log_activity(_type TEXT, _entity_type TEXT, _entity_id UUID, _amount NUMERIC, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_score INT := 0; v_level TEXT := 'low'; v_flag BOOLEAN := false; v_reason TEXT;
BEGIN
  -- naive scoring
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
    VALUES (_type, v_level, COALESCE(v_reason,'تنبيه نشاط'),
            'نشاط غير اعتيادي: ' || _type || COALESCE(' بقيمة ' || _amount::TEXT, ''),
            auth.uid(), v_id, COALESCE(_metadata,'{}'::jsonb));
  END IF;
  RETURN v_id;
END $$;

-- Aggregated employee trust score
CREATE OR REPLACE FUNCTION public.employee_trust_scores()
RETURNS TABLE(user_id UUID, full_name TEXT, events INT, flagged INT, avg_risk NUMERIC, trust_score NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name,
    COUNT(e.id)::INT AS events,
    COUNT(e.id) FILTER (WHERE e.flagged)::INT AS flagged,
    COALESCE(AVG(e.risk_score),0)::NUMERIC AS avg_risk,
    GREATEST(0, 100 - COALESCE(AVG(e.risk_score),0) - COUNT(e.id) FILTER (WHERE e.flagged) * 3)::NUMERIC AS trust_score
  FROM public.profiles p
  LEFT JOIN public.activity_events e ON e.user_id = p.id AND e.created_at >= now() - INTERVAL '30 days'
  GROUP BY p.id, p.full_name
  ORDER BY trust_score ASC
$$;

-- Store-wide risk score
CREATE OR REPLACE FUNCTION public.store_risk_score()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total INT; v_flag INT; v_avg NUMERIC; v_score INT; v_level TEXT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE flagged), COALESCE(AVG(risk_score),0)
    INTO v_total, v_flag, v_avg
  FROM public.activity_events WHERE created_at >= now() - INTERVAL '24 hours';
  v_score := LEAST(100, COALESCE(v_avg,0)::INT + v_flag * 5);
  v_level := CASE WHEN v_score >= 75 THEN 'critical' WHEN v_score >= 50 THEN 'high' WHEN v_score >= 25 THEN 'medium' ELSE 'low' END;
  RETURN jsonb_build_object('score', v_score, 'level', v_level, 'events_24h', v_total, 'flagged_24h', v_flag, 'avg_risk', ROUND(v_avg,1));
END $$;
