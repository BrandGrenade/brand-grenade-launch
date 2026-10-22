import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const DemoRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  company: z.string().trim().min(1).max(160),
  message: z.string().trim().max(2000).optional().nullable(),
})

export type DemoRequestInput = z.infer<typeof DemoRequestSchema>

export const submitDemoRequest = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => DemoRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { getRequestIP } = await import('@tanstack/react-start/server')

    // 0. Basic per-IP rate limit: 5 submissions per hour (IP stored only as a hash).
    const ip = getRequestIP({ xForwardedFor: true }) || 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip.trim()))
    const ipHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await supabaseAdmin
      .from('demo_request_rate')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gt('created_at', since)
    if ((count ?? 0) >= 5) throw new Error('Too many requests. Please try again later.')
    await supabaseAdmin.from('demo_request_rate').insert({ ip_hash: ipHash })

    // 1. Persist first — never lose a lead.
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('demo_requests')
      .insert({
        name: data.name,
        email: data.email,
        company: data.company,
        message: data.message || null,
      })
      .select('id, created_at')
      .single()

    if (insertError || !inserted) {
      console.error('demo_requests insert failed', insertError)
      throw new Error('Could not save your request. Please try again.')
    }

    // 2. Best-effort notification email via internal helper (auth-free).
    try {
      const { sendDemoRequestNotification } = await import('./demo-request.server')
      await sendDemoRequestNotification({
        id: inserted.id,
        name: data.name,
        email: data.email,
        company: data.company,
        message: data.message ?? undefined,
        submittedAt: inserted.created_at,
      })
      await supabaseAdmin
        .from('demo_requests')
        .update({ email_sent: true })
        .eq('id', inserted.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('demo request notification email failed', msg)
      await supabaseAdmin
        .from('demo_requests')
        .update({ email_sent: false, email_error: msg.slice(0, 500) })
        .eq('id', inserted.id)
      // Don't fail the user submission because of email failure.
    }

    return { ok: true, id: inserted.id }
  })
