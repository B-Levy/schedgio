import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Schedgio — Schedules that stay in sync',
  description: 'Create schedules, share a link, subscribers get updates automatically.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
