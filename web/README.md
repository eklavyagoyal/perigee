# Perigee — web

The public face of [Perigee](../README.md): a Next.js App Router site with a
cinematic landing page and **Mission Control**, a static replay that walks one
real telemetry window through all five inference stages.

Accessible React typography and controls render *above* the visual, so the
exported MP4 and the PowerPoint stay text-free. Reported benchmark numbers are
scoped to a single snapshot ([`Docs/PITCH_REQUIREMENTS_CHECKLIST.md`](Docs/PITCH_REQUIREMENTS_CHECKLIST.md))
rather than mixed across experiments; dataset preparation and model training are
independent of this app and live in the repository root.

Mission Control needs no GPU, credentials or dataset download — it serves a
recorded run. See [`public/mission-control/README.md`](public/mission-control/README.md)
for exactly what that bundle does and does not establish.

## Run

Use Node.js 22.12+ and npm (tested locally on Node 26).

```sh
cd web
npm ci
npm run dev
```

- Website: http://127.0.0.1:5173/
- Empty demo workspace: http://127.0.0.1:5173/mission-control
- Configuration status: http://127.0.0.1:5173/api/pipeline/status

No credentials, dataset downloads or GPUs are needed to view the website. The demo has empty Overview, Dataset, Evaluation and Artifacts sections; navigation changes local UI state only. It never reads pipeline status or submits inference. Select sample and Run review are intentionally disabled. The former synthetic landing console and worker UI remain in source but are not mounted by either page.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

The browser tests start a local development server automatically, or reuse the server at port 5173. Run them without real pipeline environment variables. If needed, install the test browser with `npx playwright install chromium`; `PERIGEE_CHROMIUM` accepts an existing compatible executable. Tests use software WebGL, not research GPUs. Screenshots go to ignored `test-results/`.

`npm run start` serves the standalone production build, copies its public/static assets, and optionally loads your local `.env.local`. It binds to loopback port 5173 by default; `PORT` and `PERIGEE_HOST` override these preview settings. The container runs the standalone server directly, with secrets supplied by the deployment environment.

## Application boundaries

```text
React website
  /                   Website overlays, checklist results, approach and demo link
  /mission-control    Empty design preview; no API connection or sample fixtures

Preserved for future integration (not called by the current UI):
Next.js /api/pipeline/*
  Authentication, allowlisted input, schema validation, timeouts, secret isolation
          │ proposed HTTP contract, not connected by default
          ▼
Separate inference worker (not implemented by this website migration)
  Versioned samples, TimeNet/OpenTSLM, GPU inference, durable queue and job storage
```

Long-running inference and training must not run inside an HTTP request handler. The preserved adapter accepts a sample identifier and permitted experiment settings, not arbitrary file paths, labels, shell commands or model URLs. It is not connected to this design preview. A future worker owns numerical data and enforces input/target separation. See the [worker contract and integration checklist](Docs/PIPELINE_API.md).

`PIPELINE_API_URL`, `PIPELINE_CONTROL_TOKEN` and optional `PIPELINE_SERVICE_TOKEN` are **server-only** environment variables for future integration. Copy the structure of `.env.example` into your own ignored `.env.local` and supply actual values only when the worker is ready. Never use a `NEXT_PUBLIC_` prefix for credentials. The preserved, unmounted operator component keeps its access key in page memory, not browser storage; its submission flow must be reviewed before re-enabling it. No access-key field is shown in the current preview.

This is a private research-pilot access boundary, not production multi-user authentication. Before a public deployment, add identity/roles, per-user job authorization, distributed rate limiting, quotas, audit logs, TLS and suitable retention controls. No external deployment, worker connection, training run or GPU job was performed during the migration.

## Video handoff

The [ready-to-copy generation prompt](Docs/VIDEO_PROMPT.md) describes the continuous satellite → atmospheric entry → breakup → clouds shot, plus mobile framing. Obtain a clean, text-free master: the website renders accessible React typography and controls above it.

The current Three.js scene stays active until approved footage is available. Import a master from the `web/` directory:

```sh
npm run frames -- /absolute/path/master.mp4 --name descent-v1
# Optional matching portrait master:
npm run frames -- /absolute/path/master.mp4 --name descent-v2 --mobile /absolute/path/portrait.mp4
```

The script uses local FFmpeg to create WebP frames and a manifest in `public/sequences/<name>/`. It refuses to overwrite an existing sequence. It accepts 2–600 frames at 24 fps (at most 25 seconds); desktop output is 1600 × 900 and optional mobile output is 768 × 1366. Failed imports retain their partial output and do not emit a completed manifest. `FFMPEG_PATH` can select an installed encoder instead of the `ffmpeg-static` development dependency.

Activate the sequence by setting this **non-secret asset path** in `.env.local`, then restart or rebuild:

```dotenv
NEXT_PUBLIC_SCENE_MANIFEST=/sequences/descent-v1/manifest.json
```

The renderer loads frames incrementally, allows at most three concurrent frame requests and keeps at most 12 decoded frames (about 66 MiB at desktop output size, excluding canvas/GPU/browser caches). It supports reverse scrolling, nearest-loaded-frame fallback and a still first frame for reduced motion. The mobile variant is selected when the scene mounts; without a portrait master, the desktop image uses a centre crop. Match timing between variants and check the actual footage on low-power devices before launch. A cache bound is not a guarantee of total browser memory or smooth playback on every device.

