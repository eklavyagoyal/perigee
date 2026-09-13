import { apiResponse, createJob } from '@/lib/pipeline/server';
export const runtime = 'nodejs';
export async function POST(request: Request) { return apiResponse(() => createJob(request), 202); }
