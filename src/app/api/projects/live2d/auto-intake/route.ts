import { NextResponse } from 'next/server';
import { writeLive2DAutoIntakeManifest } from '@/lib/projects/metadata-store';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = requireProjectSession();
    const body = await request.json().catch(() => ({}));
    const selectedHistoryEntryId = typeof body.selectedHistoryEntryId === 'string'
      ? body.selectedHistoryEntryId
      : null;
    const imageWidth = Number(body.imageWidth ?? 1536);
    const imageHeight = Number(body.imageHeight ?? 1024);
    const result = await writeLive2DAutoIntakeManifest(session.projectRoot, {
      selectedHistoryEntryId,
      imageWidth,
      imageHeight,
    });
    return NextResponse.json({
      success: true,
      ...result,
      message: `Live2D intake draft created: ${result.annotationCount} candidate part boxes. Review labels before export.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run Live2D auto-intake';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
