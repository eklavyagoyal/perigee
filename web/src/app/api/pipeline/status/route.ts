import { apiResponse, pipelineStatus } from '@/lib/pipeline/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return apiResponse(pipelineStatus); }
