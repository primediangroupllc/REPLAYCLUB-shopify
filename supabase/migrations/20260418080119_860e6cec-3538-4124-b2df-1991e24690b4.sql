ALTER TABLE public.events
ADD COLUMN card_style text NOT NULL DEFAULT 'glass_chrome'
CHECK (card_style IN ('glass_chrome', 'date_block', 'ticket_stub', 'boarding_pass'));