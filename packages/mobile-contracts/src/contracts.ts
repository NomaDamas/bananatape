export const MOBILE_CONTRACT_SCHEMA_VERSION = 1 as const;

export const VALID_FIXTURE_NAMES = [
  'mobile-smoke-project',
  'desktop-v1-project-with-history',
  'desktop-v1-project-with-references',
  'desktop-project-with-magic-layer-fields',
] as const;

export const CORRUPT_FIXTURE_NAMES = ['corrupt-project-missing-history'] as const;

export const FIXTURE_IMAGE_NAMES = ['reference-banana.png', 'large-banana-source.jpg'] as const;

export const VALIDATION_ERROR_CODE = {
  fileMissing: 'file.missing',
  manifestInvalid: 'manifest.invalid',
  historyMissing: 'history.missing',
  historyInvalid: 'history.invalid',
  canvasInvalid: 'canvas.invalid',
  assetMissing: 'asset.missing',
  referenceMissing: 'reference.missing',
} as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODE)[keyof typeof VALIDATION_ERROR_CODE];

export type ContractValidationIssue = {
  readonly code: ValidationErrorCode;
  readonly path: string;
  readonly message: string;
};

export type ContractValidationResult =
  | { readonly ok: true; readonly project: ContractProject }
  | { readonly ok: false; readonly issues: readonly ContractValidationIssue[] };

export type Provider = 'openai' | 'god-tibo';

export type ProjectResultType = 'generate' | 'edit';

export type GenerationStatus = 'pending' | 'streaming' | 'ready' | 'error';

export type MagicLayerStatus = 'idle' | 'preparing' | 'segmenting' | 'ready' | 'error';

export type ProjectManifest = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settings?: ProjectSettings;
};

export type ProjectSettings = {
  readonly systemPrompt: string;
  readonly referenceImages: readonly ProjectReferenceImage[];
  readonly designContext?: string;
  readonly designContextFileName?: string;
};

export type ProjectReferenceImage = {
  readonly id: string;
  readonly assetId: string;
  readonly assetPath: string;
  readonly name: string;
  readonly mimeType: 'image/png' | 'image/jpeg';
  readonly createdAt: string;
};

export type ProjectHistory = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly entries: readonly ProjectHistoryEntry[];
};

export type ProjectHistoryEntry = {
  readonly id: string;
  readonly type: ProjectResultType;
  readonly provider: Provider;
  readonly prompt: string;
  readonly assetId: string;
  readonly assetPath: string;
  readonly thumbnailPath?: string | null;
  readonly parentId?: string | null;
  readonly createdAt: string;
  readonly timestamp: number;
};

export type CanvasFile = {
  readonly schemaVersion: 1;
  readonly settings: ProjectSettings;
  readonly canvas: CanvasState;
};

export type CanvasState = {
  readonly images: Record<string, CanvasImage>;
  readonly imageOrder: readonly string[];
  readonly focusedImageIds: readonly string[];
};

export type CanvasImage = {
  readonly id: string;
  readonly url: string;
  readonly assetId?: string;
  readonly size: Size;
  readonly position: Point;
  readonly parentId: string | null;
  readonly generationIndex: number;
  readonly prompt: string;
  readonly provider: Provider;
  readonly type: ProjectResultType;
  readonly createdAt: number;
  readonly paths: readonly DrawingPath[];
  readonly boxes: readonly BoundingBox[];
  readonly memos: readonly TextMemo[];
  readonly magicLayers?: readonly MagicLayer[];
  readonly magicLayerBaseUrl?: string;
  readonly magicLayerStatus?: MagicLayerStatus;
  readonly selectedMagicLayerId?: string | null;
  readonly status: GenerationStatus;
  readonly error?: string;
};

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type Size = {
  readonly width: number;
  readonly height: number;
};

export type DrawingPath = {
  readonly id: string;
  readonly tool: 'pen' | 'arrow';
  readonly points: readonly Point[];
  readonly color: string;
  readonly strokeWidth: number;
};

export type BoundingBox = {
  readonly id: string;
  readonly tool: 'box';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly status: 'pending' | 'review' | 'accepted';
};

export type TextMemo = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly color: string;
};

export type MagicLayer = {
  readonly id: string;
  readonly name: string;
  readonly maskDataUrl: string;
  readonly cutoutDataUrl: string;
  readonly sourceBounds: Rect;
  readonly position: Point;
  readonly hidden: boolean;
};

export type Rect = Size & Point;

export type ContractProject = {
  readonly manifest: ProjectManifest;
  readonly history: ProjectHistory;
  readonly canvas?: CanvasFile;
};
