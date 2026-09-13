const steps = [
  { number: '01', label: 'PROBLEM + DATA', title: 'Start with the operator.', text: 'Help a spacecraft operations engineer review unusual telemetry in its command context. Use the open ESA Anomaly Dataset.' },
  { number: '02', label: 'CONNECT', title: 'Keep the context attached.', text: 'A reusable TimeNet connector brings together signals, metadata and annotations. Generated training rationales describe each window.' },
  { number: '03', label: 'TRAIN + EVALUATE', title: 'Compare, then question.', text: 'Fine-tune OpenTSLM with LoRA. Compare with zero-shot and classical baselines, and make the split limitations explicit.' },
  { number: '04', label: 'DEMONSTRATE', title: 'Make the evidence visible.', text: 'Next: bring a real input, model output and supporting context into one review. The workspace below is only a layout preview.' },
];

export function Approach() {
  return <section className="approach-section pitch-approach" id="approach" aria-labelledby="approach-title">
    <div className="section-top"><span className="eyebrow"><span className="section-number">02</span> THE APPROACH</span><span className="mono section-label">FROM PROBLEM TO PROOF</span></div>
    <div className="pitch-section-heading"><h2 id="approach-title">One question.<br /><span>A traceable path to an answer.</span></h2><p>Built around the challenge requirements: useful data, a reusable connector, model training, baseline comparison and a clear demonstration.</p></div>
    <div className="pitch-steps">{steps.map(step => <article key={step.number}><span className="pitch-step-number">{step.number}</span><span className="mono">{step.label}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    <div className="pitch-deliverables"><span className="mono">THE SUBMISSION</span><p>Code + training configuration <span>·</span> Checkpoint or adapter <span>·</span> Dataset documentation <span>·</span> Baseline evaluation</p><span className="pitch-pending">LIVE DEMO · STILL TO BUILD</span></div>
  </section>;
}
