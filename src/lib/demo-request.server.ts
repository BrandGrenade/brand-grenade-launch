import * as React from 'react'
import { render } from '@react-email/render'
import { template as demoRequestTemplate } from './email-templates/demo-request'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const SITE_NAME = 'Brand Grenade'
const SENDER_DOMAIN = 'notify.brandgrenade.app'
const FROM_DOMAIN = 'notify.brandgrenade.app'
const RECIPIENT = demoRequestTemplate.to || 'adrian@brandgrenade.com.au'

export interface DemoRequestNotificationInput {
  id: string
  name: string
  email: string
  company: string
  message?: string
  submittedAt: string
}

/**
 * Renders and enqueues the demo-request notification email.
 * Runs unauthenticated (called from a public form) — uses supabaseAdmin
 * directly and bypasses the auth-gated /lovable/email/transactional/send route.
 */
export async function sendDemoRequestNotification(input: DemoRequestNotificationInput) {
  const messageId = crypto.randomUUID()
  const idempotencyKey = `demo-request-${input.id}`
  const normalizedRecipient = RECIPIENT.toLowerCase()

  // Get-or-create a persistent unsubscribe token for the recipient.
  // Lovable's transactional email API requires one on every send.
  let unsubscribeToken: string
  const { data: existing } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedRecipient)
    .maybeSingle()

  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token
  } else {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    unsubscribeToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: normalizedRecipient }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedRecipient)
      .maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token
  }

  const element = React.createElement(demoRequestTemplate.component, {
    name: input.name,
    email: input.email,
    company: input.company,
    message: input.message,
    submittedAt: input.submittedAt,
  })
  const html = await render(element)
  const text = await render(element, { plainText: true })

  const subject =
    typeof demoRequestTemplate.subject === 'function'
      ? demoRequestTemplate.subject({ name: input.name, company: input.company })
      : demoRequestTemplate.subject

  // Log pending first, so we always have a record.
  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'demo-request',
    recipient_email: RECIPIENT,
    status: 'pending',
  })

  const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: RECIPIENT,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      reply_to: input.email,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: 'demo-request',
      idempotency_key: idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'demo-request',
      recipient_email: RECIPIENT,
      status: 'failed',
      error_message: `Failed to enqueue: ${enqueueError.message}`,
    })
    throw new Error(`Failed to enqueue notification: ${enqueueError.message}`)
  }

  return { messageId }
}
