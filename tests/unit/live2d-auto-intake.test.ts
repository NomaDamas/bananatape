import { describe, expect, it } from 'vitest';
import { LIVE2D_REFERENCE_SHEET_PARTS, proposeReferenceSheetGridAnnotations } from '@/lib/live2d/auto-intake';

describe('Live2D reference sheet auto-intake', () => {
  it('exposes the stable 26-part reference-sheet taxonomy', () => {
    expect(LIVE2D_REFERENCE_SHEET_PARTS).toHaveLength(26);
    expect(LIVE2D_REFERENCE_SHEET_PARTS.map((part) => part.number)).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
    expect(LIVE2D_REFERENCE_SHEET_PARTS.map((part) => part.part)).toEqual([
      'head_base',
      'face_base',
      'neck',
      'body_base',
      'outfit_torso',
      'left_upper_arm',
      'left_forearm',
      'left_hand',
      'right_upper_arm',
      'right_forearm',
      'right_hand',
      'front_hair',
      'left_side_hair',
      'right_side_hair',
      'back_hair',
      'left_eye_white',
      'right_eye_white',
      'left_iris',
      'right_iris',
      'left_upper_eyelid',
      'right_upper_eyelid',
      'left_eyebrow',
      'right_eyebrow',
      'closed_mouth',
      'open_mouth_interior',
      'mouth_teeth_tongue',
    ]);
  });

  it('proposes 26 deterministic normalized bbox annotations for a 1536x1024 strict grid sheet', () => {
    const annotations = proposeReferenceSheetGridAnnotations({ imageWidth: 1536, imageHeight: 1024 });

    expect(annotations).toHaveLength(26);
    expect(annotations[0]).toMatchObject({
      id: 'live2d-part-01',
      kind: 'bbox',
      label: '01 head base',
      part: 'head_base',
      bbox: { x: 0.535, y: 0.055, width: 0.094, height: 0.111714 },
    });
    expect(annotations[1]).toMatchObject({
      id: 'live2d-part-02',
      part: 'face_base',
      bbox: { x: 0.647, y: 0.055, width: 0.094, height: 0.111714 },
    });
    expect(annotations[4]).toMatchObject({
      id: 'live2d-part-05',
      part: 'outfit_torso',
      bbox: { x: 0.535, y: 0.184714, width: 0.094, height: 0.111714 },
    });
    expect(annotations[25]).toMatchObject({
      id: 'live2d-part-26',
      part: 'mouth_teeth_tongue',
      bbox: { x: 0.647, y: 0.833286, width: 0.094, height: 0.111714 },
    });
    expect(annotations.every((annotation) => annotation.bbox && annotation.bbox.x >= 0.5 && annotation.bbox.x + annotation.bbox.width <= 1)).toBe(true);
    expect(annotations.every((annotation) => annotation.note?.includes('Review required'))).toBe(true);
  });

  it('fails clearly for invalid image sizes instead of guessing', () => {
    expect(() => proposeReferenceSheetGridAnnotations({ imageWidth: 0, imageHeight: 1024 })).toThrow('positive finite imageWidth and imageHeight');
    expect(() => proposeReferenceSheetGridAnnotations({ imageWidth: 1536, imageHeight: Number.NaN })).toThrow('positive finite imageWidth and imageHeight');
  });
});
