import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = "Replay Club"

interface RescheduleNotificationAdminProps {
  customerName?: string
  customerEmail?: string
  roomTitle?: string
  oldDate?: string
  oldTime?: string
  newDate?: string
  newTime?: string
}

const RescheduleNotificationAdminEmail = ({
  customerName = 'A customer',
  customerEmail = '',
  roomTitle = '',
  oldDate = '',
  oldTime = '',
  newDate = '',
  newTime = '',
}: RescheduleNotificationAdminProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `${roomTitle} – ${customerName} (Rescheduled)`,
    date: newDate,
    time: newTime,
    description: `Rescheduled booking\nCustomer: ${customerName}\nEmail: ${customerEmail}\nRoom: ${roomTitle}\nPrevious: ${oldDate} at ${oldTime}`,
  })

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Booking rescheduled: {customerName} — {roomTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🔄 Booking Rescheduled</Heading>
          <Text style={text}>
            <strong>{customerName}</strong> ({customerEmail}) rescheduled their session.
          </Text>
          <Hr style={hr} />
          <Text style={oldDetail}>Previous: {oldDate} at {oldTime}</Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>New Date:</strong> {newDate}</Text>
          <Text style={detail}><strong>New Time:</strong> {newTime}</Text>
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
  component: RescheduleNotificationAdminEmail,
  subject: (data: Record<string, any>) => `Booking rescheduled: ${data.customerName || 'Customer'} — ${data.roomTitle || 'Session'}`,
  to: 'replayclubrecords@gmail.com',
  displayName: 'Reschedule notification (admin)',
  previewData: {
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    roomTitle: 'Studio A',
    oldDate: '2024-02-10',
    oldTime: '3:00 PM',
    newDate: '2024-02-15',
    newTime: '2:30 PM',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const oldDetail = { fontSize: '14px', color: '#999999', lineHeight: '1.5', margin: '0 0 6px', textDecoration: 'line-through' as const }
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
