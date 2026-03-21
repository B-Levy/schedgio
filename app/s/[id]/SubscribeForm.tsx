'use client'
import { useState } from 'react'

export default function SubscribeForm({ scheduleId, feedToken }: { scheduleId: string, feedToken: string }) {
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // webcal:// triggers native "Subscribe to Calendar" prompt on iPhone/Android
  const webcalUrl = typeof window !== 'undefined'
    ? `webcal://${window.location.host}/api/feed/${feedToken}`
    : ''

  async function subscribeEmail() {
    if (!email.trim()) return
    setStatus('loading')
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, email }),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Primary action — webcal subscribe */}
      <a href={webcalUrl}
        style={{
          display: 'block', textAlign: 'center', padding: '12px 20px',
          background: '#1D9E75', color: '#fff', borderRadius: '8px',
          textDecoration: 'none', fontWeight: 600, fontSize: '15px'
        }}>
        Subscribe to Calendar
      </a>
      <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
        Opens your calendar app — tap Subscribe to get automatic updates
      </p>

      {/* Secondary — email notifications */}
      {!showEmail && (
        <button
          onClick={() => setShowEmail(true)}
          style={{ background: 'none', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          Also get email notifications when events change
        </button>
      )}

      {showEmail && status !== 'done' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && subscribeEmail()}
            style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={subscribeEmail}
            disabled={status === 'loading'}
            style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            {status === 'loading' ? '...' : 'Add'}
          </button>
        </div>
      )}

      {status === 'done' && (
        <div style={{ fontSize: '13px', color: '#1D9E75', fontWeight: 500 }}>
          ✓ You'll get an email when this schedule is updated.
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: '12px', color: '#dc2626' }}>Something went wrong — try again.</div>
      )}
    </div>
  )
}
