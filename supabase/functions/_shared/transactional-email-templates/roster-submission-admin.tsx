import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Replay Club"
const ADMIN_DASHBOARD_URL = "https://www.replayclub.io/admin/dashboard"

interface RosterSubmissionAdminProps {
  djName?: string
  genre?: string
  city?: string
  instagram?: string
  soundcloud?: string
  spotify?: string
  mixLink?: string
  bio?: string
  hasPressPhoto?: boolean
  hasLogo?: boolean
}

const RosterSubmissionAdminEmail = ({
  djName = 'Unknown DJ',
  genre = '',
  city = '',
  instagram = '',
  soundcloud = '',
  spotify = '',
  mixLink = '',
  bio = '',
  hasPressPhoto = false,
  hasLogo = false,
}: RosterSubmissionAdminProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New roster submission: {djName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🎧 New Talent Submission</Heading>
        <Text style={text}>
          A new DJ has submitted their application to join the {SITE_NAME} roster.
        </Text>
        <Hr style={hr} />
        <Text style={detail}><strong>DJ Name:</strong> {djName}</Text>
        {genre ? <Text style={detail}><strong>Genre:</strong> {genre}</Text> : null}
        {city ? <Text style={detail}><strong>City:</strong> {city}</Text> : null}
        {bio ? (
          <>
            <Hr style={hr} />
            <Text style={detail}><strong>Bio:</strong></Text>
            <Text style={bioText}>{bio}</Text>
          </>
        ) : null}
        <Hr style={hr} />
        <Text style={sectionTitle}>Socials & Links</Text>
        {instagram ? <Text style={detail}>Instagram: <Link href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`} style={link}>{instagram}</Link></Text> : null}
        {soundcloud ? <Text style={detail}>SoundCloud: <Link href={soundcloud} style={link}>{soundcloud}</Link></Text> : null}
        {spotify ? <Text style={detail}>Spotify: <Link href={spotify} style={link}>{spotify}</Link></Text> : null}
        {mixLink ? <Text style={detail}>Mix Link: <Link href={mixLink} style={link}>{mixLink}</Link></Text> : null}
        <Hr style={hr} />
        <Text style={detail}>
          <strong>Attachments:</strong>{' '}
          {hasPressPhoto || hasLogo
            ? [hasPressPhoto ? 'Press photo ✓' : null, hasLogo ? 'Logo ✓' : null]
                .filter(Boolean)
                .join('   ·   ')
            : 'None'}
        </Text>
        <Text style={detail}>
          Press photo and logo are private files — open the submission in the
          dashboard to view them.
        </Text>
        <Hr style={hr} />
        <Text style={detail}>
          <Link href={ADMIN_DASHBOARD_URL} style={link}>
            View full submission in the Admin Dashboard →
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>This is an automated notification from {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RosterSubmissionAdminEmail,
  subject: (data: Record<string, any>) => `New roster submission: ${data.djName || 'Unknown DJ'}`,
  to: 'replayclubrecords@gmail.com',
  displayName: 'Roster submission (admin)',
  previewData: {
    djName: 'DJ NOVA',
    genre: 'House / Tech House',
    city: 'Miami, FL',
    instagram: '@djnova',
    soundcloud: 'https://soundcloud.com/djnova',
    spotify: 'https://open.spotify.com/artist/example',
    mixLink: 'https://soundcloud.com/djnova/summer-set',
    bio: 'Miami-based DJ blending deep house with tech house grooves.',
    hasPressPhoto: true,
    hasLogo: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detail = { fontSize: '14px', color: '#333333', lineHeight: '1.5', margin: '0 0 6px' }
const sectionTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' }
const bioText = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '4px 0 0', fontStyle: 'italic' as const }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const link = { color: '#1a73e8', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }
