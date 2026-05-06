import { NextResponse } from 'next/server';
import { readProjectSettings, updateProjectSettings } from '@/lib/projects/metadata-store';
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
    const patch = {
      ...(typeof body.systemPrompt === 'string' ? { systemPrompt: body.systemPrompt } : {}),
    };
    const settings = await updateProjectSettings(session.projectRoot, patch);
    return NextResponse.json({
      ...settings,
      referenceImages: settings.referenceImages.map(referenceToClient),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update project settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
