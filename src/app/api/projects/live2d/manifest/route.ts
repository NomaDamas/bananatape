import { NextResponse } from 'next/server';
import { enableLive2DMode, readProjectHistory, readProjectSettings, writeLive2DManifest } from '@/lib/projects/metadata-store';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = requireProjectSession();
    const body = await request.json().catch(() => ({}));
    const selectedHistoryEntryId = typeof body.selectedHistoryEntryId === 'string'
      ? body.selectedHistoryEntryId
      : null;
    const manifest = await writeLive2DManifest(session.projectRoot, selectedHistoryEntryId);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to write Live2D manifest';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT() {
  try {
    const session = requireProjectSession();
    const settings = await enableLive2DMode(session.projectRoot);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enable Live2D mode';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const session = requireProjectSession();
    const [settings, history] = await Promise.all([
      readProjectSettings(session.projectRoot),
      readProjectHistory(session.projectRoot),
    ]);
    return NextResponse.json({
      live2d: settings.live2d,
      selectedHistoryEntryId: settings.live2d.selectedHistoryEntryId,
      historyCount: history.entries.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No active project';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
