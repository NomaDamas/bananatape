import path from 'node:path';
import os from 'node:os';
import { mkdir, realpath, lstat } from 'node:fs/promises';

export function getProjectsRoot(env = process.env): string {
  return env.BANANATAPE_PROJECTS_DIR
    ? path.resolve(env.BANANATAPE_PROJECTS_DIR)
    : path.join(os.homedir(), 'Documents', 'BananaTape Projects');
}

export function getRuntimeDir(env = process.env): string {
  return env.BANANATAPE_HOME
    ? path.resolve(env.BANANATAPE_HOME)
    : path.join(os.homedir(), '.bananatape');
}

export function getRegistryPath(env = process.env): string {
  return path.join(getRuntimeDir(env), 'projects.json');
}

export function getRuntimeRegistryPath(env = process.env): string {
  return path.join(getRuntimeDir(env), 'runtime.json');
}

export function getProjectPath(projectId: string, env = process.env): string {
  return path.join(getProjectsRoot(env), projectId);
}

export function getManifestPath(projectRoot: string): string {
  return path.join(projectRoot, 'project.json');
}

export function getHistoryPath(projectRoot: string): string {
  return path.join(projectRoot, 'history.json');
}

export function getLive2DManifestPath(projectRoot: string): string {
  return path.join(projectRoot, 'live2d', 'manifest.json');
}

export async function ensureProjectDirectories(projectRoot: string): Promise<void> {
  await mkdir(path.join(projectRoot, 'assets'), { recursive: true });
  await mkdir(path.join(projectRoot, 'references'), { recursive: true });
  await mkdir(path.join(projectRoot, 'thumbnails'), { recursive: true });
  await mkdir(path.join(projectRoot, 'tmp'), { recursive: true });
}

export function assertProjectRelativePath(relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error('Path must be project-relative');
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'));
  if (normalized.startsWith('../') || normalized === '..' || normalized.includes('/../')) {
    throw new Error('Path escapes project root');
  }
  return normalized;
}

export async function resolveInsideProject(projectRoot: string, relativePath: string): Promise<string> {
  const safeRelative = assertProjectRelativePath(relativePath);
  const rootReal = await realpath(projectRoot);
  const target = path.resolve(rootReal, safeRelative);
  const parentReal = await realpath(path.dirname(target)).catch(() => path.dirname(target));
  if (parentReal !== rootReal && !parentReal.startsWith(`${rootReal}${path.sep}`)) {
    throw new Error('Path escapes project root');
  }
  return target;
}

export async function assertNoSymlink(filePath: string): Promise<void> {
  const stat = await lstat(filePath).catch(() => null);
  if (stat?.isSymbolicLink()) throw new Error('Symlinks are not allowed for project assets');
}
