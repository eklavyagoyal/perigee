import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createJobSchema, experimentSchema, jobIdSchema, jobSchema, samplesSchema } from './contracts';

export class PipelineError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function configuration() {
  const api = process.env.PIPELINE_API_URL;
  const controlToken = process.env.PIPELINE_CONTROL_TOKEN;
  if (!api || !controlToken || controlToken.length < 32) return null;
  try {
    const url = new URL(api);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return { url, controlToken, serviceToken: process.env.PIPELINE_SERVICE_TOKEN };
  } catch { return null; }
}

export function pipelineStatus() {
  const configured = Boolean(configuration());
  return { contractVersion: 1 as const, configured, connection: configured ? 'configured_not_checked' as const : 'not_configured' as const, authenticationRequired: true as const };
}

function authorize(request: Request) {
  const config = configuration();
  if (!config) throw new PipelineError(503, 'pipeline_not_configured', 'No pipeline worker is configured. No inference has been run.');
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1] ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(token), digest(config.controlToken))) throw new PipelineError(401, 'unauthorized', 'An operator access key is required.');
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new PipelineError(403, 'origin_not_allowed', 'Cross-origin pipeline access is not allowed.');
  return config;
}

async function boundedJson(message: Request | Response, limit: number) {
  if (!message.body) throw new PipelineError(400, 'invalid_json', 'A JSON body is required.');
  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new PipelineError(413, 'body_too_large', 'The payload exceeds the allowed size.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new PipelineError(400, 'invalid_json', 'The request must contain valid JSON.'); }
}

async function worker<T>(config: NonNullable<ReturnType<typeof configuration>>, path: string, schema: z.ZodType<T>, options: { body?: unknown; idempotencyKey?: string } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (config.serviceToken) headers.set('Authorization', `Bearer ${config.serviceToken}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  try {
    const response = await fetch(new URL(path, config.url), {
      method: options.body ? 'POST' : 'GET', headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) throw new PipelineError(404, 'not_found', 'The requested worker resource was not found.');
    if (response.status === 409) throw new PipelineError(409, 'job_conflict', 'This request ID was already used for different input.');
    if (response.status === 429) throw new PipelineError(429, 'worker_busy', 'The worker is at capacity. Try again later with the same request ID.');
    if (!response.ok) throw new PipelineError(502, 'worker_error', 'The worker could not complete this request.');
    const parsed = schema.safeParse(await boundedJson(response, 256_000));
    if (!parsed.success) throw new PipelineError(502, 'invalid_worker_response', 'The worker response does not match the pipeline contract.');
    return parsed.data;
  } catch (error) {
    if (error instanceof PipelineError) {
      if (['invalid_json', 'body_too_large'].includes(error.code)) throw new PipelineError(502, 'invalid_worker_response', 'The worker response could not be validated.');
      throw error;
    }
    throw new PipelineError(502, 'worker_unavailable', 'The worker is unreachable or timed out. Submission status may be unknown; retry only with the same request ID.');
  }
}

export async function listSamples(request: Request) {
  const config = authorize(request);
  const experiment = experimentSchema.safeParse(new URL(request.url).searchParams.get('experiment'));
  if (!experiment.success) throw new PipelineError(400, 'invalid_experiment', 'Choose a supported research experiment.');
  const data = await worker(config, `/v1/samples?experiment=${experiment.data}`, samplesSchema);
  if (data.samples.some(sample => sample.experiment !== experiment.data)) throw new PipelineError(502, 'invalid_worker_response', 'The worker returned a sample from a different experiment.');
  return data;
}

export async function createJob(request: Request) {
  const config = authorize(request);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new PipelineError(415, 'unsupported_media_type', 'Use application/json.');
  const key = z.uuid().safeParse(request.headers.get('idempotency-key'));
  if (!key.success) throw new PipelineError(400, 'invalid_request_id', 'A UUID Idempotency-Key header is required.');
  const input = createJobSchema.safeParse(await boundedJson(request, 16_384));
  if (!input.success) throw new PipelineError(400, 'invalid_input', 'The request does not match a supported experiment and input contract.');
  return worker(config, '/v1/jobs', jobSchema, { body: input.data, idempotencyKey: key.data });
}

export async function readJob(request: Request, id: string) {
  const config = authorize(request);
  if (!jobIdSchema.safeParse(id).success) throw new PipelineError(400, 'invalid_job_id', 'Invalid job identifier.');
  const job = await worker(config, `/v1/jobs/${encodeURIComponent(id)}`, jobSchema);
  if (job.id !== id) throw new PipelineError(502, 'invalid_worker_response', 'The worker returned a different job identifier.');
  return job;
}

export async function apiResponse(action: () => unknown | Promise<unknown>, status = 200) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try { return Response.json(await action(), { status, headers }); }
  catch (error) {
    const known = error instanceof PipelineError;
    return Response.json({ error: { code: known ? error.code : 'internal_error', message: known ? error.message : 'The pipeline request could not be completed.' } }, { status: known ? error.status : 500, headers });
  }
}
