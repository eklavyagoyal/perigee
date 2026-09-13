import { describe, expect, it } from 'vitest';
import { chapterAt, chapterPositions, chapterStyle, smooth } from '@/lib/descent';
import { scriptedReview, syntheticSignal } from '@/lib/demo';
import { frameIndex, frameManifestSchema, frameURL } from '@/lib/frame-contract';

describe('scroll and illustrative demo', () => {
  it('maps each chapter control to its own visible chapter', () => {
    chapterPositions.forEach((position, index) => { expect(chapterAt(position)).toBe(index); expect(chapterStyle(index, position).opacity).toBe(1); });
  });
  it('clamps transitions and keeps only the final chapter at the end', () => {
    expect(smooth(0, 1, -2)).toBe(0); expect(smooth(0, 1, 2)).toBe(1);
    expect(chapterStyle(0, 1).opacity).toBe(0); expect(chapterStyle(4, 1).opacity).toBe(1);
  });
  it('makes synthetic data deterministic and command context explicit', () => {
    expect(syntheticSignal('nominal')).toEqual(syntheticSignal('nominal'));
    expect(syntheticSignal('anomaly')).toHaveLength(120);
    expect(scriptedReview('command', true).nominal).toBe(true);
    expect(scriptedReview('command', false).nominal).toBe(false);
    expect(scriptedReview('anomaly', true).nominal).toBe(false);
  });
});
describe('video frame contract', () => {
  const desktop = { prefix: '/sequences/descent-v1/desktop/', count: 360, width: 1600, height: 900, fps: 24 };
  it('maps scroll endpoints and scrubs backwards exactly', () => {
    expect(frameIndex(0, 360)).toBe(0); expect(frameIndex(1, 360)).toBe(359);
    expect(frameIndex(.5, 360)).toBe(180); expect(frameIndex(.25, 360)).toBe(90);
    expect(frameIndex(-1, 360)).toBe(0); expect(frameIndex(3, 360)).toBe(359); expect(frameIndex(NaN, 360)).toBe(0);
    expect(frameURL(desktop, 23)).toBe('/sequences/descent-v1/desktop/frame-00023.webp');
  });
  it('accepts bounded local sequences and rejects remote or traversal paths', () => {
    expect(frameManifestSchema.safeParse({ version: 1, desktop }).success).toBe(true);
    for (const prefix of ['https://remote.example/', '/sequences/../desktop/', '/secret/']) expect(frameManifestSchema.safeParse({ version: 1, desktop: { ...desktop, prefix } }).success).toBe(false);
    expect(frameManifestSchema.safeParse({ version: 1, desktop: { ...desktop, count: 601 } }).success).toBe(false);
  });
});
