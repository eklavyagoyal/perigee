import Link from 'next/link';
import { Arrow } from '@/components/brand';
import { Descent } from '@/components/descent';
import { Evidence } from '@/components/evidence';
import './landing.css';

export default function HomePage() {
  return <div className="landing">
    <a className="skip-link" href="#evidence">Skip the cinematic experience</a>
    <main>
      <Descent navigation={<header className="landing-header"><Link className="text-link" href="/mission-control">Mission control <Arrow diagonal /></Link></header>} />
      <Evidence />
    </main>
    <footer className="landing-footer"><span>PERIGEE · SPACECRAFT ANOMALY RESEARCH</span><a href="#descent">Back to orbit ↑</a><a href="/films/perigee-descent-clean.mp4" download>Download text-free video</a></footer>
  </div>;
}
