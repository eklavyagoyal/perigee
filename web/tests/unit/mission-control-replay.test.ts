import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import replay from '../../public/mission-control/replay.json';
import { boundedRange, nearestIndex, sampleCsv, scoreRows, signalPath, type ReplayBundle } from '@/lib/mission-control-replay';

const bundle = replay as ReplayBundle;

describe('recorded mission-control evidence', () => {
  it('pins the audited run and keeps successes and failures', () => {
    expect(bundle.run.predictionSha256).toBe('38f92839518fd7ec9aba7ad195a5fdb2ec7b011631d7e308f0433273132b4ffd');
    expect(bundle.evaluation).toHaveLength(246);
    expect(bundle.cases.map(sample => [sample.reference.category, sample.prediction])).toEqual([
      ['Anomaly', 'anomalous'], ['Anomaly', 'nominal'], ['Rare Event', 'anomalous'], ['Rare Event', 'nominal'], ['Nominal', 'nominal'],
    ]);
  });
  it.each(bundle.cases)('$id preserves signal bytes, actual timestamps and normalized input', sample => {
    const bytes = Buffer.alloc(sample.values.length * 4);
    sample.values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sample.sha256.valuesFloat32LE);
    expect(sample.values).toHaveLength(sample.statistics.samples);
    expect(sample.normalized).toHaveLength(sample.values.length);
    expect(sample.offsetSeconds).toHaveLength(sample.values.length);
    expect(sample.offsetSeconds[0]).toBe(0);
    expect(sample.offsetSeconds.at(-1)).toBeLessThan(21600);
    const steps = sample.offsetSeconds.slice(1).map((time, index) => time - sample.offsetSeconds[index]);
    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(new Set(steps).size).toBeGreaterThan(1);
    sample.values.forEach((value, index) => {
      const z = Math.fround(Math.fround(value - sample.statistics.mean) / Math.max(sample.statistics.std, 1e-6));
      expect(sample.normalized[index]).toBeCloseTo(z, 5);
    });
    expect(sample.prompt.context).toContain(`mean ${sample.statistics.mean.toFixed(4)} and std ${sample.statistics.std.toFixed(4)}`);
    expect(sample.output).toBe(`Answer: ${sample.prediction}`);
    expect(bundle.evaluation[sample.row]).toMatchObject({ recordId: sample.recordId, prediction: sample.prediction, reference: sample.reference.category });
    for (const [start, end] of sample.reference.intervals) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThanOrEqual(start);
      expect(end).toBeLessThanOrEqual(sample.offsetSeconds.at(-1)!);
    }
  });
  it('separates trained task metrics from anomaly-only diagnostics', () => {
    const trained = scoreRows(bundle.evaluation);
    expect(trained).toMatchObject({ tp: 89, fp: 0, fn: 34, tn: 123, total: 246 });
    expect(trained.recall).toBeCloseTo(89 / 123);
    expect(trained.precision).toBe(1);
    const anomalies = scoreRows(bundle.evaluation, true);
    expect(anomalies).toMatchObject({ tp: 25, fp: 64, fn: 12, tn: 145, total: 246 });
    expect(anomalies.recall).toBeCloseTo(25 / 37);
    expect(anomalies.precision).toBeCloseTo(25 / 89);
  });
  it('exports every original point, rather than the current visual crop', () => {
    const sample = bundle.cases[0];
    const csv = sampleCsv(sample).trim().split('\n');
    expect(csv).toHaveLength(sample.values.length + 1);
    expect(csv[0]).toBe('timestamp_utc_equivalent,offset_seconds,value,z_score');
    expect(csv[1]).toContain(sample.startTime.slice(0, 23));
    const last = csv.at(-1)!.split(',');
    expect(Number(last[1])).toBe(sample.offsetSeconds.at(-1));
    expect(Number(last[2])).toBe(sample.values.at(-1));
  });
});

describe('signal inspection geometry', () => {
  it('finds actual nearest samples on an irregular timeline', () => {
    expect(nearestIndex([0, 7.5, 30, 60], 11)).toBe(1);
    expect(nearestIndex([0, 7.5, 30, 60], 27)).toBe(2);
    expect(nearestIndex([0, 7.5, 30, 60], -100)).toBe(0);
    expect(nearestIndex([0, 7.5, 30, 60], 100)).toBe(3);
  });
  it('handles reversed drag, bounds and a zero-width selection', () => {
    expect(boundedRange(90, 30, 100)).toEqual([30, 90]);
    expect(boundedRange(-100, 200, 100)).toEqual([0, 99]);
    expect(boundedRange(99, 99, 100)).toEqual([98, 99]);
  });
  it('plots elapsed time rather than sample position and supports flat signals', () => {
    expect(signalPath([0, 1, 0], [0, 10, 100], [0, 2], 100, 50)).toBe('M0.00,50.00 L10.00,0.00 L100.00,50.00');
    expect(signalPath([1, 1], [0, 10], [0, 1], 100, 50)).not.toMatch(/NaN|Infinity/);
  });
});
