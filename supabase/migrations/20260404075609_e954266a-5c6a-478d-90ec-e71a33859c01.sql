
-- signals: admin review fields
ALTER TABLE public.signals
  ADD COLUMN review_tag text,
  ADD COLUMN review_notes text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;

-- alerts: admin review fields
ALTER TABLE public.alerts
  ADD COLUMN review_tag text,
  ADD COLUMN review_notes text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;

-- Admin policy for alerts (signals already has admin ALL policy)
CREATE POLICY "Admins can manage alerts"
  ON public.alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
