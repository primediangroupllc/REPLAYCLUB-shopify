/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Replay Club verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Replay Club" width="180" style={logo} />
        </Section>
        <Section style={content}>
          <Heading style={h1}>Verification code</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={smallText}>
            This code will expire shortly. If you didn't request this, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>© {new Date().getFullYear()} Replay Club</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', borderRadius: '12px 12px 0 0', padding: '32px 40px', textAlign: 'center' as const }
const logo = { display: 'block', margin: '0 auto' }
const content = { padding: '40px', borderLeft: '1px solid #e5e5e5', borderRight: '1px solid #e5e5e5' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 25px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 30px', letterSpacing: '4px' }
const smallText = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const footerSection = { backgroundColor: '#0a0a0a', borderRadius: '0 0 12px 12px', padding: '20px 40px', textAlign: 'center' as const }
const footerBrand = { fontSize: '12px', color: '#555555', margin: '0' }
