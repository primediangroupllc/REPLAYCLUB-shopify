import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Img, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface BookingVerificationCodeProps {
  code?: string
}

const BookingVerificationCodeEmail = ({ code = '0000000' }: BookingVerificationCodeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} booking verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="180" style={logo} />
        </Section>
        <Section style={content}>
          <Heading style={h1}>Verification Code</Heading>
          <Text style={text}>
            Use this code to verify your booking at {SITE_NAME}. It expires in 10 minutes.
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>
          <Text style={smallText}>
            If you didn't request this code, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>© {new Date().getFullYear()} {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingVerificationCodeEmail,
  subject: `Your ${SITE_NAME} verification code`,
  displayName: 'Booking verification code',
  previewData: { code: '4829173' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', borderRadius: '12px 12px 0 0', padding: '32px 40px', textAlign: 'center' as const }
const logo = { display: 'block', margin: '0 auto' }
const content = { padding: '40px', borderLeft: '1px solid #e5e5e5', borderRight: '1px solid #e5e5e5' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 25px' }
const codeBox = { backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px', textAlign: 'center' as const, margin: '0 0 25px' }
const codeText = { fontSize: '32px', fontWeight: 'bold' as const, color: '#0a0a0a', letterSpacing: '8px', fontFamily: "'Space Grotesk', monospace", margin: '0' }
const smallText = { fontSize: '12px', color: '#999999', margin: '0' }
const footerSection = { backgroundColor: '#0a0a0a', borderRadius: '0 0 12px 12px', padding: '20px 40px', textAlign: 'center' as const }
const footerBrand = { fontSize: '12px', color: '#555555', margin: '0' }
