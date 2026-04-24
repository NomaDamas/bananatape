import { NextResponse } from 'next/server';
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
    return {
      prompt: formData.get('prompt'),
      provider: formData.get('provider'),
      size: formData.get('size'),
      quality: formData.get('quality'),
      referenceImages: formData.getAll('referenceImages').filter(isFile),
    };
  }

  const body = await request.json();
  return {
    prompt: body.prompt,
    provider: body.provider,
    size: body.size,
    quality: body.quality,
    referenceImages: [] as File[],
  };
}

export async function POST(request: Request) {
  try {
    const { prompt, provider, size, quality, referenceImages } = await parseGenerateRequest(request);

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 },
      );
    }

    let imageDataUrl: string;

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
      });
    } else if (referenceImages.length > 0) {
      imageDataUrl = await openaiEdit({
        images: referenceImages,
        prompt,
      });
    } else {
      imageDataUrl = await openaiGenerate({ prompt, size, quality });
    }

    return NextResponse.json({
      success: true,
      imageDataUrl,
      prompt,
      provider: provider ?? 'openai',
      referenceImageCount: referenceImages.length,
    });
  } catch (error) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
