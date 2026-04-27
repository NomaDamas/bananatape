const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const ASSET_ID_PATTERN = /^(img|ref)_[a-zA-Z0-9_-]{8,100}$/;

export function slugifyProjectName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return slug || 'untitled';
}

export function assertValidProjectId(projectId: string): string {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Project id must use lowercase letters, numbers, and hyphens.');
  }
  return projectId;
}

export function assertValidAssetId(assetId: string): string {
  if (!ASSET_ID_PATTERN.test(assetId)) {
    throw new Error('Invalid asset id');
  }
  if (assetId.includes('..') || assetId.includes('/') || assetId.includes('\\')) {
    throw new Error('Invalid asset id');
  }
  return assetId;
}

export function sanitizeProjectName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Project name is required');
  if (trimmed.length > 120) throw new Error('Project name is too long');
  return trimmed;
}
