export const SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL = 'JPEG, PNG, WebP, or GIF';

const SUPPORTED_REFERENCE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const SUPPORTED_REFERENCE_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
]);

export function isSupportedReferenceImageType(file: File): boolean {
  const mimeType = file.type.toLowerCase();
  if (SUPPORTED_REFERENCE_IMAGE_MIME_TYPES.has(mimeType)) {
    return true;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  return !!extension && SUPPORTED_REFERENCE_IMAGE_EXTENSIONS.has(extension);
}

export function isImageLikeFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) {
    return true;
  }

  return !!file.name.match(/\.(avif|bmp|heic|heif|ico|jfif|jpg|jpeg|png|svg|tif|tiff|webp|gif)$/i);
}
