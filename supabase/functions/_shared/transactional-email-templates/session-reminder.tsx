import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface SessionReminderProps {
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
}

const SessionReminderEmail = ({
  customerName,
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
}: SessionReminderProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `Replay Club – ${roomTitle} Session`,
    date: bookingDate,
    time: bookingTime,
    description: `Session at Replay Club\nRoom: ${roomTitle}`,
  })

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} session is tomorrow!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
          <Heading style={h1}>Session Reminder ⏰</Heading>
          <Text style={text}>
            {customerName ? `Hey ${customerName},` : 'Hey,'} just a reminder that your session is coming up tomorrow!
          </Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
          <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
          <Hr style={hr} />
          <Button style={calBtn} href={calendarUrl}>
            📅 Add to Google Calendar
          </Button>
          <Hr style={hr} />
          <Text style={subheading}>📍 Pickup Point</Text>
          <Text style={detail}>Meet your escort here — they'll walk you to the studio.</Text>
          <Text style={detail}><strong>14521 Friar St</strong></Text>
          <Text style={detail}>Van Nuys, CA 91411</Text>
          <Button href="https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411" style={mapsButton}>
            📍 Open in Google Maps
          </Button>
          <Hr style={hr} />
          <Text style={subheading}>⚠️ Quick Reminders</Text>
          <Text style={detail}>• Park at or near the pickup point and reply to this email or text the studio number to let us know you've arrived.</Text>
          <Text style={detail}>• An escort will meet you within a few minutes and walk you to the studio entrance.</Text>
          <Text style={detail}>• Please do not share the pickup point or studio location publicly — address confidentiality is part of our entry terms.</Text>
          <Text style={detail}>• Bring a valid photo ID matching the name on your booking.</Text>
          <Hr style={hr} />
          <Text style={footer}>See you tomorrow! — The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SessionReminderEmail,
  subject: (data: Record<string, any>) => `Reminder: Your ${data.roomTitle || 'session'} is tomorrow!`,
  displayName: 'Session reminder (24h before)',
  previewData: {
    customerName: 'Jane',
    roomTitle: 'DJ Session',
    bookingDate: '2024-02-15',
    bookingTime: '3:00 PM',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
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
