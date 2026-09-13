export type SceneSource = { kind: 'procedural' } | { kind: 'frames'; manifest: string };

// Set NEXT_PUBLIC_SCENE_MANIFEST to an approved local manifest after importing footage.
// This is a public asset path, never a credential. No video-generation API is used.
export const sceneSource: SceneSource = process.env.NEXT_PUBLIC_SCENE_MANIFEST
  ? { kind: 'frames', manifest: process.env.NEXT_PUBLIC_SCENE_MANIFEST }
  : { kind: 'procedural' };
