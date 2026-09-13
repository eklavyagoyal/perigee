'use client';

import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="workspace"><p className="eyebrow">CONNECTION INTERRUPTED</p><h1>Let’s restore the signal.</h1><p>The page could not finish loading. No job is automatically retried.</p><button className="button button-light" onClick={reset}>Try loading again</button><Link className="text-link" href="/">Return home</Link></main>;
}
