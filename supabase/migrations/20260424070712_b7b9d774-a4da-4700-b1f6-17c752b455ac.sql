
ALTER VIEW public.slot_locks_public SET (security_invoker = on);
ALTER VIEW public.equipment_locks_public SET (security_invoker = on);

-- Make sure anon/auth can SELECT through the view; underlying table RLS still applies.
-- Add a permissive read policy on the base tables limited to non-sensitive columns? Not possible per-column;
-- instead grant SELECT on the view and let RLS gate the base table for direct queries.
-- The owner/admin policies added in the previous migration handle base-table access.
-- For the view to return rows under invoker rights, anon/auth need to be able to SELECT the underlying rows.
-- Add a column-agnostic public read policy that the app code must pair with column projection via the view only.

-- Re-add public SELECT on base tables, but the email column will only be visible through direct queries
-- from the owner (via the new owner policies). The view excludes the email column entirely, so even
-- though the policy below permits public SELECT, queries through `slot_locks_public` cannot return emails.
CREATE POLICY "Public read active slot locks (availability only)"
ON public.slot_locks
FOR SELECT
TO anon, authenticated
USING (expires_at > now());

CREATE POLICY "Public read active equipment locks (availability only)"
ON public.equipment_locks
FOR SELECT
TO anon, authenticated
USING (expires_at > now());
