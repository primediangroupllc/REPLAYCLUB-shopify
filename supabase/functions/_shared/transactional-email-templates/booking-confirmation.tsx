import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { buildGoogleCalendarUrl } from './calendar-utils.ts'

const SITE_NAME = 'Replay Club'
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface BookingConfirmationProps {
  bookingId?: string
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  amountFormatted?: string
  tier?: string
  layout?: string
  lighting?: string
  sound?: string
  equipment?: string
}

const formatStyle = (s?: string) =>
  s ? s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''

const BookingConfirmationEmail = ({
  bookingId = '',
  customerName,
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  amountFormatted = '',
  tier = '',
  layout = '',
  lighting = '',
  sound = '',
  equipment = '',
}: BookingConfirmationProps) => {
  const calendarUrl = buildGoogleCalendarUrl({
    title: `Replay Club – ${roomTitle} Session`,
    date: bookingDate,
    time: bookingTime,
    description: `Session at Replay Club\nRoom: ${roomTitle}\nTotal: ${amountFormatted}`,
  })
  const qrUrl = bookingId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(`replayclub:checkin:${bookingId}`)}`
    : ''

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Booking confirmed — {roomTitle} on {bookingDate} at {bookingTime}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
          <Heading style={h1}>Booking Confirmed ✅</Heading>
          <Text style={text}>
            {customerName ? `Hey ${customerName},` : 'Hey,'} your session is locked in. Here are the details:
          </Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
          <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
          {amountFormatted && <Text style={detail}><strong>Total:</strong> {amountFormatted}</Text>}
          {tier && <Text style={detail}><strong>Tier:</strong> {tier}</Text>}
          {layout && <Text style={detail}><strong>Layout:</strong> {formatStyle(layout)}</Text>}
          {lighting && <Text style={detail}><strong>Lighting:</strong> {formatStyle(lighting)}</Text>}
          {sound && <Text style={detail}><strong>Sound:</strong> {formatStyle(sound)}</Text>}
          {equipment && <Text style={detail}><strong>Equipment:</strong> {equipment}</Text>}
          {qrUrl && (
            <>
              <Hr style={hr} />
              <Text style={subheading}>Check-In QR</Text>
              <Img src={qrUrl} alt="Check-in QR" width="220" height="220" style={qr} />
              <Text style={small}>Show this QR at the studio entrance — staff will scan you in.</Text>
            </>
          )}
          <Hr style={hr} />
          <Button style={calBtn} href={calendarUrl}>📅 Add to Google Calendar</Button>
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
          <Text style={footer}>See you at the studio! 🎶 — The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BookingConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `✅ Booking Confirmed — ${data?.roomTitle ?? 'your session'}`,
  displayName: 'Booking confirmation (customer)',
  previewData: {
    bookingId: '00000000-0000-0000-0000-000000000000',
    customerName: 'Jane',
    roomTitle: 'Studio A',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
    amountFormatted: '$120.00',
    tier: 'Standard',
    equipment: 'XDJ-AZ, CDJ-3000',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const small = { fontSize: '12px', color: '#888888', margin: '8px 0 0' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const subheading = { fontSize: '15px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 8px' }
const qr = { display: 'block' as const, margin: '8px 0', background: '#ffffff', padding: '12px', borderRadius: '8px' }
const footer = { fontSize: '13px', color: '#888888', margin: '20px 0 0' }
const mapsButton = { backgroundColor: '#111111', color: '#ffffff', padding: '10px 20px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' as const, margin: '12px 0 0' }
const calBtn = { backgroundColor: '#1a73e8', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' as const }
