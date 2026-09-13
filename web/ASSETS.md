# Visual assets and production

Created for this website on 2026-09-13. No stock spacecraft footage or external satellite model is required.

## Earth background

- File: [`public/images/orbital-earth.png`](public/images/orbital-earth.png)
- Dimensions: 1672 × 941 pixels.
- Provenance: generated with the built-in Imagegen tool, following the `imagegen` skill; copied unchanged into the project.
- Role: photographic-style Earth background plate. The spacecraft, heating, camera movement, clouds, and breakup are separately animated in code.
- The image is synthetic, not a NASA/ESA photograph or a scientific visualization.

Exact generation prompt:

> Use case: stylized-concept. Asset type: ultra-wide photorealistic background plate for a cinematic spacecraft safety website. Create a physically plausible, exceptionally cinematic view of the Earth from low orbit, looking tangentially across the planet. The dark curved Earth occupies the bottom 48 percent of the frame with an immense sweeping diagonal horizon from lower left to middle right, a razor-thin pale blue atmospheric rim, muted cobalt oceans, finely detailed layered white clouds and a few understated warm city lights on the shadowed hemisphere. Upper half is near-black empty space with very sparse faint stars and generous clean negative space for typography. A restrained warm sunrise is just beyond the far right edge; lovely subtle light catching cloud edges. Shot as large format aerospace cinematography, NASA photographic realism, deep ink blacks, silver-blue highlights, extraordinary natural detail, subtle film grain, elegant and atmospheric. Do NOT include any satellite or spacecraft: the spacecraft will be animated separately as a 3D model. No text, no interface, no logos, no labels, no borders, no fantasy nebulae, no lens flare rings. Make this a landscape cinematic image, approximately 16:9, highest available quality.

## Spacecraft and film

The satellite is original procedural Three.js geometry. Its solar-cell and foil textures are generated in the browser. Plasma and atmospheric haze use shaders; fragments use seeded procedural variation. All of these are illustrative artistic effects.

The previous showcase film was a local render of that scene with baked-in text: 20 seconds, 1920 × 1080, 24 fps, without audio. During the Next.js migration its MP4, WebM and manifest were moved recoverably to ignored `archive/films/`. The HTML-string entry point and its film composition were removed.

The replacement `public/films/perigee-descent-clean.mp4` is a fresh render of the same `src/scene.ts` scene: 20 seconds, 1920 × 1080, 24 fps, silent H.264. `scripts/render-clean-film.mjs` captures only the WebGL canvas, without any logo, title, chapter number, telemetry readout or footer. It does not crop or cover the original video. This file is identical to the replacement video embedded in `../outputs/perigee-jury-pitch.pptx` and delivered at `../outputs/perigee-descent.mp4`. The PowerPoint's poster is the clean first frame. The original text-baked exports remain archived.

The website also keeps its live cinematic canvas free of typography and controls. Navigation, the mission message, accessible controls and the illustrative-scenario caveat sit after the visual sequence. A download link exposes the clean MP4 without adding a separate film page or player.

Future scroll footage uses a clean external master and the provider-independent frame importer. See [the production prompt](Docs/VIDEO_PROMPT.md) and [README import instructions](README.md#video-handoff). No new visual assets or videos were generated during the Next.js migration.

Ambient sound on the interactive website is synthesized with Web Audio after an explicit click. It does not use a third-party recording.

## Typography and marks

DM Sans Variable and IBM Plex Mono are served locally from their Fontsource packages. Their license files are distributed with the corresponding npm packages. The orbital brand mark and favicon are original SVG geometry. PERIGEE is a proposed visual identity only; no trademark clearance is implied.

## Browser verification

The `browser:control-in-app-browser` skill was used to attempt the integrated preview. The browser runtime reported no available browser; its documented troubleshooting route also returned an empty browser list. Following that fallback boundary, verification used a separate local Playwright/Chromium process, not an alternative connection to a managed browser. Screenshots were inspected for desktop orbit, re-entry, plasma, final message, the console, and the mobile layouts. Browser subprocess execution required the local sandbox approval.

Imagegen informed the cinematic Earth art direction. The browser workflow informed the reduced-motion loading fix, spacecraft framing, and readable typography. The training pipeline and the other agent's data remain untouched.
