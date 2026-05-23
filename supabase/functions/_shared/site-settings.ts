// Lightweight cached reader for public.site_settings used by edge functions.
// All consumers MUST fall back to their hardcoded defaults if the fetch fails
// or any individual field is unset, so customer-facing behaviour never breaks
// when admins haven't configured a value.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface EmailSender {
  from_name?: string | null
  reply_to?: string | null
}

export interface SiteSettingsRow {
  email_senders: Record<string, EmailSender>
  sms_sender_number: string | null
  admin_notification_recipients: string[]
  twitch_channel: string | null
  email_toggles: Record<string, boolean>
  cancellation_cutoff_hours: number | null
  slot_lock_ttl_minutes: number | null
  equipment_lock_ttl_minutes: number | null
}

const TTL_MS = 30_000
let cached: { at: number; data: SiteSettingsRow } | null = null

function getClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

export async function getSiteSettings(): Promise<SiteSettingsRow> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data
  const fallback: SiteSettingsRow = {
    email_senders: {},
    sms_sender_number: null,
    admin_notification_recipients: [],
    twitch_channel: null,
    email_toggles: {},
    cancellation_cutoff_hours: null,
    slot_lock_ttl_minutes: null,
    equipment_lock_ttl_minutes: null,
  }
  try {
    const supabase = getClient()
    const { data } = await supabase
      .from('site_settings')
      .select('email_senders, sms_sender_number, admin_notification_recipients, twitch_channel, email_toggles, cancellation_cutoff_hours, slot_lock_ttl_minutes, equipment_lock_ttl_minutes')
      .order('id')
      .limit(1)
      .maybeSingle()
    const row: SiteSettingsRow = {
      email_senders: (data?.email_senders as Record<string, EmailSender>) || {},
      sms_sender_number: data?.sms_sender_number ?? null,
      admin_notification_recipients: (data?.admin_notification_recipients as string[]) || [],
      twitch_channel: data?.twitch_channel ?? null,
      email_toggles: (data?.email_toggles as Record<string, boolean>) || {},
      cancellation_cutoff_hours:
        typeof data?.cancellation_cutoff_hours === 'number' ? data.cancellation_cutoff_hours : null,
      slot_lock_ttl_minutes:
        typeof data?.slot_lock_ttl_minutes === 'number' ? data.slot_lock_ttl_minutes : null,
      equipment_lock_ttl_minutes:
        typeof data?.equipment_lock_ttl_minutes === 'number' ? data.equipment_lock_ttl_minutes : null,
    }
    cached = { at: Date.now(), data: row }
    return row
  } catch (e) {
    console.error('[site-settings] fetch failed, using fallback', e)
    return fallback
  }
}

/**
 * Build the From: header for transactional emails.
 * Per-type from_name overrides the default; mailbox stays at noreply@<domain>.
 */
export async function resolveFromHeader(
  emailType: string,
  fallbackName: string,
  domain: string,
  mailbox = 'noreply',
): Promise<string> {
  const s = await getSiteSettings()
  const senders = s.email_senders || {}
  const name =
    senders[emailType]?.from_name?.trim() ||
    senders.default?.from_name?.trim() ||
    fallbackName
  return `${name} <${mailbox}@${domain}>`
}

/** SMS "From" number with hardcoded TWILIO_PHONE_NUMBER fallback. */
export async function resolveSmsFrom(): Promise<string | null> {
  const s = await getSiteSettings()
  return (s.sms_sender_number?.trim() || Deno.env.get('TWILIO_PHONE_NUMBER') || null)
}

/**
 * Admin notification recipient list. Returns the configured array if non-empty,
 * otherwise the supplied hardcoded fallback (single email or array).
 */
export async function resolveAdminEmails(fallback: string | string[]): Promise<string[]> {
  const s = await getSiteSettings()
  const list = (s.admin_notification_recipients || []).filter(Boolean)
  if (list.length > 0) return list
  return Array.isArray(fallback) ? fallback : [fallback]
}

/**
 * Admin SMS recipient list. The settings table currently stores admin
 * recipients as emails only — there is no admin-phone array yet — so this
 * just returns the env-configured ADMIN_PHONE_NUMBER as a single-element
 * list when set. Kept here so call sites have one consistent helper.
 */
export function resolveAdminPhones(): string[] {
  const p = Deno.env.get('ADMIN_PHONE_NUMBER')
  return p ? [p] : []
}

export async function resolveTwitchChannel(fallback: string): Promise<string> {
  const s = await getSiteSettings()
  return s.twitch_channel?.trim() || fallback
}

/**
 * Returns whether a given transactional email type is enabled. Defaults to
 * TRUE (preserves current behaviour) if the toggle is missing or settings
 * fetch failed. Pass the same key the admin UI exposes.
 *
 * Known keys: booking_confirmation, admin_notification, reminder_2h,
 * followup, event_confirmation, rental_confirmation, promo_code,
 * waitlist_spot, booking_cancelled, reschedule_confirmation,
 * verification_email, event_reminder.
 */
export async function isEmailTypeEnabled(emailType: string): Promise<boolean> {
  try {
    const s = await getSiteSettings()
    const v = s.email_toggles?.[emailType]
    if (v === false) return false
    return true
  } catch {
    return true
  }
}

/** Cancellation cutoff in hours; falls back to the supplied default. */
export async function resolveCancellationCutoffHours(fallback: number): Promise<number> {
  const s = await getSiteSettings()
  return typeof s.cancellation_cutoff_hours === 'number' && s.cancellation_cutoff_hours >= 0
    ? s.cancellation_cutoff_hours
    : fallback
}

/** Slot lock TTL in seconds; falls back to the supplied default seconds. */
export async function resolveSlotLockTtlSeconds(fallbackSeconds: number): Promise<number> {
  const s = await getSiteSettings()
  return typeof s.slot_lock_ttl_minutes === 'number' && s.slot_lock_ttl_minutes > 0
    ? s.slot_lock_ttl_minutes * 60
    : fallbackSeconds
}

/** Equipment rental lock TTL in seconds; falls back to default seconds. */
export async function resolveEquipmentLockTtlSeconds(fallbackSeconds: number): Promise<number> {
  const s = await getSiteSettings()
  return typeof s.equipment_lock_ttl_minutes === 'number' && s.equipment_lock_ttl_minutes > 0
    ? s.equipment_lock_ttl_minutes * 60
    : fallbackSeconds
}

/**
 * Send a single SMS via Twilio to one or more recipient numbers.
 * Reads the From number from site_settings.sms_sender_number first, then
 * falls back to TWILIO_PHONE_NUMBER. Silently no-ops if Twilio creds or
 * recipients are missing — SMS is best-effort, never blocks the caller.
 */
export async function sendTwilioSms(
  to: string | string[],
  body: string,
): Promise<void> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = await resolveSmsFrom()
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  if (!sid || !auth || !from || recipients.length === 0) {
    console.log('[sms] skipped — missing creds, from, or recipients')
    return
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  await Promise.all(
    recipients.map(async (To) => {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${sid}:${auth}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To, From: from, Body: body }),
        })
        if (!resp.ok) {
          console.error('[sms] twilio error', resp.status, await resp.text())
        }
      } catch (e) {
        console.error('[sms] send failed', e)
      }
    }),
  )
}