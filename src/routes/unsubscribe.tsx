import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: 'Unsubscribe — Brand Grenade' },
      { name: 'description', content: 'Manage your email preferences for Brand Grenade notifications.' },
    ],
  }),
})

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; email: string }
  | { kind: 'already' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'success' }
  | { kind: 'error'; reason: string }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [submitting, setSubmitting] = useState(false)
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token') || ''
      : ''

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid', reason: 'Missing token.' })
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.already_unsubscribed) {
          setState({ kind: 'already' })
        } else if (res.ok && data.valid) {
          setState({ kind: 'ready', email: data.email || 'your address' })
        } else {
          setState({ kind: 'invalid', reason: data.error || 'Invalid or expired link.' })
        }

      } catch {
        setState({ kind: 'invalid', reason: 'Could not validate this link.' })
      }
    })()
  }, [token])

  async function confirm() {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) setState({ kind: 'success' })
      else {
        const data = await res.json().catch(() => ({}))
        setState({ kind: 'error', reason: data.error || 'Could not unsubscribe.' })
      }
    } catch {
      setState({ kind: 'error', reason: 'Network error. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-2 p-8">
        <h1 className="text-heading mb-4 text-text-primary">Email preferences</h1>
        {state.kind === 'loading' && <p className="text-body-sm text-text-secondary">Checking your link…</p>}
        {state.kind === 'ready' && (
          <>
            <p className="text-body-sm mb-6 text-text-secondary">
              Unsubscribe <strong className="text-text-primary">{state.email}</strong> from Brand Grenade notifications?
            </p>
            <button
              onClick={confirm}
              disabled={submitting}
              className="w-full rounded bg-primary px-4 py-2 text-text-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? 'Unsubscribing…' : 'Confirm unsubscribe'}
            </button>
          </>
        )}
        {state.kind === 'already' && <p className="text-body-sm text-text-secondary">You're already unsubscribed.</p>}
        {state.kind === 'success' && <p className="text-body-sm text-text-secondary">You've been unsubscribed. You won't receive further emails.</p>}
        {state.kind === 'invalid' && <p className="text-body-sm text-text-secondary">{state.reason}</p>}
        {state.kind === 'error' && <p className="text-body-sm text-text-secondary">{state.reason}</p>}
      </div>
    </main>
  )
}
