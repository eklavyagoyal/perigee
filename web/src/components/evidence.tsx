import { pitchBenchmark } from '@/lib/pitch-content';

export function Evidence() {
  return <section className="evidence-section pitch-evidence" id="evidence" tabIndex={-1} aria-labelledby="evidence-title">
    <div className="section-top"><span className="eyebrow"><span className="section-number">01</span> THE RESULTS</span><span className="mono section-label">REPORTED EXPERIMENT · NOT FLIGHT VALIDATION</span></div>
    <div className="pitch-section-heading"><h2 id="evidence-title">A useful model starts<br /><span>with an honest comparison.</span></h2><p>The pitch-checklist experiment pairs ESA telemetry with command context. Here is what its classification benchmark actually shows.</p></div>
    <div className="pitch-metrics">
      <article><span className="mono">THE TEST SET</span><strong>{pitchBenchmark.testWindows}</strong><h3>Telemetry windows.</h3><p>{pitchBenchmark.positiveWindows} positive examples in one curated test split.</p></article>
      <article><span className="mono">FINE-TUNED · v13</span><strong>{pitchBenchmark.results[1].accuracy}</strong><h3>Classification accuracy.</h3><p>OpenTSLM with a Llama-3.2-3B backbone and LoRA fine-tuning.</p></article>
      <article><span className="mono">CLASSICAL BASELINE</span><strong>{pitchBenchmark.results[3].accuracy}</strong><h3>The baseline is still ahead.</h3><p>Logistic regression on the five engineered features supplied in the prompt.</p></article>
    </div>
    <div className="pitch-comparison">
      <table><caption>Same 246-row test split · reported accuracy</caption><thead><tr><th scope="col">Approach</th><th scope="col">Accuracy</th></tr></thead><tbody>{pitchBenchmark.results.map(result => <tr key={result.name} className={result.name.endsWith('v13') ? 'highlight-result' : undefined}><th scope="row">{result.name}<small>{result.detail}</small></th><td>{result.accuracy}</td></tr>)}</tbody></table>
      <aside className="pitch-learning"><span className="eyebrow">THE KEY LEARNING</span><h3>Classification is only<br />part of the question.</h3><p>The fine-tuned model does not beat the classical baseline here. Its generated rationale is a candidate aid for human review, not a validated explanation.</p><p>The next research question: can the time-series encoder add information beyond the engineered text features?</p></aside>
    </div>
    <div className="pitch-caveats"><h3>Read these numbers with their limits.</h3><p>The 80/10/10 anomaly-pair split is shuffled, not strictly time-separated. These window-level results do not establish performance on independent events, unseen missions or future operations.</p><p>Zero-shot accuracy includes all 246 rows; 111 answers (45%) were unparseable. Rationale reliability and live inference are not demonstrated by this page.</p><span className="mono">SOURCE · {pitchBenchmark.source} · BASELINE RESULTS</span></div>
  </section>;
}
