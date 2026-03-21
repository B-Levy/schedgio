import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { scheduleId, email } = await req.json()
  if (!scheduleId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Upsert — don't double-add same email
  const { error } = await supabase
    .from('subscribers')
    .upsert({ schedule_id: scheduleId, email }, { onConflict: 'schedule_id,email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
