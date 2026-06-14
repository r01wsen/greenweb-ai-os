import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GreenWeb AI OS - Multi-Domain AI Intelligence',
  description: 'Smart AI for agriculture, medical, legal, life coaching, relationships, and engineering',
  keywords: ['AI', 'agriculture', 'medical', 'legal', 'life coach', 'engineering'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
