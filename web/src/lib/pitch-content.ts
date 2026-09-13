// Reported fixed-split results from the authoritative pitch checklist, not rerun here.
export const pitchBenchmark = {
  source: 'Docs/PITCH_REQUIREMENTS_CHECKLIST.md',
  testWindows: 224,
  positiveWindows: 112,
  model: { name: 'OpenTSLM · balanced sampling', detail: 'LoRA · retrained on the event-grouped split', accuracy: '75.89%', precision: '0.837', recall: '0.643', f1: '0.727' },
  confusion: { trueNegative: 98, falsePositive: 14, falseNegative: 40, truePositive: 72 },
  categories: { rareEvent: { detected: 49, total: 74 }, anomaly: { detected: 23, total: 38 } },
  results: [
    { name: 'Two-shot Llama-3.2-3B', sourceRow: '| Two-shot LLM baseline, no fine-tuning |', detail: 'Frozen text-only LLM · no time-series encoder', accuracy: '50.45%', precision: '1.000', recall: '0.009', f1: null },
    { name: 'Classical · current prompt features', sourceRow: '| Classical baseline, restricted to current prompt', detail: 'Logistic regression · mean, std, telecommand presence/timing', accuracy: '90.18%', precision: '1.000', recall: '0.804', f1: '0.891' },
    { name: 'Classical · five engineered features', sourceRow: '| Classical baseline (logistic regression, 5 engineered features)', detail: 'Logistic regression · includes features removed from the current prompt', accuracy: '92.86%', precision: '1.000', recall: '0.857', f1: '0.923' },
    { name: 'Classical · raw values only', sourceRow: '| Classical baseline, RAW values only (no engineered features', detail: 'Logistic regression · 120 resampled raw points · no summary statistics', accuracy: '57.59%', precision: '0.623', recall: '0.384', f1: '0.475' },
  ],
} as const;
