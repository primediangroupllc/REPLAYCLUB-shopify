import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"

interface BookingFailureAdminProps {
  stage?: string
  errorMessage?: string
  route?: string
  service?: string
  bookingDate?: string
  bookingTime?: string
  customerName?: string
  customerEmail?: string
  stripeSessionId?: string
  bookingId?: string
  amountFormatted?: string
  userAgent?: string
  viewport?: string
  consoleLog?: string
  networkLog?: string
  occurredAt?: string
}

const BookingFailureAdminEmail = ({
  stage = 'unknown',
  errorMessage = '(no message)',
  route = '',
  service = '',
  bookingDate = '',
  bookingTime = '',
  customerName = '',
  customerEmail = '',
  stripeSessionId = '',
  bookingId = '',
  amountFormatted = '',
  userAgent = '',
  viewport = '',
  consoleLog = '',
  networkLog = '',
  occurredAt = '',
}: BookingFailureAdminProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Booking failure: {stage} — {errorMessage}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>⚠️ Booking Failure Report</Heading>
        <Text style={text}>
          A user could not complete checkout. Details below.
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>Stage:</strong> {stage}</Text>
        <Text style={detail}><strong>Error:</strong> {errorMessage}</Text>
        {occurredAt ? <Text style={detail}><strong>Time:</strong> {occurredAt}</Text> : null}
        <Hr style={hr} />
        <Heading style={h2}>Booking context</Heading>
        {service ? <Text style={detail}><strong>Service:</strong> {service}</Text> : null}
        {bookingDate ? <Text style={detail}><strong>Date:</strong> {bookingDate}</Text> : null}
        {bookingTime ? <Text style={detail}><strong>Time:</strong> {bookingTime}</Text> : null}
        {amountFormatted ? <Text style={detail}><strong>Amount:</strong> {amountFormatted}</Text> : null}
        {customerName ? <Text style={detail}><strong>Customer:</strong> {customerName}</Text> : null}
        {customerEmail ? <Text style={detail}><strong>Email:</strong> {customerEmail}</Text> : null}
        {stripeSessionId ? <Text style={detail}><strong>Stripe session:</strong> {stripeSessionId}</Text> : null}
        {bookingId ? <Text style={detail}><strong>Booking id:</strong> {bookingId}</Text> : null}
        <Hr style={hr} />
        <Heading style={h2}>Browser context</Heading>
        {route ? <Text style={detail}><strong>Route:</strong> {route}</Text> : null}
        {viewport ? <Text style={detail}><strong>Viewport:</strong> {viewport}</Text> : null}
        {userAgent ? <Text style={mono}><strong>UA:</strong> {userAgent}</Text> : null}
        {consoleLog ? (
          <>
            <Text style={detail}><strong>Recent console errors:</strong></Text>
            <Text style={pre}>{consoleLog}</Text>
          </>
        ) : null}
        {networkLog ? (
          <>
            <Text style={detail}><strong>Recent failed requests:</strong></Text>
            <Text style={pre}>{networkLog}</Text>
          </>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>Automated failure report from {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingFailureAdminEmail,
  subject: (data: Record<string, any>) =>
    `⚠️ Booking failure (${data.stage || 'unknown'}) — ${data.customerEmail || data.service || 'user'}`,
  to: 'replayclubrecords@gmail.com',
  displayName: 'Booking failure (admin)',
  previewData: {
    stage: 'create-booking-payment',
    errorMessage: 'Stripe session creation failed: amount must be at least $0.50',
    route: '/?modal=booking',
    service: 'DJ Session',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    stripeSessionId: '',
    bookingId: '',
    amountFormatted: '$150.00',
    userAgent: 'Mozilla/5.0 ...',
    viewport: '390x844',
    consoleLog: '[14:01:22] Error: failed to upload signature',
    networkLog: 'POST /functions/v1/create-booking-payment → 500',
    occurredAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#b91c1c', margin: '0 0 16px' }
const h2 = { fontSize: '15px', fontWeight: 'bold' as const, color: '#111111', margin: '16px 0 8px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const mono = { fontSize: '12px', color: '#555555', fontFamily: 'ui-monospace, Menlo, monospace', margin: '0 0 6px', wordBreak: 'break-all' as const }
const pre = { fontSize: '12px', color: '#1f2937', fontFamily: 'ui-monospace, Menlo, monospace', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap' as const, margin: '0 0 12px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }