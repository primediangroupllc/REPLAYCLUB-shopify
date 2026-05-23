import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"

interface PhotographerBookingAdminProps {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  roomTitle?: string
  bookingDate?: string
  bookingTime?: string
  packageName?: string
  addOns?: string
  amountFormatted?: string
}

const PhotographerBookingAdminEmail = ({
  customerName = 'A customer',
  customerEmail = '',
  customerPhone = '',
  roomTitle = '',
  bookingDate = '',
  bookingTime = '',
  packageName = '',
  addOns = '',
  amountFormatted = '',
}: PhotographerBookingAdminProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>📸 Photographer needed: {customerName} — {bookingDate}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📸 Photographer Booking — Schedule Shooter</Heading>
        <Text style={text}>
          A paid booking includes a <strong>{packageName || 'photographer package'}</strong>.
          Please assign and schedule a photographer.
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>Customer:</strong> {customerName}</Text>
        {customerEmail ? <Text style={detail}><strong>Email:</strong> {customerEmail}</Text> : null}
        {customerPhone ? <Text style={detail}><strong>Phone:</strong> {customerPhone}</Text> : null}
        <Text style={detail}><strong>Room:</strong> {roomTitle}</Text>
        <Text style={detail}><strong>Date:</strong> {bookingDate}</Text>
        <Text style={detail}><strong>Time:</strong> {bookingTime}</Text>
        <Text style={detail}><strong>Package:</strong> {packageName}</Text>
        {addOns ? <Text style={detail}><strong>Add-ons:</strong> {addOns}</Text> : null}
        {amountFormatted ? <Text style={detail}><strong>Total:</strong> {amountFormatted}</Text> : null}
        <Hr style={hr} />
        <Text style={footer}>Automated photographer alert from {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PhotographerBookingAdminEmail,
  subject: (data: Record<string, any>) =>
    `📸 Photographer booking: ${data.customerName || 'Customer'} — ${data.bookingDate || ''}`,
  to: 'replayclubrecords@gmail.com',
  displayName: 'Photographer booking (admin)',
  previewData: {
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '+1 555 123 4567',
    roomTitle: 'Photoshoot',
    bookingDate: '2024-02-15',
    bookingTime: '2:30 PM',
    packageName: 'Professional Photographer Package',
    addOns: 'Sony FX3, Pro Lighting Package',
    amountFormatted: '$595.00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }