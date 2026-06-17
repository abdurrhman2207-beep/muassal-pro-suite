
CREATE TYPE public.adjustment_type AS ENUM ('manual','damage','gift','transfer_in','transfer_out','count');

CREATE TABLE public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  adjustment_type public.adjustment_type NOT NULL DEFAULT 'manual',
  quantity NUMERIC NOT NULL,
  reason TEXT,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustments TO authenticated;
GRANT ALL ON public.stock_adjustments TO service_role;

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read adjustments" ON public.stock_adjustments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert adjustments" ON public.stock_adjustments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin update adjustments" ON public.stock_adjustments
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admin delete adjustments" ON public.stock_adjustments
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_stock_adjustment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
    SET quantity = quantity + NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_stock_adjustment
AFTER INSERT ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_adjustment();
