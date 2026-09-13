import { apiResponse, readJob } from '@/lib/pipeline/server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => readJob(request, (await context.params).id));
}
