import { NextResponse } from 'next/server';
import { deleteHistoryEntry } from '@/lib/projects/metadata-store';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const { entryId } = await params;
    const session = await requireProjectSession();
    const history = await deleteHistoryEntry(session.projectRoot, entryId);
    return NextResponse.json({ success: true, history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
