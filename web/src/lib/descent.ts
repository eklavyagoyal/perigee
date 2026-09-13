export const chapterStarts = [0, .21, .43, .64, .84, 1.05];
export const chapterPositions = [0, .28, .49, .70, .94];
export const chapterLabels = ['Orbit', 'First deviation', 'Atmospheric re-entry', 'Signal lost', 'Protect the mission'];

export function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function chapterAt(p: number) { return p < .21 ? 0 : p < .43 ? 1 : p < .64 ? 2 : p < .84 ? 3 : 4; }
export function chapterStyle(index: number, progress: number) {
  const enter = index === 0 ? 1 : smooth(chapterStarts[index], chapterStarts[index] + .035, progress);
  const exit = index === 4 ? 0 : smooth(chapterStarts[index + 1] - .045, chapterStarts[index + 1], progress);
  return { opacity: enter * (1 - exit), transform: `translateY(${(1 - enter) * 22 - exit * 15}px)` };
}
export interface SceneRenderer {
  ready: Promise<void>;
  render(progress: number, time: number, reduced?: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
