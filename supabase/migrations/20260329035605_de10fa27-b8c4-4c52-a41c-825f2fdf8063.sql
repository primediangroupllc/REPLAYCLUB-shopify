drop policy if exists "Users can read own bookings by email" on public.bookings;

create policy "Users can read own bookings by email"
on public.bookings
for select
to authenticated
using (
  lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);