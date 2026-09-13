import { frameIndex, frameManifestSchema, frameURL, type FrameVariant } from './frame-contract';
import type { SceneRenderer } from './descent';

/** Scroll scrubbing without video seeking. At most 12 decoded frames and 3 requests. */
export class FrameSequence implements SceneRenderer {
  readonly ready: Promise<void>;
  private context: CanvasRenderingContext2D;
  private variant?: FrameVariant;
  private cache = new Map<number, ImageBitmap>();
  private pending = new Set<number>();
  private failed = new Set<number>();
  private abort = new AbortController();
  private target = 0;
  private painted = -1;
  private disposed = false;
  private viewWidth = 1;
  private viewHeight = 1;

  constructor(private canvas: HTMLCanvasElement, manifest: string) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas is unavailable.');
    this.context = context;
    this.ready = this.initialize(manifest);
  }
  private async initialize(manifest: string) {
    if (!/^\/sequences\/[a-z0-9-]+\/manifest\.json$/.test(manifest)) throw new Error('Use a local sequence manifest.');
    const response = await fetch(manifest, { signal: this.abort.signal });
    if (!response.ok) throw new Error('Sequence manifest is unavailable.');
    const data = frameManifestSchema.parse(await response.json());
    this.variant = innerWidth < 760 && data.mobile ? data.mobile : data.desktop;
    await this.load(0);
    this.paint(); this.prefetch();
  }
  private async load(index: number) {
    this.pending.add(index);
    try {
      const response = await fetch(frameURL(this.variant!, index), { signal: this.abort.signal });
      if (!response.ok) throw new Error('Frame is unavailable.');
      const bitmap = await createImageBitmap(await response.blob());
      if (this.disposed) { bitmap.close(); return; }
      this.cache.set(index, bitmap);
      // Evict the frame farthest from the current scroll position, not the most recent one.
      while (this.cache.size > 12) {
        const farthest = [...this.cache.keys()].sort((a, b) => Math.abs(b - this.target) - Math.abs(a - this.target))[0];
        this.cache.get(farthest)!.close(); this.cache.delete(farthest);
      }
      this.paint();
    } catch (error) {
      this.failed.add(index);
      throw error;
    } finally { this.pending.delete(index); }
  }
  private prefetch() {
    if (!this.variant || this.disposed) return;
    const candidates = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(offset => this.target + offset);
    for (const index of candidates) {
      if (this.pending.size >= 3) break;
      if (index < 0 || index >= this.variant.count || this.cache.has(index) || this.pending.has(index) || this.failed.has(index)) continue;
      void this.load(index).catch(() => { /* Keep the last usable frame if one asset is unavailable. */ }).finally(() => this.prefetch());
    }
  }
  private paint() {
    if (this.disposed || !this.cache.size) return;
    const nearest = [...this.cache.keys()].sort((a, b) => Math.abs(a - this.target) - Math.abs(b - this.target))[0];
    if (nearest === this.painted) return;
    const bitmap = this.cache.get(nearest)!;
    const scale = Math.max(this.viewWidth / bitmap.width, this.viewHeight / bitmap.height);
    this.context.drawImage(bitmap, (this.viewWidth - bitmap.width * scale) / 2, (this.viewHeight - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    this.painted = nearest;
  }
  render(progress: number, _time: number, reducedMotion = false) {
    if (!this.variant || this.disposed) return;
    // Respect reduced motion with an actual still; text chapters remain scroll-accessible.
    this.target = reducedMotion ? 0 : frameIndex(progress, this.variant.count);
    this.paint(); this.prefetch();
  }
  resize(width: number, height: number) {
    this.viewWidth = width; this.viewHeight = height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.painted = -1; this.paint();
  }
  dispose() {
    this.disposed = true; this.abort.abort();
    for (const bitmap of this.cache.values()) bitmap.close();
    this.cache.clear();
  }
}
