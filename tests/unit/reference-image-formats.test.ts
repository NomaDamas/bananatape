import { describe, expect, it } from 'vitest';
import { isImageLikeFile, isSupportedReferenceImageType } from '../../src/lib/images/reference-image-formats';

describe('reference image formats', () => {
  it('accepts jpeg, png, webp, and gif uploads', () => {
    expect(isSupportedReferenceImageType(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedReferenceImageType(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedReferenceImageType(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe(true);
    expect(isSupportedReferenceImageType(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe(true);
  });

  it('treats unsupported image formats as image-like but not supported', () => {
    const avif = new File(['x'], 'reference.avif', { type: 'image/avif' });
    expect(isImageLikeFile(avif)).toBe(true);
    expect(isSupportedReferenceImageType(avif)).toBe(false);
  });

  it('uses extensions when browser MIME metadata is missing', () => {
    expect(isImageLikeFile(new File(['x'], 'reference.heic', { type: '' }))).toBe(true);
    expect(isSupportedReferenceImageType(new File(['x'], 'reference.jpeg', { type: '' }))).toBe(true);
  });
});
