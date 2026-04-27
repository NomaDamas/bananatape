import { NextResponse } from 'next/server';
import { getCurrentProjectSummary } from '@/lib/projects/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getCurrentProjectSummary());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message.includes('Unauthorized') || message.includes('session') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
