
CREATE POLICY "store_assets_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'store-assets');
CREATE POLICY "store_assets_admin_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "store_assets_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'store-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "store_assets_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'store-assets' AND public.is_admin(auth.uid()));
