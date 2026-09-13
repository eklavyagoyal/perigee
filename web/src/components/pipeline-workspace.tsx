'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Arrow } from './brand';
import { experimentOptions, jobSchema, pipelineStatusSchema, samplesSchema, type CreateJob, type Experiment, type PipelineJob, type PipelineStatus, type Sample } from '@/lib/pipeline/contracts';

async function api<T>(url: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(data);
    throw new Error(error.success ? error.data.error.message : 'The request could not be completed.');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error('The response did not match the expected contract.');
  return parsed.data;
}

export function PipelineWorkspace({ initialStatus }: { initialStatus: PipelineStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [token, setToken] = useState('');
  const [experiment, setExperiment] = useState<Experiment>('m1-extrema-41-46');
  const [context, setContext] = useState<CreateJob['commandContext']>('none');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleId, setSampleId] = useState('');
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [resumeId, setResumeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const requestRef = useRef<{ body: string; key: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = loading || job?.status === 'queued' || job?.status === 'running';
  const jobId = job?.id;
  const jobStatus = job?.status;
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!jobId || !jobStatus || !['queued', 'running'].includes(jobStatus)) return;
    const abort = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!document.hidden) {
        try {
          const current = await api(`/api/pipeline/jobs/${encodeURIComponent(jobId!)}`, jobSchema, { headers: { Authorization: `Bearer ${token}` }, signal: abort.signal });
          if (abort.signal.aborted) return;
          setJob(current); setError('');
          if (['succeeded', 'failed'].includes(current.status)) return;
        } catch (failure) {
          if (abort.signal.aborted) return;
          setError(failure instanceof Error ? failure.message : 'Job status is temporarily unavailable.');
        }
      }
      if (!abort.signal.aborted) timeout = setTimeout(poll, 2500);
    }
    timeout = setTimeout(poll, 1500);
    return () => { abort.abort(); clearTimeout(timeout); };
  }, [jobId, jobStatus, token]); // Polling is scoped to the selected job and operator session.

  async function act(action: (signal: AbortSignal) => Promise<void>) {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError('');
    try { await action(current.signal); }
    catch (failure) { if (!current.signal.aborted) setError(failure instanceof Error ? failure.message : 'The request failed.'); }
    finally { if (!current.signal.aborted) setLoading(false); }
  }
  function changeExperiment(value: Experiment) {
    setExperiment(value); setContext('none'); setSamples([]); setSampleId(''); setJob(null); setConnected(false); setError(''); requestRef.current = null;
  }
  async function loadSamples() {
    await act(async signal => {
      const data = await api(`/api/pipeline/samples?experiment=${experiment}`, samplesSchema, { headers: { Authorization: `Bearer ${token}` }, signal });
      setSamples(data.samples); setSampleId(data.samples[0]?.id ?? ''); setConnected(true); setJob(null);
    });
  }
  async function submit() {
    const body = JSON.stringify({ contractVersion: 1, experiment, sampleId, commandContext: context } satisfies CreateJob);
    // Preserve the request identity after network failures: a timed-out submission may already exist.
    if (requestRef.current?.body !== body) requestRef.current = { body, key: crypto.randomUUID() };
    const key = requestRef.current.key;
    await act(async signal => {
      const data = await api('/api/pipeline/jobs', jobSchema, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body, signal });
      setJob(data); setResumeId(data.id);
    });
  }
  const selected = samples.find(sample => sample.id === sampleId);

  return <>
    <section className={`connection-banner ${connected ? 'connected' : ''}`} aria-live="polite"><div><span className="status-dot" /><strong>{connected ? 'Worker responded' : status.configured ? 'Worker configured · connection not checked' : 'Pipeline not connected'}</strong><p>{status.configured ? 'Load authorized samples to verify the service. No model results are simulated here.' : 'Set the server-side worker URL and operator access key to enable real inference. No job has been run.'}</p></div><button className="text-link" disabled={loading} onClick={() => act(async signal => { setStatus(await api('/api/pipeline/status', pipelineStatusSchema, { signal })); setConnected(false); })}>Refresh connection <Arrow /></button></section>
    <div className="workspace-grid">
      <section className="workspace-card" aria-labelledby="input-title"><span className="eyebrow">01 / INPUT</span><h2 id="input-title">Prepare a review.</h2>
        <label htmlFor="operator-key">Operator access key</label><input id="operator-key" type="password" autoComplete="off" value={token} disabled={Boolean(busy)} onChange={event => { setToken(event.target.value); setSamples([]); setSampleId(''); setConnected(false); setJob(null); }} placeholder="Kept in memory for this page only" />
        <p className="field-note">Private pilot access. This key is never saved in browser storage. Production multi-user authentication must replace this shared-key boundary.</p>
        <label htmlFor="experiment">Research experiment</label><select id="experiment" value={experiment} disabled={Boolean(busy)} onChange={event => changeExperiment(event.target.value as Experiment)}>{experimentOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><p className="field-note">{experimentOptions.find(option => option.id === experiment)?.detail}</p>
        <button className="workspace-secondary" disabled={!status.configured || token.length < 32 || Boolean(busy)} onClick={loadSamples}>Load available samples</button>
        <label htmlFor="sample">Versioned sample</label><select id="sample" value={sampleId} disabled={!samples.length || Boolean(busy)} onChange={event => { setSampleId(event.target.value); setJob(null); }}><option value="">{connected && !samples.length ? 'No samples available for this experiment' : 'Load samples from the worker first'}</option>{samples.map(sample => <option key={sample.id} value={sample.id}>{sample.id}</option>)}</select>
        {selected && <dl className="sample-details"><dt>Observed interval</dt><dd>{selected.observedStart} → {selected.observedEnd}</dd><dt>Classify from</dt><dd>{selected.decisionStart}</dd><dt>Dataset / transform</dt><dd>{selected.datasetVersion} / {selected.transformVersion}</dd><dt>Channels</dt><dd>{selected.channels.join(', ')}</dd></dl>}
        <label htmlFor="command-context">Command context</label><select id="command-context" value={context} disabled={experiment === 'm1-extrema-41-46' || Boolean(busy)} onChange={event => { setContext(event.target.value as CreateJob['commandContext']); setJob(null); }}><option value="none">Telemetry only</option><option value="strictly_previous">Strictly previous commands</option><option value="through_decision_time">Commands through decision time</option></select>
        <button className="button button-light workspace-submit" disabled={!status.configured || !selected || token.length < 32 || Boolean(busy)} onClick={submit}>{loading ? 'Contacting worker…' : busy ? 'Job in progress…' : 'Submit inference job'}<Arrow /></button><p className="field-note">Explicit submission may use worker/GPU resources. No training or spacecraft commands are started by this page.</p>
      </section>
      <section className="workspace-card result-card" aria-labelledby="result-title"><span className="eyebrow">02 / OBSERVATIONS</span><h2 id="result-title">Evidence, with provenance.</h2>
        <div aria-live="polite" aria-atomic="true">{!job ? <div className="empty-result"><span aria-hidden="true">⌁</span><h3>No inference result yet.</h3><p>A result appears only after a worker accepts and completes a job. The synthetic landing-page demo is separate.</p></div> : <><span className={`job-status ${job.status}`}>{job.status.toUpperCase()}</span><p className="job-id">Job {job.id}</p>{job.status === 'queued' && <p>The worker has accepted the job and placed it in its queue.</p>}{job.status === 'running' && <p>The worker is processing the selected input. You can keep this page open to follow the result.</p>}{job.status === 'failed' && <p>The worker reported a failed job: {job.error ?? 'inference_failed'}. No classification is available.</p>}{job.result && <div className="model-result"><h3>{job.result.classification}</h3><ul>{job.result.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul><dl className="sample-details"><dt>Model</dt><dd>{job.result.model.family} / {job.result.model.checkpoint}</dd><dt>Checkpoint revision</dt><dd>{job.result.model.revision}</dd><dt>Dataset / transform</dt><dd>{job.result.datasetVersion} / {job.result.transformVersion}</dd></dl><p className="field-note">Model-generated observations require engineering review. Fluency does not establish causation or correctness.</p></div>}</>}</div>
        <div className="resume-job"><label htmlFor="resume-job">Resume an existing job</label><input id="resume-job" value={resumeId} disabled={Boolean(busy)} onChange={event => setResumeId(event.target.value)} placeholder="Job identifier from the worker" /><button className="workspace-secondary" disabled={!status.configured || !resumeId || token.length < 32 || Boolean(busy)} onClick={() => act(async signal => { setJob(await api(`/api/pipeline/jobs/${encodeURIComponent(resumeId)}`, jobSchema, { headers: { Authorization: `Bearer ${token}` }, signal })); setConnected(true); })}>Load job status</button></div>
      </section>
    </div>
    {(jobStatus === 'queued' || jobStatus === 'running') && <p className="field-note"><button className="text-link" onClick={() => { setResumeId(jobId!); setJob(null); setError(''); }}>Stop following this job</button> — stops polling only; the worker continues. Keep the job ID to resume.</p>}
    {error && <div className="workspace-error" role="alert">{error}</div>}
  </>;
}