There is no separate film page or player. A clean 20-second 1080p/24fps MP4 is available at `/films/perigee-descent-clean.mp4` and linked below the visual sequence. It is rendered directly from `src/scene.ts`, with no titles, logos, readouts or footer. The PowerPoint uses the same clean MP4 and a text-free first-frame poster. The live website continues to render the scene interactively; it does not autoplay the MP4 or download it on page load.

To reproduce this text-free film, supply a new output path:

```sh
npm run film:clean -- /absolute/path/new-clean-film.mp4
```

The renderer uses a temporary loopback-only scene page, local Chromium and FFmpeg. It never connects to the inference worker or a research GPU. PNG frames stream straight to the encoder; only six QA stills are retained beside the output. It refuses to overwrite an existing MP4. `PERIGEE_CHROMIUM` and `FFMPEG_PATH` can select installed tools. The export contains no UI text. React renders the website's text separately over the canvas; changing those overlays does not change the movie or PowerPoint.

Previous text-baked MP4/WebM showcase files remain recoverably archived in ignored `archive/films/`; those originals are not public deployment assets. Do not reuse them in the PowerPoint.

## Source map

- `src/app/`: routes, metadata, page layouts and API handlers.
- `src/components/`: React navigation, descent, checklist evidence and empty demo workspace. Earlier scripted/worker components are preserved but unmounted.
- `src/lib/pitch-content.ts`: explicitly scoped checklist benchmark, with a source-parity unit test.
- `src/lib/pipeline/`: shared Zod contract and server-only worker adapter.
- `src/scene.ts`: original Three.js spacecraft, Earth, plasma and breakup renderer; resources are disposed on navigation.
- `src/lib/frame-sequence.ts`: interchangeable image-sequence renderer.
- `src/lib/descent.ts`, `demo.ts`, `ambient-sound.ts`: scroll math, synthetic signals and opt-in sound.
- `src/app/pitch.css`: website overlays, checklist sections and responsive empty application shell; base styles remain in `style.css`, `evidence.css` and `app/workspace.css`.
- `tests/unit/`: input/authentication/error boundaries, research contracts, scroll math and frame-cache lifecycle.
- `tests/*.spec.ts`: Chromium desktop/mobile, keyboard, reduced motion, WebGL fallback, server rendering without JavaScript, Next navigation and assertions that the empty UI makes no pipeline requests. Adapter validation/authentication remain covered by unit tests; the unmounted operator UI no longer has an active browser-flow test.

## Deployment

This is now a Node.js application, **not** a `dist/` directory to upload to a static host. Use a Next-compatible Node host or the standalone build. For a standalone package, include `.next/standalone/`, copy `public/` into its `public/` directory and `.next/static/` into its `.next/static/` directory, then run its `server.js`. Configure the listening host/port and runtime server secrets through the hosting platform. Video asset configuration is public build-time configuration; import footage before building.

`Dockerfile` provides a standalone container recipe; it is not a deployed service and has not been validated against a running Docker daemon here. Build from `web/` so research data and GPU artifacts never enter the image context. Configure secrets at runtime, not as Docker build arguments.

## Scientific and visual boundaries

The trajectory, timing and heating are illustrative, not orbital simulation. Current pitch metrics follow the corrected event-grouped section of Docs/PITCH_REQUIREMENTS_CHECKLIST.md: 224 test windows, 112 nominal and 112 positive (Anomaly + Rare Event). Two-shot frozen Llama-3.2-3B: 50.45% accuracy, precision 1.000, recall 0.009; F1 and a fresh parsing count are not reported. Restricted classical baseline: 90.18% accuracy, P 1.000, R 0.804, F1 0.891. Five-feature classical: 92.86%, P 1.000, R 0.857, F1 0.923. Raw-values classical: 57.59%, P 0.623, R 0.384, F1 0.475. These have different feature sets and are not an isolated encoder ablation. OpenTSLM SP with sub-category-balanced sampling has now been retrained on the corrected split using an H200: 75.89% accuracy (170/224), P 0.837, R 0.643, F1 0.727. Confusion counts: TN 98, FP 14, FN 40, TP 72. Rare Event recall is 66.2% (49/74); Anomaly recall is 60.5% (23/38). It outperforms the two-shot LLM but remains behind the restricted classical baseline. The selected checkpoint was epoch 7, chosen by validation loss (0.4377). The checklist reports zero shared events after grouping by anomaly_id; this is not a chronological or flight validation. Mission Control retains its older saved predictions (F1 0.840) with an explicit historical-replay notice. Generated explanations are unvalidated. Checklist figures are reported, not independently reproduced here.

Research documentation remains authoritative about dataset channels and model readiness; additional local research files outside `web/` are not part of this web-only publication. Anonymous telemetry IDs are not assigned physical subsystem meanings based on historical failure statistics. Historical sources and their caveats are preserved in [CLAIMS.md](CLAIMS.md); visual provenance is in [ASSETS.md](ASSETS.md).

Verification: 40 unit tests and eight Chromium browser tests pass, alongside TypeScript, ESLint and the standalone production build; the tests assert that neither page makes pipeline requests. Worker adapter tests use mocks, not a real endpoint. Browser coverage is Chromium only — Safari, Firefox and real video delivery still need their own device testing.
