import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface BookingCancelledProps {
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
}

const BookingCancelledEmail = ({
  customerName,
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
}: BookingCancelledProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} booking has been cancelled</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
        <Heading style={h1}>Booking Cancelled</Heading>
        <Text style={text}>
          {customerName ? `Hey ${customerName},` : 'Hey,'} your booking has been successfully cancelled.
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
        <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
        <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
        <Hr style={hr} />
        <Text style={detail}>
          For refund inquiries, please contact us at <strong>replayclubrecords@gmail.com</strong>.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingCancelledEmail,
  subject: 'Your Replay Club booking has been cancelled',
  displayName: 'Booking cancellation confirmation',
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
const footer = { fontSize: '13px', color: '#888888', margin: '20px 0 0' }
