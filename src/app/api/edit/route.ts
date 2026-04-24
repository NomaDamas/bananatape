import { NextResponse } from 'next/server';
import { editImage } from '../../../lib/providers/openai-provider';
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const prompt = formData.get('prompt');
    const provider = formData.get('provider');
    const images = formData.getAll('images').filter(isFile);
    const maskImage = formData.get('maskImage');

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 },
      );
    }

    if (typeof provider !== 'string' || !provider.trim()) {
      return NextResponse.json(
        { error: 'provider is required' },
        { status: 400 },
      );
    }

    let imageDataUrl: string;

    if (provider === 'god-tibo') {
      if (images.length === 0) {
        return NextResponse.json(
          {
            error:
              'at least one image is required and must be a valid file for god-tibo',
          },
          { status: 400 },
        );
      }

      const imageDataUrls = await Promise.all(images.map(fileToDataUrl));

      imageDataUrl = await godTiboGenerate({
        prompt,
        images: imageDataUrls,
      });

      return NextResponse.json({
        success: true,
        imageDataUrl,
        prompt,
        provider: 'god-tibo',
      });
    }

    if (images.length > OPENAI_MAX_INPUT_IMAGES) {
      return NextResponse.json(
        { error: `OpenAI supports up to ${OPENAI_MAX_INPUT_IMAGES} total input images for edits` },
        { status: 400 },
      );
    }

    if (images.length === 0 || !isFile(maskImage)) {
      return NextResponse.json(
        {
          error:
            'at least one image and maskImage are required and must be valid files',
        },
        { status: 400 },
      );
    }

    imageDataUrl = await editImage({
      images,
      maskImage,
      prompt,
    });

    return NextResponse.json({
      success: true,
      imageDataUrl,
      prompt,
      provider: 'openai',
    });
  } catch (error) {
    console.error('Edit error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
