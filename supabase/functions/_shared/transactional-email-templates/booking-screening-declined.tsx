/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Replay Club'
const LOGO_URL = 'https://ynpkkoqzenmctqrmtnxs.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface Props {
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  reason?: string
  reapplyUrl?: string
}

const BookingScreeningDeclinedEmail = ({
  customerName,
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  reason,
  reapplyUrl = 'https://www.replayclub.io',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your {SITE_NAME} booking request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
        <Heading style={h1}>Unable to accommodate this request</Heading>
        <Text style={text}>
          {customerName ? `Hi ${customerName},` : 'Hi,'} thanks for your interest in {SITE_NAME}.
        </Text>
        <Text style={text}>
          After reviewing your request, we&rsquo;re unable to accommodate this particular session.
          {reason ? ` ${reason}` : ''} Any payment authorization for this request has been released
          and you have not been charged.
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>Requested room:</strong> {roomTitle}</Text>
        <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
        <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
        <Hr style={hr} />
        <Text style={text}>
          You&rsquo;re welcome to submit a new request for a different date or service at{' '}
          <a href={reapplyUrl} style={link}>{reapplyUrl}</a>.
        </Text>
        <Text style={text}>
          For questions, reach us at <strong>replayclubrecords@gmail.com</strong>.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingScreeningDeclinedEmail,
  subject: 'Update on your Replay Club booking request',
  displayName: 'Booking screening declined',
  previewData: {
    customerName: 'Alex',
    roomTitle: 'DJ Session',
    bookingDate: '2025-05-12',
    bookingTime: '7:00 PM',
    reason: 'We were unable to confirm availability in time.',
    reapplyUrl: 'https://www.replayclub.io',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const link = { color: '#111111', textDecoration: 'underline' }
const footer = { fontSize: '13px', color: '#888888', margin: '20px 0 0' }