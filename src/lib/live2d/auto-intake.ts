import type { Live2DAnnotation } from './contract';

export interface Live2DReferenceSheetPart {
  number: number;
  part: string;
  label: string;
  hiddenArea?: string;
}

export interface ReferenceSheetGridOptions {
  imageWidth: number;
  imageHeight: number;
}

export interface Live2DAutoIntakeResult {
  annotations: Live2DAnnotation[];
  detectedParts: string[];
  reviewRequired: true;
  scopeNote: string;
}

export const LIVE2D_REFERENCE_SHEET_PARTS: readonly Live2DReferenceSheetPart[] = [
  { number: 1, part: 'head_base', label: '01 head base', hiddenArea: 'face under bangs and jaw overlap' },
  { number: 2, part: 'face_base', label: '02 face without hair/eyes/mouth', hiddenArea: 'face under bangs' },
  { number: 3, part: 'neck', label: '03 neck', hiddenArea: 'neck under head and collar' },
  { number: 4, part: 'body_base', label: '04 body base', hiddenArea: 'torso under outfit and arms' },
  { number: 5, part: 'outfit_torso', label: '05 outfit torso', hiddenArea: 'torso under arms' },
  { number: 6, part: 'left_upper_arm', label: '06 left upper arm', hiddenArea: 'shoulder overlap under torso/hair' },
  { number: 7, part: 'left_forearm', label: '07 left forearm', hiddenArea: 'elbow overlap' },
  { number: 8, part: 'left_hand', label: '08 left hand', hiddenArea: 'wrist overlap' },
  { number: 9, part: 'right_upper_arm', label: '09 right upper arm', hiddenArea: 'shoulder overlap under torso/hair' },
  { number: 10, part: 'right_forearm', label: '10 right forearm', hiddenArea: 'elbow overlap' },
  { number: 11, part: 'right_hand', label: '11 right hand', hiddenArea: 'wrist overlap' },
  { number: 12, part: 'front_hair', label: '12 front hair / bangs', hiddenArea: 'hair roots under overlapping locks' },
  { number: 13, part: 'left_side_hair', label: '13 left side hair', hiddenArea: 'side hair under front hair' },
  { number: 14, part: 'right_side_hair', label: '14 right side hair', hiddenArea: 'side hair under front hair' },
  { number: 15, part: 'back_hair', label: '15 back hair', hiddenArea: 'back hair behind head and neck' },
  { number: 16, part: 'left_eye_white', label: '16 left eye white', hiddenArea: 'eye area under eyelids' },
  { number: 17, part: 'right_eye_white', label: '17 right eye white', hiddenArea: 'eye area under eyelids' },
  { number: 18, part: 'left_iris', label: '18 left iris', hiddenArea: 'iris under eyelids' },
  { number: 19, part: 'right_iris', label: '19 right iris', hiddenArea: 'iris under eyelids' },
  { number: 20, part: 'left_upper_eyelid', label: '20 left upper eyelid' },
  { number: 21, part: 'right_upper_eyelid', label: '21 right upper eyelid' },
  { number: 22, part: 'left_eyebrow', label: '22 left eyebrow', hiddenArea: 'brow area under bangs' },
  { number: 23, part: 'right_eyebrow', label: '23 right eyebrow', hiddenArea: 'brow area under bangs' },
  { number: 24, part: 'closed_mouth', label: '24 closed mouth' },
  { number: 25, part: 'open_mouth_interior', label: '25 open mouth interior', hiddenArea: 'inside mouth cavity' },
  { number: 26, part: 'mouth_teeth_tongue', label: '26 teeth and tongue', hiddenArea: 'inside mouth cavity' },
] as const;

const GRID_COLUMNS = 4;
const GRID_ROWS = 7;
const RIGHT_GRID_X = 0.5;
const GRID_OUTER_MARGIN_X = 0.035;
const GRID_OUTER_MARGIN_Y = 0.055;
const GRID_GAP_X = 0.018;
const GRID_GAP_Y = 0.018;

function roundNormalized(value: number): number {
  return Number(value.toFixed(6));
}

function assertValidImageSize({ imageWidth, imageHeight }: ReferenceSheetGridOptions): void {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('Live2D auto-intake requires positive finite imageWidth and imageHeight');
  }
}

export function shouldAutoIntakeLive2D(prompt: string, live2dEnabled: boolean): boolean {
  if (live2dEnabled) return true;
  const normalized = prompt.toLowerCase();
  return normalized.includes('live2d') && (
    normalized.includes('part sheet')
    || normalized.includes('reference sheet')
    || normalized.includes('separated parts')
    || normalized.includes('파츠')
  );
}

export function proposeReferenceSheetGridAnnotations(options: ReferenceSheetGridOptions): Live2DAnnotation[] {
  assertValidImageSize(options);

  const gridX = RIGHT_GRID_X + GRID_OUTER_MARGIN_X;
  const gridY = GRID_OUTER_MARGIN_Y;
  const gridWidth = 1 - RIGHT_GRID_X - (GRID_OUTER_MARGIN_X * 2);
  const gridHeight = 1 - (GRID_OUTER_MARGIN_Y * 2);
  const cellWidth = (gridWidth - (GRID_GAP_X * (GRID_COLUMNS - 1))) / GRID_COLUMNS;
  const cellHeight = (gridHeight - (GRID_GAP_Y * (GRID_ROWS - 1))) / GRID_ROWS;

  return LIVE2D_REFERENCE_SHEET_PARTS.map((part, index) => {
    const row = Math.floor(index / GRID_COLUMNS);
    const column = index % GRID_COLUMNS;
    return {
      id: `live2d-part-${String(part.number).padStart(2, '0')}`,
      kind: 'bbox',
      label: part.label,
      part: part.part,
      hiddenArea: part.hiddenArea,
      bbox: {
        x: roundNormalized(gridX + (column * (cellWidth + GRID_GAP_X))),
        y: roundNormalized(gridY + (row * (cellHeight + GRID_GAP_Y))),
        width: roundNormalized(cellWidth),
        height: roundNormalized(cellHeight),
      },
      note: 'Deterministic Live2D reference-sheet candidate box. Review required before export or rigging.',
    } satisfies Live2DAnnotation;
  });
}

export function createLive2DAutoIntake(options: ReferenceSheetGridOptions): Live2DAutoIntakeResult {
  const annotations = proposeReferenceSheetGridAnnotations(options);
  return {
    annotations,
    detectedParts: annotations.map((annotation) => annotation.part).filter((part): part is string => Boolean(part)),
    reviewRequired: true,
    scopeNote: 'Auto-intake creates candidate Live2D part boxes only. Review is required; this does not create a rigged Cubism model or .moc3.',
  };
}
