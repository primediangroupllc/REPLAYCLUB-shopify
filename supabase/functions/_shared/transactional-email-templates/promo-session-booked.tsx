import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = "Replay Club"

interface PromoSessionBookedProps {
  customerName?: string
  customerEmail?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  layout?: string
  lighting?: string
}

const formatStyle = (s?: string) =>
  s ? s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''

const PromoSessionBookedEmail = ({
  customerName = 'A customer',
  customerEmail = '',
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  layout = '',
  lighting = '',
}: PromoSessionBookedProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `Promo Session – ${customerName} (${roomTitle})`,
    date: bookingDate,
    time: bookingTime,
    description: `Free promo session\nCustomer: ${customerName}\nEmail: ${customerEmail}\nRoom: ${roomTitle}\nDuration: 1.5 hours`,
  })

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New promo session booked at {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 New Promo Session Booked</Heading>
          <Text style={text}>
            <strong>{customerName}</strong> ({customerEmail}) just redeemed a promo code and booked a free session.
          </Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
          <Text style={detail}><strong>Time:</strong> {bookingTime} (1.5 hours)</Text>
          {layout && <Text style={detail}><strong>Layout:</strong> {formatStyle(layout)}</Text>}
          {lighting && <Text style={detail}><strong>Lighting:</strong> {formatStyle(lighting)}</Text>}
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
  component: PromoSessionBookedEmail,
  subject: (data: Record<string, any>) => `New promo session booked – ${data.customerName || 'Customer'}`,
  to: 'replayclubrecords@gmail.com',
  displayName: 'Promo session booked (admin notification)',
  previewData: {
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    roomTitle: 'Studio A',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
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
