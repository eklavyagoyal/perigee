# Website ↔ inference worker contract (proposal v1)

Implemented on the **website side** only. The research agent must implement or adapt a worker to this contract before setting `PIPELINE_API_URL`. This document does not claim that a trained checkpoint, queue, endpoint or GPU service already exists. The research plan in the repository’s root `Docs/` takes precedence if experiment details change; update schemas and tests together.

## Responsibilities and deployment boundary

Next.js hosts pages and short API requests. A separately deployed worker owns versioned telemetry, command filtering, numerical transforms, TimeNet/OpenTSLM, model loading, GPU scheduling, persistence and job authorization. Training is out of scope for this API. No spacecraft commanding is exposed.

The worker must return from job creation quickly. Next waits at most 10 seconds for each upstream response; it does not run or hold an inference task in memory. Queue state and idempotency must survive worker and Next restarts. A timeout during submission means **unknown submission status**, not proof that no job exists.

## Server configuration

| Variable | Meaning |
| --- | --- |
| `PIPELINE_API_URL` | Worker origin only, e.g. `https://worker.example`. HTTPS required except localhost/loopback development. Paths, credentials, queries and fragments are rejected. |
| `PIPELINE_CONTROL_TOKEN` | Random pilot operator secret, at least 32 characters. Stored server-side; manually entered by an authorized pilot operator. |
| `PIPELINE_SERVICE_TOKEN` | Optional separate worker-service Bearer token. Use this when the worker requires token authentication; otherwise secure the private service network or equivalent. |

Secrets must never be checked in, logged or prefixed `NEXT_PUBLIC_`. The website’s `server-only` import prevents importing the worker adapter into client code. Browser requests carry the operator Bearer key; upstream requests replace it with the separate service credential, if configured. Redirects are not followed. There is no arbitrary upstream URL supplied by the client.

The public status route reports only whether configuration is valid; it does not probe the worker or assert model readiness. Samples/results require authorization. Same-origin checks reject browser requests with a foreign Origin, but are not a substitute for authentication. With a reverse proxy, configure trusted host handling so the public origin matches the request origin. All API responses use `Cache-Control: no-store`.

## Endpoints

| Browser → Next.js | Next.js → worker | Purpose |
| --- | --- | --- |
| `GET /api/pipeline/status` | No upstream request | Configuration state, not a health result |
| `GET /api/pipeline/samples?experiment=<id>` | `GET /v1/samples?experiment=<id>` | Authorized, versioned inputs; at most 100 per response |
| `POST /api/pipeline/jobs` | `POST /v1/jobs` | Explicit inference submission; Next returns 202 with a validated job |
| `GET /api/pipeline/jobs/<id>` | `GET /v1/jobs/<id>` | Resume or poll a job |

The shared executable schema lives in `src/lib/pipeline/contracts.ts`. All sample, job and submission objects reject extra fields. Browser bodies are limited to 16 KiB and upstream JSON to 256,000 bytes. Identifiers are 1–128 characters, start with an ASCII letter/digit and contain only letters, digits, dot, underscore or hyphen. UTC timestamps are ISO 8601 with `Z`.

### Sample listing

```json
{
  "contractVersion": 1,
  "samples": [{
    "id": "m1-window-001",
    "experiment": "m1-extrema-41-46",
    "datasetVersion": "example-dataset-revision",
    "transformVersion": "example-transform-revision",
    "observedStart": "2020-01-01T00:00:00Z",
    "decisionStart": "2020-01-01T06:00:00Z",
    "observedEnd": "2020-01-01T12:00:00Z",
    "channels": ["41", "42", "43", "44", "45", "46"]
  }]
}
```

These are illustrative identifiers/timestamps, not supplied ESA samples. Require `observedStart < decisionStart < observedEnd`. Returned samples must match the requested experiment. The service must enforce experiment-specific window lengths, channel sets, dataset availability and access rights; the web boundary’s timestamp ordering check alone does not enforce the research protocol. Do not include anomaly labels, ground truth or evaluation-only metadata in this input response.

### Submit

Require `Content-Type: application/json` and an `Idempotency-Key` UUID in addition to authentication.

```json
{
  "contractVersion": 1,
  "experiment": "m1-extrema-41-46",
  "sampleId": "m1-window-001",
  "commandContext": "none"
}
```

