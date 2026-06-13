import type { Metadata } from 'next'
import { ThemeProvider } from '@/shared/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'GHL Titan',
  description: 'CRM, agenda y marketing de Titanic Factory',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
