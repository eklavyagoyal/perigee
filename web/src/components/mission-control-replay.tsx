'use client';

import { useEffect, useId, useState, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Brand } from '@/components/brand';
import { boundedRange, elapsed, nearestIndex, sampleCsv, scoreRows, signalPath, STAGES,
  type ReplayBundle, type ReplayCase, type SampleRange } from '@/lib/mission-control-replay';

type View = 'pipeline' | 'evaluation' | 'artifacts';
type IconName = 'pipeline' | 'evaluation' | 'artifacts' | 'play' | 'pause' | 'next' | 'reset' | 'arrow' | 'download' | 'check';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    pipeline: <><rect x="3" y="4" width="6" height="6" rx="1" /><rect x="15" y="14" width="6" height="6" rx="1" /><path d="M6 10v7h9M15 7h6M18 4v6" /></>,
    evaluation: <><path d="M4 3v17h17M8 15v-4M13 15V7M18 15V4" /></>,
    artifacts: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    next: <path d="m8 5 7 7-7 7M19 5v14" />,
    reset: <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Kicker({ children }: { children: ReactNode }) { return <span className="mc-kicker">{children}</span>; }
function MiniTrace({ sample }: { sample: ReplayCase }) {
  return <svg className="mc-mini-trace" viewBox="0 0 130 32" aria-hidden="true"><path d={signalPath(sample.values, sample.offsetSeconds, [0, sample.values.length - 1], 130, 32, 2)} fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>;
}
function Datum({ label, children }: { label: string; children: ReactNode }) {
  return <div className="mc-datum"><dt>{label}</dt><dd>{children}</dd></div>;
}
function Download({ children, name, content, type }: { children: ReactNode; name: string; content: string; type: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button className="mc-text-button" onClick={download}><Icon name="download" />{children}</button>;
}

function SignalChart({ sample, normalized, setNormalized, reveal, inspect, setInspect }: {
  sample: ReplayCase; normalized: boolean; setNormalized: (value: boolean) => void; reveal: boolean;
  inspect: number; setInspect: (index: number) => void;
}) {
  const [range, setRange] = useState<SampleRange>([0, sample.values.length - 1]);
  const [drag, setDrag] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const clipId = useId();
  const values = normalized ? sample.normalized : sample.values;
  const visible = values.slice(range[0], range[1] + 1);
  const low = Math.min(...visible), high = Math.max(...visible);
  const padding = (high - low || 1) * .12;
  const yMin = low - padding, yMax = high + padding;
  const W = 760, H = 285, left = 62, right = 20, top = 22, bottom = 38;
  const pw = W - left - right, ph = H - top - bottom;
  const t0 = sample.offsetSeconds[range[0]], t1 = sample.offsetSeconds[range[1]];
  const x = (seconds: number) => left + (seconds - t0) / (t1 - t0) * pw;
  const y = (value: number) => top + (1 - (value - yMin) / (yMax - yMin)) * ph;
  const path = visible.map((value, i) => `${i ? 'L' : 'M'}${x(sample.offsetSeconds[range[0] + i]).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
  const cursor = Math.max(range[0], Math.min(range[1], inspect));
  const isZoomed = range[0] > 0 || range[1] < values.length - 1;

  function point(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * W - left) / pw));
    return nearestIndex(sample.offsetSeconds, t0 + fraction * (t1 - t0));
  }
  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag !== null) {
      const end = point(event);
      if (Math.abs(end - drag) >= 4) setRange(boundedRange(drag, end, values.length));
    }
    setDrag(null); setDragEnd(null);
  }
  function zoom() {
    const width = Math.max(4, Math.floor((range[1] - range[0]) / 2));
    const start = Math.max(0, Math.min(values.length - width - 1, cursor - Math.floor(width / 2)));
    setRange(boundedRange(start, start + width, values.length));
  }

  return <section className="mc-card mc-signal" aria-labelledby="signal-title">
    <div className="mc-card-heading"><div><Kicker>01 / Telemetry window</Kicker><h2 id="signal-title">{sample.channel.replace('channel_', 'Channel ')} <span className="mc-light">/ Mission1</span></h2></div>
      <div className="mc-segment" aria-label="Signal scale"><button aria-pressed={!normalized} onClick={() => setNormalized(false)}>Raw</button><button aria-pressed={normalized} onClick={() => setNormalized(true)}>Z-score</button></div>
    </div>
    <div className="mc-trace-meta"><span>{sample.startTime.slice(0, 10)} <span className="mc-light">· {sample.startTime.slice(11, 19)} start</span></span><span>{sample.statistics.samples} samples <span className="mc-light">/ 6h window</span></span></div>
    <svg className="mc-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sample.channel}, ${normalized ? 'z-score normalized' : 'raw'} telemetry. Use the sample slider and zoom buttons to inspect the signal.`}
      onPointerDown={(event) => { if (event.pointerType === 'mouse' && event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); const index = point(event); setDrag(index); setDragEnd(index); setInspect(index); }}
      onPointerMove={(event) => { const index = point(event); setInspect(index); if (drag !== null) setDragEnd(index); }}
      onPointerUp={endDrag} onPointerCancel={() => { setDrag(null); setDragEnd(null); }}>
      <defs><clipPath id={clipId}><rect x={left} y={top} width={pw} height={ph} /></clipPath></defs>
      {Array.from({ length: 5 }, (_, i) => {
        const value = yMin + (yMax - yMin) * i / 4;
        return <g key={i}><line className="mc-grid-line" x1={left} x2={W - right} y1={y(value)} y2={y(value)} /><text x={left - 12} y={y(value) + 3} textAnchor="end">{value.toFixed(normalized ? 1 : 3)}</text></g>;
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const time = t0 + (t1 - t0) * i / 4;
        return <g key={i}><line className="mc-grid-line mc-grid-vertical" x1={x(time)} x2={x(time)} y1={top} y2={H - bottom} /><text x={x(time)} y={H - 13} textAnchor="middle">{elapsed(time)}</text></g>;
      })}
      <g clipPath={`url(#${clipId})`}>
        {reveal && sample.reference.intervals.map(([start, end], i) => <rect key={i} className="mc-reference-band" x={x(start)} y={top} width={Math.max(3, x(end) - x(start))} height={ph} />)}
        {normalized && yMin < 0 && yMax > 0 && <line className="mc-zero-line" x1={left} x2={W - right} y1={y(0)} y2={y(0)} />}
        <path className="mc-signal-path" d={path} fill="none" strokeWidth="1.65" vectorEffect="non-scaling-stroke" />
        {drag !== null && dragEnd !== null && <rect className="mc-drag-band" x={x(sample.offsetSeconds[Math.min(drag, dragEnd)])} y={top} width={Math.abs(x(sample.offsetSeconds[drag]) - x(sample.offsetSeconds[dragEnd]))} height={ph} />}
        <line className="mc-cursor-line" x1={x(sample.offsetSeconds[cursor])} x2={x(sample.offsetSeconds[cursor])} y1={top} y2={H - bottom} />
        <circle cx={x(sample.offsetSeconds[cursor])} cy={y(values[cursor])} r="4" className="mc-cursor-dot" />
      </g>
      <text x={left} y="11" className="mc-axis-caption">{normalized ? 'STANDARD DEVIATIONS' : 'SOURCE VALUE / DIMENSIONLESS'}</text>
    </svg>
    <div className="mc-readout"><span><i />{elapsed(sample.offsetSeconds[cursor])} <span className="mc-light">/ #{cursor + 1}</span></span><span>raw <b>{sample.values[cursor].toFixed(5)}</b></span><span>z <b>{sample.normalized[cursor].toFixed(3)}</b></span></div>
    <div className="mc-chart-tools"><label className="mc-sample-slider">Inspect<input aria-label="Inspect sample" type="range" min={range[0]} max={range[1]} value={cursor} onChange={(event) => setInspect(Number(event.target.value))} /></label><button onClick={zoom} disabled={range[1] - range[0] <= 4}>Zoom in</button><button onClick={() => setRange([0, values.length - 1])} disabled={!isZoomed}>Full window</button></div>
    <div className="mc-chart-foot"><span>{reveal && sample.reference.intervals.length > 0 ? <><i className="mc-legend-reference" />ESA reference interval</> : <><i className="mc-legend-signal" />TimeNet signal · original timestamps</>}</span><span>Drag to zoom · prediction uses full window</span></div>
  </section>;
}

function StagePanel({ sample, run, stage, reveal, setReveal, inspect }: {
  sample: ReplayCase; run: ReplayBundle['run']; stage: number; reveal: boolean; setReveal: (value: boolean) => void; inspect: number;
}) {
  const [copied, setCopied] = useState(false);
  const patch = Math.floor(inspect / run.patchSize);
  const patchValues = Array.from({ length: run.patchSize }, (_, i) => sample.normalized[patch * run.patchSize + i] ?? 0);
  const patchCount = sample.statistics.minimumPaddedSamples / run.patchSize;
  const correct = sample.prediction === sample.reference.target;
  async function copyPrompt() {
    const content = `${sample.prompt.pre}\n\n${sample.prompt.context}\n\n[Projected time-series embeddings inserted here — not text]\n\n${sample.prompt.post}`;
    try { await navigator.clipboard.writeText(content); setCopied(true); }
    catch { setCopied(false); }
  }
  return <section className={`mc-card mc-inspector mc-inspector-${stage}`} aria-labelledby="stage-heading">
    <div className="mc-card-heading"><div><Kicker>Stage {String(stage + 1).padStart(2, '0')} / 05</Kicker><h2 id="stage-heading">{STAGES[stage].name === 'Result' ? 'Model decision' : STAGES[stage].name === 'Prompt' ? 'Inside the prompt' : STAGES[stage].name === 'Encode' ? 'Signal to embeddings' : STAGES[stage].name === 'Normalize' ? 'Preserve the shape' : 'Trace the source'}</h2></div><span className="mc-stage-index">0{stage + 1}</span></div>
    <div className="mc-inspector-body">
      {stage === 0 && <>
        <div className="mc-source-chain"><div><span className="mc-node-symbol">01</span><div><strong>ESA Anomaly Dataset</strong><small>Mission1 · subsystem_5</small></div></div><span className="mc-chain-line" /><div><span className="mc-node-symbol">02</span><div><strong>TimeNet registry</strong><small>TimeF record · v{run.datasetVersion}</small></div></div><span className="mc-chain-line" /><div><span className="mc-node-symbol mc-node-accent">03</span><div><strong>One channel, six hours</strong><small>{sample.statistics.samples} irregularly spaced values</small></div></div></div>
        <dl className="mc-details-grid"><Datum label="Dataset channels">41–46</Datum><Datum label="Channels per input">1</Datum><Datum label="Data type">float32</Datum><Datum label="Label in prompt">No</Datum></dl>
        <p className="mc-note">The waveform comes from TimeNet. The answer comes from the saved OpenTSLM run.</p>
      </>}
      {stage === 1 && <>
        <div className="mc-equation"><span>z</span><b>=</b><div><span>x − μ</span><hr /><span>max(σ, 10⁻⁶)</span></div></div>
        <dl className="mc-details-grid"><Datum label="Window mean · μ">{sample.statistics.mean.toFixed(5)}</Datum><Datum label="Population std · σ">{sample.statistics.std.toFixed(5)}</Datum><Datum label="Input length">{sample.statistics.samples}</Datum><Datum label="Min. padded length">{sample.statistics.minimumPaddedSamples}</Datum></dl>
        <div className="mc-split-flow"><div><span>Shape</span><strong>Normalized signal</strong><small>→ Time-series encoder</small></div><div><span>Absolute scale</span><strong>Raw mean + std</strong><small>→ Prompt text</small></div></div>
        <p className="mc-note">Statistics use the full window. Padding adds zeros after normalization; zoom does not recalculate them.</p>
      </>}
      {stage === 2 && <>
        <div className="mc-patch-heading"><Kicker>Input patch {patch + 1}</Kicker><span>4 consecutive samples</span></div>
        <div className="mc-patch-values">{patchValues.map((value, i) => <div key={i}><span>#{patch * 4 + i + 1}</span><b>{value.toFixed(2)}</b><div className="mc-value-bar"><i style={{ height: `${Math.min(100, Math.max(4, Math.abs(value) * 20))}%` }} /></div></div>)}</div>
        <div className="mc-architecture"><div><b>Conv1D patch embedding</b><span>kernel 4 · stride 4</span></div><Icon name="arrow" /><div><b>Transformer encoder</b><span>6 layers · 8 heads · width 128</span></div><Icon name="arrow" /><div className="mc-architecture-accent"><b>MLP projector → LLM</b><span>At least {patchCount} soft tokens for this window</span></div></div>
        <p className="mc-note">Inspect the curve to change the input patch. Architecture view; internal activations were not recorded. Batch padding may add tokens.</p>
      </>}
      {stage === 3 && <>
        <div className="mc-token-sequence" aria-label="Input embedding order"><span>Instructions</span><span>Context</span><span className="mc-soft-token">Signal vectors</span><span>Question</span></div>
        <div className="mc-prompt-scroll">
          <details><summary>01 · Instructions <span>exact text</span></summary><pre>{sample.prompt.pre}</pre></details>
          <details open><summary>02 · Channel context <span>exact text</span></summary><pre>{sample.prompt.context}</pre></details>
          <div className="mc-embedding-slot"><span className="mc-token-glyph">▥</span><div><strong>Projected signal embeddings</strong><small>Inserted as vectors into inputs_embeds</small></div></div>
          <details><summary>03 · Output instruction <span>exact text</span></summary><pre>{sample.prompt.post}</pre></details>
        </div>
        <button className="mc-text-button" onClick={copyPrompt}>{copied ? 'Copied with embedding marker' : 'Copy prompt + embedding marker'}</button>
      </>}
      {stage === 4 && <>
        <div className={`mc-decision mc-decision-${sample.prediction}`}><span className="mc-decision-symbol">{sample.prediction === 'anomalous' ? '!' : '—'}</span><div><Kicker>Recorded classification</Kicker><h3>{sample.prediction === 'anomalous' ? 'Anomalous' : 'Nominal'}</h3></div></div>
        <div className="mc-recorded-answer"><Kicker>Original model response</Kicker><pre>{sample.output}</pre></div>
        <p className="mc-note">This response contains a label only. No rationale or confidence score was saved for this window.</p>
        <div className="mc-reference"><div className="mc-reference-heading"><Kicker>ESA reference</Kicker><button className="mc-text-button" aria-expanded={reveal} onClick={() => setReveal(!reveal)}>{reveal ? 'Hide reference' : 'Reveal reference'} <Icon name="arrow" /></button></div>
          {reveal ? <><div className="mc-reference-result"><strong>{sample.reference.category}</strong><span className={correct ? 'mc-outcome-correct' : 'mc-outcome-missed'}>{correct ? 'Matches task label' : 'Missed positive'}</span></div><p className="mc-note">{sample.reference.category === 'Rare Event' ? 'This run maps Rare Event to anomalous. That is a task label, not proof of a fault.' : sample.reference.category === 'Anomaly' ? 'ESA labels this as an Anomaly. Its annotated interval is now marked on the chart.' : 'Sampled nominal window, clear of ESA-labeled intervals.'}</p></> : <p className="mc-note">Compare the decision with the dataset label.</p>}
        </div>
      </>}
    </div>
    <div className="mc-inspector-footer"><span>{stage === 4 ? 'Source: saved prediction row' : stage === 3 ? 'Numeric signal stays numeric' : 'Single-channel OpenTSLM path'}</span><span>{stage + 1} / 5</span></div>
  </section>;
}

function Evaluation({ bundle }: { bundle: ReplayBundle }) {
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const score = scoreRows(bundle.evaluation, anomalyOnly);
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const categories = ['Anomaly', 'Rare Event', 'Nominal'] as const;
  return <div className="mc-evaluation">
    <p className="mc-note">This replay uses the earlier saved run (trained-task F1 0.840). The <Link href="/#evidence">updated research comparison</Link> reports a different, sub-category-balanced run; its aggregate scores are not substituted for these saved predictions.</p>
    <div className="mc-section-intro"><div><Kicker>Complete saved test cohort</Kicker><h2>What did the model catch?</h2></div><div className="mc-segment" aria-label="Evaluation target"><button aria-pressed={!anomalyOnly} onClick={() => setAnomalyOnly(false)}>Trained task</button><button aria-pressed={anomalyOnly} onClick={() => setAnomalyOnly(true)}>Anomaly only</button></div></div>
    <p className="mc-eval-definition">{anomalyOnly ? 'Positive = ESA Anomaly. Rare Events are negatives in this diagnostic rescore; the model was not trained for this target.' : 'Positive = ESA Anomaly + Rare Event. Metrics use all 246 saved predictions, not just the five demo windows.'}</p>
    <div className="mc-metric-row"><div><Kicker>Recall</Kicker><strong>{percent(score.recall)}</strong><span>{score.tp} of {score.tp + score.fn} positives detected</span></div><div><Kicker>Precision</Kicker><strong>{percent(score.precision)}</strong><span>{score.tp} of {score.tp + score.fp} alerts match the target</span></div><div><Kicker>F1 score</Kicker><strong>{percent(score.f1)}</strong><span>Precision / recall balance</span></div><div><Kicker>Missed positives</Kicker><strong className="mc-missed-value">{score.fn}</strong><span>Among {score.total} evaluated windows</span></div></div>
    <div className="mc-eval-grid"><section className="mc-card"><div className="mc-card-heading"><div><Kicker>By original ESA category</Kicker><h2>Flagged vs. quiet</h2></div></div><div className="mc-category-bars">{categories.map((category) => {
      const rows = bundle.evaluation.filter((row) => row.reference === category);
      const flagged = rows.filter((row) => row.prediction === 'anomalous').length;
      return <div key={category}><div className="mc-bar-title"><strong>{category}</strong><span>{flagged} flagged <span className="mc-light">/ {rows.length} total</span></span></div><div className="mc-bar-track" role="img" aria-label={`${category}: ${flagged} flagged, ${rows.length - flagged} quiet`}><span style={{ width: `${flagged / rows.length * 100}%` }} /></div><small>{rows.length - flagged} quiet</small></div>;
    })}</div></section><section className="mc-card"><div className="mc-card-heading"><div><Kicker>Window-level counts</Kicker><h2>Confusion matrix</h2></div></div><div className="mc-matrix"><div className="mc-matrix-hit"><span>True positive</span><strong>{score.tp}</strong></div><div><span>False positive</span><strong>{score.fp}</strong></div><div className="mc-matrix-miss"><span>False negative</span><strong>{score.fn}</strong></div><div><span>True negative</span><strong>{score.tn}</strong></div></div></section></div>
    <details className="mc-disclosure" open><summary>Evaluation scope <span>Read before interpreting the scores</span></summary><div className="mc-scope-grid"><p><strong>Balanced sample</strong>123 positive + 123 nominal windows. Precision on this curated cohort is not deployment precision.</p><p><strong>Historical replay</strong>Saved predictions from the old split, before event grouping was corrected. Not the new 224-window evaluation.</p><p><strong>Generalization limit</strong>These scores describe the saved split. They do not establish performance on unseen events or a chronological holdout.</p></div></details>
  </div>;
}

function Artifacts({ bundle, sample }: { bundle: ReplayBundle; sample: ReplayCase }) {
  const { run } = bundle;
  return <div className="mc-artifacts"><div className="mc-section-intro"><div><Kicker>Provenance / reproducibility</Kicker><h2>Every view has a source.</h2></div><a className="mc-primary" href="/mission-control/replay.json" download="perigee-mission-control-replay.json"><Icon name="download" />Download replay bundle</a></div>
    <section className="mc-card"><div className="mc-card-heading"><div><Kicker>Saved run</Kicker><h2>{run.model}</h2></div><span className="mc-badge">Recorded · no live inference</span></div><dl className="mc-artifact-data"><Datum label="Run ID">{run.id}</Datum><Datum label="Prediction snapshot">{run.recordedAt}</Datum><Datum label="Recorded epoch field">{run.epoch}</Datum><Datum label="Dataset">{run.dataset} / {run.datasetVersion}</Datum><Datum label="Training inputs">Channels 41–46, one channel per window</Datum><Datum label="Train / validation / test">{run.split.train} / {run.split.validation} / {run.split.test}</Datum><Datum label="Prediction file SHA-256"><code>{run.predictionSha256}</code></Datum></dl></section>
    <section className="mc-card"><div className="mc-card-heading"><div><Kicker>Selected input</Kicker><h2>{sample.name} · {sample.channel.replace('channel_', 'CH ')}</h2></div><Download content={sampleCsv(sample)} name={`${sample.id}.csv`} type="text/csv">Download signal CSV</Download></div><dl className="mc-artifact-data"><Datum label="TimeF record">{sample.recordId}</Datum><Datum label="Prediction row">{sample.row} (zero-based)</Datum><Datum label="Values SHA-256 · float32 LE"><code>{sample.sha256.valuesFloat32LE}</code></Datum><Datum label="Prediction row SHA-256"><code>{sample.sha256.predictionRow}</code></Datum></dl></section>
    <details className="mc-disclosure" open><summary>What this replay preserves</summary><div className="mc-provenance-notes"><p>{run.replay}</p><p>{run.timeBasis}</p><p>{run.padding}</p><p>Prompt wording and model responses are preserved verbatim. No weights, GPU connection, API keys, activation tensors or confidence scores are included. Reference labels are in the downloadable bundle; the reveal button is a presentation control.</p></div></details>
  </div>;
}

export function MissionControlReplay({ bundle }: { bundle: ReplayBundle }) {
  const [view, setView] = useState<View>('pipeline');
  const [caseIndex, setCaseIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [inspect, setInspect] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [scaleOverride, setScaleOverride] = useState<boolean | null>(null);
  const sample = bundle.cases[caseIndex];
  const normalized = scaleOverride ?? (stage === 1 || stage === 2);
  const nav: { id: View; title: string; icon: IconName }[] = [{ id: 'pipeline', title: 'Pipeline', icon: 'pipeline' }, { id: 'evaluation', title: 'Evaluation', icon: 'evaluation' }, { id: 'artifacts', title: 'Artifacts', icon: 'artifacts' }];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (stage >= 3) { setStage(4); setPlaying(false); }
      else setStage(stage + 1);
      setScaleOverride(null);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [playing, stage]);

  function selectCase(index: number) { setCaseIndex(index); setStage(0); setPlaying(false); setReveal(false); setInspect(0); setScaleOverride(null); }
  function selectStage(index: number) { setStage(index); setPlaying(false); setScaleOverride(null); }
  function reset() { setStage(0); setPlaying(false); setReveal(false); setInspect(0); setScaleOverride(null); setResetCount(value => value + 1); }
  function toggleReplay() {
    if (playing) { setPlaying(false); return; }
    if (stage === 4) { setStage(0); setReveal(false); setResetCount(value => value + 1); }
    setScaleOverride(null); setPlaying(true);
  }

  return <div className="mc-app">
    <a className="skip-link" href="#mc-main">Skip to mission pipeline</a>
    <aside className="mc-sidebar"><Brand /><div className="mc-workspace-name"><span className="mc-workspace-icon">M1</span><div>Mission workspace<small>ESA · Telemetry intelligence</small></div></div><Kicker>Explore the evidence</Kicker><nav aria-label="Mission control">{nav.map((item) => <button key={item.id} aria-pressed={view === item.id} onClick={() => { setView(item.id); setPlaying(false); }}><Icon name={item.icon} /><span>{item.title}</span>{view === item.id && <i />}</button>)}</nav><div className="mc-sidebar-bottom"><div className="mc-model-card"><Kicker>Recorded model</Kicker><strong>OpenTSLM SP</strong><span>Llama 3.2 · 3B</span><div><i />Browser replay ready</div></div><Link href="/" className="mc-back-link">Back to presentation <Icon name="arrow" /></Link><span className="mc-sidebar-foot">PERIGEE / MISSION CONTROL</span></div></aside>
    <div className="mc-main-shell"><header className="mc-topbar"><div>Workspace <span>/</span> <b>{nav.find((item) => item.id === view)?.title}</b></div><span className="mc-badge"><i />Recorded run <span className="mc-badge-detail">· no live inference</span></span></header>
      <main id="mc-main" className="mc-main"><div className="mc-page-heading"><div><Kicker>Mission control / ESA Mission1</Kicker><h1>{view === 'pipeline' ? 'Telemetry pipeline.' : view === 'evaluation' ? 'Results in context.' : 'The evidence trail.'}</h1><p>{view === 'pipeline' ? 'Follow a real window from source signal to model decision.' : view === 'evaluation' ? 'Inspect what was detected, what was missed, and how it was scored.' : 'Recorded inputs, exact prompt text and saved predictions.'}</p></div><span className="mc-run-stamp">SP–3B <span>/</span> 13 SEP 2026<small>5 curated windows · 246 evaluated</small></span></div>
        {view === 'pipeline' && <>
          <div className="mc-window-label"><Kicker>Select a recorded window</Kicker><span>ESA category revealed after the decision</span></div>
          <div className="mc-window-picker" aria-label="Recorded windows">{bundle.cases.map((item, index) => <button key={item.id} aria-pressed={caseIndex === index} onClick={() => selectCase(index)} aria-label={`${item.name}, ${item.channel.replace('channel_', 'channel ')}, ${item.startTime.slice(0, 10)}`}><div><span className="mc-window-number">0{index + 1}</span><strong>{item.channel.replace('channel_', 'CH ')}</strong><span className="mc-window-date">{item.startTime.slice(0, 10)}</span></div><MiniTrace sample={item} /></button>)}</div>
          <div className="mc-pipeline-bar"><Kicker>Inference path</Kicker><div className="mc-replay-controls"><span>{playing ? 'Replaying recorded steps' : 'Explore each step or replay'}</span><button className="mc-icon-button" onClick={reset} aria-label="Reset pipeline"><Icon name="reset" /></button><button className="mc-icon-button" disabled={stage === 4} onClick={() => selectStage(Math.min(4, stage + 1))} aria-label="Next pipeline step"><Icon name="next" /></button><button className="mc-primary mc-replay-button" onClick={toggleReplay}><Icon name={playing ? 'pause' : 'play'} />{playing ? 'Pause' : stage === 4 ? 'Replay again' : 'Replay pipeline'}</button></div></div>
          <ol className="mc-stage-track" aria-label="Pipeline steps">{STAGES.map((item, index) => <li key={item.name}><button aria-label={`Step ${index + 1}: ${item.name} ${item.short}`} aria-current={stage === index ? 'step' : undefined} onClick={() => selectStage(index)} className={index < stage ? 'mc-stage-past' : ''}><span className="mc-step-number">{index < stage ? <Icon name="check" /> : `0${index + 1}`}</span><div><strong>{item.name}</strong><small>{item.short}</small></div><span className="mc-step-arrow">›</span></button></li>)}</ol>
          <div className="mc-live-region" role="status" aria-live="polite">{sample.name}, step {stage + 1} of 5: {STAGES[stage].name}{stage === 4 ? `. Saved response: ${sample.output}` : ''}</div>
          <div className="mc-inspection-grid"><SignalChart key={`signal-${sample.id}-${resetCount}`} sample={sample} normalized={normalized} setNormalized={setScaleOverride} reveal={reveal} inspect={inspect} setInspect={setInspect} /><StagePanel key={`stage-${sample.id}`} sample={sample} run={bundle.run} stage={stage} reveal={reveal} setReveal={setReveal} inspect={inspect} /></div>
          <div className="mc-traceability-strip"><span><Icon name="artifacts" /><b>TimeF record</b><code>{reveal ? sample.recordId : `${sample.channel} / saved row ${sample.row}`}</code></span><button onClick={() => setView('artifacts')}>View provenance <Icon name="arrow" /></button></div>
          <details className="mc-disclosure mc-compact-disclosure"><summary>Input contract <span>What enters the model</span></summary><div className="mc-scope-grid"><p><strong>Numeric branch</strong>One channel → window z-score → 4-sample patches → Transformer encoder → MLP → soft prompt vectors.</p><p><strong>Text branch</strong>Channel, raw mean/std and priority ≥2 telecommand timing. Labels and reference intervals are excluded.</p><p><strong>Recorded output</strong>The site replays a saved answer. Cropping or switching scale changes the view, not the model input or its prediction.</p></div></details>
        </>}
        {view === 'evaluation' && <Evaluation bundle={bundle} />}
        {view === 'artifacts' && <Artifacts bundle={bundle} sample={sample} />}
        <div className="mc-page-foot"><span>ESA → TimeNet → OpenTSLM → recorded decision</span><span>CPU-hostable · no GPU or API required</span></div>
      </main>
    </div>
  </div>;
}
