import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  company?: string
  message?: string
  submittedAt?: string
}

const DemoRequestEmail = ({
  name = 'Unknown',
  email = 'unknown@example.com',
  company = 'Unknown',
  message,
  submittedAt,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Brand Grenade demo request from {name} ({company})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Demo Request</Heading>
        <Text style={intro}>
          Someone has requested a Brand Grenade demo via the website.
        </Text>

        <Section style={card}>
          <Text style={row}><strong>Name:</strong> {name}</Text>
          <Text style={row}><strong>Email:</strong> {email}</Text>
          <Text style={row}><strong>Company:</strong> {company}</Text>
          {submittedAt ? (
            <Text style={row}><strong>Submitted:</strong> {submittedAt}</Text>
          ) : null}
        </Section>

        {message ? (
          <>
            <Hr style={hr} />
            <Text style={label}>Message</Text>
            <Text style={messageStyle}>{message}</Text>
          </>
        ) : null}

        <Hr style={hr} />
        <Text style={foot}>Brand Grenade — Strategic Territory Intelligence Engine</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DemoRequestEmail,
  subject: (d: Record<string, any>) =>
    `New Brand Grenade demo request — ${d.name || 'unknown'} (${d.company || 'unknown'})`,
  displayName: 'Demo Request Notification',
  to: 'adrian@brandgrenade.com.au',
  previewData: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    company: 'Acme Co',
    message: 'Interested in seeing the platform.',
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#EDE8E0', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0A0908' }
const intro = { fontSize: '14px', color: '#1C1A18', margin: '0 0 20px' }
const card = {
  backgroundColor: '#f7f7f7',
  padding: '16px 20px',
  borderRadius: '6px',
}
const row = { fontSize: '14px', color: '#0A0908', margin: '4px 0' }
const label = { fontSize: '12px', color: '#8B8680', textTransform: 'uppercase' as const, margin: '16px 0 4px', letterSpacing: '0.05em' }
const messageStyle = { fontSize: '14px', color: '#0A0908', whiteSpace: 'pre-wrap' as const, margin: 0 }
const hr = { borderColor: '#EDE8E0', margin: '24px 0' }
const foot = { fontSize: '11px', color: '#8B8680', margin: 0 }
