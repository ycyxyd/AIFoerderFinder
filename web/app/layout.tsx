import type { Metadata, Viewport } from 'next';
import './globals.css';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'FörderFinder – Orientierung zu Förderprogrammen',
  description:
    'Allgemeine, unverbindliche Informationen zu deutschen Förderprogrammen. Keine Rechts-, Steuer- oder Förderberatung.',
  manifest: '/manifest.webmanifest',
  applicationName: 'FörderFinder',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <Footer />
      </body>
    </html>
  );
}
