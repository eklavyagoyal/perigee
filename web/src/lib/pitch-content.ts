// Scoped to Docs/PITCH_REQUIREMENTS_CHECKLIST.md, not other runs.
// Reported experiment results, not independently reproduced metrics.
export const pitchBenchmark = {
  source: 'Docs/PITCH_REQUIREMENTS_CHECKLIST.md',
  testWindows: 246,
  positiveWindows: 123,
  results: [
    { name: 'Logistic regression · restricted', sourceRow: '| Classical logistic regression (restricted)', detail: 'Four numerical prompt features', accuracy: '86.99%', precision: '1.000', recall: '0.740', f1: '0.850' },
    { name: 'OpenTSLM · balanced sampling', sourceRow: '| **Fine-tuned LLM (current prompt, sub-category-balanced)**', detail: 'Current prompt + time series · sub-category-balanced training', accuracy: '86.99%', precision: '0.989', recall: '0.748', f1: '0.852' },
  ],
} as const;
