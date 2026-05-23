/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as promoSessionBooked } from './promo-session-booked.tsx'
import { template as promoBookingConfirmation } from './promo-booking-confirmation.tsx'
import { template as bookingConfirmation } from './booking-confirmation.tsx'
import { template as sessionReminder } from './session-reminder.tsx'
import { template as bookingCancelled } from './booking-cancelled.tsx'
import { template as bookingRescheduled } from './booking-rescheduled.tsx'
import { template as waitlistSpotOpen } from './waitlist-spot-open.tsx'
import { template as bookingVerificationCode } from './booking-verification-code.tsx'
import { template as mixUploaded } from './mix-uploaded.tsx'
import { template as mixExpiring } from './mix-expiring.tsx'
import { template as bookingNotificationAdmin } from './booking-notification-admin.tsx'
import { template as rescheduleNotificationAdmin } from './reschedule-notification-admin.tsx'
import { template as rosterSubmissionAdmin } from './roster-submission-admin.tsx'
import { template as rosterConfirmation } from './roster-confirmation.tsx'
import { template as postSessionFollowup } from './post-session-followup.tsx'
import { template as idVerificationResult } from './id-verification-result.tsx'
import { template as eventLiveNotification } from './event-live-notification.tsx'
import { template as photographerBookingAdmin } from './photographer-booking-admin.tsx'
import { template as bookingFailureAdmin } from './booking-failure-admin.tsx'
import { template as bookingScreeningDeclined } from './booking-screening-declined.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'event-live-notification': eventLiveNotification,
  'promo-session-booked': promoSessionBooked,
  'promo-booking-confirmation': promoBookingConfirmation,
  'booking-confirmation': bookingConfirmation,
  'session-reminder': sessionReminder,
  'booking-cancelled': bookingCancelled,
  'booking-rescheduled': bookingRescheduled,
  'waitlist-spot-open': waitlistSpotOpen,
  'booking-verification-code': bookingVerificationCode,
  'mix-uploaded': mixUploaded,
  'mix-expiring': mixExpiring,
  'booking-notification-admin': bookingNotificationAdmin,
  'reschedule-notification-admin': rescheduleNotificationAdmin,
  'roster-submission-admin': rosterSubmissionAdmin,
  'roster-confirmation': rosterConfirmation,
  'post-session-followup': postSessionFollowup,
  'id-verification-result': idVerificationResult,
  'photographer-booking-admin': photographerBookingAdmin,
  'booking-failure-admin': bookingFailureAdmin,
  'booking-screening-declined': bookingScreeningDeclined,
}
