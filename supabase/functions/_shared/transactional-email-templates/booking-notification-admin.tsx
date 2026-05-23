import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = "Replay Club"

interface BookingNotificationAdminProps {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  amountFormatted?: string
  tier?: string
  equipment?: string
  consentAccepted?: boolean
  consentAcceptedAt?: string
  consentVersion?: string
}

const BookingNotificationAdminEmail = ({
  customerName = 'A customer',
  customerEmail = '',
  customerPhone = '',
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  amountFormatted = '',
  tier = '',
  equipment = '',
  consentAccepted = false,
  consentAcceptedAt = '',
  consentVersion = '',
}: BookingNotificationAdminProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `${roomTitle} – ${customerName}`,
    date: bookingDate,
    time: bookingTime,
    description: `Paid booking\nCustomer: ${customerName}\nEmail: ${customerEmail}\nRoom: ${roomTitle}\nTotal: ${amountFormatted}${tier ? `\nTier: ${tier}` : ''}${equipment ? `\nEquipment: ${equipment}` : ''}`,
  })

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New booking: {customerName} — {roomTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎵 New Booking Received</Heading>
          <Text style={text}>
            <strong>{customerName}</strong> ({customerEmail}) just booked a paid session.
          </Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
          <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
          {customerPhone ? (
            <Text style={detail}>
              <strong>Phone:</strong>{' '}
              <a href={`tel:${customerPhone.replace(/[^\d+]/g, '')}`} style={telLink}>{customerPhone}</a>
            </Text>
          ) : null}
          {amountFormatted ? <Text style={detail}><strong>Total:</strong> {amountFormatted}</Text> : null}
          {tier ? <Text style={detail}><strong>Tier:</strong> {tier}</Text> : null}
          {equipment ? <Text style={detail}><strong>Equipment:</strong> {equipment}</Text> : null}
          {consentAccepted ? (
            <Text style={detail}>
              <strong>Terms accepted:</strong> ✅ {consentVersion || 'v1.0'}
              {consentAcceptedAt ? ` · ${consentAcceptedAt}` : ''}
            </Text>
          ) : null}
          <Hr style={hr} />
          <Button style={calBtn} href={calendarUrl}>
            📅 Add to Google Calendar
          </Button>
          <Hr style={hr} />
          <Text style={footer}>This is an automated notification from {SITE_NAME}.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BookingNotificationAdminEmail,
  subject: (data: Record<string, any>) => `New booking: ${data.customerName || 'Customer'} — ${data.roomTitle || 'Session'}`,
  to: 'replayclubrecords@gmail.com',
  displayName: 'Booking notification (admin)',
  previewData: {
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '(555) 555-1234',
    roomTitle: 'DJ Session',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
    amountFormatted: '$150.00',
    tier: 'Performance',
    equipment: 'XDJ-AZ, Ableton Push',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const calBtn = {
  backgroundColor: '#1a73e8',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }
const telLink = { color: '#1a73e8', textDecoration: 'underline' as const }
