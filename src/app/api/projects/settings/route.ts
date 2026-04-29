import { NextResponse } from 'next/server';
import { readProjectSettings, updateProjectSettings } from '@/lib/projects/metadata-store';
import { normalizeLive2DProjectSettings } from '@/lib/live2d/contract';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

function referenceToClient(reference: Awaited<ReturnType<typeof readProjectSettings>>['referenceImages'][number]) {
  return {
    ...reference,
    assetUrl: `/api/projects/assets/${reference.assetId}`,
  };
}

export async function GET() {
  try {
    const session = requireProjectSession();
    const settings = await readProjectSettings(session.projectRoot);
    return NextResponse.json({
      ...settings,
      referenceImages: settings.referenceImages.map(referenceToClient),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No active project';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = requireProjectSession();
    const body = await request.json();
    const settings = await updateProjectSettings(session.projectRoot, {
      systemPrompt: typeof body.systemPrompt === 'string' ? body.systemPrompt : '',
      ...(body.live2d ? { live2d: normalizeLive2DProjectSettings(body.live2d) } : {}),
    });
    return NextResponse.json({
      ...settings,
      referenceImages: settings.referenceImages.map(referenceToClient),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update project settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
