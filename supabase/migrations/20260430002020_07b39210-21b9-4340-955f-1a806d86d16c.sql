-- Admin RPCs for Services + Tiers CRUD (chunk 3)
-- All functions are SECURITY DEFINER, restrict access to admins, and write to audit_log.

-- ============================================================================
-- admin_update_service: update editable scalar fields on studio_configurations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_service(
  p_studio_key text,
  p_payload jsonb
)
RETURNS public.studio_configurations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_before public.studio_configurations;
  v_after public.studio_configurations;
  v_display_name text;
  v_description text;
  v_starting_at_copy text;
  v_base_price_cents integer;
  v_sort_order integer;
  v_is_active boolean;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.studio_configurations WHERE studio_key = p_studio_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'studio not found: %', p_studio_key USING ERRCODE = 'P0002';
  END IF;

  -- Extract + validate
  v_display_name      := COALESCE(p_payload->>'display_name', v_before.display_name);
  v_description       := COALESCE(p_payload->>'description', v_before.description);
  v_starting_at_copy  := CASE WHEN p_payload ? 'starting_at_copy' THEN p_payload->>'starting_at_copy' ELSE v_before.starting_at_copy END;
  v_base_price_cents  := CASE WHEN p_payload ? 'base_price_cents' AND p_payload->>'base_price_cents' IS NOT NULL
                              THEN (p_payload->>'base_price_cents')::int
                              ELSE v_before.base_price_cents END;
  v_sort_order        := COALESCE((p_payload->>'sort_order')::int, v_before.sort_order);
  v_is_active         := COALESCE((p_payload->>'is_active')::boolean, v_before.is_active);

  IF length(trim(v_display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name cannot be empty' USING ERRCODE = '22023';
  END IF;
  IF v_base_price_cents IS NOT NULL AND v_base_price_cents < 0 THEN
    RAISE EXCEPTION 'base_price_cents must be >= 0' USING ERRCODE = '22023';
  END IF;
  IF v_sort_order < 0 THEN
    RAISE EXCEPTION 'sort_order must be >= 0' USING ERRCODE = '22023';
  END IF;

  UPDATE public.studio_configurations
  SET display_name      = v_display_name,
      description       = v_description,
      starting_at_copy  = v_starting_at_copy,
      base_price_cents  = v_base_price_cents,
      sort_order        = v_sort_order,
      is_active         = v_is_active,
      updated_at        = now()
  WHERE studio_key = p_studio_key
  RETURNING * INTO v_after;

  INSERT INTO public.audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    'update',
    'studio_configuration',
    p_studio_key,
    jsonb_build_object(
      'before', jsonb_build_object(
        'display_name', v_before.display_name,
        'description', v_before.description,
        'starting_at_copy', v_before.starting_at_copy,
        'base_price_cents', v_before.base_price_cents,
        'sort_order', v_before.sort_order,
        'is_active', v_before.is_active
      ),
      'after', jsonb_build_object(
        'display_name', v_after.display_name,
        'description', v_after.description,
        'starting_at_copy', v_after.starting_at_copy,
        'base_price_cents', v_after.base_price_cents,
        'sort_order', v_after.sort_order,
        'is_active', v_after.is_active
      )
    )
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_service(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_service(text, jsonb) TO authenticated;

-- ============================================================================
-- admin_upsert_tier: add or update one tier inside studio_configurations.tiers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_tier(
  p_studio_key text,
  p_tier jsonb
)
RETURNS public.studio_configurations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_before public.studio_configurations;
  v_after public.studio_configurations;
  v_tiers jsonb;
  v_tier_id text;
  v_label text;
  v_price integer;
  v_existing_idx int;
  v_dup_count int;
  v_normalized jsonb;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.studio_configurations WHERE studio_key = p_studio_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'studio not found: %', p_studio_key USING ERRCODE = 'P0002';
  END IF;

  v_tier_id := COALESCE(p_tier->>'id', '');
  v_label   := trim(COALESCE(p_tier->>'label', ''));
  v_price   := COALESCE((p_tier->>'price_cents_per_hour')::int, 0);

  IF length(v_tier_id) = 0 THEN
    RAISE EXCEPTION 'tier id is required' USING ERRCODE = '22023';
  END IF;
  IF length(v_label) = 0 THEN
    RAISE EXCEPTION 'tier label is required' USING ERRCODE = '22023';
  END IF;
  IF v_price < 0 THEN
    RAISE EXCEPTION 'price_cents_per_hour must be >= 0' USING ERRCODE = '22023';
  END IF;

  v_tiers := COALESCE(v_before.tiers, '[]'::jsonb);

  -- Duplicate label check (case-insensitive, excluding the tier we're editing)
  SELECT count(*) INTO v_dup_count
  FROM jsonb_array_elements(v_tiers) AS t
  WHERE lower(trim(t->>'label')) = lower(v_label)
    AND COALESCE(t->>'id', '') <> v_tier_id;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'duplicate tier label: %', v_label USING ERRCODE = '23505';
  END IF;

  -- Normalize the tier payload (preserve only known fields)
  v_normalized := jsonb_build_object(
    'id', v_tier_id,
    'label', v_label,
    'price_cents_per_hour', v_price,
    'features', COALESCE(p_tier->'features', '[]'::jsonb),
    'description', p_tier->>'description',
    'flat_addon_cents', CASE WHEN p_tier ? 'flat_addon_cents' THEN (p_tier->>'flat_addon_cents')::int ELSE NULL END,
    'image_url', p_tier->>'image_url',
    'sort_order', CASE WHEN p_tier ? 'sort_order' THEN (p_tier->>'sort_order')::int ELSE NULL END
  );

  -- Find existing tier by id
  SELECT idx - 1 INTO v_existing_idx
  FROM jsonb_array_elements(v_tiers) WITH ORDINALITY AS arr(elem, idx)
  WHERE elem->>'id' = v_tier_id
  LIMIT 1;

  IF v_existing_idx IS NOT NULL THEN
    v_tiers := jsonb_set(v_tiers, ARRAY[v_existing_idx::text], v_normalized, false);
  ELSE
    v_tiers := v_tiers || jsonb_build_array(v_normalized);
  END IF;

  UPDATE public.studio_configurations
  SET tiers = v_tiers, updated_at = now()
  WHERE studio_key = p_studio_key
  RETURNING * INTO v_after;

  INSERT INTO public.audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN v_existing_idx IS NULL THEN 'create' ELSE 'update' END,
    'studio_tier',
    p_studio_key || ':' || v_tier_id,
    jsonb_build_object(
      'studio_key', p_studio_key,
      'tier_id', v_tier_id,
      'before_tiers', v_before.tiers,
      'after_tier', v_normalized
    )
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_tier(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_tier(text, jsonb) TO authenticated;

-- ============================================================================
-- admin_delete_tier: remove tier; block if in-flight bookings reference it
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_tier(
  p_studio_key text,
  p_tier_id text
)
RETURNS public.studio_configurations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_before public.studio_configurations;
  v_after public.studio_configurations;
  v_room_title text;
  v_tier_label text;
  v_tier_to_delete jsonb;
  v_remaining_tiers jsonb;
  v_inflight_count int;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.studio_configurations WHERE studio_key = p_studio_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'studio not found: %', p_studio_key USING ERRCODE = 'P0002';
  END IF;

  -- Find the tier being deleted to capture its label for the booking check
  SELECT elem INTO v_tier_to_delete
  FROM jsonb_array_elements(COALESCE(v_before.tiers, '[]'::jsonb)) AS elem
  WHERE elem->>'id' = p_tier_id
  LIMIT 1;
  IF v_tier_to_delete IS NULL THEN
    RAISE EXCEPTION 'tier not found: %', p_tier_id USING ERRCODE = 'P0002';
  END IF;

  v_tier_label := v_tier_to_delete->>'label';
  v_room_title := v_before.display_name;

  -- In-flight bookings = same room_title + matching tier label + future date + not cancelled
  SELECT count(*) INTO v_inflight_count
  FROM public.bookings b
  WHERE lower(b.tier) = lower(v_tier_label)
    AND b.booking_date >= CURRENT_DATE
    AND COALESCE(b.payment_status, '') <> 'cancelled';

  IF v_inflight_count > 0 THEN
    RAISE EXCEPTION 'cannot delete tier "%" — % in-flight booking(s) reference it', v_tier_label, v_inflight_count
      USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_remaining_tiers
  FROM jsonb_array_elements(COALESCE(v_before.tiers, '[]'::jsonb)) AS elem
  WHERE elem->>'id' <> p_tier_id;

  UPDATE public.studio_configurations
  SET tiers = v_remaining_tiers, updated_at = now()
  WHERE studio_key = p_studio_key
  RETURNING * INTO v_after;

  INSERT INTO public.audit_log (admin_user_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    'delete',
    'studio_tier',
    p_studio_key || ':' || p_tier_id,
    jsonb_build_object(
      'studio_key', p_studio_key,
      'tier_id', p_tier_id,
      'deleted_tier', v_tier_to_delete
    )
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_tier(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_tier(text, text) TO authenticated;