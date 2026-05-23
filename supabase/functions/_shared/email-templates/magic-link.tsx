/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Replay Club login link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Replay Club" width="180" style={logo} />
        </Section>
        <Section style={content}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>
            Click the button below to log in to Replay Club. This link will expire shortly.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Log In
          </Button>
          <Text style={smallText}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>© {new Date().getFullYear()} Replay Club</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', borderRadius: '12px 12px 0 0', padding: '32px 40px', textAlign: 'center' as const }
const logo = { display: 'block', margin: '0 auto' }
const content = { padding: '40px', borderLeft: '1px solid #e5e5e5', borderRight: '1px solid #e5e5e5' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 25px' }
const button = { backgroundColor: '#0a0a0a', color: '#f2f2f2', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '14px 24px', textDecoration: 'none', textTransform: 'uppercase' as const, letterSpacing: '1.5px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const smallText = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const footerSection = { backgroundColor: '#0a0a0a', borderRadius: '0 0 12px 12px', padding: '20px 40px', textAlign: 'center' as const }
const footerBrand = { fontSize: '12px', color: '#555555', margin: '0' }
