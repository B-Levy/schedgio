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
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Schedule[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeNav, setActiveNav] = useState<'schedules' | 'search' | 'discover'>('schedules')

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

  async function searchSchedules() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setHasSearched(true)
    const { data } = await supabase
      .from('schedules')
      .select('*, events(*), subscribers(id)')
      .eq('is_private', false)
      .ilike('name', `%${searchQuery}%`)
      .limit(20)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  function toggleExpand(id: string) {
    setSchedules(s => s.map(x => x.id === id ? { ...x, expanded: !x.expanded } : x))
  }

  function getShareUrl(s: Schedule) {
    return `${window.location.origin}/s/${s.id}`
  }

  function getFeedUrl(s: Schedule) {
    return `${window.location.origin}/api/feed/${s.feed_token}`
  }

  function copyShareLink(s: Schedule) {
    navigator.clipboard.writeText(getShareUrl(s))
    setCopiedId(s.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function copyFeedLink(s: Schedule) {
    navigator.clipboard.writeText(getFeedUrl(s))
    setCopiedFeedId(s.id)
    setTimeout(() => setCopiedFeedId(null), 2000)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span style={{ color: '#6b7280' }}>Loading...</span>
    </div>
  )

  if (!user) return <LoginScreen onSignIn={signInWithGoogle} />

  const sidebarItems = [
    { key: 'schedules', label: 'My Schedules', icon: '📅' },
    { key: 'search', label: 'Search', icon: '🔍' },
    { key: 'discover', label: 'Discover', icon: '🌎' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb' }}>

      {/* Top header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '52px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, zIndex: 10 }}>
        <a href="/" style={{ fontSize: '20px', fontWeight: 700, textDecoration: 'none', color: '#1a1a1a', letterSpacing: '-0.5px' }}>
          sched<span style={{ color: '#1D9E75' }}>gio</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{user.email}</span>
          <button onClick={signOut} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px' }}>Sign out</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left sidebar */}
        <aside style={{ width: '220px', background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '1rem 0' }}>
          {sidebarItems.map(item => (
            <button key={item.key}
              onClick={() => setActiveNav(item.key as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 1.25rem', border: 'none', background: activeNav === item.key ? '#f0fdf4' : 'transparent',
                cursor: 'pointer', fontSize: '14px', fontWeight: activeNav === item.key ? 700 : 400, letterSpacing: activeNav === item.key ? '-0.3px' : 'normal',
                color: activeNav === item.key ? '#1D9E75' : '#374151',
                borderLeft: `3px solid ${activeNav === item.key ? '#1D9E75' : 'transparent'}`,
                textAlign: 'left', transition: 'all .15s'
              }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}


        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>

          {/* MY SCHEDULES */}
          {activeNav === 'schedules' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700 }}>My Schedules</h1>
                <button onClick={createSchedule}
                  style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  + New schedule
                </button>
              </div>
              {schedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280', background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  <p style={{ fontSize: '15px', marginBottom: '8px' }}>No schedules yet.</p>
                  <p style={{ fontSize: '13px' }}>Click "+ New schedule" to get started.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {schedules.map(s => (
                    <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>

                      {/* Schedule header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '.9rem 1.1rem' }}>
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleExpand(s.id)}>
                          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {s.name || 'Untitled schedule'}
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>{s.expanded ? '▲' : '▼'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: s.is_private ? '#FAEEDA' : '#E1F5EE', color: s.is_private ? '#633806' : '#085041' }}>
                              {s.is_private ? 'Link-gated' : 'Public'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.events?.length ?? 0} events · {s.subscribers?.length ?? 0} subscribers</span>
                          </div>
                        </div>
                        <Link href={`/schedule/${s.id}`}
                          style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                          Edit
                        </Link>
                      </div>

                      {/* Expanded events */}
                      {s.expanded && (
                        <div style={{ borderTop: '1px solid #f3f4f6' }}>
                          {s.events?.length === 0 && (
                            <div style={{ padding: '1rem 1.1rem', fontSize: '13px', color: '#9ca3af' }}>No upcoming events.</div>
                          )}
                          {(s.events ?? [])
                            .filter(ev => {
                              if (!ev.date) return false
                              const today = new Date(); today.setHours(0,0,0,0)
                              return new Date(ev.date + 'T12:00:00') >= today
                            })
                            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
                            .slice(0, 10)
                            .map((ev, i) => {
                              const d = ev.date ? new Date(ev.date + 'T12:00:00') : null
                              const mon = d ? d.toLocaleString('en-US', { month: 'short' }) : '—'
                              const day = d ? d.getDate() : '—'
                              const dateStr = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
                              return (
                                <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '.6rem 1.1rem', borderBottom: '1px solid #f9fafb' }}>
                                  <div style={{ minWidth: '36px', textAlign: 'center', background: '#f9fafb', borderRadius: '6px', padding: '4px 6px', flexShrink: 0 }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af' }}>{mon}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.1 }}>{day}</div>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{ev.name || 'Untitled'}</div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '8px', marginTop: '1px' }}>
                                      {dateStr && <span>{dateStr}</span>}
                                      {ev.time && <span>{fmtTime(ev.time)}</span>}
                                      {ev.location && <span>📍 {ev.location}</span>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          {(() => {
                            const tod = new Date(); tod.setHours(0,0,0,0)
                            const fc = (s.events ?? []).filter(ev => ev.date && new Date(ev.date + 'T12:00:00') >= tod).length
                            return fc > 10 ? (
                              <div style={{ padding: '.6rem 1.1rem', fontSize: '12px', color: '#9ca3af', borderBottom: '1px solid #f9fafb' }}>
                                + {fc - 10} more upcoming — click Edit to see all
                              </div>
                            ) : null
                          })()}
                          {/* Past events in grey */}
                          {(s.events ?? [])
                            .filter(ev => {
                              if (!ev.date) return false
                              const tod = new Date(); tod.setHours(0,0,0,0)
                              return new Date(ev.date + 'T12:00:00') < tod
                            })
                            .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
                            .map((ev, i, arr) => {
                              const d = ev.date ? new Date(ev.date + 'T12:00:00') : null
                              const mon = d ? d.toLocaleString('en-US', { month: 'short' }) : '—'
                              const day = d ? d.getDate() : '—'
                              const dateStr = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
                              return (
                                <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '.6rem 1.1rem', borderBottom: i < arr.length - 1 ? '1px solid #f9fafb' : 'none', opacity: 0.45 }}>
                                  {i === 0 && (
                                    <div style={{ position: 'absolute', left: 0, right: 0, borderTop: '1px dashed #e5e7eb', marginTop: '-1px' }} />
                                  )}
                                  <div style={{ minWidth: '36px', textAlign: 'center', background: '#f3f4f6', borderRadius: '6px', padding: '4px 6px', flexShrink: 0 }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af' }}>{mon}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.1, color: '#9ca3af' }}>{day}</div>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, fontSize: '13px', color: '#9ca3af' }}>{ev.name || 'Untitled'}</div>
                                    <div style={{ fontSize: '11px', color: '#d1d5db', display: 'flex', gap: '8px', marginTop: '1px' }}>
                                      {dateStr && <span>{dateStr}</span>}
                                      {ev.location && <span>📍 {ev.location}</span>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          }

                          {/* Share links */}
                          <div style={{ padding: '.75rem 1.1rem', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', width: '70px', flexShrink: 0 }}>Share link</span>
                              <code style={{ flex: 1, fontSize: '11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px 8px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getShareUrl(s)}
                              </code>
                              <button onClick={() => copyShareLink(s)}
                                style={{ flexShrink: 0, fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500, color: copiedId === s.id ? '#1D9E75' : '#374151' }}>
                                {copiedId === s.id ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', width: '70px', flexShrink: 0 }}>Cal feed</span>
                              <code style={{ flex: 1, fontSize: '11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px 8px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getFeedUrl(s)}
                              </code>
                              <button onClick={() => copyFeedLink(s)}
                                style={{ flexShrink: 0, fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500, color: copiedFeedId === s.id ? '#1D9E75' : '#374151' }}>
                                {copiedFeedId === s.id ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SEARCH */}
          {activeNav === 'search' && (
            <div style={{ maxWidth: '700px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Search public schedules</h1>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1.25rem' }}>Find public schedules you can subscribe to — no login required to view.</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchSchedules()}
                  placeholder="Search by schedule name..."
                  style={{ flex: 1, padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                  autoFocus
                />
                <button onClick={searchSchedules} disabled={searching}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  {searching ? '...' : 'Search'}
                </button>
              </div>

              {hasSearched && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  No public schedules found for "{searchQuery}"
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {searchResults.map(s => (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '3px' }}>{s.name}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{s.events?.length ?? 0} events · {s.subscribers?.length ?? 0} subscribers</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={`/s/${s.id}`} target="_blank" rel="noopener"
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', fontSize: '12px', textDecoration: 'none', color: '#374151', fontWeight: 500 }}>
                        View
                      </a>
                      <a href={`/s/${s.id}`} target="_blank" rel="noopener"
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#1D9E75', fontSize: '12px', textDecoration: 'none', color: '#fff', fontWeight: 600 }}>
                        Subscribe →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DISCOVER */}
          {activeNav === 'discover' && (
            <div style={{ maxWidth: '700px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Discover</h1>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1.5rem' }}>Local events and community schedules you can subscribe to.</p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌎</div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#374151', marginBottom: '6px' }}>Coming soon</div>
                <p style={{ fontSize: '13px', lineHeight: 1.7 }}>
                  We're building a discovery feed of local events and public community schedules.<br />
                  For now, use Search to find public schedules by name.
                </p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Schedule[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  async function searchSchedules() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setHasSearched(true)
    const { data } = await supabase
      .from('schedules')
      .select('*, events(*), subscribers(id)')
      .eq('is_private', false)
      .ilike('name', `%${searchQuery}%`)
      .limit(20)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f9fafb' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '52px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <a href="/" style={{ fontSize: '20px', fontWeight: 700, textDecoration: 'none', color: '#1a1a1a', letterSpacing: '-0.5px' }}>
          sched<span style={{ color: '#1D9E75' }}>gio</span>
        </a>
        <button onClick={onSignIn}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '7px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>

        {/* Left — hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.15, marginBottom: '1rem' }}>
            Schedules that<br /><span style={{ color: '#1D9E75' }}>stay in sync.</span>
          </h1>
          <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '380px', lineHeight: 1.7, marginBottom: '2rem' }}>
            Create a schedule, share a link. Subscribers get automatic calendar updates — no app needed.
          </p>
          <button onClick={onSignIn}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderRadius: '9px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Get started with Google
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '420px', marginTop: '2.5rem' }}>
            {[['📅', 'Live calendar feed', 'Auto-syncs to Google & Apple Calendar'], ['📸', 'Photo sharing', 'Attach photos to events'], ['🔔', 'Notifications', 'Email subscribers on changes']].map(([icon, title, desc]) => (
              <div key={title as string} style={{ background: '#fff', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#6b7280', border: '1px solid #e5e7eb', textAlign: 'left' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a', marginBottom: '3px' }}>{title as string}</div>
                {desc as string}
              </div>
            ))}
          </div>
        </div>

        {/* Right — search (no login required) */}
        <div style={{ width: '420px', background: '#fff', borderLeft: '1px solid #e5e7eb', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Find a schedule</h2>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>Search public schedules — no login needed.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchSchedules()}
              placeholder="e.g. Little League, Book Club..."
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
              autoFocus
            />
            <button onClick={searchSchedules} disabled={searching}
              style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {hasSearched && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
              No public schedules found for "{searchQuery}"
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {searchResults.map(s => (
              <div key={s.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{s.events?.length ?? 0} events</div>
                </div>
                <a href={`/s/${s.id}`} target="_blank" rel="noopener"
                  style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#1D9E75', fontSize: '12px', textDecoration: 'none', color: '#fff', fontWeight: 600 }}>
                  View →
                </a>
              </div>
            ))}
          </div>

          {!hasSearched && (
            <div style={{ marginTop: 'auto', padding: '1.5rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.7 }}>
                Want to <strong>create</strong> your own schedules?<br />Sign in with Google — it's free.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
