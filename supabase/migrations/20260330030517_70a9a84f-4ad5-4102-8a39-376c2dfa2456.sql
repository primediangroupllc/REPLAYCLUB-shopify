CREATE TRIGGER on_mix_insert_update_generate_waveform
  AFTER INSERT OR UPDATE OF file_url ON public.mixes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_waveform_generation();