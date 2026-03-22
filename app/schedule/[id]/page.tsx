'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

const HOURS = ['12','1','2','3','4','5','6','7','8','9','10','11']
const MINUTES = ['00','15','30','45']

function parseTo12(t: string): { hour: string; minute: string; ampm: 'AM' | 'PM' } {
  if (!t) return { hour: '12', minute: '00', ampm: 'PM' }
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = String(h === 0 ? 12 : h > 12 ? h - 12 : h)
  const minute = String(m).padStart(2, '0')
  return { hour, minute, ampm }
}

function formatTo24(hour: string, minute: string, ampm: 'AM' | 'PM'): string {
  let h = parseInt(hour)
  if (ampm === 'AM' && h === 12) h = 0
  if (ampm === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2, '0')}:${minute}`
}

function fmtTime(t: string): string {
  if (!t) return ''
  const { hour, minute, ampm } = parseTo12(t)
  return `${hour}:${minute} ${ampm}`
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

type Attachment = {
  id?: string
  name: string
  url: string
  size?: number
  mime_type?: string
}

type Event = {
  id?: string
  name: string
  date: string
  time: string
  location: string
  notes: string
  sequence: number
  photos: string[]
  attachments?: Attachment[]
  _recurDates?: string[]
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
  const [dirty, setDirty] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showNotify, setShowNotify] = useState(false)
  const [notifySent, setNotifySent] = useState(false)
  const [locSug, setLocSug] = useState<{ idx: number; results: string[] } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [recurModal, setRecurModal] = useState<{ idx: number } | null>(null)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadForIdx = useRef<number | null>(null)

  useEffect(() => { loadSchedule() }, [id])

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
      .select('*, attachments(*)')
      .eq('schedule_id', id)
      .order('date', { ascending: true })
    setEvents((evs ?? []).map(e => ({ ...e, photos: e.photos ?? [], attachments: e.attachments ?? [] })))
    setDirty(false)
  }

  async function saveAll() {
    if (!schedule) return
    setSaving(true)
    await supabase.from('schedules').update({ name: schedule.name, is_private: schedule.is_private }).eq('id', id)
    const updated = [...events]
    for (let i = 0; i < updated.length; i++) {
      const ev = updated[i]
      const payload = {
        name: ev.name, date: ev.date || null,
        time: ev.time || null, location: ev.location,
        notes: ev.notes, sequence: (ev.sequence ?? 0) + 1,
        photos: ev.photos, schedule_id: id
      }
      if (ev.id) {
        await supabase.from('events').update(payload).eq('id', ev.id)
      } else {
        const { data } = await supabase.from('events').insert(payload).select().single()
        if (data) updated[i] = { ...ev, id: data.id }
      }
    }
    // Sort by date after saving
    updated.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    setEvents(updated)
    setSaving(false); setSaved(true); setDirty(false)
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
    setEvents(evs => [...evs, { name: '', date: '', time: '12:00', location: '', notes: '', sequence: 0, photos: [], attachments: [] }])
    setDirty(true)
  }

  function duplicateEvent(idx: number) {
    const ev = { ...events[idx], id: undefined, name: events[idx].name + ' (copy)', attachments: [] }
    const next = [...events]; next.splice(idx + 1, 0, ev)
    setEvents(next); setDirty(true)
  }

  async function removeEvent(idx: number) {
    const ev = events[idx]
    if (ev.id) await supabase.from('events').delete().eq('id', ev.id)
    setEvents(evs => evs.filter((_, i) => i !== idx))
    setDirty(true)
  }

  // Expand recurring event into multiple rows
  function applyRecurrence(idx: number, dates: string[]) {
    const base = events[idx]
    const newRows: Event[] = dates.map(date => ({
      ...base, id: undefined, date, attachments: [], _recurDates: undefined
    }))
    const next = [...events]
    next.splice(idx, 1, ...newRows)
    setEvents(next)
    setDirty(true)
    setRecurModal(null)
  }

  function focusCell(row: number, col: number) {
    const el = tableRef.current?.querySelector(`[data-cell="${row}-${col}"]`) as HTMLElement
    el?.focus()
  }

  function handleCellKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextCol = e.shiftKey ? col - 1 : col + 1
      if (nextCol >= 0 && nextCol < 5) focusCell(row, nextCol)
      else if (!e.shiftKey && nextCol >= 5) {
        if (row + 1 < events.length) focusCell(row + 1, 0)
        else { addEvent(); setTimeout(() => focusCell(row + 1, 0), 80) }
      } else if (e.shiftKey && nextCol < 0 && row > 0) {
        focusCell(row - 1, 4)
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (row + 1 < events.length) focusCell(row + 1, col)
      else { addEvent(); setTimeout(() => focusCell(row + 1, col), 80) }
    }
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

  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOver(idx) }
  function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOver(null); return }
    const next = [...events]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setEvents(next); setDirty(true)
    setDragIdx(null); setDragOver(null)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const idx = uploadForIdx.current
    if (!file || idx === null) return
    setUploadingIdx(idx)
    const path = `${id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path)
      const att: Attachment = { name: file.name, url: publicUrl, size: file.size, mime_type: file.type }
      const current = events[idx].attachments ?? []
      updateEvent(idx, { attachments: [...current, att] })
    }
    setUploadingIdx(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function removeAttachment(evIdx: number, attIdx: number) {
    const atts = [...(events[evIdx].attachments ?? [])]
    atts.splice(attIdx, 1)
    updateEvent(evIdx, { attachments: atts })
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  async function sendNotifications(selectedEmails: string[]) {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: id, scheduleName: schedule?.name, emails: selectedEmails, shareUrl: `${window.location.origin}/s/${id}` })
    })
    setNotifySent(true)
    setTimeout(() => { setShowNotify(false); setNotifySent(false) }, 2500)
  }

  const shareUrl = schedule ? `${window.location.origin}/s/${schedule.is_private ? `${id}?t=${schedule.feed_token}` : id}` : ''
  const feedUrl = schedule ? `${window.location.origin}/api/feed/${schedule.feed_token}` : ''

  if (!schedule) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>

  const cellBase: React.CSSProperties = {
    border: 'none', outline: 'none', fontSize: '13px',
    padding: '0 8px', background: 'transparent',
    width: '100%', height: '100%',
    fontFamily: 'inherit', color: '#1a1a1a',
  }
  const selStyle: React.CSSProperties = {
    border: 'none', outline: 'none', fontSize: '13px',
    background: 'transparent', fontFamily: 'inherit',
    color: '#1a1a1a', cursor: 'pointer', padding: '0 2px', height: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', height: '52px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '18px', padding: '4px 8px' }}>←</button>
          <a href="/" style={{ fontSize: '18px', fontWeight: 700, textDecoration: 'none', color: '#1a1a1a', letterSpacing: '-0.5px' }}>sched<span style={{ color: '#1D9E75' }}>gio</span></a>
          <input
            value={schedule.name} placeholder="Schedule name..."
            onChange={e => updateSchedule({ name: e.target.value })}
            style={{ fontSize: '15px', fontWeight: 600, border: 'none', outline: 'none', borderBottom: `2px solid ${dirty ? '#1D9E75' : 'transparent'}`, transition: 'border-color .15s', padding: '2px 4px', minWidth: '200px', background: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: saved ? '#1D9E75' : '#9ca3af' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : dirty ? 'Unsaved changes' : ''}
          </span>
          <button onClick={saveAll} disabled={saving || !dirty}
            style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: dirty ? '#1D9E75' : '#e5e7eb', color: dirty ? '#fff' : '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: dirty ? 'pointer' : 'default', transition: 'all .15s' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setShowShare(s => !s)}
            style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #1D9E75', background: '#fff', color: '#1D9E75', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Share
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 1.25rem', borderBottom: '1px solid #f3f4f6', background: '#fafafa', flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#6b7280' }}>
          <div onClick={() => updateSchedule({ is_private: !schedule.is_private })}
            style={{ width: '28px', height: '16px', borderRadius: '8px', background: schedule.is_private ? '#1D9E75' : '#d1d5db', position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: '2px', left: schedule.is_private ? '13px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </div>
          {schedule.is_private ? 'Link-gated' : 'Public'}
        </label>
        <div style={{ width: '1px', height: '16px', background: '#e5e7eb' }} />
        <button onClick={addEvent}
          style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
          + Add row
        </button>
        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
          Drag ☰ to reorder · Tab between cells · Saves sort by date
        </span>
      </div>

      {/* Spreadsheet */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <colgroup>
            <col style={{ width: '28px' }} />
            <col style={{ width: '28px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '120px' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 5 }}>
              <th style={{ padding: '8px 4px', fontSize: '11px', color: '#9ca3af', textAlign: 'center', fontWeight: 400 }}></th>
              <th style={{ padding: '8px 4px', fontSize: '11px', color: '#9ca3af', textAlign: 'center', fontWeight: 400 }}>#</th>
              {['Event', 'Date', 'Time', 'Location', 'Notes', 'Actions'].map(h => (
                <th key={h} style={{ padding: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#6b7280', textAlign: 'left', borderRight: '1px solid #f3f4f6' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => {
              const { hour, minute, ampm } = parseTo12(ev.time || '12:00')
              const isOver = dragOver === i
              const isDragging = dragIdx === i
              const isHovered = hoveredRow === i
              const atts = ev.attachments ?? []

              return (
                <>
                  <tr key={`row-${i}`}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={e => onDragOver(e, i)}
                    onDrop={() => onDrop(i)}
                    onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: atts.length ? 'none' : '1px solid #f3f4f6',
                      background: isDragging ? '#f0fdf4' : isOver ? '#e0f2fe' : isHovered ? '#fafffe' : '#fff',
                      opacity: isDragging ? 0.5 : 1,
                    }}>
                    <td style={{ textAlign: 'center', padding: '0 4px', cursor: 'grab', color: '#d1d5db', fontSize: '13px', userSelect: 'none' }}>☰</td>
                    <td style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', userSelect: 'none' }}>{i + 1}</td>

                    {/* Event name */}
                    <td style={{ padding: 0, borderRight: '1px solid #f3f4f6', height: '36px' }}>
                      <input data-cell={`${i}-0`} value={ev.name} placeholder="Event name"
                        onChange={e => updateEvent(i, { name: e.target.value })}
                        onKeyDown={e => handleCellKeyDown(e, i, 0)}
                        style={cellBase} />
                    </td>

                    {/* Date */}
                    <td style={{ padding: 0, borderRight: '1px solid #f3f4f6', height: '36px' }}>
                      <input data-cell={`${i}-1`} type="date" value={ev.date}
                        onChange={e => updateEvent(i, { date: e.target.value })}
                        onKeyDown={e => handleCellKeyDown(e, i, 1)}
                        style={{ ...cellBase, colorScheme: 'light' }} />
                    </td>

                    {/* Time */}
                    <td style={{ padding: '0 6px', borderRight: '1px solid #f3f4f6', height: '36px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <select data-cell={`${i}-2`} value={hour}
                          onChange={e => updateEvent(i, { time: formatTo24(e.target.value, minute, ampm) })}
                          onKeyDown={e => handleCellKeyDown(e, i, 2)}
                          style={{ ...selStyle, width: '38px' }}>
                          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span style={{ color: '#9ca3af' }}>:</span>
                        <select value={minute}
                          onChange={e => updateEvent(i, { time: formatTo24(hour, e.target.value, ampm) })}
                          style={{ ...selStyle, width: '42px' }}>
                          {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={ampm}
                          onChange={e => updateEvent(i, { time: formatTo24(hour, minute, e.target.value as 'AM' | 'PM') })}
                          style={{ ...selStyle, width: '46px' }}>
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </td>

                    {/* Location */}
                    <td style={{ padding: 0, borderRight: '1px solid #f3f4f6', height: '36px', position: 'relative' }}>
                      <input data-cell={`${i}-3`} value={ev.location} placeholder="Location"
                        onChange={e => handleLocInput(i, e.target.value)}
                        onKeyDown={e => handleCellKeyDown(e, i, 3)}
                        onBlur={() => setTimeout(() => setLocSug(null), 200)}
                        style={cellBase} autoComplete="off" />
                      {locSug?.idx === i && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', zIndex: 30, boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
                          {locSug.results.map(r => (
                            <div key={r} onMouseDown={() => pickLocation(i, r)}
                              style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                              📍 {r}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: 0, borderRight: '1px solid #f3f4f6', height: '36px' }}>
                      <input data-cell={`${i}-4`} value={ev.notes} placeholder="Notes"
                        onChange={e => updateEvent(i, { notes: e.target.value })}
                        onKeyDown={e => handleCellKeyDown(e, i, 4)}
                        style={cellBase} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0 8px', height: '36px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => duplicateEvent(i)} title="Duplicate"
                          style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                          Copy
                        </button>
                        <button onClick={() => setRecurModal({ idx: i })} title="Set recurring dates"
                          style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                          Recur
                        </button>
                        <button onClick={() => { uploadForIdx.current = i; fileInputRef.current?.click() }}
                          title="Attach file" disabled={uploadingIdx === i}
                          style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                          {uploadingIdx === i ? '...' : '📎'}
                        </button>
                        <button onClick={() => removeEvent(i)} title="Delete"
                          style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Attachments sub-row */}
                  {atts.length > 0 && (
                    <tr key={`att-${i}`} style={{ borderBottom: '1px solid #f3f4f6', background: hoveredRow === i ? '#fafffe' : '#fafafa' }}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}>
                      <td colSpan={2} />
                      <td colSpan={6} style={{ padding: '4px 8px 6px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {atts.map((att, ai) => (
                            <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}>
                              <span>📎</span>
                              <a href={att.url} target="_blank" rel="noopener" style={{ color: '#1D9E75', textDecoration: 'none', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {att.name}
                              </a>
                              {att.size && <span style={{ color: '#9ca3af' }}>{fmtFileSize(att.size)}</span>}
                              <button onClick={() => removeAttachment(i, ai)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px', padding: '0 2px', lineHeight: 1 }}>×</button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}

            {/* Add row */}
            <tr onClick={addEvent} style={{ cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td colSpan={8} style={{ padding: '9px 12px', fontSize: '12px', color: '#9ca3af' }}>
                + Click to add row
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Share panel */}
      {showShare && (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff', padding: '1rem 1.25rem', flexShrink: 0, display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: '6px' }}>Share link</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <code style={{ flex: 1, fontSize: '11px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>{shareUrl}</code>
              <button onClick={() => copy(shareUrl, 'share')} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: copied === 'share' ? '#1D9E75' : '#374151' }}>
                {copied === 'share' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: '6px' }}>Calendar feed</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <code style={{ flex: 1, fontSize: '11px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>{feedUrl}</code>
              <button onClick={() => copy(feedUrl, 'feed')} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: copied === 'feed' ? '#1D9E75' : '#374151' }}>
                {copied === 'feed' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: '6px' }}>Notify subscribers</div>
            {(schedule.subscribers?.length ?? 0) === 0
              ? <p style={{ fontSize: '12px', color: '#9ca3af' }}>No subscribers yet.</p>
              : <button onClick={() => setShowNotify(true)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Send notice to {schedule.subscribers.length}
                </button>
            }
          </div>
        </div>
      )}

      {/* Recurrence modal */}
      {recurModal && (
        <RecurModal
          event={events[recurModal.idx]}
          onApply={(dates) => applyRecurrence(recurModal.idx, dates)}
          onClose={() => setRecurModal(null)}
        />
      )}

      {/* Notify modal */}
      {showNotify && (
        <NotifyModal subscribers={schedule.subscribers} scheduleName={schedule.name}
          onSend={sendNotifications} onClose={() => setShowNotify(false)} sent={notifySent} />
      )}
    </div>
  )
}

function RecurModal({ event, onApply, onClose }: {
  event: Event
  onApply: (dates: string[]) => void
  onClose: () => void
}) {
  const [dates, setDates] = useState<string[]>(event.date ? [event.date] : [])
  const [newDate, setNewDate] = useState('')

  function addDate() {
    if (!newDate || dates.includes(newDate)) return
    setDates(d => [...d, newDate].sort())
    setNewDate('')
  }

  function removeDate(d: string) {
    setDates(ds => ds.filter(x => x !== d))
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '440px', margin: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>Recurring dates</div>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Pick all dates for "<strong>{event.name || 'this event'}</strong>". Each date becomes its own row so you can edit details individually.
        </p>

        {/* Add date */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={addDate}
            style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Add
          </button>
        </div>

        {/* Date list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.25rem', maxHeight: '240px', overflowY: 'auto' }}>
          {dates.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>No dates added yet.</p>}
          {dates.map(d => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>
              <span>{fmtDate(d)}</span>
              <button onClick={() => removeDate(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          <button onClick={() => dates.length > 0 && onApply(dates)} disabled={dates.length === 0}
            style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: dates.length > 0 ? '#1D9E75' : '#e5e7eb', color: dates.length > 0 ? '#fff' : '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: dates.length > 0 ? 'pointer' : 'default' }}>
            Create {dates.length} row{dates.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
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
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', width: '100%', maxWidth: '400px', margin: '1rem' }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
            <div style={{ fontWeight: 600 }}>Notices sent!</div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>Notify subscribers</div>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1rem' }}>Email selected subscribers about "{scheduleName}".</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem', maxHeight: '180px', overflowY: 'auto' }}>
              {subscribers.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: '#f9fafb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={selected.has(s.email)} onChange={() => toggle(s.email)} style={{ accentColor: '#1D9E75' }} />
                  {s.email}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={() => onSend(Array.from(selected))} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
