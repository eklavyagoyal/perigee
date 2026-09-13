import Link from 'next/link';

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M5 12h14M13 6l6 6-6 6'} stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export function OrbitMark() {
  return <svg className="brand-mark" viewBox="0 0 46 46" fill="none" aria-hidden="true"><ellipse cx="23" cy="23" rx="22" ry="8" transform="rotate(-42 23 23)" stroke="currentColor" strokeWidth="1.15" /><circle cx="23" cy="23" r="5" fill="currentColor" /><circle cx="38" cy="10" r="3" fill="#d3ab7a" /></svg>;
}

export function Brand({ href = '/' }: { href?: string }) {
  return <Link className="brand" href={href} aria-label="Perigee home"><OrbitMark /><span>PERIGEE<span className="brand-sub">ORBITAL INTELLIGENCE</span></span></Link>;
}
