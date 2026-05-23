import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Img, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface PromoBookingConfirmationProps {
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  layout?: string
  lighting?: string
}

const formatStyle = (s?: string) =>
  s ? s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''

const PromoBookingConfirmationEmail = ({
  customerName,
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  layout = '',
  lighting = '',
}: PromoBookingConfirmationProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `Replay Club – ${roomTitle} Session`,
    date: bookingDate,
    time: bookingTime,
    description: `Free promo session at Replay Club\nRoom: ${roomTitle}\nDuration: 1.5 hours`,
  })

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to {SITE_NAME} — your free session is confirmed!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
          <Heading style={h1}>Welcome to Replay Club 🎶</Heading>
          <Text style={text}>
            {customerName ? `Hey ${customerName},` : 'Hey,'} your free promo session has been booked!
          </Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
          <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
          <Text style={detail}><strong>Duration:</strong> 1 hour 30 minutes</Text>
          {layout && <Text style={detail}><strong>Layout:</strong> {formatStyle(layout)}</Text>}
          {lighting && <Text style={detail}><strong>Lighting:</strong> {formatStyle(lighting)}</Text>}
          <Hr style={hr} />
          <Button style={calBtn} href={calendarUrl}>
            📅 Add to Google Calendar
          </Button>
          <Hr style={hr} />
          <Text style={subheading}>📍 Pickup Point</Text>
          <Text style={detail}>Replay Club is a private studio. Meet your escort at the pickup point below — they'll walk you to the studio entrance.</Text>
          <Text style={detail}><strong>14521 Friar St</strong></Text>
          <Text style={detail}>Van Nuys, CA 91411</Text>
          <Button href="https://www.google.com/maps/search/?api=1&query=14521+Friar+St+Van+Nuys+CA+91411" style={mapsButton}>
            📍 Open in Google Maps
          </Button>
          <Hr style={hr} />
          <Text style={subheading}>⚠️ Important Info</Text>
          <Text style={detail}>• When you arrive, reply to this email or text the studio number so we know you're here.</Text>
          <Text style={detail}>• An escort will meet you within a few minutes and walk you to the studio entrance.</Text>
          <Text style={detail}>• Please do not share the pickup point or studio location publicly — address confidentiality is part of our entry terms.</Text>
          <Text style={detail}>• <strong>Valid photo ID is required</strong> matching the name on your booking.</Text>
          <Text style={detail}>• Please arrive 5–10 minutes before your start time.</Text>
          <Hr style={hr} />
          <Text style={footer}>See you there! — The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PromoBookingConfirmationEmail,
  subject: 'Welcome to Replay Club — your free session is confirmed!',
  displayName: 'Promo booking confirmation (customer)',
  previewData: {
    customerName: 'Jane',
    roomTitle: 'Studio A',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
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
