
-- ============ BOS Phase 1: Core tables ============

-- 1) automations
CREATE TABLE public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- stock_low, sale_created, sale_threshold, customer_tier, etc
  rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_automations" ON public.automations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth_read_automations" ON public.automations FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_automations_updated BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) automation_logs
CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
  event JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.automation_logs TO authenticated;
GRANT ALL ON public.automation_logs TO service_role;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_automation_logs" ON public.automation_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "system_insert_automation_logs" ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3) approvals
CREATE TYPE public.approval_type AS ENUM ('discount','purchase','return','price_change','refund');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','cancelled');
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.approval_type NOT NULL,
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.approval_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_or_admin_read_approvals" ON public.approvals FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth_insert_approvals" ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());
CREATE POLICY "admin_update_approvals" ON public.approvals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_approvals_updated BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) tasks
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','done','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  related_entity TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_read" ON public.tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "task_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "task_update" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "task_delete_admin" ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) task_comments
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments_read" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- 6) announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announce_read" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announce_admin_write" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "announce_admin_delete" ON public.announcements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 7) chat
CREATE TABLE public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_channels TO authenticated;
GRANT ALL ON public.chat_channels TO service_role;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_read" ON public.chat_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "channels_insert" ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 8) documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  related_entity TEXT,
  related_id UUID,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_read" ON public.documents FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "docs_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "docs_delete" ON public.documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 9) custom_kpis
CREATE TABLE public.custom_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  formula TEXT NOT NULL, -- safe DSL identifier like 'revenue_30d', 'profit_margin'
  target NUMERIC,
  unit TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_kpis TO authenticated;
GRANT ALL ON public.custom_kpis TO service_role;
ALTER TABLE public.custom_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_admin" ON public.custom_kpis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 10) custom_reports
CREATE TABLE public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_reports TO authenticated;
GRANT ALL ON public.custom_reports TO service_role;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_admin" ON public.custom_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11) webhooks
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_admin" ON public.webhooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_del_admin" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 12) api_keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{read}',
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apikeys_admin" ON public.api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 13) health_score_snapshots
CREATE TABLE public.health_score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score NUMERIC NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.health_score_snapshots TO authenticated;
GRANT ALL ON public.health_score_snapshots TO service_role;
ALTER TABLE public.health_score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_read" ON public.health_score_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 14) ai_recommendations
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- strategy | advisor | risk
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_rec_admin" ON public.ai_recommendations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 15) forecasts
CREATE TABLE public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL, -- revenue | demand | inventory
  entity_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  predicted_value NUMERIC NOT NULL,
  confidence NUMERIC,
  commentary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.forecasts TO authenticated;
GRANT ALL ON public.forecasts TO service_role;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecast_admin" ON public.forecasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 16) white_label_settings (singleton row)
CREATE TABLE public.white_label_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL DEFAULT 'Muassal Pro',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0ea5b7',
  custom_domain TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.white_label_settings TO authenticated, anon;
GRANT INSERT, UPDATE ON public.white_label_settings TO authenticated;
GRANT ALL ON public.white_label_settings TO service_role;
ALTER TABLE public.white_label_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_read_all" ON public.white_label_settings FOR SELECT USING (true);
CREATE POLICY "wl_admin_write" ON public.white_label_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "wl_admin_update" ON public.white_label_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.white_label_settings (brand_name) VALUES ('Muassal Pro');

-- ============ Business Health Score function ============
CREATE OR REPLACE FUNCTION public.calculate_business_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev_30 NUMERIC := 0;
  v_rev_prev_30 NUMERIC := 0;
  v_profit_30 NUMERIC := 0;
  v_low_stock INT := 0;
  v_total_products INT := 0;
  v_customers_active INT := 0;
  v_customers_total INT := 0;
  v_growth NUMERIC := 0;
  v_margin NUMERIC := 0;
  v_inventory NUMERIC := 0;
  v_retention NUMERIC := 0;
  v_employees NUMERIC := 70;
  v_branches NUMERIC := 70;
  v_score NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(total),0) INTO v_rev_30 FROM public.sales
    WHERE created_at >= now() - INTERVAL '30 days';
  SELECT COALESCE(SUM(total),0) INTO v_rev_prev_30 FROM public.sales
    WHERE created_at >= now() - INTERVAL '60 days' AND created_at < now() - INTERVAL '30 days';
  SELECT COALESCE(SUM((unit_price-unit_cost)*quantity),0) INTO v_profit_30 FROM public.sale_items
    WHERE created_at >= now() - INTERVAL '30 days';
  SELECT COUNT(*) INTO v_total_products FROM public.products;
  SELECT COUNT(*) INTO v_low_stock FROM public.products WHERE quantity <= low_stock_threshold;
  SELECT COUNT(*) INTO v_customers_total FROM public.customers;
  SELECT COUNT(DISTINCT customer_id) INTO v_customers_active FROM public.sales
    WHERE created_at >= now() - INTERVAL '60 days' AND customer_id IS NOT NULL;

  -- 1) growth
  IF v_rev_prev_30 > 0 THEN
    v_growth := LEAST(100, GREATEST(0, 50 + ((v_rev_30 - v_rev_prev_30) / v_rev_prev_30) * 100));
  ELSE
    v_growth := CASE WHEN v_rev_30 > 0 THEN 75 ELSE 50 END;
  END IF;

  -- 2) profitability (margin)
  IF v_rev_30 > 0 THEN
    v_margin := LEAST(100, (v_profit_30 / v_rev_30) * 200);
  END IF;

  -- 3) inventory health
  IF v_total_products > 0 THEN
    v_inventory := LEAST(100, 100 - (v_low_stock::NUMERIC / v_total_products * 100));
  ELSE
    v_inventory := 50;
  END IF;

  -- 4) retention
  IF v_customers_total > 0 THEN
    v_retention := LEAST(100, v_customers_active::NUMERIC / v_customers_total * 100);
  ELSE
    v_retention := 50;
  END IF;

  v_score := ROUND((v_growth*0.25 + v_margin*0.25 + v_inventory*0.2 + v_retention*0.15 + v_employees*0.075 + v_branches*0.075)::NUMERIC, 1);

  RETURN jsonb_build_object(
    'score', v_score,
    'breakdown', jsonb_build_object(
      'revenue_growth', ROUND(v_growth,1),
      'profitability', ROUND(v_margin,1),
      'inventory_health', ROUND(v_inventory,1),
      'customer_retention', ROUND(v_retention,1),
      'employee_performance', v_employees,
      'branch_performance', v_branches
    ),
    'metrics', jsonb_build_object(
      'revenue_30d', v_rev_30,
      'revenue_prev_30d', v_rev_prev_30,
      'profit_30d', v_profit_30,
      'low_stock_count', v_low_stock,
      'total_products', v_total_products,
      'active_customers', v_customers_active,
      'total_customers', v_customers_total
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.record_health_snapshot()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data JSONB;
  v_id UUID;
BEGIN
  v_data := public.calculate_business_health();
  INSERT INTO public.health_score_snapshots (score, breakdown)
  VALUES ((v_data->>'score')::NUMERIC, v_data->'breakdown')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- storage bucket for documents (reuse store-assets bucket; nothing to do)
