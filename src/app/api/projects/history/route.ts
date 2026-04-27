import { NextResponse } from 'next/server';
import { readProjectHistory } from '@/lib/projects/metadata-store';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

function toClientEntry(entry: Awaited<ReturnType<typeof readProjectHistory>>['entries'][number]) {
  return {
    ...entry,
    assetUrl: `/api/projects/assets/${entry.assetId}`,
  };
}

export async function GET() {
  try {
    const session = requireProjectSession();
    const history = await readProjectHistory(session.projectRoot);
    return NextResponse.json({ ...history, entries: history.entries.map(toClientEntry) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
