import './globals.css';
import type { Metadata, Viewport } from 'next';
import Header from '@/components/Header';
import { cfg } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(cfg.siteUrl),
  title: { default: 'The Sages AI Studio', template: '%s · The Sages AI Studio' },
  description: 'Imagine it. Create it. Bring it to life. An AI production studio for cinematic videos, mini-movies, animation, commercials and career stories.',
  openGraph: { title: 'The Sages AI Studio', description: 'Imagine it. Create it. Bring it to life.', images: ['/studio-control.jpg'] },
};
export const viewport: Viewport = { themeColor: '#090c16', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Manrope:wght@400;600;700&display=swap" />
      </head>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
