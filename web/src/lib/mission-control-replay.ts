export type Label = 'nominal' | 'anomalous';
export type ReferenceCategory = 'Anomaly' | 'Rare Event' | 'Nominal';
export type SampleRange = [number, number];

export interface ReplayCase {
  id: string;
  name: string;
  row: number;
  recordId: string;
  channel: string;
  startTime: string;
  offsetSeconds: number[];
  values: number[];
  normalized: number[];
  statistics: { mean: number; std: number; min: number; max: number; samples: number; minimumPaddedSamples: number };
  telecommandMinutes: number | null;
  prompt: { pre: string; context: string; post: string };
  output: string;
  prediction: Label;
  reference: { category: ReferenceCategory; target: Label; intervals: [number, number][] };
  sha256: { valuesFloat32LE: string; predictionRow: string };
}

export interface EvaluationRow {
  row: number;
  recordId: string;
  channel: string;
  reference: ReferenceCategory;
  target: Label;
  prediction: Label;
}

export interface ReplayBundle {
  schemaVersion: number;
  run: {
    id: string; model: string; backbone: string; recordedAt: string; epoch: number;
    dataset: string; datasetVersion: string; channels: number[]; patchSize: number;
    encoderWidth: number; encoderLayers: number; encoderHeads: number;
    split: { train: number; validation: number; test: number; seed: number; unit: string; testEventIds: number; testEventIdsAlsoInTrain: number };
    predictionSha256: string; predictionFile: string; source: string; timeBasis: string;
    normalization: string; padding: string; replay: string; exportedAt: string;
  };
  cases: ReplayCase[];
  evaluation: EvaluationRow[];
}

export const STAGES = [
  { name: 'Source', short: 'TimeNet / TimeF' },
  { name: 'Normalize', short: 'Window z-score' },
  { name: 'Encode', short: 'Signal → soft tokens' },
  { name: 'Prompt', short: 'Text + embeddings' },
  { name: 'Result', short: 'Recorded response' },
] as const;

export function boundedRange(start: number, end: number, length: number): SampleRange {
  const low = Math.max(0, Math.min(length - 2, Math.round(Math.min(start, end))));
  return [low, Math.min(length - 1, Math.max(low + 1, Math.round(Math.max(start, end))))];
}

export function nearestIndex(times: number[], target: number): number {
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (times[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low > 0 && target - times[low - 1] < times[low] - target ? low - 1 : low;
}

export function signalPath(values: number[], times: number[], range: SampleRange, width: number, height: number, inset = 0): string {
  const [start, end] = range;
  const visible = values.slice(start, end + 1);
  const min = Math.min(...visible);
  const max = Math.max(...visible);
  const span = max - min || 1;
  const duration = times[end] - times[start] || 1;
  return visible.map((value, offset) => {
    const x = inset + (times[start + offset] - times[start]) / duration * (width - 2 * inset);
    const y = inset + (1 - (value - min) / span) * (height - 2 * inset);
    return `${offset ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export function scoreRows(rows: EvaluationRow[], anomalyOnly = false) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const row of rows) {
    const positive = anomalyOnly ? row.reference === 'Anomaly' : row.target === 'anomalous';
    if (row.prediction === 'anomalous') { if (positive) tp++; else fp++; }
    else { if (positive) fn++; else tn++; }
  }
  return { tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0,
    f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0, total: rows.length };
}

export function elapsed(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}

export function sampleCsv(sample: ReplayCase): string {
  return ['timestamp_utc_equivalent,offset_seconds,value,z_score', ...sample.values.map((value, i) =>
    `${new Date(Date.parse(sample.startTime) + sample.offsetSeconds[i] * 1000).toISOString()},${sample.offsetSeconds[i]},${value},${sample.normalized[i]}`,
  )].join('\n') + '\n';
}
