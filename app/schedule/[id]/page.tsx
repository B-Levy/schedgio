'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PLACE_SUGGESTIONS = [
  'Fenway Park, Boston, MA',
  'Gillette Stadium, Foxborough, MA',
  'TD Garden, Boston, MA',
  'Harvard Stadium, Cambridge, MA',
  'Polar Park, Worcester, MA',
  'Memorial Field, Dedham, MA',
  'Dedham Community Theater',
  'Legacy Place, Dedham, MA',
  'Patriot Place, Foxborough, MA',
]

type Event = {
  id?: string
  name: string
  date: string
  time: string
  location: string
  notes: string
  sequence: number
  photos: string[]
}

type Schedule = {
  id: string
  name: string
  is_private: boolean
  feed_token: string
  owner_id: string
  subscribers: { id: string; email: string }[]
}

export default function ScheduleEditor() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showNotify, setShowNotify] = useState(false)
  const [notifySent, setNotifySent] = useState(false)
  const [locSug, setLocSug] = useState<{ idx: number; results: string[] } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { loadSchedule() }, [id])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  async function loadSchedule() {
    const { data: sched } = await supabase
      .from('schedules')
      .select('*, subscribers(id, email)')
      .eq('id', id)
      .single()
    if (!sched) { router.push('/'); return }
    setSchedule(sched)

    const { data: evs } = await supabase
      .from('events')
      .select('*')
      .eq('schedule_id', id)
      .order('created_at', { ascending: true })
    setEvents((evs ?? []).map(e => ({ ...e, photos: e.photos ?? [] })))
    setDirty(false)
  }

  async function saveAll() {
    if (!schedule) return
    setSaving(true)

    // Save schedule name and privacy
    await supabase
      .from('schedules')
      .update({ name: schedule.name, is_private: schedule.is_private })
      .eq('id', id)

    // Save each event — update if has id, insert if new
    const updatedEvents = [...events]
    for (let i = 0; i < updatedEvents.length; i++) {
      const ev = updatedEvents[i]
      const payload = {
        name: ev.name,
        date: ev.date || null,
        time: ev.time || null,
        location: ev.location,
        notes: ev.notes,
        sequence: (ev.sequence ?? 0) + 1,
        photos: ev.photos,
        schedule_id: id
      }
      if (ev.id) {
        await supabase.from('events').update(payload).eq('id', ev.id)
      } else {
        const { data } = await supabase.from('events').insert(payload).select().single()
        if (data) updatedEvents[i] = { ...ev, id: data.id }
      }
    }
    setEvents(updatedEvents)
    setSaving(false)
    setSaved(true)
    setDirty(false)
    setTimeout(() => setSaved(false), 2500)
  }

  function updateSchedule(patch: Partial<Schedule>) {
    setSchedule(s => s ? { ...s, ...patch } : s)
    setDirty(true)
  }

  function updateEvent(idx: number, patch: Partial<Event>) {
    setEvents(evs => evs.map((e, i) => i === idx ? { ...e, ...patch } : e))
    setDirty(true)
  }

  function addEvent() {
    setEvents(evs => [...evs, { name: '', date: '', time: '', location: '', notes: '', sequence: 0, photos: [] }])
    setDirty(true)
  }

  async function removeEvent(idx: number) {
    const ev = events[idx]
    if (ev.id) await supabase.from('events').delete().eq('id', ev.id)
    setEvents(evs => evs.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function handleLocInput(idx: number, val: string) {
    updateEvent(idx, { location: val })
    if (val.length < 2) { setLocSug(null); return }
    const results = PLACE_SUGGESTIONS.filter(p => p.toLowerCase().includes(val.toLowerCase())).slice(0, 5)
    setLocSug(results.length ? { idx, results } : null)
  }

  function pickLocation(idx: number, val: string) {
    updateEvent(idx, { location: val })
    setLocSug(null)
  }

  function addPhotoPlaceholder(idx: number) {
    const colors = ['#E1F5EE', '#E6F1FB', '#FAEEDA', '#FBEAF0']
    const c = colors[Math.floor(Math.random() * colors.length)]
    const ph = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='${encodeURIComponent(c)}'/><text x='40' y='48' text-anchor='middle' font-size='28'>📷</text></svg>`
    updateEvent(idx, { photos: [...(events[idx].photos ?? []), ph] })
  }

  async function sendNotifications(selectedEmails: string[]) {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId: id,
        scheduleName: schedule?.name,
        emails: selectedEmails,
        shareUrl: `${window.location.origin}/s/${id}`
      })
    })
    setNotifySent(true)
    setTimeout(() => { setShowNotify(false); setNotifySent(false) }, 2500)
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const shareUrl = schedule
    ? (schedule.is_private
      ? `${window.location.origin}/s/${id}?t=${schedule.feed_token}`
      : `${window.location.origin}/s/${id}`)
    : ''
  const feedUrl = schedule ? `${window.location.origin}/api/feed/${schedule.feed_token}` : ''

  if (!schedule) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>

  return (
    <div>
      <header className="header">
        <a href="/" className="logo">sched<span>io</span></a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {saved ? '✓ Saved' : dirty ? 'Unsaved changes' : ''}
          </span>
          <button
            className={`btn btn-sm ${dirty ? 'btn-primary' : ''}`}
            onClick={saveAll}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-sm" style={{ background: '#1D9E75', color: '#fff', borderColor: '#1D9E75' }}
            onClick={() => { setShowShare(s => !s) }}>
            Share
          </button>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
          <button className="btn btn-sm" onClick={() => router.push('/')}>← Back</button>
          <input
            style={{ flex: 1, fontSize: '22px', fontWeight: 600, border: 'none', outline: 'none', borderBottom: '2px solid transparent', transition: 'border-color .15s', padding: '4px 0' }}
            onFocus={e => (e.target.style.borderBottomColor = '#1D9E75')}
            onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
            value={schedule.name}
            placeholder="Schedule name..."
            onChange={e => updateSchedule({ name: e.target.value })}
          />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', background: '#f9fafb', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <span>
              <span style={{ fontWeight: 500 }}>Privacy:</span>{' '}
              <span style={{ color: schedule.is_private ? '#633806' : '#085041' }}>
                {schedule.is_private ? 'Link-gated' : 'Public'}
              </span>
            </span>
            <div
              onClick={() => updateSchedule({ is_private: !schedule.is_private })}
              style={{ width: '32px', height: '18px', borderRadius: '9px', background: schedule.is_private ? '#1D9E75' : '#e5e7eb', position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: '3px', left: schedule.is_private ? '15px' : '3px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
          </label>
          <button className="btn btn-sm" onClick={addEvent}>+ Add event</button>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280' }}>
            {schedule.subscribers?.length ?? 0} subscriber{schedule.subscribers?.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Events table */}
        <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Event', 'Date', 'Time', 'Location', 'Notes', 'Photos', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 4px', minWidth: '160px' }}>
                    <input style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px', padding: '4px', background: 'transparent' }}
                      value={ev.name} placeholder="Event name"
                      onChange={e => updateEvent(i, { name: e.target.value })} />
                  </td>
                  <td style={{ padding: '6px 4px', minWidth: '130px' }}>
                    <input type="date" style={{ border: 'none', outline: 'none', fontSize: '13px', padding: '4px', background: 'transparent' }}
                      value={ev.date} onChange={e => updateEvent(i, { date: e.target.value })} />
                  </td>
                  <td style={{ padding: '6px 4px', minWidth: '90px' }}>
                    <input type="time" style={{ border: 'none', outline: 'none', fontSize: '13px', padding: '4px', background: 'transparent' }}
                      value={ev.time} onChange={e => updateEvent(i, { time: e.target.value })} />
                  </td>
                  <td style={{ padding: '6px 4px', minWidth: '180px', position: 'relative' }}>
                    <input style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px', padding: '4px', background: 'transparent' }}
                      value={ev.location} placeholder="Location"
                      onChange={e => handleLocInput(i, e.target.value)}
                      onBlur={() => setTimeout(() => setLocSug(null), 200)} />
                    {locSug?.idx === i && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                        {locSug.results.map(r => (
                          <div key={r} onMouseDown={() => pickLocation(i, r)}
                            style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>{r}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 4px', minWidth: '110px' }}>
                    <input style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px', padding: '4px', background: 'transparent' }}
                      value={ev.notes} placeholder="Notes"
                      onChange={e => updateEvent(i, { notes: e.target.value })} />
                  </td>
                  <td style={{ padding: '6px 4px', minWidth: '90px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {(ev.photos ?? []).map((p, pi) => (
                        <img key={pi} src={p} alt="" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                      ))}
                      <button onClick={() => addPhotoPlaceholder(i)}
                        style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px dashed #e5e7eb', background: 'transparent', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>+</button>
                    </div>
                  </td>
                  <td style={{ padding: '6px 4px' }}>
                    <button className="btn btn-sm btn-danger" onClick={() => removeEvent(i)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', fontSize: '13px' }}>
              No events yet — click "+ Add event" to start.
            </div>
          )}
        </div>

        {/* Save button prominent at bottom */}
        {dirty && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save changes'}
            </button>
          </div>
        )}

        {/* Share panel */}
        {showShare && (
          <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Section title="Share link — send this to your team">
              <CopyRow label={shareUrl} onCopy={() => copy(shareUrl, 'share')} copied={copied === 'share'} />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                {schedule.is_private ? 'Only people with this exact link can view.' : 'Anyone can view with this link.'}
              </p>
            </Section>

            <Section title="Calendar feed — for auto-updates">
              <CopyRow label={feedUrl} onCopy={() => copy(feedUrl, 'feed')} copied={copied === 'feed'} />
              <div style={{ marginTop: '10px', background: '#f9fafb', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#6b7280', lineHeight: 1.8 }}>
                <strong style={{ fontWeight: 600 }}>Google Calendar:</strong> Other calendars → + → From URL → paste<br />
                <strong style={{ fontWeight: 600 }}>Apple Calendar:</strong> File → New Calendar Subscription → paste
              </div>
            </Section>

            <Section title="Notify subscribers">
              {(schedule.subscribers?.length ?? 0) === 0 ? (
                <p style={{ fontSize: '13px', color: '#6b7280' }}>No subscribers yet. Share the link to get subscribers.</p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>{schedule.subscribers.length} subscriber{schedule.subscribers.length !== 1 ? 's' : ''} will receive an email.</p>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowNotify(true)}>Send notice</button>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Notify modal */}
        {showNotify && (
          <NotifyModal
            subscribers={schedule.subscribers}
            scheduleName={schedule.name}
            onSend={sendNotifications}
            onClose={() => setShowNotify(false)}
            sent={notifySent}
          />
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6b7280', marginBottom: '8px' }}>{title}</div>
      {children}
    </div>
  )
}

function CopyRow({ label, onCopy, copied }: { label: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{label}</div>
      <button className="btn btn-sm" onClick={onCopy}>{copied ? '✓ Copied' : 'Copy'}</button>
    </div>
  )
}

function NotifyModal({ subscribers, scheduleName, onSend, onClose, sent }: {
  subscribers: { id: string; email: string }[]
  scheduleName: string
  onSend: (emails: string[]) => void
  onClose: () => void
  sent: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(subscribers.map(s => s.email)))
  const toggle = (email: string) => setSelected(s => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', margin: '1rem' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>Notices sent!</div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>Notify subscribers</div>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1rem' }}>Select who should receive an email about "{scheduleName}".</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.25rem', maxHeight: '200px', overflowY: 'auto' }}>
              {subscribers.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f9fafb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={selected.has(s.email)} onChange={() => toggle(s.email)} style={{ accentColor: '#1D9E75', width: '14px', height: '14px' }} />
                  {s.email}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={() => onSend(Array.from(selected))}>Send emails</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
