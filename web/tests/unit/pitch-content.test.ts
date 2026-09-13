import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pitchBenchmark } from '@/lib/pitch-content';

const checklist = readFileSync(new URL('../../Docs/PITCH_REQUIREMENTS_CHECKLIST.md', import.meta.url), 'utf8');

describe('pitch checklist provenance', () => {
  it('keeps every displayed accuracy tied to the corresponding checklist row', () => {
    const identifiers = ['Zero-shot Llama-3.2-3B', '| v13 ', '| v14 ', '**Classical baseline**'];
    pitchBenchmark.results.forEach((result, index) => {
      const row = checklist.split('\n').find(line => line.includes(identifiers[index]));
      expect(row).toBeDefined();
      expect(row).toContain(result.accuracy);
    });
  });
  it('preserves the test population and does not present the model as the winner', () => {
    expect(checklist).toContain(`${pitchBenchmark.testWindows}-row test split`);
    expect(checklist).toContain(`${pitchBenchmark.positiveWindows} positive examples`);
    expect(parseFloat(pitchBenchmark.results[1].accuracy)).toBeLessThan(parseFloat(pitchBenchmark.results[3].accuracy));
  });
});
