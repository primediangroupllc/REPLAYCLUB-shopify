import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface EventLiveNotificationProps {
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  roomTitle?: string
  eventUrl?: string
}

const EventLiveNotificationEmail = ({
  eventTitle = '',
  eventDate = '',
  eventTime = '',
  roomTitle = '',
  eventUrl = 'https://www.replayclub.io/events',
}: EventLiveNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{eventTitle ? `${eventTitle} is live — secure your ticket` : 'The event you waited for is live'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
        <Heading style={h1}>It's Live 🎉</Heading>
        <Text style={text}>
          You asked us to let you know — <strong>{eventTitle || 'the event'}</strong> just went live at {SITE_NAME}.
        </Text>
        <Hr style={hr} />
        {eventTitle && <Text style={detail}><strong>Event:</strong> {eventTitle}</Text>}
        {eventDate && <Text style={detail}><strong>Date:</strong> {eventDate}</Text>}
        {eventTime && <Text style={detail}><strong>Time:</strong> {eventTime}</Text>}
        {roomTitle && <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>}
        <Hr style={hr} />
        <Text style={text}>
          Spots are limited — secure your ticket before they're gone.
        </Text>
        <Button href={eventUrl} style={ctaButton}>
          Secure Your Ticket
        </Button>
        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventLiveNotificationEmail,
  subject: (data: Record<string, any>) =>
    data?.eventTitle ? `${data.eventTitle} is live — secure your ticket` : 'An event you waited for is live',
  displayName: 'Event live notification',
  previewData: {
    eventTitle: 'Late Night Listening Session',
    eventDate: 'Saturday, July 12, 2026',
    eventTime: '9:00 PM',
    roomTitle: 'Studio A',
    eventUrl: 'https://www.replayclub.io/events',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const footer = { fontSize: '13px', color: '#888888', margin: '20px 0 0' }
const ctaButton = { backgroundColor: '#111111', color: '#ffffff', padding: '12px 28px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block', margin: '0 0 8px' }
