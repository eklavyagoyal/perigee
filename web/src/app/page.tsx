import Link from 'next/link';
import { Brand, Arrow } from '@/components/brand';
import { Descent } from '@/components/descent';
import { Evidence } from '@/components/evidence';
import { Approach } from '@/components/approach';

export default function HomePage() {
  return <>
    <a className="skip-link" href="#evidence">Skip the cinematic experience</a>
    <main>
      <Descent navigation={<header className="site-header">
        <Brand href="/#descent" />
        <nav aria-label="Main navigation"><a className="nav-link" href="#evidence">The results</a><a className="nav-link" href="#approach">Our approach</a></nav>
        <Link className="header-cta" href="/mission-control">Demo preview <Arrow diagonal /></Link>
      </header>} />
      <Evidence />
      <Approach />
      <section className="mission-section pitch-demo-entry" id="mission-control" aria-labelledby="demo-entry-title">
        <div><span className="eyebrow dark">03 / THE WORKSPACE · DESIGN PREVIEW</span><h2 id="demo-entry-title">A place for the signal.<br /><span>And the questions after it.</span></h2><p>An empty first layout for our next design discussion.<br />No samples, model connection or generated results yet.</p><Link className="button button-light" href="/mission-control">Open demo workspace <Arrow /></Link></div>
        <div className="pitch-window-preview" aria-hidden="true"><div className="preview-window-bar"><i /><i /><i /><span>MISSION WORKSPACE</span></div><div className="preview-window-body"><div className="preview-sidebar"><i /><i /><i /></div><div className="preview-empty"><span>+</span><p>Your first signal goes here.</p><small>LAYOUT ONLY</small></div></div></div>
      </section>
    </main>
    <footer><Brand href="/#descent" /><span>Telemetry. Context. Human judgement.</span><a className="text-link" id="replay-button" href="#descent">Back to orbit <Arrow diagonal /></a><div className="footer-bottom"><span>EUROPEAN HACKATHON LEAGUE · ZURICH 2026</span><a href="/films/perigee-descent-clean.mp4" download>Download text-free video</a></div></footer>
  </>;
}
