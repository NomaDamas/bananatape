import { NextResponse } from 'next/server';
import { persistImageResult } from '@/lib/projects/asset-store';
import { hasActiveProject, requireProjectSession } from '@/lib/projects/session';
import { isSupportedReferenceImageType, SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL } from '@/lib/images/reference-image-formats';
import { editImage } from '../../../lib/providers/openai-provider';
import { generateImage as godTiboGenerate } from '../../../lib/providers/god-tibo-provider';

const OPENAI_MAX_INPUT_IMAGES = 16;
const ANNOTATION_ONLY_EDIT_PROMPT = 'Apply the changes indicated by the annotations on the image.';

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  return `data:${file.type};base64,${base64}`;
}

export async function POST(request: Request) {
  try {
    const projectSession = hasActiveProject() ? await requireProjectSession() : null;
    const formData = await request.formData();

    const prompt = formData.get('prompt');
    const provider = formData.get('provider');
    const parentId = formData.get('parentId');
    const images = formData.getAll('images').filter(isFile);
    const maskImage = formData.get('maskImage');

    if (typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 },
      );
    }
    const submittedPrompt = prompt.trim() || ANNOTATION_ONLY_EDIT_PROMPT;

    if (typeof provider !== 'string' || !provider.trim()) {
      return NextResponse.json(
        { error: 'provider is required' },
        { status: 400 },
      );
    }

    let imageDataUrl: string;

    const uploadedImages = isFile(maskImage) ? [...images, maskImage] : images;
    if (uploadedImages.some((file) => !isSupportedReferenceImageType(file))) {
      return NextResponse.json(
        { error: `Unsupported image format. Please use ${SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL}.` },
        { status: 400 },
      );
    }

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
        prompt: submittedPrompt,
        images: imageDataUrls,
      });

      const response: Record<string, unknown> = {
        success: true,
        imageDataUrl,
        prompt: submittedPrompt,
        provider: 'god-tibo',
      };
      if (projectSession) {
        const persisted = await persistImageResult({
          projectRoot: projectSession.projectRoot,
          imageDataUrl,
          prompt: submittedPrompt,
          provider: 'god-tibo',
          type: 'edit',
          parentId: optionalString(parentId),
        });
        response.assetId = persisted.historyEntry.assetId;
        response.assetUrl = persisted.assetUrl;
        response.metadata = persisted.historyEntry;
      }
      return NextResponse.json(response);
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
      prompt: submittedPrompt,
    });

    const response: Record<string, unknown> = {
      success: true,
      imageDataUrl,
      prompt: submittedPrompt,
      provider: 'openai',
    };
    if (projectSession) {
      const persisted = await persistImageResult({
        projectRoot: projectSession.projectRoot,
        imageDataUrl,
        prompt: submittedPrompt,
        provider: 'openai',
        type: 'edit',
        parentId: optionalString(parentId),
      });
      response.assetId = persisted.historyEntry.assetId;
      response.assetUrl = persisted.assetUrl;
      response.metadata = persisted.historyEntry;
    }
    return NextResponse.json(response);
  } catch (error) {
    console.error('Edit error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
