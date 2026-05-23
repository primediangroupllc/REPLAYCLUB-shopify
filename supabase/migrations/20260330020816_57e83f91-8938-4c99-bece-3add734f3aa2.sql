
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function that calls the generate-waveform edge function via pg_net
CREATE OR REPLACE FUNCTION public.trigger_waveform_generation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Only trigger if file_url is set and waveform_data is null
  IF NEW.file_url IS NOT NULL AND NEW.waveform_data IS NULL THEN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/generate-waveform',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('mix_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on mixes table
CREATE TRIGGER on_mix_insert_generate_waveform
  AFTER INSERT ON public.mixes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_waveform_generation();
