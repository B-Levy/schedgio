'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { googleCalUrl, CalEvent } from '@/lib/ics'
import SubscribeForm from './SubscribeForm'

type Schedule = {
  id: string
  name: string
  is_private: boolean
  feed_token: string
  owner_name: string
  events: CalEvent[]
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function SharedView() {
  const { id } = useParams<{ id: string }>()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('schedules')
        .select('*, events(*)')
        .eq('id', id)
        .single()
      if (error || !data) {
        setError('Schedule not found or you do not have access.')
        return
      }
      const sorted = [...(data.events ?? [])].sort((a: CalEvent, b: CalEvent) =>
        (a.date ?? '').localeCompare(b.date ?? ''))
      setSchedule({ ...data, events: sorted })
    }
    load()
  }, [id])

  if (error) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Oops</div>
      <p>{error}</p>
    </div>
  )

  if (!schedule) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const feedUrl = `${siteUrl}/api/feed/${schedule.feed_token}`

  function copyFeed() {
    navigator.clipboard.writeText(feedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
        <a href="/" style={{ fontSize: '20px', fontWeight: 700, textDecoration: 'none', color: '#1a1a1a', letterSpacing: '-0.5px' }}>
          sched<span style={{ color: '#1D9E75' }}>io</span>
        </a>
      </header>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.25rem 3rem' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.5px', marginBottom: '4px' }}>
          {schedule.name || 'Untitled Schedule'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Organized by <strong style={{ fontWeight: 600 }}>{schedule.owner_name || 'unknown'}</strong>
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
            borderRadius: '20px', fontSize: '11px', fontWeight: 500,
            background: schedule.is_private ? '#FAEEDA' : '#E1F5EE',
            color: schedule.is_private ? '#633806' : '#085041'
          }}>
            {schedule.is_private ? 'Link-gated' : 'Public'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
          {schedule.events.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No events added yet.</p>
          )}
          {schedule.events.map((ev) => {
            const d = ev.date ? new Date(ev.date + 'T12:00:00') : null
            const mon = d ? d.toLocaleString('en-US', { month: 'short' }) : '—'
            const day = d ? d.getDate() : '—'
            const dateStr = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : ''
            const timeStr = ev.time ? fmtTime(ev.time) : ''
            const photos: string[] = (ev as any).photos ?? []
            return (
              <div key={ev.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '1rem 1.1rem' }}>
                  <div style={{ minWidth: '48px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', padding: '8px', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280' }}>{mon}</div>
                    <div style={{ fontSize: '22px', fontWeight: 600, lineHeight: 1.1 }}>{day}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '5px' }}>{ev.name || 'Untitled event'}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {dateStr && <span>{dateStr}</span>}
                      {timeStr && <span>{timeStr}</span>}
                      {ev.location && <span>📍 {ev.location}</span>}
                      {ev.notes && <span>{ev.notes}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a href={googleCalUrl(ev)} target="_blank" rel="noopener"
                        style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#1a1a1a' }}>
                        + Google Calendar
                      </a>
                      <a href={`/api/feed/${schedule.feed_token}?download=1`} download={`${ev.name || 'event'}.ics`}
                        style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#1a1a1a' }}>
                        + Apple / .ics
                      </a>
                    </div>
                  </div>
                </div>
                {photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', padding: '.75rem 1.1rem', borderTop: '1px solid #e5e7eb', overflowX: 'auto' }}>
                    {photos.map((p, pi) => (
                      <img key={pi} src={p} alt="" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <a href={`/api/feed/${schedule.feed_token}?download=1`}
              download={`${schedule.name || 'schedule'}.ics`}
              style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', textDecoration: 'none', color: '#1a1a1a', fontWeight: 500 }}>
              Download all events (.ics)
            </a>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1.1rem 1.25rem', border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Subscribe to this calendar</div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px', lineHeight: 1.6 }}>
              Add this URL to Google or Apple Calendar for automatic updates. Or enter your email to get notified when events change.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>
                {feedUrl}
              </div>
              <button onClick={copyFeed}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <SubscribeForm scheduleId={id} />
          </div>
        </div>
      </div>
    </div>
  )
}
