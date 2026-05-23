ALTER TABLE public.mixes ADD COLUMN expires_at timestamp with time zone DEFAULT (now() + interval '7 days');
ALTER TABLE public.mixes ADD COLUMN reminder_sent boolean DEFAULT false;