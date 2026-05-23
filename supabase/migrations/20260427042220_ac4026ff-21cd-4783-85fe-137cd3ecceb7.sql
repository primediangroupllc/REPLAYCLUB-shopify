-- Update room_title in various tables
UPDATE public.bookings SET room_title = 'Disk Jockey' WHERE room_title = 'DJ Session';
UPDATE public.blocked_dates SET room_title = 'Disk Jockey' WHERE room_title = 'DJ Session';
UPDATE public.promo_codes SET room_title = 'Disk Jockey' WHERE room_title = 'DJ Session';
UPDATE public.waitlist SET room_title = 'Disk Jockey' WHERE room_title = 'DJ Session';
UPDATE public.slot_locks SET room_title = 'Disk Jockey' WHERE room_title = 'DJ Session';
-- Check and update any other columns that might contain the room title
UPDATE public.events SET title = REPLACE(title, 'DJ Session', 'Disk Jockey') WHERE title LIKE '%DJ Session%';
UPDATE public.notifications SET message = REPLACE(message, 'DJ Session', 'Disk Jockey') WHERE message LIKE '%DJ Session%';
