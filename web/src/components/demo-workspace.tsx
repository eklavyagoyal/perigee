'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Arrow, Brand } from './brand';

const sections = ['Overview', 'Dataset', 'Evaluation', 'Artifacts'] as const;
type Section = typeof sections[number];
const emptySections = {
  Dataset: { title: 'No dataset selected.', description: 'A place for the sample catalogue, metadata and split documentation.' },
  Evaluation: { title: 'No evaluation loaded.', description: 'A place for a versioned experiment, baseline comparison and limitations.' },
  Artifacts: { title: 'No artifacts attached.', description: 'A place for the code, training configuration, adapter and dataset documentation.' },
};

// Intentionally local UI state only. No API requests, fixtures or model outputs.
export function DemoWorkspace() {
  const [section, setSection] = useState<Section>('Overview');
  return <div className="demo-shell">
    <aside className="demo-sidebar"><Brand /><span className="demo-sidebar-label mono">WORKSPACE</span><nav aria-label="Workspace sections">{sections.map((item, index) => <button key={item} aria-current={section === item ? 'page' : undefined} aria-controls="demo-content" onClick={() => setSection(item)}><span className="mono">0{index + 1}</span>{item}<span className="demo-nav-dot" aria-hidden="true" /></button>)}</nav><div className="demo-sidebar-bottom"><span className="mono">EARLY DESIGN STUDY</span><p>Structure first.<br />Real data comes next.</p><Link href="/" className="text-link">Back to the experience <Arrow diagonal /></Link></div></aside>
    <div className="demo-main"><header className="demo-topbar"><span className="mono">PERIGEE <span>/</span> {section.toUpperCase()}</span><span className="demo-preview-badge">DESIGN PREVIEW</span></header>
      <main id="demo-content"><div className="demo-page-heading"><div><p className="eyebrow dark">YOUR MISSION, IN CONTEXT</p><h1>{section === 'Overview' ? 'Mission workspace.' : section + '.'}</h1><p>Layout preview only. No data loaded and no model connected.</p></div><button className="demo-run" disabled title="Available after a model is connected">Run review <Arrow /></button></div>
        {section === 'Overview' ? <><div className="demo-sample-bar"><div><span className="demo-outline-dot" aria-hidden="true" /><span>No sample selected</span></div><button disabled>Select sample <span aria-hidden="true">+</span></button></div><div className="demo-panels"><section className="demo-panel demo-telemetry" aria-labelledby="telemetry-title"><div className="demo-panel-heading"><h2 id="telemetry-title">Telemetry window</h2><span className="mono">INPUT</span></div><div className="demo-empty-state"><div className="demo-empty-orbit" aria-hidden="true"><i /></div><h3>Your first signal goes here.</h3><p>Select a real telemetry window to begin.<br />No illustrative data is shown in this preview.</p><span className="demo-empty-tag mono">AWAITING SAMPLE</span></div><div className="demo-context-placeholder"><span className="mono">COMMAND CONTEXT</span><p>No command history loaded.</p></div></section><div className="demo-result-column"><section className="demo-panel" aria-labelledby="model-title"><div className="demo-panel-heading"><h2 id="model-title">Model output</h2><span className="mono">OUTPUT</span></div><div className="demo-small-empty"><span aria-hidden="true">—</span><h3>No model response.</h3><p>Classification and rationale will appear here after integration.</p></div></section><section className="demo-panel" aria-labelledby="review-title"><div className="demo-panel-heading"><h2 id="review-title">Evidence &amp; limitations</h2><span className="mono">REVIEW</span></div><div className="demo-small-empty"><span aria-hidden="true">—</span><h3>Nothing to review yet.</h3><p>Reserved for source context, model provenance and caveats.</p></div></section></div></div></> : <section className="demo-panel demo-empty-section" aria-label={section}><div className="demo-empty-state"><div className="demo-empty-orbit" aria-hidden="true"><i /></div><h2>{emptySections[section].title}</h2><p>{emptySections[section].description}</p><span className="demo-empty-tag mono">PLACEHOLDER ONLY</span></div></section>}
        <p className="demo-bottom-note">A layout to discuss, not a working inference demo. No model requests or GPU jobs are triggered.</p>
      </main>
    </div>
  </div>;
}
