import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Img, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface WaitlistSpotOpenProps {
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  bookingUrl?: string
}

const WaitlistSpotOpenEmail = ({
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  bookingUrl = 'https://www.replayclub.io',
}: WaitlistSpotOpenProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A spot just opened up at {SITE_NAME}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
        <Heading style={h1}>A Spot Just Opened Up! 🎉</Heading>
        <Text style={text}>
          Great news — a time slot you were waiting for is now available.
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
        <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
        <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
        <Hr style={hr} />
        <Text style={text}>
          Book now before someone else grabs it!
        </Text>
        <Button href={bookingUrl} style={bookButton}>
          Book Now
        </Button>
        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WaitlistSpotOpenEmail,
  subject: 'A spot just opened up at Replay Club!',
  displayName: 'Waitlist spot available notification',
  previewData: {
    roomTitle: 'Studio A',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
    bookingUrl: 'https://www.replayclub.io',
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
const bookButton = { backgroundColor: '#111111', color: '#ffffff', padding: '12px 28px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block', margin: '0 0 8px' }
