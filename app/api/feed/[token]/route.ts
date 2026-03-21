import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildICS, CalEvent } from '@/lib/ics'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { data: schedule } = await supabase
    .from('schedules')
    .select('*, events(*)')
    .eq('feed_token', params.token)
    .single()

  if (!schedule) return new NextResponse('Not found', { status: 404 })

  const events: CalEvent[] = (schedule.events ?? [])
    .filter((e: CalEvent) => e.date)
    .sort((a: CalEvent, b: CalEvent) => (a.date ?? '').localeCompare(b.date ?? ''))

  const ics = buildICS(events, schedule.name || 'Schedule')
  const isDownload = req.nextUrl.searchParams.get('download') === '1'

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': isDownload
        ? `attachment; filename="${schedule.name || 'schedule'}.ics"`
        : 'inline',
      // No-cache so calendar apps always get the latest
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
