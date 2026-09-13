import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pitchBenchmark } from '@/lib/pitch-content';

const checklist = readFileSync(new URL('../../Docs/PITCH_REQUIREMENTS_CHECKLIST.md', import.meta.url), 'utf8');

describe('pitch checklist provenance', () => {
  it('keeps every displayed accuracy tied to the corresponding checklist row', () => {
    pitchBenchmark.results.forEach((result) => {
      const row = checklist.split('\n').find(line => line.includes(result.sourceRow));
      expect(row).toBeDefined();
      expect(row).toContain(result.accuracy);
      for (const metric of [result.precision, result.recall, result.f1]) expect(row).toContain(metric);
    });
  });
  it('preserves the test population and does not present the model as the winner', () => {
    expect(checklist).toContain(`${pitchBenchmark.testWindows}-row test split`);
    expect(checklist).toContain(`${pitchBenchmark.positiveWindows} positive examples`);
    expect(pitchBenchmark.results[1].accuracy).toEqual(pitchBenchmark.results[0].accuracy);
    expect(Number(pitchBenchmark.results[1].f1) - Number(pitchBenchmark.results[0].f1)).toBeCloseTo(0.002);
  });
});
