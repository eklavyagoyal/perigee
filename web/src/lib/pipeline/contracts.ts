import { z } from 'zod';

export const experimentSchema = z.enum(['m1-extrema-41-46', 'm1-command-14-21-29']);
export type Experiment = z.infer<typeof experimentSchema>;
export const commandContextSchema = z.enum(['none', 'strictly_previous', 'through_decision_time']);
const identifier = z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
export const jobIdSchema = identifier;
export const createJobSchema = z.object({
  contractVersion: z.literal(1),
  experiment: experimentSchema,
  sampleId: identifier,
  commandContext: commandContextSchema,
}).strict().refine(input => input.experiment !== 'm1-extrema-41-46' || input.commandContext === 'none', {
  message: 'The extrema experiment does not take command context.', path: ['commandContext'],
});
export type CreateJob = z.infer<typeof createJobSchema>;

export const sampleSchema = z.object({
  id: identifier,
  experiment: experimentSchema,
  datasetVersion: z.string().min(1).max(160),
  transformVersion: z.string().min(1).max(160),
  observedStart: z.iso.datetime(),
  observedEnd: z.iso.datetime(),
  decisionStart: z.iso.datetime(),
  channels: z.array(z.string().min(1).max(40)).min(1).max(32),
}).strict().refine(sample => Date.parse(sample.observedStart) < Date.parse(sample.decisionStart) && Date.parse(sample.decisionStart) < Date.parse(sample.observedEnd), 'Invalid window boundaries.');
export const samplesSchema = z.object({ contractVersion: z.literal(1), samples: z.array(sampleSchema).max(100) }).strict();
export type Sample = z.infer<typeof sampleSchema>;

export const jobSchema = z.object({
  contractVersion: z.literal(1),
  id: identifier,
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  createdAt: z.iso.datetime(),
  result: z.object({
    classification: z.enum(['nominal', 'anomaly', 'uncertain']),
    observations: z.array(z.string().min(1).max(2000)).max(20),
    model: z.object({ family: z.literal('OpenTSLM'), checkpoint: z.string().min(1).max(200), revision: z.string().min(1).max(128) }).strict(),
    datasetVersion: z.string().min(1).max(160),
    transformVersion: z.string().min(1).max(160),
  }).strict().optional(),
  error: z.enum(['input_unavailable', 'inference_failed', 'cancelled']).optional(),
}).strict()
  .refine(job => (job.status === 'succeeded') === Boolean(job.result), 'Only a successful job must contain a result.')
  .refine(job => job.status === 'failed' || !job.error, 'Only failed jobs may contain an error.');
export type PipelineJob = z.infer<typeof jobSchema>;

export const pipelineStatusSchema = z.object({ contractVersion: z.literal(1), configured: z.boolean(), connection: z.enum(['not_configured', 'configured_not_checked']), authenticationRequired: z.literal(true) });
export type PipelineStatus = z.infer<typeof pipelineStatusSchema>;
export const experimentOptions: { id: Experiment; label: string; detail: string }[] = [
  { id: 'm1-extrema-41-46', label: 'Mission 1 · channels 41–46', detail: 'Main research candidate. Extrema-preserving numerical inputs; no command context.' },
  { id: 'm1-command-14-21-29', label: 'Mission 1 · channels 14 / 21 / 29', detail: 'Command-context experiment. Compare permitted command-history settings.' },
];
