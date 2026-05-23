import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Img, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'
const BOOKING_URL = 'https://www.replayclub.io'

interface PostSessionFollowupProps {
  customerName?: string
  roomTitle?: string
  bookingDate?: string
  referralCode?: string
}

const PostSessionFollowupEmail = ({
  customerName = 'there',
  roomTitle = 'your session',
  bookingDate = '',
  referralCode = '',
}: PostSessionFollowupProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for your session at {SITE_NAME}! Book again &amp; save.</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="180" style={logo} />
        </Section>

        <Heading style={h1}>Thanks for coming in, {customerName}! 🎶</Heading>

        <Text style={text}>
          We hope you had an amazing {roomTitle} session{bookingDate ? ` on ${bookingDate}` : ''}. 
          The studio loved having you — and we'd love to see you back.
        </Text>

        <Hr style={hr} />

        {/* Rebook CTA */}
        <Heading as="h2" style={h2}>Ready for another session?</Heading>
        <Text style={text}>
          Book your next session and keep the momentum going. Same studio, same vibe, new fire.
        </Text>

        <Section style={ctaSection}>
          <Button style={ctaButton} href={BOOKING_URL}>
            Book Again →
          </Button>
        </Section>

        <Hr style={hr} />

        {/* Referral */}
        {referralCode ? (
          <>
            <Heading as="h2" style={h2}>Share the love, earn credits 🎁</Heading>
            <Text style={text}>
              Refer a friend and you'll both get <strong>$10 off</strong> your next booking.
              Share your personal referral code:
            </Text>
            <Section style={codeSection}>
              <Text style={codeText}>{referralCode}</Text>
            </Section>
            <Text style={smallText}>
              Your friend enters this code when booking. Once they complete a session, you both earn the credit.
            </Text>
            <Hr style={hr} />
          </>
        ) : null}

        {/* Social */}
        <Text style={text}>
          Got a mix or content from your session? Tag us <strong>@replayclub</strong> — we love sharing our community's work.
        </Text>

        <Text style={footer}>
          See you next time! 🔊<br />
          The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PostSessionFollowupEmail,
  subject: (data: Record<string, any>) =>
    `Thanks for your session${data.customerName ? `, ${data.customerName}` : ''}! Book again & save`,
  displayName: 'Post-session follow-up',
  previewData: {
    customerName: 'Alex',
    roomTitle: 'DJ Session',
    bookingDate: 'January 15, 2024',
    referralCode: 'ALEX1234',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '560px', margin: '0 auto' }
const header = {
  backgroundColor: '#0a0a0a',
  padding: '32px 40px',
  textAlign: 'center' as const,
  borderRadius: '12px 12px 0 0',
}
const logo = { display: 'block' as const, margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '32px 25px 16px', padding: '0' }
const h2 = { fontSize: '17px', fontWeight: 'bold' as const, color: '#111111', margin: '0 25px 10px', padding: '0' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 25px 16px' }
const smallText = { fontSize: '13px', color: '#666666', lineHeight: '1.5', margin: '0 25px 16px' }
const hr = { borderColor: '#e5e5e5', margin: '24px 25px' }
const ctaSection = { textAlign: 'center' as const, margin: '0 25px 8px' }
const ctaButton = {
  backgroundColor: '#111111',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const codeSection = {
  backgroundColor: '#f4f4f4',
  borderRadius: '8px',
  padding: '16px 24px',
  textAlign: 'center' as const,
  margin: '0 25px 12px',
}
const codeText = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#111111',
  letterSpacing: '3px',
  margin: '0',
}
const footer = { fontSize: '13px', color: '#999999', margin: '8px 25px 32px', lineHeight: '1.5' }
