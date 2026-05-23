-- Create host activity log table
CREATE TABLE public.host_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  event_id uuid NOT NULL,
  action text NOT NULL, -- 'dashboard_access', 'check_in', 'check_out'
  rsvp_id uuid,
  guest_name text,
  guest_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_host_activity_event ON public.host_activity_log(event_id, created_at DESC);
CREATE INDEX idx_host_activity_host ON public.host_activity_log(host_id, created_at DESC);

ALTER TABLE public.host_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read host activity"
  ON public.host_activity_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages host activity"
  ON public.host_activity_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Update host_check_in to log activity
CREATE OR REPLACE FUNCTION public.host_check_in(p_token text, p_rsvp_id uuid, p_check_in boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_host_id uuid;
  v_guest_name text;
  v_guest_email text;
BEGIN
  SELECT event_id, id INTO v_event_id, v_host_id FROM public.event_hosts
    WHERE token = p_token AND revoked = false LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or revoked host token';
  END IF;

  UPDATE public.event_rsvps
    SET checked_in_at = CASE WHEN p_check_in THEN now() ELSE NULL END
    WHERE id = p_rsvp_id AND event_id = v_event_id
    RETURNING user_name, user_email INTO v_guest_name, v_guest_email;

  UPDATE public.event_hosts SET last_accessed_at = now()
    WHERE token = p_token;

  INSERT INTO public.host_activity_log (host_id, event_id, action, rsvp_id, guest_name, guest_email)
  VALUES (v_host_id, v_event_id, CASE WHEN p_check_in THEN 'check_in' ELSE 'check_out' END,
          p_rsvp_id, v_guest_name, v_guest_email);

  RETURN FOUND;
END;
$function$;

-- New function for hosts to log dashboard accesses
CREATE OR REPLACE FUNCTION public.log_host_access(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_host_id uuid;
  v_last timestamp with time zone;
BEGIN
  SELECT event_id, id, last_accessed_at INTO v_event_id, v_host_id, v_last
  FROM public.event_hosts
  WHERE token = p_token AND revoked = false LIMIT 1;
  IF v_event_id IS NULL THEN
    RETURN false;
  END IF;

  -- Throttle: only log if no access in the past 5 minutes
  IF v_last IS NULL OR v_last < now() - interval '5 minutes' THEN
    INSERT INTO public.host_activity_log (host_id, event_id, action)
    VALUES (v_host_id, v_event_id, 'dashboard_access');
  END IF;

  UPDATE public.event_hosts SET last_accessed_at = now() WHERE token = p_token;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_host_access(text) TO anon, authenticated;