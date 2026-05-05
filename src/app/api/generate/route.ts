import { NextResponse } from 'next/server';
import { persistImageResult } from '@/lib/projects/asset-store';
import { hasActiveProject, requireProjectSession } from '@/lib/projects/session';
import { isSupportedReferenceImageType, SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL } from '@/lib/images/reference-image-formats';
import { parseConcreteOutputSize } from '@/lib/generation/output-size';
import { editImage as openaiEdit, generateImage as openaiGenerate } from '../../../lib/providers/openai-provider';
import { generateImage as godTiboGenerate } from '../../../lib/providers/god-tibo-provider';

const OPENAI_MAX_INPUT_IMAGES = 16;

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  return `data:${file.type};base64,${base64}`;
}

async function parseGenerateRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const hasSize = formData.has('size');
    const sizeRaw = formData.get('size');
    return {
      prompt: formData.get('prompt'),
      provider: formData.get('provider'),
      size: parseConcreteOutputSize(sizeRaw),
      sizeRaw,
      hasSize,
      quality: formData.get('quality'),
      referenceImages: formData.getAll('referenceImages').filter(isFile),
    };
  }

  const body = await request.json();
  const hasSize = Object.prototype.hasOwnProperty.call(body, 'size');
  const sizeRaw = hasSize ? body.size : null;
  return {
    prompt: body.prompt,
    provider: body.provider,
    size: parseConcreteOutputSize(sizeRaw),
    sizeRaw,
    hasSize,
    quality: body.quality,
    referenceImages: [] as File[],
  };
}

export async function POST(request: Request) {
  try {
    const projectSession = hasActiveProject() ? requireProjectSession() : null;
    const { prompt, provider, size, sizeRaw, hasSize, quality, referenceImages } = await parseGenerateRequest(request);

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 },
      );
    }

    if (typeof sizeRaw === 'string' && sizeRaw === 'auto') {
      return NextResponse.json(
        { error: "Resolve 'auto' on the client before submitting." },
        { status: 400 },
      );
    }

    if (hasSize && size === null) {
      return NextResponse.json(
        { error: 'Invalid size. Allowed: 1024x1024, 1536x1024, 1024x1536, 2048x2048, 2048x1152, 3840x2160, 2160x3840.' },
        { status: 400 },
      );
    }

    let imageDataUrl: string;

    if (referenceImages.some((file) => !isSupportedReferenceImageType(file))) {
      return NextResponse.json(
        { error: `Unsupported image format. Please use ${SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL}.` },
        { status: 400 },
      );
    }

    if (provider !== 'god-tibo' && referenceImages.length > OPENAI_MAX_INPUT_IMAGES) {
      return NextResponse.json(
        { error: `OpenAI supports up to ${OPENAI_MAX_INPUT_IMAGES} reference images for generation` },
        { status: 400 },
      );
    }

    if (provider === 'god-tibo') {
      const imageDataUrls = await Promise.all(referenceImages.map(fileToDataUrl));
      imageDataUrl = await godTiboGenerate({
        prompt,
        images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
        ...(typeof size === 'string' && size ? { size } : {}),
      });
    } else if (referenceImages.length > 0) {
      imageDataUrl = await openaiEdit({
        images: referenceImages,
        prompt,
        size: size ?? undefined,
      });
    } else {
      imageDataUrl = await openaiGenerate({ prompt, size: size ?? undefined, quality });
    }

    const response: Record<string, unknown> = {
      success: true,
      imageDataUrl,
      prompt,
      provider: provider ?? 'openai',
      referenceImageCount: referenceImages.length,
    };

    if (projectSession) {
      const persisted = await persistImageResult({
        projectRoot: projectSession.projectRoot,
        imageDataUrl,
        prompt,
        provider: (provider ?? 'openai') as 'openai' | 'god-tibo',
        type: 'generate',
      });
      response.assetId = persisted.historyEntry.assetId;
      response.assetUrl = persisted.assetUrl;
      response.metadata = persisted.historyEntry;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
