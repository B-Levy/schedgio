export type CalEvent = {
  id: string
  name: string
  date: string       // YYYY-MM-DD
  time?: string      // HH:MM
  location?: string
  notes?: string
  sequence?: number  // incremented on each update so calendar apps re-sync
}

export function buildICS(events: CalEvent[], scheduleName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedgio//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${scheduleName}`,
    'X-WR-TIMEZONE:America/New_York',
  ]

  for (const ev of events) {
    if (!ev.date) continue
    const d = ev.date.replace(/-/g, '')
    let dtstart: string
    let dtend: string

    if (ev.time) {
      const [h, m] = ev.time.split(':')
      dtstart = `${d}T${h}${m}00`
      const endH = String(parseInt(h) + 1).padStart(2, '0')
      dtend = `${d}T${endH}${m}00`
    } else {
      dtstart = d
      dtend = d
    }

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@schedgio.app`,
      `SEQUENCE:${ev.sequence ?? 0}`,
      `SUMMARY:${icsEscape(ev.name || 'Event')}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `LOCATION:${icsEscape(ev.location || '')}`,
      `DESCRIPTION:${icsEscape(ev.notes || '')}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function icsEscape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function googleCalUrl(ev: CalEvent): string {
  if (!ev.date) return '#'
  const d = ev.date.replace(/-/g, '')
  let s: string, e: string
  if (ev.time) {
    const [h, m] = ev.time.split(':')
    s = `${d}T${h}${m}00`
    e = `${d}T${String(parseInt(h) + 1).padStart(2, '0')}${m}00`
  } else {
    s = d; e = d
  }
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.name || 'Event',
    dates: `${s}/${e}`,
    location: ev.location || '',
    details: ev.notes || '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}
