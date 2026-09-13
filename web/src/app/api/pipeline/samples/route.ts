import { apiResponse, listSamples } from '@/lib/pipeline/server';
export const runtime = 'nodejs';
export async function GET(request: Request) { return apiResponse(() => listSamples(request)); }
