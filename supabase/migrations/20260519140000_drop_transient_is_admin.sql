-- is_admin(uuid) was a transient bootstrap helper. Migration 20260512074648
-- ("admins all backdrops") referenced it, but is_admin never existed in prod —
-- that migration was superseded by 20260512075158, which uses has_role().
-- Bootstrap defines is_admin only so 074648 can apply during replay; this drops
-- it afterward so the schema is byte-for-byte identical to prod. has_role()
-- remains the canonical admin check used by every live policy.
DROP FUNCTION IF EXISTS public.is_admin(uuid);
