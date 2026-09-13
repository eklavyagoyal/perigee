import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameSequence } from '@/lib/frame-sequence';

let bitmaps: { width: number; height: number; index: number; close: ReturnType<typeof vi.fn> }[];
let draw: ReturnType<typeof vi.fn>;
let fetchFrame: ReturnType<typeof vi.fn>;
const manifest = { version: 1, desktop: { prefix: '/sequences/test/desktop/', count: 100, width: 1600, height: 900, fps: 24 }, mobile: { prefix: '/sequences/test/mobile/', count: 100, width: 768, height: 1366, fps: 24 } };
function create() {
  const canvas = { getContext: () => ({ drawImage: draw, setTransform: vi.fn() }), width: 1, height: 1 } as unknown as HTMLCanvasElement;
  return new FrameSequence(canvas, '/sequences/test/manifest.json');
}
beforeEach(() => {
  bitmaps = []; draw = vi.fn();
  vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('devicePixelRatio', 1);
  fetchFrame = vi.fn(async (url: string) => {
    if (url.endsWith('manifest.json')) return Response.json(manifest);
    const index = Number(url.match(/frame-(\d+)/)?.[1]);
    return { ok: true, blob: async () => index };
  });
  vi.stubGlobal('fetch', fetchFrame);
  vi.stubGlobal('createImageBitmap', vi.fn(async (index: number) => {
    const bitmap = { width: 1600, height: 900, index, close: vi.fn() };
    bitmaps.push(bitmap); return bitmap;
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('bounded scroll renderer', () => {
  it('scrubs in both directions, retains at most 12 decoded images and releases them on unmount', async () => {
    const scene = create(); await scene.ready;
    scene.resize(1440, 900);
    for (const [progress, expected] of [[.5, 50], [1, 99], [.2, 20]] as const) {
      scene.render(progress, 0);
      await vi.waitFor(() => expect(draw.mock.lastCall?.[0].index).toBe(expected));
      expect(bitmaps.filter(bitmap => !bitmap.close.mock.calls.length).length).toBeLessThanOrEqual(12);
    }
    scene.dispose();
    await vi.waitFor(() => expect(bitmaps.every(bitmap => bitmap.close.mock.calls.length === 1)).toBe(true));
  });
  it('uses the mobile variant when one is available and reduced motion always shows frame zero', async () => {
    vi.stubGlobal('innerWidth', 390);
    const scene = create(); await scene.ready;
    scene.render(1, 0, true);
    expect(draw.mock.lastCall?.[0].index).toBe(0);
    expect(fetchFrame.mock.calls.some(([url]) => String(url).includes('/mobile/'))).toBe(true);
    scene.dispose();
  });
  it('keeps a usable image if a later frame is missing', async () => {
    const scene = create(); await scene.ready;
    fetchFrame.mockResolvedValue({ ok: false });
    scene.render(1, 0);
    await vi.waitFor(() => expect(fetchFrame.mock.calls.some(([url]) => String(url).endsWith('frame-00099.webp'))).toBe(true));
    expect(draw.mock.lastCall?.[0]).toBeDefined();
    scene.dispose();
  });
  it('rejects remote manifests without fetching them', async () => {
    const scene = new FrameSequence({ getContext: () => ({ drawImage: draw }) } as unknown as HTMLCanvasElement, 'https://elsewhere.example/manifest.json');
    await expect(scene.ready).rejects.toThrow('local sequence');
    expect(fetchFrame).not.toHaveBeenCalled(); scene.dispose();
  });
});
