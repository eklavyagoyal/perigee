import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { apiResponse, createJob, listSamples, pipelineStatus, readJob } from '@/lib/pipeline/server';
import { createJobSchema, jobSchema, sampleSchema } from '@/lib/pipeline/contracts';

const operator = 'test-only-operator-key-32-characters-minimum';
const service = 'test-only-private-service-key';
const key = '9f86d081-884c-4d65-959e-a2feaa0c55ad';
const input = { contractVersion: 1, experiment: 'm1-extrema-41-46', sampleId: 'm1-window-001', commandContext: 'none' };
const sample = { id: input.sampleId, experiment: input.experiment, datasetVersion: 'test-dataset', transformVersion: 'test-transform', observedStart: '2020-01-01T00:00:00Z', decisionStart: '2020-01-01T06:00:00Z', observedEnd: '2020-01-01T12:00:00Z', channels: ['41', '42', '43', '44', '45', '46'] };
const queued = { contractVersion: 1, id: 'job-001', status: 'queued', createdAt: '2026-09-13T10:00:00Z' };
const success = { ...queued, status: 'succeeded', result: { classification: 'uncertain', observations: ['Test fixture only.'], model: { family: 'OpenTSLM', checkpoint: 'test-checkpoint', revision: 'test-revision' }, datasetVersion: 'test-dataset', transformVersion: 'test-transform' } };
let worker: ReturnType<typeof vi.fn>;
function request(path = '/jobs', body: unknown = input, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:5173/api/pipeline${path}`, {
    method: path === '/jobs' ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${operator}`, 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers },
    body: path === '/jobs' ? JSON.stringify(body) : undefined,
  });
}
async function failure(action: () => unknown | Promise<unknown>, status: number, code: string) {
  const response = await apiResponse(action);
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const data = await response.json();
  expect(data.error.code).toBe(code);
  expect(JSON.stringify(data)).not.toContain(service);
  expect(JSON.stringify(data)).not.toContain(operator);
}
beforeEach(() => {
  vi.stubEnv('PIPELINE_API_URL', 'http://localhost:8080');
  vi.stubEnv('PIPELINE_CONTROL_TOKEN', operator);
  vi.stubEnv('PIPELINE_SERVICE_TOKEN', service);
  worker = vi.fn().mockResolvedValue(Response.json(queued));
  vi.stubGlobal('fetch', worker);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('private pipeline boundary', () => {
  it('exposes configuration state, never credentials or a fabricated health check', () => {
    expect(pipelineStatus()).toEqual({ contractVersion: 1, configured: true, connection: 'configured_not_checked', authenticationRequired: true });
    expect(worker).not.toHaveBeenCalled();
  });
  it.each(['', 'http://remote.example', 'https://user:password@example.com', 'https://worker.example/unsafe/path', 'https://worker.example?secret=x'])('fails closed for invalid worker configuration: %s', async url => {
    vi.stubEnv('PIPELINE_API_URL', url);
    expect(pipelineStatus().configured).toBe(false);
    await failure(() => createJob(request()), 503, 'pipeline_not_configured');
    expect(worker).not.toHaveBeenCalled();
  });
  it('fails closed with a short operator key', () => {
    vi.stubEnv('PIPELINE_CONTROL_TOKEN', 'weak');
    expect(pipelineStatus().configured).toBe(false);
  });
  it.each(['', 'Bearer wrong-key', operator])('rejects missing or incorrect authentication', async authorization => {
    await failure(() => createJob(request('/jobs', input, { Authorization: authorization })), 401, 'unauthorized');
    expect(worker).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests even with a valid key', async () => {
    await failure(() => createJob(request('/jobs', input, { Origin: 'https://other.example' })), 403, 'origin_not_allowed');
    expect(worker).not.toHaveBeenCalled();
  });
  it('accepts only explicit allowlisted input, not labels, paths or arbitrary worker URLs', async () => {
    for (const extra of [{ groundTruth: 'anomaly' }, { file: '../../etc/passwd' }, { workerUrl: 'https://evil.example' }]) {
      await failure(() => createJob(request('/jobs', { ...input, ...extra })), 400, 'invalid_input');
    }
    expect(worker).not.toHaveBeenCalled();
  });
  it('requires a request identity and JSON content type', async () => {
    await failure(() => createJob(request('/jobs', input, { 'Idempotency-Key': 'not-a-uuid' })), 400, 'invalid_request_id');
    await failure(() => createJob(request('/jobs', input, { 'Content-Type': 'text/plain' })), 415, 'unsupported_media_type');
  });
  it('rejects malformed and oversized bodies without contacting a worker', async () => {
    const broken = new Request('http://localhost:5173/api/pipeline/jobs', { method: 'POST', headers: request().headers, body: '{' });
    await failure(() => createJob(broken), 400, 'invalid_json');
    await failure(() => createJob(request('/jobs', { ...input, huge: 'x'.repeat(17_000) })), 413, 'body_too_large');
    expect(worker).not.toHaveBeenCalled();
  });
  it('forwards one job, the same idempotency key and only the service credential', async () => {
    const result = await createJob(request('/jobs', input, { Origin: 'http://localhost:5173' }));
    expect(result).toEqual(queued);
    expect(worker).toHaveBeenCalledTimes(1);
    const [url, options] = worker.mock.calls[0];
    expect(String(url)).toBe('http://localhost:8080/v1/jobs');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(input));
    expect(options.headers.get('Authorization')).toBe(`Bearer ${service}`);
    expect(options.headers.get('Idempotency-Key')).toBe(key);
    expect(options.redirect).toBe('error');
    expect(options.cache).toBe('no-store');
  });
  it('does not automatically retry a timed-out submission or expose upstream errors', async () => {
    worker.mockRejectedValue(new Error(`Internal error ${operator} ${service}`));
    await failure(() => createJob(request()), 502, 'worker_unavailable');
    expect(worker).toHaveBeenCalledTimes(1);
  });
  it.each([[404, 'not_found'], [409, 'job_conflict'], [429, 'worker_busy'], [500, 'worker_error']] as const)('sanitizes worker status %s', async (status, code) => {
    worker.mockResolvedValue(new Response(service, { status }));
    await failure(() => createJob(request()), status === 500 ? 502 : status, code);
  });
  it.each(['not-json', 'x'.repeat(256_001)])('rejects malformed or oversized upstream output', async body => {
    worker.mockResolvedValue(new Response(body));
    await failure(() => createJob(request()), 502, 'invalid_worker_response');
  });
  it('lists versioned samples and rejects a mismatched experiment', async () => {
    worker.mockResolvedValueOnce(Response.json({ contractVersion: 1, samples: [sample] }));
    expect((await listSamples(request('/samples?experiment=m1-extrema-41-46'))).samples).toHaveLength(1);
    worker.mockResolvedValueOnce(Response.json({ contractVersion: 1, samples: [{ ...sample, experiment: 'm1-command-14-21-29' }] }));
    await failure(() => listSamples(request('/samples?experiment=m1-extrema-41-46')), 502, 'invalid_worker_response');
  });
  it('rejects unknown experiments and unsafe job identifiers', async () => {
    await failure(() => listSamples(request('/samples?experiment=unknown')), 400, 'invalid_experiment');
    await failure(() => readJob(request('/jobs/anything'), '../secrets'), 400, 'invalid_job_id');
    expect(worker).not.toHaveBeenCalled();
  });
  it('rejects mismatched job identities and accepts a valid completed result', async () => {
    await failure(() => readJob(request('/jobs/job-002'), 'job-002'), 502, 'invalid_worker_response');
    worker.mockResolvedValueOnce(Response.json(success));
    expect((await readJob(request('/jobs/job-001'), 'job-001')).result?.model.family).toBe('OpenTSLM');
  });
  it('sanitizes unexpected application exceptions', async () => {
    await failure(() => { throw new Error(service); }, 500, 'internal_error');
  });
});

describe('versioned research contracts', () => {
  it('keeps command contexts out of the main extrema experiment', () => {
    expect(createJobSchema.safeParse({ ...input, commandContext: 'strictly_previous' }).success).toBe(false);
    expect(createJobSchema.safeParse({ ...input, experiment: 'm1-command-14-21-29', commandContext: 'strictly_previous' }).success).toBe(true);
  });
  it('requires chronological windows, including fractional timestamps', () => {
    expect(sampleSchema.safeParse(sample).success).toBe(true);
    expect(sampleSchema.safeParse({ ...sample, decisionStart: sample.observedEnd }).success).toBe(false);
    expect(sampleSchema.safeParse({ ...sample, observedStart: '2020-01-01T00:00:00Z', decisionStart: '2020-01-01T00:00:00.500Z' }).success).toBe(true);
  });
  it('requires an actual success and checkpoint provenance before accepting observations', () => {
    expect(jobSchema.safeParse({ ...queued, status: 'succeeded' }).success).toBe(false);
    expect(jobSchema.safeParse({ ...success, status: 'running' }).success).toBe(false);
    expect(jobSchema.safeParse({ ...success, error: 'inference_failed' }).success).toBe(false);
    expect(jobSchema.safeParse({ ...success, result: { ...success.result, model: { family: 'CNN' } } }).success).toBe(false);
  });
});
