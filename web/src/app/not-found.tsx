import Link from 'next/link';
export default function NotFound() {
  return <main className="workspace"><p className="eyebrow">404 / OUTSIDE THE FLIGHT PLAN</p><h1>Nothing in this orbit.</h1><Link className="button button-light" href="/">Return to Earth</Link></main>;
}
