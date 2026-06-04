import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Img, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface BookingRescheduledProps {
  customerName?: string
  roomTitle?: string
  oldDate?: string
  oldTime?: string
  newDate?: string
  newTime?: string
}

const BookingRescheduledEmail = ({
  customerName,
  roomTitle = '',
  oldDate = '',
  oldTime = '',
  newDate = '',
  newTime = '',
}: BookingRescheduledProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `Replay Club – ${roomTitle} Session`,
    date: newDate,
    time: newTime,
    description: `Rescheduled session at Replay Club\nRoom: ${roomTitle}\nPrevious: ${oldDate} at ${oldTime}`,
  })

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} session has been rescheduled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
          <Heading style={h1}>Session Rescheduled ✅</Heading>
          <Text style={text}>
            {customerName ? `Hey ${customerName},` : 'Hey,'} your session has been successfully rescheduled.
          </Text>
          <Hr style={hr} />
          <Text style={subheading}>Previous Schedule</Text>
          <Text style={oldDetail}>📅 {oldDate} at {oldTime}</Text>
          <Hr style={hr} />
          <Text style={subheading}>New Schedule</Text>
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {newDate}</Text>
          <Text style={detail}><strong>Time:</strong> {newTime}</Text>
          <Hr style={hr} />
          <Button style={calBtn} href={calendarUrl}>
            📅 Add to Google Calendar
          </Button>
          <Hr style={hr} />
          <Text style={subheading}>📍 Pickup Point</Text>
          <Text style={detail}>Meet your escort here — they'll walk you to the studio.</Text>
          <Text style={detail}><strong>14521 Friar St</strong>, Van Nuys, CA 91411</Text>
          <Button href="https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411" style={mapsButton}>
            📍 Open in Google Maps
          </Button>
          <Text style={detail}>When you arrive, reply to this email or text the studio number — your escort will meet you within a few minutes.</Text>
          <Hr style={hr} />
          <Text style={footer}>See you there! — The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BookingRescheduledEmail,
  subject: 'Your Replay Club session has been rescheduled',
  displayName: 'Booking reschedule confirmation',
  previewData: {
    customerName: 'Jane',
    roomTitle: 'Studio A',
    oldDate: '2024-02-10',
    oldTime: '3:00 PM',
    newDate: '2024-02-15',
    newTime: '2:30 PM',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const oldDetail = { fontSize: '14px', color: '#999999', lineHeight: '1.5', margin: '0 0 6px', textDecoration: 'line-through' as const }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const subheading = { fontSize: '15px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 8px' }
const footer = { fontSize: '13px', color: '#888888', margin: '20px 0 0' }
const mapsButton = { backgroundColor: '#111111', color: '#ffffff', padding: '10px 20px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' as const, margin: '12px 0 0' }
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
