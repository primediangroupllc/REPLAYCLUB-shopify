ALTER TABLE public.discount_codes ADD COLUMN expires_at timestamptz;
CREATE INDEX idx_discount_codes_expires_at ON public.discount_codes (expires_at) WHERE redeemed = false;