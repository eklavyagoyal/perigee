import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pitchBenchmark } from '@/lib/pitch-content';

const checklist = readFileSync(new URL('../../Docs/PITCH_REQUIREMENTS_CHECKLIST.md', import.meta.url), 'utf8');

describe('pitch checklist provenance', () => {
  it('keeps every displayed accuracy tied to the corresponding checklist row', () => {
    pitchBenchmark.results.forEach((result) => {
      const fixedSection = checklist.split('**Reproduced on the fixed split already**')[1];
      const row = fixedSection.split('\n').find(line => line.includes(result.sourceRow))?.split('|')[3];
      expect(row).toBeDefined();
      expect(row).toContain(result.accuracy);
      for (const metric of [result.precision, result.recall, result.f1]) if (metric !== null) expect(row).toContain(metric);
    });
  });
  it('uses the corrected cohort without transferring old fine-tuned or parsing results', () => {
    expect(checklist).toContain(`/ ${pitchBenchmark.testWindows} test rows`);
    expect(checklist).toContain('exactly 50/50 nominal:anomalous');
    expect(pitchBenchmark.positiveWindows * 2).toBe(pitchBenchmark.testWindows);
    expect(pitchBenchmark.results[0].name).toBe('Two-shot Llama-3.2-3B');
    expect(pitchBenchmark.results[0].f1).toBeNull();
    expect(pitchBenchmark.results.every(result => !result.name.includes('OpenTSLM'))).toBe(true);
  });
  it('checks the retrained model against the new table and confusion counts', () => {
    const section = checklist.split('| Metric | Leaky split (old) | Fixed split (new) |')[1];
    for (const key of ['accuracy', 'precision', 'recall', 'f1'] as const) {
      const row = section.split('\n').find(line => line.toLowerCase().startsWith(`| ${key} |`))?.split('|')[3];
      expect(row).toContain(pitchBenchmark.model[key]);
    }
    const { truePositive: tp, trueNegative: tn, falsePositive: fp, falseNegative: fn } = pitchBenchmark.confusion;
    expect(tp + tn + fp + fn).toBe(pitchBenchmark.testWindows);
    expect(((tp + tn) / pitchBenchmark.testWindows * 100).toFixed(2) + '%').toBe(pitchBenchmark.model.accuracy);
    expect((tp / (tp + fp)).toFixed(3)).toBe(pitchBenchmark.model.precision);
    expect((tp / (tp + fn)).toFixed(3)).toBe(pitchBenchmark.model.recall);
    expect((2 * tp / (2 * tp + fp + fn)).toFixed(3)).toBe(pitchBenchmark.model.f1);
    expect(pitchBenchmark.categories.rareEvent.detected + pitchBenchmark.categories.anomaly.detected).toBe(tp);
  });
});