Allowed experiments:

- `m1-extrema-41-46`: Mission 1 channels 41–46; main extrema-preserving numerical candidate. `commandContext` must be `none`. The current research plan proposes a 12-hour observed window, classification of the last six hours, mean/min/max per two-minute bin (18 numerical series × 360 bins). The worker, not the browser, implements and versions this transformation.
- `m1-command-14-21-29`: Mission 1 channels 14/21/29; context settings `none`, `strictly_previous`, `through_decision_time`. Implement the temporal cutoffs exactly as defined in the research plan, relative to that sample’s decision interval. Do not silently substitute the previous MSE/CNN baseline for native OpenTSLM.

For each authorized caller scope and idempotency key, atomically persist a fingerprint of the complete request and its job. Same key + same input returns the original job; same key + different input returns 409. Enforce this **at the worker or durable gateway**, not in a Next process-local map. The browser retains the same UUID for unchanged input after failure, but a reload loses that unsaved request identity. Do not submit again after a reload if acceptance is unknown; recover the existing job through worker records first. Successful submissions show the job ID, which can be re-entered in “Resume an existing job.”

### Job response

```json
{
  "contractVersion": 1,
  "id": "job-001",
  "status": "queued",
  "createdAt": "2026-09-13T10:00:00Z"
}
```

Statuses: `queued`, `running`, `succeeded`, `failed`. Only `succeeded` may and must have a `result`:

```json
{
  "classification": "uncertain",
  "observations": ["Example only: review the observed deviation against permitted context."],
  "model": {
    "family": "OpenTSLM",
    "checkpoint": "example-checkpoint",
    "revision": "immutable-checkpoint-revision"
  },
  "datasetVersion": "example-dataset-revision",
  "transformVersion": "example-transform-revision"
}
```

Classification is `nominal`, `anomaly` or `uncertain`. Observations are plain text (at most 20, each 2,000 characters); React renders them as text, not injected markup. Only failed jobs may carry `error`, limited to `input_unavailable`, `inference_failed`, `cancelled`. No stack traces, file paths, prompt dumps or arbitrary upstream errors are exposed.

The worker must persist the job’s original sample/experiment/context association and bind result provenance to that input. Next validates output shape and requested job identity, but cannot establish that a worker actually ran the claimed model or prevent leakage inside model preparation. Resolve provenance, permitted command history and evaluation separation in worker-side tests.

## Errors, polling and safety

Next errors use `{ "error": { "code": "...", "message": "..." } }`. Missing configuration returns 503, invalid credentials 401, foreign Origin 403, invalid input 400, oversized input 413 and incorrect content type 415. Upstream 404/409/429 are represented as safe not-found/conflict/capacity responses; other worker failures and invalid output return 502. Unexpected local failures return a generic 500. No automatic submission retries occur in the adapter.

The UI polls active jobs about every 2.5 seconds, pauses polling while the document is hidden and aborts polling on navigation. “Stop following” stops polling only, not inference. Cancellation is not implemented. Do not interpret closing a tab, an aborted HTTP request or a failed status poll as GPU job cancellation.

## Integration and public-launch checklist

1. Confirm experiment IDs and transformation revisions with the research owner; supply an authorized sample catalogue without evaluation labels.
2. Implement the three worker endpoints, service authorization and durable idempotency; test concurrent duplicate submissions and recovery after process restart.
3. Load the intended OpenTSLM checkpoint and TimeNet path, verify native numerical inputs and prevent leakage from targets/evaluation metadata. Publish immutable model/dataset/transform provenance.
4. Enforce sample/job access rights, queue limits, GPU quotas, bounded execution and result retention. Keep the service private.
5. Connect a development worker, then test one explicitly authorized sample end to end. Browser tests currently use mocks; they are not model-validation evidence.
6. Before exposing inference publicly, replace the shared pilot key with proper user sessions and roles, per-user job ownership checks, distributed rate limiting, audit logging and an operational error/observability policy. Add contact/legal/privacy material as appropriate.

The migration does not implement a durable queue, database, multi-tenant identity provider, Python inference API or training scheduler. Those are explicit integration requirements, not hidden frontend functionality.
