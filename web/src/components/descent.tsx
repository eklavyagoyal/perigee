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
      <div className="chapter chapter-hero" {...chapterProps(0)}><h1>Years of work.<br /><span>One mission.</span></h1><p>Out here, every signal matters.</p></div>
      <div className="chapter" {...chapterProps(1)}><h2>It starts with<br />a small deviation.</h2><p>A change in the signal.<br />{' '}A question that needs context.</p></div>
      <div className="chapter" {...chapterProps(2)}><h2>Then everything<br /><em>changes.</em></h2></div>
      <div className="chapter" {...chapterProps(3)}><h2>No signal.<br /><span>No second chance.</span></h2></div>
      <div className="chapter chapter-final" {...chapterProps(4)}><h2>An anomaly shouldn’t<br /><em>end a mission.</em></h2><p>Find the signal. Understand the context.</p><Link className="button button-light" href="/mission-control">Open mission control <Arrow /></Link><a className="landing-results-link" href="#evidence">Explore the research ↓</a></div>
      <div className="landing-flight-footer"><span>SCROLL TO DESCEND <span aria-hidden="true">↓</span></span><details className="landing-controls"><summary>Scene controls</summary><div className="landing-controls-panel"><nav aria-label="Journey chapters">{chapterLabels.map((label, index) => <button key={label} aria-current={phase === index ? 'step' : undefined} onClick={() => seek(chapterPositions[index])}>{label}</button>)}</nav><button id="sound-toggle" aria-pressed={soundOn} aria-label={soundOn ? 'Mute atmospheric sound' : 'Enable atmospheric sound'} onClick={toggleSound}>{soundOn ? 'Sound on' : 'Sound off'}</button><button id="motion-toggle" aria-pressed={paused} aria-label={paused ? 'Resume ambient animation' : 'Pause ambient animation'} onClick={() => setManualPause(!paused)}>{paused ? 'Resume animation' : 'Pause animation'}</button></div></details></div>
      <span className="sr-only" role="status">{soundError}</span>
    </div>
  </section>
    <p id="scene-description" className="pitch-scene-disclaimer">Illustrative satellite descent, not an orbital simulation, model forecast or claim of prevented loss.</p>
  </>;
}
