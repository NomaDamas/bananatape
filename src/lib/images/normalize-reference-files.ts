import {
  isImageLikeFile,
  isSupportedReferenceImageType,
} from '@/lib/images/reference-image-formats';

export interface NormalizeReferenceFilesResult {
  files: File[];
  convertedCount: number;
  rejectedCount: number;
  ignoredCount: number;
}

function convertCanvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function convertedPngName(file: File): string {
  const withoutExtension = file.name.replace(/\.[^.]+$/, '');
  return `${withoutExtension || 'reference-image'}.png`;
}

async function convertImageToPng(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.drawImage(bitmap, 0, 0);
    const blob = await convertCanvasToPngBlob(canvas);
    if (!blob) {
      return null;
    }

    return new File([blob], convertedPngName(file), {
      type: 'image/png',
      lastModified: Date.now(),
    });
  } catch {
    return null;
  } finally {
    bitmap?.close?.();
  }
}

export async function normalizeReferenceFiles(files: File[]): Promise<NormalizeReferenceFilesResult> {
  const normalizedFiles: File[] = [];
  let convertedCount = 0;
  let rejectedCount = 0;
  let ignoredCount = 0;

  for (const file of files) {
    if (!isImageLikeFile(file)) {
      ignoredCount += 1;
      continue;
    }

    if (isSupportedReferenceImageType(file)) {
      normalizedFiles.push(file);
      continue;
    }

    const convertedFile = await convertImageToPng(file);
    if (convertedFile) {
      normalizedFiles.push(convertedFile);
      convertedCount += 1;
    } else {
      rejectedCount += 1;
    }
  }

  return {
    files: normalizedFiles,
    convertedCount,
    rejectedCount,
    ignoredCount,
  };
}
