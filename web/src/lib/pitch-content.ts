// Scoped to Docs/PITCH_REQUIREMENTS_CHECKLIST.md, not other runs.
// Reported experiment results, not independently reproduced metrics.
export const pitchBenchmark = {
  source: 'Docs/PITCH_REQUIREMENTS_CHECKLIST.md',
  testWindows: 246,
  positiveWindows: 123,
  results: [
    { name: 'Zero-shot Llama-3.2-3B', detail: 'Text only · no time-series encoder', accuracy: '23.6%' },
    { name: 'OpenTSLM · v13', detail: 'Fine-tuned · statistics + periodicity + commands', accuracy: '86.99%' },
    { name: 'OpenTSLM · v14', detail: 'Fine-tuned · statistics + commands', accuracy: '82.52%' },
    { name: 'Logistic regression', detail: 'Classical baseline · five engineered features', accuracy: '89.84%' },
  ],
} as const;
