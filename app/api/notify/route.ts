import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { scheduleName, emails, shareUrl } = await req.json()
  if (!emails?.length) return NextResponse.json({ ok: true })

  try {
    await resend.emails.send({
      from: 'Schedgio <onboarding@resend.dev>',
      to: emails,
      subject: `Schedule updated: ${scheduleName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <div style="font-size:22px;font-weight:700;margin-bottom:1rem">
            sched<span style="color:#1D9E75">io</span>
          </div>
          <p style="font-size:16px;margin-bottom:1rem">
            <strong>${scheduleName}</strong> has been updated.
          </p>
          <a href="${shareUrl}"
             style="display:inline-block;background:#1D9E75;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
            View updated schedule →
          </a>
          <p style="font-size:12px;color:#6b7280;margin-top:1.5rem">
            You're receiving this because you subscribed to this schedule on Schedgio.
          </p>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
