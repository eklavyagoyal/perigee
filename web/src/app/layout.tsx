import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../style.css';
import '../evidence.css';
import './workspace.css';
import './pitch.css';

export const metadata: Metadata = {
  title: { default: 'PERIGEE — Every signal. In context.', template: '%s | PERIGEE' },
  description: 'ESA telemetry and command context for spacecraft anomaly research. Explore the approach, reported baseline comparison and an early demo workspace.',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { themeColor: '#080d12' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
