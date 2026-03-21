'use client'
import { useState } from 'react'

export default function SubscribeForm({ scheduleId }: { scheduleId: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function subscribe() {
    if (!email.trim()) return
    setStatus('loading')
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, email }),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  if (status === 'done') return (
    <div style={{ fontSize: '13px', color: '#1D9E75', fontWeight: 500 }}>
      ✓ Subscribed! You'll get an email when this schedule is updated.
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && subscribe()}
        style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
      />
      <button
        onClick={subscribe}
        disabled={status === 'loading'}
        style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
      >
        {status === 'loading' ? '...' : 'Subscribe'}
      </button>
      {status === 'error' && <span style={{ fontSize: '12px', color: '#dc2626', alignSelf: 'center' }}>Error — try again</span>}
    </div>
  )
}
