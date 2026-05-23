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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  redirectTo?: string
  tokenHash?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  redirectTo,
  tokenHash,
}: RecoveryEmailProps) => {
  const recoveryUrl = buildRecoveryUrl({ confirmationUrl, redirectTo, tokenHash })

  return (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your Replay Club password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Replay Club" width="180" style={logo} />
        </Section>
        <Section style={content}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            We received a request to reset your Replay Club password. Click the button below to choose a new password.
          </Text>
          <Button style={button} href={recoveryUrl}>
            Reset Password
          </Button>
          <Text style={smallText}>
            If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>© {new Date().getFullYear()} Replay Club</Text>
        </Section>
      </Container>
    </Body>
  </Html>
  )
}

export default RecoveryEmail

// Canonical reset destination — always points to the production custom domain
// so the recovery link works regardless of which environment requested it.
const CANONICAL_RESET_URL = 'https://www.replayclub.io/reset-password'

function buildRecoveryUrl({
  confirmationUrl,
  redirectTo,
  tokenHash,
}: Pick<RecoveryEmailProps, 'confirmationUrl' | 'redirectTo' | 'tokenHash'>) {
  try {
    const fallbackUrl = new URL(confirmationUrl)
    const resolvedTokenHash =
      tokenHash ??
      fallbackUrl.searchParams.get('token_hash') ??
      fallbackUrl.searchParams.get('token')

    if (!resolvedTokenHash) return confirmationUrl

    const url = new URL(CANONICAL_RESET_URL)
    url.searchParams.set('token_hash', resolvedTokenHash)
    url.searchParams.set('type', 'recovery')
    return url.toString()
  } catch {
    return confirmationUrl
  }
}


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
