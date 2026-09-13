'use client';

import { useRef } from 'react';
import { Arrow } from './brand';

export function ResearchNotes() {
  const ref = useRef<HTMLDialogElement>(null);
  return <><button className="text-link" onClick={() => ref.current?.showModal()}>Research notes <Arrow diagonal /></button><dialog ref={ref} className="research-dialog" aria-labelledby="research-title" onClick={event => {
    if (event.target !== ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) ref.current.close();
  }}><div className="dialog-bar"><span className="mono">PERIGEE / RESEARCH NOTES</span><button className="close-dialog" aria-label="Close research notes" onClick={() => ref.current?.close()}>×</button></div><h2 id="research-title">A cinematic concept.<br />A research question.</h2><p>Can telemetry and time-aligned command context help distinguish real anomalies from rare nominal operations?</p><p>The descent is illustrative. Its altitude, velocity, heating and timing are not a physical simulation or a model forecast.</p><p>The landing-page examples use synthetic signals and scripted explanations. They do not represent live OpenTSLM inference, validated operational performance, or a guarantee that a detector can prevent re-entry.</p><p>The pipeline workspace connects through a separate server-side worker adapter. A model is only described as connected when that service is configured and responds.</p><a className="text-link" href="https://zenodo.org/records/12528696" target="_blank" rel="noopener noreferrer">Explore the ESA dataset <Arrow diagonal /></a></dialog></>;
}
