import Link from 'next/link';
import { Arrow } from './brand';
import { pitchBenchmark } from '@/lib/pitch-content';

export function Evidence() {
  return <section className="landing-evidence" id="evidence" tabIndex={-1} aria-labelledby="evidence-title">
    <div className="landing-evidence-heading"><div><span className="eyebrow">THE RESEARCH</span><h2 id="evidence-title">Find the signal.<br /><span>Understand the context.</span></h2></div><p>ESA telemetry. Command history. OpenTSLM.<br />For the engineers behind the mission.</p></div>
    <div className="landing-metrics">
      <article><strong>{pitchBenchmark.testWindows}</strong><span>Test windows</span></article>
      <article><strong>{pitchBenchmark.results[1].accuracy}</strong><span>OpenTSLM · accuracy</span></article>
      <article><strong>{pitchBenchmark.results[0].accuracy}</strong><span>Restricted baseline · accuracy</span></article>
    </div>
    <p className="landing-result-note">Same accuracy. Similar F1. An event-overlapping test split — not flight validation.</p>
    <div className="landing-next"><Link className="button button-light" href="/mission-control">Open mission control <Arrow /></Link><span>Telemetry. Context. Human judgement.</span></div>
    <details className="landing-method"><summary>Experiment details &amp; limitations <span aria-hidden="true">+</span></summary>
      <div className="landing-method-body"><table><caption>Same 246-row test split · reported results</caption><thead><tr><th scope="col">Approach</th><th scope="col">Accuracy / F1</th></tr></thead><tbody>{pitchBenchmark.results.map(result => <tr key={result.name}><th scope="row">{result.name}<small>{result.detail}<br />Precision {result.precision} · recall {result.recall}</small></th><td>{result.accuracy}<br /><small>F1 {result.f1}</small></td></tr>)}</tbody></table>
        <div><p>The restricted logistic baseline uses window mean, standard deviation, command presence and minutes since command. OpenTSLM (Llama-3.2-3B, LoRA) additionally receives the time series and channel identifier. The F1 difference of 0.002 does not establish a meaningful advantage.</p><p>The 80/10/10 anomaly-pair split is shuffled, not strictly time-separated. Of 246 test windows, 123 are positive: Anomaly and Rare Event are grouped together. The split audit found 68 of 69 test event IDs also in training. An independent-event or chronological holdout is still needed.</p><p>Mission Control replays an earlier saved run (F1 0.840), not this newly reported run. A generated rationale is a candidate aid for review, not a validated explanation.</p><p>Source: {pitchBenchmark.source}, reproduced in the web documentation. Reported checklist results, not independently reproduced here.</p></div>
      </div>
    </details>
  </section>;
}
