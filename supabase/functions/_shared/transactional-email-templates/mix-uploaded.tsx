import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const LOGO_URL = 'https://airoizwnopiaawshpksx.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface MixUploadedProps {
  displayName?: string
  mixTitle?: string
  mixDescription?: string
  profileUrl?: string
}

const MixUploadedEmail = ({
  displayName,
  mixTitle = 'Your Mix',
  mixDescription,
  profileUrl = '',
}: MixUploadedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your recorded mix "{mixTitle}" is ready to listen on {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="120" height="40" style={logo} />
        <Heading style={h1}>Your Mix Is Ready 🎧</Heading>
        <Text style={text}>
          {displayName ? `Hey ${displayName},` : 'Hey,'} great news — your recorded session has been uploaded and is ready to listen!
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>Title:</strong> {mixTitle}</Text>
        {mixDescription && (
          <Text style={detail}><strong>Notes:</strong> {mixDescription}</Text>
        )}
        <Hr style={hr} />
        {profileUrl && (
          <Button style={button} href={profileUrl}>
            LISTEN NOW
          </Button>
        )}
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MixUploadedEmail,
  subject: (data: Record<string, any>) =>
    `Your mix "${data.mixTitle || 'recording'}" is ready — Replay Club`,
  displayName: 'Mix uploaded notification',
  previewData: {
    displayName: 'Jane',
    mixTitle: 'Friday Night Session',
    mixDescription: 'Live set recorded at Studio A',
    profileUrl: 'https://replayclub.io/profile',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const button = {
  backgroundColor: '#111111',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
  margin: '0 0 20px',
}
const footer = { fontSize: '13px', color: '#888888', margin: '20px 0 0' }
