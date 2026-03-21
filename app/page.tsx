'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Schedule = {
  id: string
  name: string
  is_private: boolean
  feed_token: string
  created_at: string
  events: { id: string }[]
  subscribers: { id: string }[]
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

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
      .select('*, events(id), subscribers(id)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setSchedules(data as Schedule[])
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/` }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSchedules([])
  }

  async function createSchedule() {
    const feedToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const { data, error } = await supabase
      .from('schedules')
      .insert({ name: 'New schedule', owner_id: user.id, is_private: false, feed_token: feedToken })
      .select()
      .single()
    if (data) router.push(`/schedule/${data.id}`)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span className="text-muted">Loading...</span>
    </div>
  )

  if (!user) return <LoginScreen onSignIn={signInWithGoogle} />

  return (
    <div>
      <header className="header">
        <a href="/" className="logo">sched<span>io</span></a>
        <div className="flex items-center gap-3">
          <span className="text-muted">{user.email}</span>
          <button className="btn btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>My schedules</h1>
          <button className="btn btn-primary" onClick={createSchedule}>+ New schedule</button>
        </div>

        {schedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '15px' }}>No schedules yet.</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Create one and share it with your team.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schedules.map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{s.name || 'Untitled schedule'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${s.is_private ? 'badge-gated' : 'badge-public'}`}>
                      {s.is_private ? 'Link-gated' : 'Public'}
                    </span>
                    <span className="text-muted">{s.events?.length ?? 0} events</span>
                    <span className="text-muted">{s.subscribers?.length ?? 0} subscribers</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/s/${s.id}`} className="btn btn-sm" target="_blank">Preview</Link>
                  <Link href={`/schedule/${s.id}`} className="btn btn-sm btn-primary">Edit</Link>
                </div>
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
        <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>sched<span style={{ color: 'var(--green)' }}>io</span></div>
        <p style={{ fontSize: '20px', fontWeight: 600, marginTop: '1rem' }}>Schedules that stay in sync.</p>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '380px', lineHeight: 1.7 }}>
          Create a schedule, share a link. Subscribers get calendar sync and email updates — no app needed.
        </p>
      </div>
      <button onClick={onSignIn} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 22px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
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
          <div key={title} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>{title}</div>
            {desc}
          </div>
        ))}
      </div>
    </div>
  )
}
