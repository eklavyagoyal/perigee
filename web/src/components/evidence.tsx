import Link from 'next/link';
import { Arrow } from './brand';
import { pitchBenchmark } from '@/lib/pitch-content';

export function Evidence() {
  return <section className="landing-evidence" id="evidence" tabIndex={-1} aria-labelledby="evidence-title">
    <div className="landing-evidence-heading"><div><span className="eyebrow">THE RESEARCH</span><h2 id="evidence-title">Find the signal.<br /><span>Understand the context.</span></h2></div><p>ESA telemetry. Command history. OpenTSLM.<br />For the engineers behind the mission.</p></div>
    <div className="landing-metrics">
      <article><strong>{pitchBenchmark.testWindows}</strong><span>Event-grouped test windows</span></article>
      <article><strong>{pitchBenchmark.results[0].accuracy}</strong><span>Two-shot LLM · accuracy</span></article>
      <article><strong>{pitchBenchmark.model.accuracy}</strong><span>OpenTSLM · accuracy</span></article>
    </div>
    <p className="landing-result-note">OpenTSLM outperforms the two-shot LLM baseline. Classical summary statistics still lead at 90.18%. Reported results — not flight validation.</p>
    <div className="landing-next"><Link className="button button-light" href="/mission-control">Open mission control <Arrow /></Link><span>Telemetry. Context. Human judgement.</span></div>
    <details className="landing-method"><summary>Experiment details &amp; limitations <span aria-hidden="true">+</span></summary>
      <div className="landing-method-body"><table><caption>Fixed event-grouped split · 224 test windows · reported results</caption><thead><tr><th scope="col">Approach</th><th scope="col">Accuracy</th></tr></thead><tbody>{[pitchBenchmark.model, ...pitchBenchmark.results].map(result => <tr key={result.name}><th scope="row">{result.name}<small>{result.detail}<br />Precision {result.precision} · recall {result.recall} · F1 {result.f1 ?? 'not reported'}</small></th><td>{result.accuracy}</td></tr>)}</tbody></table>
        <div>
          <p>The updated checklist groups all channels from the same event by anomaly_id. It reports zero event overlap across training, validation and test. The evaluation is still not strictly time-separated. The 224 test windows are balanced: 112 nominal and 112 positive. Positive means Anomaly + Rare Event.</p>
          <p>The two-shot frozen Llama-3.2-3B baseline reports 50.45% accuracy and 0.009 recall. Precision 1.000 accompanies extremely few positive predictions, not broad detection. F1 and a new parsing count are not reported for this rerun; the old 246-window parsing figures are not transferred to it.</p>
          <p>The restricted classical baseline uses mean, standard deviation and telecommand presence/timing. It leads with 90.18% accuracy and 0.891 F1 versus OpenTSLM at 75.89% and 0.727. The five-feature and raw-values baselines use different input representations, so this is not an isolated measure of encoder performance.</p>
          <p>OpenTSLM SP with sub-category-balanced sampling was retrained on the corrected split using an H200. It correctly classifies 170 of 224 windows: 98 nominal and 72 positive, with 14 false positives and 40 missed positive windows. Precision is 0.837, recall 0.643 and F1 0.727. Rare Event recall is 66.2% (49/74); Anomaly recall is 60.5% (23/38). These replace the old-split headline scores. Checkpoint selection used validation loss; the selected checkpoint was epoch 7.</p>
          <p>Mission Control replays an earlier saved run on the old split (F1 0.840), not the corrected evaluation. It is a demonstration of the workflow, not evidence of new model performance. A generated rationale is a candidate aid for review, not a validated explanation.</p>
          <p>Source: {pitchBenchmark.source}, reproduced in the web documentation. Reported checklist results, not independently reproduced here.</p>
        </div>
      </div>
    </details>
  </section>;
}
