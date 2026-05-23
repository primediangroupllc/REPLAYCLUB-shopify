import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Img, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface IdVerificationResultProps {
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  status?: 'approved' | 'rejected'
  reason?: string
}

const IdVerificationResultEmail = ({
  customerName,
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  status = 'approved',
  reason,
}: IdVerificationResultProps) => {
  const isApproved = status === 'approved'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isApproved
          ? `Your ID has been verified for your ${SITE_NAME} session`
          : `Action required: ID verification for your ${SITE_NAME} session`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
          <Heading style={h1}>
            {isApproved ? '✅ ID Verified' : '⚠️ ID Verification Issue'}
          </Heading>
          <Text style={text}>
            {customerName ? `Hey ${customerName},` : 'Hey,'}
            {isApproved
              ? ' your identity has been verified. You\'re all set for your upcoming session!'
              : ' we were unable to verify your ID for your upcoming session. Please contact us to resolve this before your session.'}
          </Text>
          <Hr style={hr} />
          <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
          <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
          <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
          {!isApproved && reason && (
            <>
              <Hr style={hr} />
              <Text style={detail}><strong>Reason:</strong> {reason}</Text>
            </>
          )}
          <Hr style={hr} />
          {!isApproved && (
            <Text style={detail}>
              Please contact us at <strong>replayclubrecords@gmail.com</strong> to resolve this issue before your session.
            </Text>
          )}
          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: IdVerificationResultEmail,
  subject: (data: Record<string, any>) =>
    data.status === 'approved'
      ? 'Your ID has been verified — Replay Club'
      : 'Action required: ID verification — Replay Club',
  displayName: 'ID verification result',
  previewData: {
    customerName: 'Jane',
    roomTitle: 'DJ Studio',
    bookingDate: '2024-02-15',
    bookingTime: '2:00 PM',
    status: 'approved',
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
