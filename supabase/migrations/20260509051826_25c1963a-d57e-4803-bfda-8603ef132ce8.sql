-- 1. Extend booking_tab_type enum
ALTER TYPE public.booking_tab_type ADD VALUE IF NOT EXISTS 'livestream';
ALTER TYPE public.booking_tab_type ADD VALUE IF NOT EXISTS 'music';
