'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { Arrow } from './brand';
import { AmbientSound } from '@/lib/ambient-sound';
import { chapterAt, chapterLabels, chapterPositions, chapterStyle, type SceneRenderer } from '@/lib/descent';
import { sceneSource } from '@/config/scene';

function subscribeMotion(callback: () => void) {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

export function Descent({ navigation }: { navigation: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  const soundRef = useRef<AmbientSound | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, () => matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
  const [manualPause, setManualPause] = useState<boolean | null>(null);
  const paused = manualPause ?? reduced;
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [soundError, setSoundError] = useState('');
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const section = sectionRef.current!;
    let renderer: SceneRenderer | null = null;
    let active = true;
    let frame = 0;
    let lastTime = 0;
    let lastProgress = -1;
    let forceFrame = true;
    pausedRef.current = matchMedia('(prefers-reduced-motion: reduce)').matches;

    async function initialize() {
      try {
        if (sceneSource.kind === 'frames') {
          const { FrameSequence } = await import('@/lib/frame-sequence');
          if (!active) return;
          renderer = new FrameSequence(canvas, sceneSource.manifest);
        } else {
          const { OrbitalScene } = await import('@/scene');
          if (!active) return;
          renderer = new OrbitalScene(canvas);
        }
        renderer.resize(innerWidth, innerHeight);
        await renderer.ready;
        if (!active) return;
        forceFrame = true;
        renderer.render(progressRef.current, performance.now() / 1000, pausedRef.current);
        setReady(true);
      } catch {
        if (active) { renderer?.dispose(); renderer = null; setFallback(true); setReady(true); }
      }
    }
    function animate(now: number) {
      if (!active) return;
      frame = requestAnimationFrame(animate);
      if (document.hidden || now - lastTime < 1000 / 45) return;
      lastTime = now;
      const target = Math.max(0, Math.min(1, (scrollY - section.offsetTop) / Math.max(1, section.offsetHeight - innerHeight)));
      let p = pausedRef.current ? target : progressRef.current + (target - progressRef.current) * .12;
      if (Math.abs(target - p) < .0001) p = target;
      progressRef.current = p;
      if (forceFrame || !pausedRef.current || p !== lastProgress) {
        if (scrollY < section.offsetTop + section.offsetHeight + 100) renderer?.render(p, now / 1000, pausedRef.current);
        forceFrame = false; lastProgress = p; setProgress(p);
      }
      soundRef.current?.update(p);
    }
    const resize = () => { renderer?.resize(innerWidth, innerHeight); forceFrame = true; };
    const visibility = () => soundRef.current?.visibility(document.hidden);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    void initialize(); frame = requestAnimationFrame(animate);
    return () => {
      active = false; cancelAnimationFrame(frame); renderer?.dispose();
      soundRef.current?.dispose(); soundRef.current = null;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  function seek(value: number) {
    const section = sectionRef.current!;
    scrollTo({ top: section.offsetTop + (section.offsetHeight - innerHeight) * value, behavior: paused ? 'instant' : 'smooth' });
  }
  async function toggleSound() {
    try {
      soundRef.current ??= new AmbientSound();
      await soundRef.current.setEnabled(!soundRef.current.on);
      setSoundOn(soundRef.current.on); setSoundError('');
    } catch { setSoundError('Audio is unavailable in this browser.'); }
  }

  const phase = chapterAt(progress);
  function chapterProps(index: number) {
    const style = chapterStyle(index, progress);
    return { style, inert: style.opacity < .5, 'aria-hidden': style.opacity < .5, 'data-chapter': index };
  }
  return <><section ref={sectionRef} className="descent pitch-descent" id="descent" data-phase={phase} data-ready={ready} aria-label="A cinematic journey from orbit to Earth" aria-describedby="scene-description">
    <div className={`flight-stage${fallback ? ' static-fallback' : ''}`}>
      <canvas ref={canvasRef} id="orbital-canvas" hidden={fallback} style={{ opacity: ready ? 1 : 0 }} aria-label="Animated satellite above Earth, descending into the atmosphere as you scroll" />
      <div className="scene-grain" aria-hidden="true" /><div className="scene-vignette" aria-hidden="true" />
      <div className="pitch-scene-shade" aria-hidden="true" />
      {navigation}
      <div className="chapter chapter-hero" {...chapterProps(0)}><span className="eyebrow">FOR SPACECRAFT OPERATIONS ENGINEERS</span><h1>Every signal.<br /><span>In context.</span></h1><p>ESA telemetry. Command history.<br />{' '}Time-series language models for human review.</p><a className="text-link" href="#evidence">Explore the results <Arrow diagonal /></a></div>
      <div className="chapter" {...chapterProps(1)}><span className="eyebrow">01 / PROBLEM + DATA</span><h2>A signal alone<br />isn’t the story.</h2><p>Bring telemetry, metadata and command history<br />{' '}together through a reusable TimeNet connector.</p></div>
      <div className="chapter" {...chapterProps(2)}><span className="eyebrow">02 / TRAIN + EVALUATE</span><h2>Train the model.<br />Test the claim.</h2><p>Fine-tune OpenTSLM. Compare with baselines.<br />{' '}Keep the evaluation limits in view.</p></div>
      <div className="chapter" {...chapterProps(3)}><span className="eyebrow">03 / EVIDENCE + LIMITATIONS</span><h2>An answer needs<br />its evidence.</h2><p>A generated rationale is something to review.<br />{' '}It is not proof of a diagnosis.</p></div>
      <div className="chapter chapter-final" {...chapterProps(4)}><span className="eyebrow">04 / DEMONSTRATE</span><h2>Make the next<br /><em>review clearer.</em></h2><p>One workspace for the input, context and answer.<br />{' '}A first layout. Ready for our next design discussion.</p><Link className="button button-light" href="/mission-control">Open demo workspace <Arrow /></Link><span className="pitch-preview-label mono">DESIGN PREVIEW · NO MODEL CONNECTED</span></div>
      <nav className="chapter-rail" aria-label="Journey chapters">{chapterLabels.map((label, index) => <button key={label} className={phase === index ? 'active' : undefined} aria-label={label} aria-current={phase === index ? 'step' : undefined} onClick={() => seek(chapterPositions[index])}><span>{String(index + 1).padStart(2, '0')}</span><i /></button>)}</nav>
      <div className="pitch-flight-footer"><span className="mono">SCROLL TO FOLLOW THE DESCENT <span aria-hidden="true">↓</span></span><div className="pitch-scene-controls"><button id="sound-toggle" aria-pressed={soundOn} aria-label={soundOn ? 'Mute atmospheric sound' : 'Enable atmospheric sound'} onClick={toggleSound}>{soundOn ? 'Sound on' : 'Sound off'}</button><button id="motion-toggle" aria-pressed={paused} aria-label={paused ? 'Resume ambient animation' : 'Pause ambient animation'} onClick={() => setManualPause(!paused)}>{paused ? 'Resume animation' : 'Pause animation'}</button></div></div>
      <span className="sr-only" role="status">{soundError}</span>
    </div>
  </section>
    <p id="scene-description" className="pitch-scene-disclaimer">Illustrative satellite descent, not an orbital simulation, model forecast or claim of prevented loss.</p>
  </>;
}
