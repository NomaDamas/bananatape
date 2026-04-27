import { NextResponse } from 'next/server';
import { persistReferenceImage } from '@/lib/projects/asset-store';
import { clearProjectReferences, removeProjectReference } from '@/lib/projects/metadata-store';
import { isSupportedReferenceImageType, SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL } from '@/lib/images/reference-image-formats';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function toClientReference(reference: Awaited<ReturnType<typeof persistReferenceImage>>) {
  return {
    ...reference,
    assetUrl: `/api/projects/assets/${reference.assetId}`,
  };
}

export async function POST(request: Request) {
  try {
    const session = requireProjectSession();
    const formData = await request.formData();
    const files = formData.getAll('referenceImages').filter(isFile);

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one reference image is required' }, { status: 400 });
    }
    if (files.some((file) => !isSupportedReferenceImageType(file))) {
      return NextResponse.json(
        { error: `Unsupported image format. Please use ${SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL}.` },
        { status: 400 },
      );
    }

    const references = await Promise.all(files.map((file) => persistReferenceImage(session.projectRoot, file)));
    return NextResponse.json({ referenceImages: references.map(toClientReference) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to persist reference images';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = requireProjectSession();
    const url = new URL(request.url);
    const referenceId = url.searchParams.get('referenceId');
    if (referenceId) {
      const settings = await removeProjectReference(session.projectRoot, referenceId);
      return NextResponse.json({ success: true, referenceImages: settings.referenceImages });
    }
    const settings = await clearProjectReferences(session.projectRoot);
    return NextResponse.json({ success: true, referenceImages: settings.referenceImages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete reference image';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
