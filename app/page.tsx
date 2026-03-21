'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Event = {
  id: string
  name: string
  date: string
  time: string
  location: string
  notes: string
}

type Schedule = {
  id: string
  name: string
  is_private: boolean
  feed_token: string
  created_at: string
  events: Event[]
  subscribers: { id: string }[]
  expanded?: boolean
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) fetchSchedules()
  }, [user])

  async function fetchSchedules() {
    const { data } = await supabase
      .from('schedules')
      .select('*, events(*), subscribers(id)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setSchedules(data.map((s: Schedule) => ({ ...s, expanded: false })))
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSchedules([])
  }

  async function createSchedule() {
    const feedToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const { data } = await supabase
      .from('schedules')
      .insert({ name: 'New schedule', owner_id: user.id, owner_name: user.user_metadata?.full_name || user.email, is_private: false, feed_token: feedToken })
      .select()
      .single()
    if (data) router.push(`/schedule/${data.id}`)
  }

  function toggleExpand(id: string) {
    setSchedules(s => s.map(x => x.id === id ? { ...x, expanded: !x.expanded } : x))
  }

  function getShareUrl(s: Schedule) {
    const base = window.location.origin
    return s.is_private ? `${base}/s/${s.id}?t=${s.feed_token}` : `${base}/s/${s.id}`
  }

  function getFeedUrl(s: Schedule) {
    return `${window.location.origin}/api/feed/${s.feed_token}`
  }

  function copyLink(s: Schedule) {
    navigator.clipboard.writeText(getShareUrl(s))
    setCopiedId(s.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span style={{ color: '#6b7280' }}>Loading...</span>
    </div>
  )

  if (!user) return <LoginScreen onSignIn={signInWithGoogle} />

  return (
    <div>
      <header className="header">
        <a href="/" className="logo">sched<span>io</span></a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{user.email}</span>
          <button className="btn btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>My schedules</h1>
          <button className="btn btn-primary" onClick={createSchedule}>+ New schedule</button>
        </div>

        {schedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
            <p style={{ fontSize: '15px' }}>No schedules yet.</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Create one and share it with your team.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {schedules.map(s => (
              <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Schedule header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 1.25rem' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleExpand(s.id)}>
                    <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {s.name || 'Untitled schedule'}
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 400 }}>
                        {s.expanded ? '▲' : '▼'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span className={`badge ${s.is_private ? 'badge-gated' : 'badge-public'}`}>
                        {s.is_private ? 'Link-gated' : 'Public'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.events?.length ?? 0} events</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.subscribers?.length ?? 0} subscribers</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-sm" onClick={() => copyLink(s)}>
                      {copiedId === s.id ? '✓ Copied' : 'Copy link'}
                    </button>
                    <Link href={`/schedule/${s.id}`} className="btn btn-sm btn-primary">Edit</Link>
                  </div>
                </div>

                {/* Expanded events list */}
                {s.expanded && (
                  <div style={{ borderTop: '1px solid #e5e7eb' }}>
                    {s.events?.length === 0 && (
                      <div style={{ padding: '1rem 1.25rem', fontSize: '13px', color: '#6b7280' }}>
                        No events yet. Click Edit to add some.
                      </div>
                    )}
                    {(s.events ?? [])
                      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
                      .map((ev, i) => {
                        const d = ev.date ? new Date(ev.date + 'T12:00:00') : null
                        const mon = d ? d.toLocaleString('en-US', { month: 'short' }) : '—'
                        const day = d ? d.getDate() : '—'
                        const dateStr = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }) : ''
                        return (
                          <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '.75rem 1.25rem', borderBottom: i < s.events.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <div style={{ minWidth: '40px', textAlign: 'center', background: '#f9fafb', borderRadius: '6px', padding: '5px 6px', flexShrink: 0 }}>
                              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.05em', color: '#9ca3af' }}>{mon}</div>
                              <div style={{ fontSize: '18px', fontWeight: 600, lineHeight: 1.1 }}>{day}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: '14px' }}>{ev.name || 'Untitled event'}</div>
                              <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                {dateStr && <span>{dateStr}</span>}
                                {ev.time && <span>{fmtTime(ev.time)}</span>}
                                {ev.location && <span>📍 {ev.location}</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                    {/* Share links at bottom of expanded card */}
                    <div style={{ padding: '.75rem 1.25rem', background: '#f9fafb', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Share:</span>
                      <code style={{ fontSize: '11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '3px 8px', color: '#374151' }}>
                        {getShareUrl(s)}
                      </code>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>Feed:</span>
                      <code style={{ fontSize: '11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '3px 8px', color: '#374151' }}>
                        {getFeedUrl(s)}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
      <div>
        <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>sched<span style={{ color: '#1D9E75' }}>io</span></div>
        <p style={{ fontSize: '20px', fontWeight: 600, marginTop: '1rem' }}>Schedules that stay in sync.</p>
        <p style={{ color: '#6b7280', marginTop: '8px', maxWidth: '380px', lineHeight: 1.7 }}>
          Create a schedule, share a link. Subscribers get calendar sync and email updates — no app needed.
        </p>
      </div>
      <button onClick={onSignIn} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 22px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '420px', marginTop: '8px' }}>
        {[
          ['Live .ics feed', 'Auto-syncs to any calendar app'],
          ['Photo sharing', 'Attach photos to events'],
          ['Email notices', 'Alert subscribers on changes'],
        ].map(([title, desc]) => (
          <div key={title} style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#6b7280' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a', marginBottom: '4px' }}>{title}</div>
            {desc}
          </div>
        ))}
      </div>
    </div>
  )
}
