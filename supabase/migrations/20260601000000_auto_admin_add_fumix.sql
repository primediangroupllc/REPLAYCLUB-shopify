-- Extend the auto-admin allowlist: grant admin on signup to BOTH
-- sereda.a@gmail.com and fumix.mgmt@gmail.com (was sereda only). Fires via the
-- on_sereda_admin_assignment trigger on public.profiles.
CREATE OR REPLACE FUNCTION public.auto_admin_sereda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  IF lower(user_email) IN ('sereda.a@gmail.com', 'fumix.mgmt@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
