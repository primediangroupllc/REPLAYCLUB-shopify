import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"

interface RosterConfirmationProps {
  djName?: string
}

const RosterConfirmationEmail = ({ djName }: RosterConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We got your submission, {djName || 'DJ'}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks for applying{djName ? `, ${djName}` : ''}.</Heading>
        <Text style={text}>
          We've received your submission to join the {SITE_NAME} talent roster. Our team will review your mix, photos, and profile — if it's a fit, we'll reach out.
        </Text>
        <Hr style={hr} />
        <Text style={subtext}>
          In the meantime, keep creating. We're always watching.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RosterConfirmationEmail,
  subject: 'We got your submission',
  displayName: 'Roster submission confirmation',
  previewData: { djName: 'DJ NOVA' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const subtext = { fontSize: '14px', color: '#555555', lineHeight: '1.5', margin: '0 0 16px', fontStyle: 'italic' as const }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '20px 0 0' }
