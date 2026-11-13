import './globals.css';
import type { Metadata, Viewport } from 'next';
import Header from '@/components/Header';
import { cfg } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(cfg.siteUrl),
  title: { default: 'The Sages AI Studio', template: '%s · The Sages AI Studio' },
  description: 'Imagine it. Create it. Bring it to life. An AI production studio for cinematic videos, mini-movies, animation, commercials and career stories.',
  // The picture shown wherever a link to the studio is shared: social posts, messages and email previews.
  openGraph: { type: 'website', siteName: 'The Sages AI Studio', title: 'The Sages AI Studio', description: 'Imagine it. Create it. Bring it to life.', images: [{ url: '/brand/og.jpg', width: 1200, height: 630, alt: 'The Sages AI Studio. Imagine it. Create it. Bring it to life. AI video, film and animation.' }] },
  twitter: { card: 'summary_large_image', title: 'The Sages AI Studio', description: 'Imagine it. Create it. Bring it to life.', images: ['/brand/og.jpg'] },
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
