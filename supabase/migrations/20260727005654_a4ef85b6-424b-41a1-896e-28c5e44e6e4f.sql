DROP POLICY IF EXISTS "system_insert_automation_logs" ON public.automation_logs;
CREATE POLICY "automation_logs_insert_admin" ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));